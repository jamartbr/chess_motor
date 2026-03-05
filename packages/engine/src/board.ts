import { Color, PieceType, GameMode } from './types';
import type { Piece } from './types';


interface Move {
  san: string; // "e4", "exd5+", etc.
  number: number;
}

interface State {
    // turn: Color;
    // whiteControlPoints: number;
    // BlackControlPoints: number;

    // moves: Move[] = [];


    // enPassant?: number | null;
    // promotion?: number | null;
}

interface CastlingRights {
    whiteQueenSide: boolean;
    whiteKingSide: boolean;
    blackQueenSide: boolean;
    blackKingSide: boolean;
}

export class Board {

    public mode: GameMode = GameMode.Classical;
        
    // A 128-slot array for the 0x88 representation
    private grid: (Piece | null)[] = new Array(128).fill(null);

    // Convert row/column to the 0x88 index
    private getIndex(rank: number, file: number): number {
        return (rank << 4) | file;
    }

    // Convert 0x88 index to algebraic notation
    private toAlgebraic(index: number): string {
        const file = index & 7;
        const rank = index >> 4;
        return String.fromCharCode(97 + file) + (rank + 1);
    }

    // Generate SAN notation
    private getSAN(from: number, to: number, piece: Piece, captured: Piece | null, promotionType?: PieceType): string {
        // Castling
        if (piece.type === PieceType.King) {
            if (to - from === 2) return "O-O";
            if (to - from === -2) return "O-O-O";
        }

        let san = "";

        if (piece.type !== PieceType.Pawn) {
            // Añadir inicial de la pieza (N, B, R, Q, K)
            const char = piece.type === PieceType.Knight ? 'N' : piece.type.charAt(0).toUpperCase();
            san += char;
            
            // TODO: desambiguación si dos piezas iguales llegan al mismo sitio
        }

        // Capture
        if (captured || (piece.type === PieceType.Pawn && to === this.enPassantSquare)) {
            if (piece.type === PieceType.Pawn) {
                san += this.toAlgebraic(from)[0]; // Peón indica columna de origen: "exd5"
            }
            san += "x";
        }

        // Casilla destino
        san += this.toAlgebraic(to);

        // Promotion
        if (promotionType && promotionType !== PieceType.Pawn && this.promotionSquare === to) {
            const char = promotionType === PieceType.Knight ? 'N' : promotionType.charAt(0).toUpperCase();
            san += "=" + char;
        }

        // Check for check or checkmate
        const enemyColor = piece.color === Color.White ? Color.Black : Color.White;
        const enemyKingIndex = this.findKing(enemyColor);
        
        if (this.isSquareAttacked(enemyKingIndex, piece.color)) {
            san += "+"; // Check
            
            // Verify if it's checkmate by testing if enemy has legal moves
            let hasLegalMoves = false;
            for (let i = 0; i < 128; i++) {
            if (this.isSquareOnBoard(i)) {
                const enemyPiece = this.getPieceAt(i);
                if (enemyPiece && enemyPiece.color === enemyColor) {
                const moves = this.getLegalMoves(i);
                if (moves.length > 0) {
                    hasLegalMoves = true;
                    break;
                }
                }
            }
            }
            
            if (!hasLegalMoves) {
            san = san.slice(0, -1) + "#"; // Checkmate replaces check
            }
        }
        
        return san;
    }

    private setPiece(rank: number, file:number, type: PieceType, color: Color): void {
        const index = this.getIndex(rank, file);
        this.grid[index] = { type, color };
    }

    public turn: Color = Color.White;
    public whiteControlPoints: number = 0;
    public blackControlPoints: number = 0;
    
    public castlingRights: CastlingRights = {
        whiteQueenSide: true,
        whiteKingSide: true,
        blackQueenSide: true,
        blackKingSide: true
    };

    private enPassantSquare: number | null = null;
    private promotionSquare: number | null = null;

    // States are stored in a stack
    // state 'attributes':
    //      - rights: interface with 4 boolean values, one for each rook/king castling right
    //      - enPassant: true if en passant capture is now plausible
    private stateStack: { rights: CastlingRights, enPassant: number | null, promotion: number | null }[] = [];

    // Store movements
    public moveHistory: string[] = [];

    public resetBoard(): void {
        this.grid.fill(null);

        this.whiteControlPoints = 0;
        this.blackControlPoints = 0;
        this.turn = Color.White;
        this.castlingRights = {
            whiteQueenSide: true,
            whiteKingSide: true,
            blackQueenSide: true,
            blackKingSide: true
        };

        const pieces: PieceType[] = [
            PieceType.Rook, PieceType.Knight, PieceType.Bishop, PieceType.Queen,
            PieceType.King, PieceType.Bishop, PieceType.Knight, PieceType.Rook
        ]

        for (let file = 0; file < 8; file++) {
            // 1. Place White's back rank
            this.setPiece(0, file, pieces[file]!, Color.White);
            // 2. Place White's pawns
            this.setPiece(1, file, PieceType.Pawn, Color.White);
            // 3. Place Black's pawns
            this.setPiece(6, file, PieceType.Pawn, Color.Black);
            // 4. Place Black's back rank
            this.setPiece(7, file, pieces[file]!, Color.Black);
        }

        // Reset move history
        this.moveHistory = [];
    }

    constructor() {
        this.resetBoard();
    }

    public isSquareOnBoard(index: number): boolean {
        return (index & 0x88) === 0;
    }

    public getPieceAt(index: number): Piece | null {
        if (!this.isSquareOnBoard(index)) return null;
        return this.grid[index];
    }

    private readonly knightOffsets = [33, 31, 18, 14, -33, -31, -18, -14];
    private readonly bishopOffsets = [15, 17, -15, -17];
    private readonly rookOffsets = [1, 16, -1, -16];

    private getOffsetSquares(offset: number, originIndex: number): number[] {
        const squares: number[] = [];
        let targetIndex = originIndex + offset;
        while (this.isSquareOnBoard(targetIndex)) {
            if (this.getPieceAt(targetIndex)) {
                squares.push(targetIndex);
                break;
            }
            squares.push(targetIndex);
            targetIndex += offset;
        }
        return squares;
    }

    public getKnightMoves(index: number): number[] {
        const piece = this.getPieceAt(index);
        if (!piece ) return [];

        const legalSquares: number[] = [];

        for (const offset of this.knightOffsets) {
            const targetIndex = index + offset;

            if (this.isSquareOnBoard(targetIndex)) {
                const targetPiece = this.getPieceAt(targetIndex);

                if (!targetPiece || targetPiece.color !== piece.color) {
                    legalSquares.push(targetIndex);
                }
            }
        }

        return legalSquares;
    }

    public getSlidingMoves(index: number, offsets: number[]): number[] {
        const piece = this.getPieceAt(index);

        const legalSquares: number[] = [];

        for (const offset of offsets) {
            const ray = this.getOffsetSquares(offset, index);
            if (ray.length === 0) continue;

            const lastSquare = ray[ray.length - 1];
            const lastPiece = this.getPieceAt(lastSquare);
            if (piece && lastPiece && lastPiece.color === piece.color) ray.pop();

            legalSquares.push(...ray);
        }

        return legalSquares;
    }

    private canCastleKingSide(isWhite: boolean, offset: number, enemy: Color): boolean {
        const rights = isWhite ? this.castlingRights.whiteKingSide : this.castlingRights.blackKingSide;
        if (!rights) return false;

        // Squares between King (e) and Rook (h) are f and g
        const f = offset + 5;
        const g = offset + 6;

        // Ensure squares between king and rook are empty
        if (this.getPieceAt(f) || this.getPieceAt(g)) return false;

        // King must not be in check, pass through check (f) or land in check (g)
        return (
            !this.isSquareAttacked(offset + 4, enemy) &&
            !this.isSquareAttacked(f, enemy) &&
            !this.isSquareAttacked(g, enemy)
        );
    }

    private canCastleQueenSide(isWhite: boolean, offset: number, enemy: Color): boolean {
        const rights = isWhite ? this.castlingRights.whiteQueenSide : this.castlingRights.blackQueenSide;
        if (!rights) return false;

        // Squares between King (e) and Rook (a) are d, c and b
        const d = offset + 3;
        const c = offset + 2;
        const b = offset + 1;
        const a = offset + 0;

        // Ensure squares between king and rook are empty
        if (this.getPieceAt(d) || this.getPieceAt(c) || this.getPieceAt(b)) return false;

        // King must not be in check, pass through check (d) or land in check (c)
        return (
            !this.isSquareAttacked(offset + 4, enemy) &&
            !this.isSquareAttacked(d, enemy) &&
            !this.isSquareAttacked(c, enemy)
        );
    }

    public getKingMoves(index: number): number[] {
        const piece = this.getPieceAt(index);
        if (!piece) return [];

        const legalSquares: number[] = [];

        for (const offset of [...this.bishopOffsets, ...this.rookOffsets]) {
            const targetIndex = index + offset;

            if (this.isSquareOnBoard(targetIndex)) {
                const targetPiece = this.getPieceAt(targetIndex);

                if (!targetPiece || targetPiece.color !== piece.color) {
                    legalSquares.push(targetIndex);
                }
            }
        }

        // Castling Logic
        const isWhite = piece.color === Color.White;
        const rankOffset = isWhite ? 0x00 : 0x70; // Rank 0 or Rank 7
        const enemyColor = isWhite ? Color.Black : Color.White;

        // 1. King-Side Castling
        if (this.canCastleKingSide(isWhite, rankOffset, enemyColor)) {
            legalSquares.push(index + 2); // e.g., g1 or g8
        }

        // 2. Queen-Side Castling
        if (this.canCastleQueenSide(isWhite, rankOffset, enemyColor)) {
            legalSquares.push(index - 2); // e.g., c1 or c8
        }
        
        return legalSquares;
    }

    public getPawnMoves(index: number): number[] {
        const piece = this.getPieceAt(index);
        if (!piece) return [];

        const legalSquares: number[] = [];

        // 1. Move foward 1 step
        const foward = piece.color === Color.White ? 16 : -16;
        const rank = index >> 4;

        let targetIndex = index + foward;
        if (this.isSquareOnBoard(index) && !this.getPieceAt(targetIndex)) {
            legalSquares.push(targetIndex);

            // 2. Move foward 2 steps if initial move
            const initialRank = (piece.color === Color.White && rank === 1) ||
                                (piece.color === Color.Black && rank === 6);
            targetIndex += foward;
            if (initialRank && !this.getPieceAt(targetIndex)) {
                legalSquares.push(targetIndex);
            } 
        }

        // 3. Captures
        const captureOffsets = piece.color === Color.White ? [15, 17] : [-15, -17];
        for (const offset of captureOffsets) {
            targetIndex = index + offset;

            if (this.isSquareOnBoard(targetIndex)) {
                const targetPiece = this.getPieceAt(targetIndex);

                // Standard capture
                if (targetPiece && targetPiece.color !== piece.color) {
                    legalSquares.push(targetIndex);
                }

                // En passant capture
                else if (targetIndex === this.enPassantSquare) {
                    legalSquares.push(targetIndex);
                }
            }
        }
        
        return legalSquares;
    }

    public getValidMoves(index: number): number[] {
        const piece = this.getPieceAt(index);
        if (!piece) return [];

        switch (piece.type) {
            case PieceType.Knight:
                return this.getKnightMoves(index);
            case PieceType.Bishop:
                return this.getSlidingMoves(index, this.bishopOffsets);
            case PieceType.Rook:
                return this.getSlidingMoves(index, this.rookOffsets);
            case PieceType.Queen:
                return this.getSlidingMoves(index, [...this.bishopOffsets, ...this.rookOffsets]);
            case PieceType.King:
                return this.getKingMoves(index);
            case PieceType.Pawn:
                return this.getPawnMoves(index);
            default:
                return [];
        }
    }

    private updateCastlingRights(from: number, to: number, piece: Piece | null): void {
        // If King moves
        if (piece?.type === PieceType.King) {
            if (piece.color === Color.White) {
            this.castlingRights.whiteKingSide = false;
            this.castlingRights.whiteQueenSide = false;
            } else {
            this.castlingRights.blackKingSide = false;
            this.castlingRights.blackQueenSide = false;
            }
        }

        // If a Rook moves OR is captured (check 'from' and 'to')
        const checkRook = (index: number) => {
            if (index === 0x00) this.castlingRights.whiteQueenSide = false;
            if (index === 0x07) this.castlingRights.whiteKingSide = false;
            if (index === 0x70) this.castlingRights.blackQueenSide = false;
            if (index === 0x77) this.castlingRights.blackKingSide = false;
        };

        checkRook(from);
        checkRook(to);
    }

    public makeMove(from: number, to: number, promotionType: PieceType = PieceType.Queen): Piece | null {
        
        // Save current state to the stack
        this.stateStack.push({
            rights: { ...this.castlingRights }, 
            enPassant: this.enPassantSquare,
            promotion: this.promotionSquare 
        });

        const piece = { ...this.grid[from]! };
        let captured = this.grid[to];

        // Generate SAN notation
        const san = this.getSAN(from, to, piece, captured, promotionType);

        // Handle en passant capture
        if (piece?.type === PieceType.Pawn && to === this.enPassantSquare) {
            const capturedPawnIndex = piece.color === Color.White ? to - 16 : to + 16;
            captured = this.grid[capturedPawnIndex];
            this.grid[capturedPawnIndex] = null;
        }

        // Handle castling
        if (piece?.type === PieceType.King && Math.abs(to - from) === 2) {
            const isKingSide = to > from;
            const rookFrom = isKingSide ? from + 3 : from - 4;
            const rookTo = isKingSide ? from + 1 : from - 1;
            
            // Move the Rook
            this.grid[rookTo] = this.grid[rookFrom];
            this.grid[rookFrom] = null;
        }

        // Standard move logic
        this.grid[to] = piece;
        this.grid[from] = null;

        // Update en passant target
        this.enPassantSquare = null; // Reset by default
        if (piece?.type === PieceType.Pawn && Math.abs(to - from) === 32) {
            this.enPassantSquare = (from + to) / 2; // The square in the middle
        }

        // Update promotion square
        const rank = to >> 4;
        this.promotionSquare = null; // Reset by default
        if (piece?.type === PieceType.Pawn && (rank === 0 || rank === 7)) {
            console.log("promotion")
            piece.type = promotionType;
            this.promotionSquare = to;
        }

        // Update castling rights
        this.updateCastlingRights(from, to, piece);

        // Update turn
        this.turn = this.turn === Color.White ? Color.Black : Color.White;

        // Update move history
        this.moveHistory.push(san);

        return captured;
    }

    public undoMove(from: number, to: number, captured: Piece | null): void {
        const state = this.stateStack.pop();
        if (!state) return; // Guard clause

        let piece = this.grid[to];

        // 1. Revert promotion if it happened
        if (piece && to === this.promotionSquare) {
            console.log("undoing promotion")
            piece.type = PieceType.Pawn;
        }

        // 2. Restore state flags
        this.castlingRights = { ...state.rights };
        this.promotionSquare = state.promotion;
        this.enPassantSquare = state.enPassant;

        // 3. Move the piece(s) back to origin
        this.grid[from] = piece;
        this.grid[to] = captured;

        // 4. Handle piece restoration when En Passant capture
        if (piece?.type === PieceType.Pawn && to === state.enPassant) {
            this.grid[to] = null; // Destination square must be empty
            const capturedPawnIndex = piece.color === Color.White ? to - 16 : to + 16;
            this.grid[capturedPawnIndex] = captured; // Put captured pawn back
        }

        // 5. Handle rook if it was a castling move
        if (piece?.type === PieceType.King && Math.abs(to - from) === 2) {
            const isKingSide = to > from;
            const rookFrom = isKingSide ? from + 3 : from - 4;
            const rookTo = isKingSide ? from + 1 : from - 1;
            this.grid[rookFrom] = this.grid[rookTo]; // Put Rook back in corner
            this.grid[rookTo] = null;                // Clear castling square
        }

        // 6. Restore turn
        this.turn = this.turn === Color.White ? Color.Black : Color.White;

        // 7. Restore move history
        this.moveHistory.pop();
    }

    /**
     * 
     * @param targetIndex 
     * @param attackerColor 
     * @returns 
     */
    public isSquareAttacked(targetIndex: number, attackerColor: Color): boolean {
        // 1. Check for knights
        for (const offset of this.knightOffsets) {
            const square = targetIndex + offset;
            if (this.isSquareOnBoard(square)) {
                const piece = this.getPieceAt(square);
                if (piece && piece.type === PieceType.Knight && piece.color === attackerColor) return true;
            }
        }

        /// 2. Check diagonally (Bishops/Queens)
        for (const offset of this.bishopOffsets) {
            let square = targetIndex + offset;
            while (this.isSquareOnBoard(square)) {
                const piece = this.getPieceAt(square);
                if (piece) {
                    if (piece.color === attackerColor && (piece.type === PieceType.Bishop || piece.type === PieceType.Queen)) return true;
                    break; // Blocked by any piece
                }
                square += offset;
            }
        }

        // 3. Check horizontally/vertically (Rooks/Queens)
        for (const offset of this.rookOffsets) {
            let square = targetIndex + offset;
            while (this.isSquareOnBoard(square)) {
                const piece = this.getPieceAt(square);
                if (piece) {
                    if (piece.color === attackerColor && (piece.type === PieceType.Rook || piece.type === PieceType.Queen)) return true;
                    break; // Blocked by any piece
                }
                square += offset;
            }
        }

        // 4. Check for pawns
        const pawnCaptureOffsets = attackerColor === Color.Black ? [15, 17] : [-15, -17];
        for (const offset of pawnCaptureOffsets) {
            const square = targetIndex + offset;
            if (this.isSquareOnBoard(square)) {
                const piece = this.getPieceAt(square);
                if (piece && piece.type === PieceType.Pawn && piece.color === attackerColor) return true;
            }
        }

        // 5. Check for enemy king
        for (const offset of [...this.bishopOffsets, ...this.rookOffsets]) {
            const square = targetIndex + offset;
            if (this.isSquareOnBoard(square)) {
                const piece = this.getPieceAt(square);
                if (piece && piece.type === PieceType.King && piece.color === attackerColor) return true;
            }
        }

        return false;
    }

    public getLegalMoves(fromIndex: number): number[] {
        const piece = this.getPieceAt(fromIndex);
        if (!piece) return [];

        const pseudoMoves = this.getValidMoves(fromIndex);
        const legalMoves = [];

        for (const toIndex of pseudoMoves) {
            // 1. Simulate move
            const captured = this.makeMove(fromIndex, toIndex);

            // 2. Check if the king is under attack
            const kingIndex = this.findKing(piece.color);
            const enemyColor = piece.color === Color.White ? Color.Black : Color.White;
            if (!this.isSquareAttacked(kingIndex, enemyColor)) {
                legalMoves.push(toIndex);
            }

            // 4. Undo move
            this.undoMove(fromIndex, toIndex, captured);
        }

        return legalMoves;
    }

    public findKing(color: Color): number {
        for (let i = 0; i < 128; i++) {
            if (this.isSquareOnBoard(i)) {
                const piece = this.getPieceAt(i);
                if (piece && piece.type === PieceType.King && piece.color === color) return i;
            }
        }
        return -1;
    }

    /**
     * Checks if the current player has any legal moves.
     * If they don't, the game is over.
     */
    public isGameOver(): boolean {
        for (let i = 0; i < 128; i++) {
            if (this.isSquareOnBoard(i)) {
                const piece = this.getPieceAt(i);
                if (piece && piece.color === this.turn) {
                    const moves = this.getLegalMoves(i);
                    if (moves.length > 0) return false;
                }
            }
        }
        return true;
    }

    /**
     * Determines the winner based on Dominion points.
     */
    public getDominionWinner(): Color | 'Draw' {
        if (this.whiteControlPoints > this.blackControlPoints) return Color.White;
        if (this.blackControlPoints > this.whiteControlPoints) return Color.Black;
        return 'Draw';
    }

    /**
     * Calculates the control for the entire board and updates points.
     * Called at the end of every turn.
     */
    public updateControlPoints(): void {
        // Only calculate points if we are in Dominion mode
        if (this.mode !== GameMode.Dominion) return;
        
        let currentTurnWhiteControl = 0;
        let currentTurnBlackControl = 0;

        // Iterate through all 128 squares (0x88 board)
        for (let i = 0; i < 128; i++) {
            if ((i & 0x88) === 0) { // Valid square
                const control = this.getSquareControl(i);
                if (control === Color.White) currentTurnWhiteControl++;
                else if (control === Color.Black) currentTurnBlackControl++;
            }
        }

        this.whiteControlPoints += currentTurnWhiteControl;
        this.blackControlPoints += currentTurnBlackControl;
    }

    /**
     * Determines square control based on your rules:
     * 1. Piece presence
     * 2. Attack balance (more attackers than defenders)
     */
    public getSquareControl(index: number): Color | null {
        const piece = this.grid[index];
        
        // Rule 1: If a piece is there, that player controls it
        if (piece) return piece.color;

        // Rule 2: Attack balance
        // You likely already have a method to count attackers for move validation
        const whiteAttackers = this.countAttackers(index, Color.White);
        const blackAttackers = this.countAttackers(index, Color.Black);

        if (whiteAttackers > blackAttackers) return Color.White;
        if (blackAttackers > whiteAttackers) return Color.Black;

        return null; // Neutral or contested equally
    }

    /**
     * Counts how many pieces of a specific color attack a target square.
     * This is essential for the "Dominion" control calculation.
     * @param targetIndex The 0x88 index of the square to check
     * @param attackerColor The color of the pieces we are looking for
     */
    public countAttackers(targetIndex: number, attackerColor: Color): number {
        let count = 0;

        // 1. Check for Knights
        for (const offset of this.knightOffsets) {
            const square = targetIndex + offset;
            if (this.isSquareOnBoard(square)) {
                const piece = this.getPieceAt(square);
                if (piece && piece.type === PieceType.Knight && piece.color === attackerColor) {
                    count++;
                }
            }
        }

        // 2. Check for Sliding Pieces (Bishops, Queens, Rooks)
        // We use raw loops here instead of getSlidingMoves for maximum performance
        const directions = [
            { dir: 16, types: [PieceType.Rook, PieceType.Queen] },   // North
            { dir: -16, types: [PieceType.Rook, PieceType.Queen] },  // South
            { dir: 1, types: [PieceType.Rook, PieceType.Queen] },    // East
            { dir: -1, types: [PieceType.Rook, PieceType.Queen] },   // West
            { dir: 17, types: [PieceType.Bishop, PieceType.Queen] }, // NE
            { dir: 15, types: [PieceType.Bishop, PieceType.Queen] }, // NW
            { dir: -17, types: [PieceType.Bishop, PieceType.Queen] },// SW
            { dir: -15, types: [PieceType.Bishop, PieceType.Queen] } // SE
        ];

        for (const { dir, types } of directions) {
            let square = targetIndex + dir;
            while (this.isSquareOnBoard(square)) {
                const piece = this.getPieceAt(square);
                if (piece) {
                    if (piece.color === attackerColor && types.includes(piece.type)) {
                        count++;
                    }
                    break; // Path is blocked by any piece
                }
                square += dir;
            }
        }

        // 3. Check for Pawns
        // If we want white attackers, we look "below" the square (indices 15, 17 away)
        const pawnOffsets = attackerColor === Color.White ? [-17, -15] : [17, 15];
        for (const offset of pawnOffsets) {
            const square = targetIndex + offset;
            if (this.isSquareOnBoard(square)) {
                const piece = this.getPieceAt(square);
                if (piece && piece.type === PieceType.Pawn && piece.color === attackerColor) {
                    count++;
                }
            }
        }

        // 4. Check for King
        const kingOffsets = [1, -1, 16, -16, 17, 15, -17, -15];
        for (const offset of kingOffsets) {
            const square = targetIndex + offset;
            if (this.isSquareOnBoard(square)) {
                const piece = this.getPieceAt(square);
                if (piece && piece.type === PieceType.King && piece.color === attackerColor) {
                    count++;
                }
            }
        }

        return count;
    }
}