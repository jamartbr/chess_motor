import { Color, GameMode, PieceType } from './types';
import type { Piece, MoveRecord } from './types';
import { Board } from './Board';
import { makeMove as execMake, undoMove as execUndo } from './MoveExecutor';
import { legalMoves, hasNoLegalMoves, isInCheck } from './MoveValidator';
import { buildSAN } from './Notation';
import { updateControlPoints, squareControl } from './DominionScorer';
import { isSquareAttacked, countAttackers } from './AttackMap';

export { Color, GameMode, PieceType };
export type { Piece, MoveRecord };

/**
 * Engine
 * ------
 * The single public entry point for the chess engine.
 *
 * Consumers import Engine and interact exclusively through its methods;
 * internal modules (Board, MoveGenerator, etc.) remain encapsulated.
 *
 * Typical caller workflow
 * -----------------------
 *   const engine = new Engine();
 *   engine.getLegalMoves(fromIndex);   // highlight squares
 *   engine.move(fromIndex, toIndex);   // apply player's move
 *   engine.isGameOver();               // poll result
 */
export class Engine {

    public readonly board: Board;

    /**
     * Maps a position key -> number of times it has been seen.
     * Used for threefold-repetition detection.
     * Lives on Engine (not Board) because repetition is a game-level concept
     * and should not be affected by silent search simulations.
     */
    public readonly positionHistory = new Map<string, number>();

    constructor(mode: GameMode = GameMode.Classical) {
        this.board      = new Board();
        this.board.mode = mode;
        this.positionHistory.set(this.positionKey(), 1); // Record the starting position
    }

    // Board read API

    get turn():             Color          { return this.board.turn; }
    get moveHistory():      readonly string[] { return this.board.moveHistory; }
    get whitePoints():      number         { return this.board.whiteControlPoints; }
    get blackPoints():      number         { return this.board.blackControlPoints; }
    get mode():             GameMode       { return this.board.mode; }

    getPiece(index: number): Piece | null {
        return this.board.getPiece(index);
    }

    /** 0x88 index -> "e4" etc. */
    toAlgebraic(index: number): string {
        return this.board.toAlgebraic(index);
    }

    /** rank (0-7) + file (0-7) -> 0x88 index */
    toIndex(rank: number, file: number): number {
        return this.board.idx(rank, file);
    }

    isOnBoard(index: number): boolean {
        return this.board.isOnBoard(index);
    }

    // Move API

    /**
     * Returns all legal target squares for the piece at `fromIndex`.
     * Returns [] if the square is empty or it is not that piece's turn.
     */
    getLegalMoves(fromIndex: number): number[] {
        const piece = this.board.getPiece(fromIndex);
        if (!piece || piece.color !== this.board.turn) return [];
        return legalMoves(this.board, fromIndex);
    }

    /**
     * Apply a move. Returns the MoveRecord (needed to call `undoMove`).
     * Throws if the move is not legal.
     *
     * @param from          0x88 origin index
     * @param to            0x88 destination index
     * @param promotionType Piece type to promote to (default: Queen)
     */
    move(from: number, to: number, promotionType: PieceType = PieceType.Queen): MoveRecord {
        // Validate
        const legal = legalMoves(this.board, from);
        if (!legal.includes(to)) {
            throw new Error(`Illegal move: ${this.board.toAlgebraic(from)} → ${this.board.toAlgebraic(to)}, legal moves where: ${legal}`);
        }

        // Detect en passant before the move is applied (board.enPassantSquare resets inside makeMove)
        const piece        = this.board.getPiece(from)!;
        const wasEnPassant = piece.type === PieceType.Pawn && to === this.board.enPassantSquare;
        const captured     = wasEnPassant
            ? this.board.getPiece(piece.color === Color.White ? to - 16 : to + 16)
            : this.board.getPiece(to);

        // Execute
        const record = execMake(this.board, from, to, promotionType, /*silent*/ false);

        // Build SAN now that the board reflects the new position
        const san = buildSAN(this.board, from, to, piece, captured, promotionType, wasEnPassant);
        record.san = san;

        // Overwrite the placeholder entry that makeMove pushed
        this.board.moveHistory[this.board.moveHistory.length - 1] = san;

        // Dominion scoring
        updateControlPoints(this.board);

        // Record position for threefold-repetition tracking
        const key = this.positionKey();
        this.positionHistory.set(key, (this.positionHistory.get(key) ?? 0) + 1);

        return record;
    }

    /**
     * Undo the most recent move.
     * `record` must be the MoveRecord returned by `move()`.
     */
    undoMove(record: MoveRecord): void {
        // Remove the position that was recorded when this move was made
        const key = this.positionKey();
        const count = (this.positionHistory.get(key) ?? 1) - 1;
        if (count <= 0) this.positionHistory.delete(key);
        else            this.positionHistory.set(key, count);

        execUndo(this.board, record, /*silent*/ false);
    }

    // Game-state queries

    /**
     * Returns true when the game is over for any reason:
     * checkmate, stalemate, threefold repetition, 50-move rule, or
     * insufficient material.
     */
    isGameOver(): boolean {
        return (
            hasNoLegalMoves(this.board) ||
            this.isThreefoldRepetition() ||
            this.isFiftyMoveRule() ||
            this.isInsufficientMaterial()
        );
    }

    /** Returns true if the side to move is currently in check. */
    isCheck(): boolean {
        return isInCheck(this.board, this.board.turn);
    }

    /**
     * Returns the reason the game ended, or null if it is still ongoing.
     * Useful for displaying a specific message to the player.
     */
    getDrawReason(): 'stalemate' | 'threefold' | 'fifty-move' | 'insufficient' | null {
        if (hasNoLegalMoves(this.board) && !isInCheck(this.board, this.board.turn)) return 'stalemate';
        if (this.isThreefoldRepetition()) return 'threefold';
        if (this.isFiftyMoveRule())       return 'fifty-move';
        if (this.isInsufficientMaterial()) return 'insufficient';
        return null;
    }

    /** True if the current position has occurred three or more times. */
    isThreefoldRepetition(): boolean {
        return (this.positionHistory.get(this.positionKey()) ?? 0) >= 3;
    }

    /** True if 50 full moves (100 half-moves) have passed without a pawn move or capture. */
    isFiftyMoveRule(): boolean {
        return this.board.halfMoveClock >= 100;
    }

    /**
     * True when neither side has enough material to deliver checkmate.
     * Covers the standard FIDE cases:
     *   - K vs K
     *   - K+B vs K
     *   - K+N vs K
     *   - K+B vs K+B (same coloured bishops)
     */
    isInsufficientMaterial(): boolean {
        const pieces = { white: [] as PieceType[], black: [] as PieceType[] };

        for (let i = 0; i < 128; i++) {
            if (!this.board.isOnBoard(i)) continue;
            const p = this.board.grid[i];
            if (!p || p.type === PieceType.King) continue;
            // Any pawn, rook, or queen means mate is still possible
            if (p.type === PieceType.Pawn ||
                p.type === PieceType.Rook ||
                p.type === PieceType.Queen) return false;
            if (p.color === Color.White) pieces.white.push(p.type);
            else                         pieces.black.push(p.type);
        }

        const w = pieces.white;
        const b = pieces.black;

        // K vs K
        if (w.length === 0 && b.length === 0) return true;

        // K+minor vs K
        if (w.length === 0 && b.length === 1) return true;
        if (b.length === 0 && w.length === 1) return true;

        // K+B vs K+B — only a draw if the bishops are on the same colour
        if (w.length === 1 && b.length === 1 &&
            w[0] === PieceType.Bishop && b[0] === PieceType.Bishop) {
            const whiteBishopSq = this.findPieceSquare(PieceType.Bishop, Color.White)!;
            const blackBishopSq = this.findPieceSquare(PieceType.Bishop, Color.Black)!;
            const sameColor =
                ((whiteBishopSq >> 4) + (whiteBishopSq & 7)) % 2 ===
                ((blackBishopSq >> 4) + (blackBishopSq & 7)) % 2;
            if (sameColor) return true;
        }

        return false;
    }

    /**
     * Determines the winner after `isGameOver()` returns true.
     *
     * Classical: checkmate -> loser is the side to move; all draws -> 'Draw'.
     * Dominion:  highest accumulated territory points wins.
     */
    getWinner(): Color | 'Draw' {
        if (this.board.mode === GameMode.Classical) {
            // Only a decisive result if it's checkmate specifically
            if (hasNoLegalMoves(this.board) && isInCheck(this.board, this.board.turn)) {
                return this.board.enemy(this.board.turn);
            }
            return 'Draw';
            // TODO: call getDrawReason();
        }

        // Dominion
        const { whiteControlPoints: w, blackControlPoints: b } = this.board;
        if (w > b) return Color.White;
        if (b > w) return Color.Black;
        return 'Draw';
    }

    // Dominion helpers

    /** Which color controls a square (or null if contested). */
    getSquareControl(index: number): Color | null {
        return squareControl(this.board, index);
    }

    countAttackers(index: number, color: Color): number {
        return countAttackers(this.board, index, color);
    }

    isSquareAttacked(index: number, byColor: Color): boolean {
        return isSquareAttacked(this.board, index, byColor);
    }

    // Utility

    reset(): void {
        this.board.reset();
        this.positionHistory.clear();
        this.positionHistory.set(this.positionKey(), 1);
    }

    // Private helpers

    /**
     * Produces a compact string that uniquely identifies the current position,
     * including side to move, castling rights and en-passant square.
     *
     * Format: "<grid>|<turn>|<castling>|<enPassant>"
     */
    public positionKey(): string {
        let key = '';
        for (let i = 0; i < 128; i++) {
            if (!this.board.isOnBoard(i)) continue;
            const p = this.board.grid[i];
            key += p ? `${p.color[0]}${Board.PIECE_LETTER[p.type] || 'P'}` : '-';
        }
        const r = this.board.castlingRights;
        key += `|${this.board.turn[0]}`;
        key += `|${r.whiteKingSide ? 'K' : ''}${r.whiteQueenSide ? 'Q' : ''}${r.blackKingSide ? 'k' : ''}${r.blackQueenSide ? 'q' : ''}`;
        key += `|${this.board.enPassantSquare ?? '-'}`
        return key;
    }

    /** Returns the 0x88 index of the first piece matching type+color, or null. */
    public findPieceSquare(type: PieceType, color: Color): number | null {
        for (let i = 0; i < 128; i++) {
            if (!this.board.isOnBoard(i)) continue;
            const p = this.board.grid[i];
            if (p && p.type === type && p.color === color) return i;
        }
        return null;
    }

    /**
     * Dump the board to the console in a human-readable grid.
     * Useful during development.
     */
    debugPrint(): void {
        const SYMBOLS: Record<string, Record<string, string>> = {
            [Color.White]: {
                [PieceType.King]:   '♔', [PieceType.Queen]:  '♕',
                [PieceType.Rook]:   '♖', [PieceType.Bishop]: '♗',
                [PieceType.Knight]: '♘', [PieceType.Pawn]:   '♙',
            },
            [Color.Black]: {
                [PieceType.King]:   '♚', [PieceType.Queen]:  '♛',
                [PieceType.Rook]:   '♜', [PieceType.Bishop]: '♝',
                [PieceType.Knight]: '♞', [PieceType.Pawn]:   '♟',
            },
        };

        const rows: string[] = [];
        for (let rank = 7; rank >= 0; rank--) {
            let row = `${rank + 1} `;
            for (let file = 0; file < 8; file++) {
                const p = this.board.getPiece(this.board.idx(rank, file));
                row += p ? SYMBOLS[p.color]![p.type]! : '·';
                row += ' ';
            }
            rows.push(row);
        }
        rows.push('  a b c d e f g h');
        console.log(rows.join('\n'));
    }
}