import { Color, Piece, BoardGrid, PieceType } from './types'

interface CastlingRights {
    whiteQueenSide: boolean;
    whiteKingSide: boolean;
    blackQueenSide: boolean;
    blackKingSide: boolean;
}

export class Board {
        
    // A 128-slot array for the 0x88 representation
    private grid: (Piece | null)[] = new Array(128).fill(null);

    // Convert row/column to the 0x88 index
    private getIndex(rank: number, file: number): number {
        return (rank << 4) | file;
    }

    private setPiece(rank: number, file:number, type: PieceType, color: Color): void {
        const index = this.getIndex(rank, file);
        this.grid[index] = { type, color };
    }
    
    private castlingRights: CastlingRights = {
        whiteQueenSide: true,
        whiteKingSide: true,
        blackQueenSide: true,
        blackKingSide: true
    };

    private enPassantSquare: number | null = null;

    // The "Stack" to store historical state
    private stateStack: { rights: CastlingRights, enPassant: number | null }[] = [];

    public resetBoard(): void {
        this.grid.fill(null);

        const pieces: PieceType[] = [
            PieceType.Rook, PieceType.Knight, PieceType.Bishop, PieceType.Queen,
            PieceType.King, PieceType.Bishop, PieceType.Knight, PieceType.Rook
        ]

        for (let file = 0; file < 8; file++) {
            // 1. Place White's back rank
            this.setPiece(0, file, pieces[file], Color.White);
            // 2. Place White's pawns
            this.setPiece(1, file, PieceType.Pawn, Color.White);
            // 3. Place Black's pawns
            this.setPiece(6, file, PieceType.Pawn, Color.Black);
            // 4. Place Black's back rank
            this.setPiece(7, file, pieces[file], Color.Black);
        }
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
        if (!piece) return [];

        const legalSquares: number[] = [];

        for (const offset of offsets) {
            const ray = this.getOffsetSquares(offset, index);
            if (ray.length === 0) continue;

            const lastSquare = ray[ray.length - 1];
            const lastPiece = this.getPieceAt(lastSquare);
            if (lastPiece && lastPiece.color === piece.color) ray.pop();

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

        // TODO: en passant logic
        
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

    public makeMove(from: number, to: number): Piece | null {
        // Save current state to the stack
        this.stateStack.push({ 
            rights: { ...this.castlingRights }, 
            enPassant: this.enPassantSquare 
        });

        const piece = this.grid[from];
        let captured = this.grid[to];

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

        // Update castling rights
        this.updateCastlingRights(from, to, piece);

        return captured;
    }

    public undoMove(from: number, to: number, captured: Piece | null): void {
        const state = this.stateStack.pop();
        const piece = this.grid[to];

        // Restore pieces
        this.grid[from] = piece;
        this.grid[to] = captured;

        // Handle Rook if castling
        if (piece?.type === PieceType.King && Math.abs(to - from) === 2) {
            const isKingSide = to > from;
            const rookFrom = isKingSide ? from + 3 : from - 4;
            const rookTo = isKingSide ? from + 1 : from - 1;
            this.grid[rookFrom] = this.grid[rookTo];
            this.grid[rookTo] = null;
        }

        // Handle en passant
        if (piece?.type === PieceType.Pawn && to === state?.enPassant) {
            const capturedPawnIndex = piece.color === Color.White ? to - 16 : to + 16;
            this.grid[capturedPawnIndex] = captured;
        } else {
            this.grid[to] = captured; // Standard restoration
        }
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

        // 2. Check diagonally
        // No need to check color, getSlidingMoves removes same-color pieces
        for (const square of this.getSlidingMoves(targetIndex, this.bishopOffsets)) {
            const piece = this.getPieceAt(square);
            if (piece && (piece.type === PieceType.Bishop || piece.type === PieceType.Queen 
                || piece.type === PieceType.King))
            return true;
        }

        // 3. Check horizontally
        // No need to check color, getSlidingMoves removes same-color pieces
        for (const square of this.getSlidingMoves(targetIndex, this.rookOffsets)) {
            const piece = this.getPieceAt(square);
            if (piece && (piece.type === PieceType.Rook || piece.type === PieceType.Queen
                || piece.type === PieceType.King))
            return true;
        }

        // 4. Check for pawns (no en passant)
        const pawnCaptureOffsets = attackerColor === Color.Black ? [15, 17] : [-15, -17];
        for (const offset of pawnCaptureOffsets) {
            const square = targetIndex + offset;
            if (this.isSquareOnBoard(square)) {
                const piece = this.getPieceAt(square);
                if (piece && piece.type === PieceType.Pawn && piece.color === attackerColor) return true;
            }
        }

        // TODO: en passant logic

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
}