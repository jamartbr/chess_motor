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

    private readonly board: Board;

    constructor(mode: GameMode = GameMode.Classical) {
        this.board      = new Board();
        this.board.mode = mode;
    }

    // ── Board read API ───────────────────────────────────────────────────────

    get turn():             Color          { return this.board.turn; }
    get moveHistory():      readonly string[] { return this.board.moveHistory; }
    get whitePoints():      number         { return this.board.whiteControlPoints; }
    get blackPoints():      number         { return this.board.blackControlPoints; }
    get mode():             GameMode       { return this.board.mode; }

    getPiece(index: number): Piece | null {
        return this.board.getPiece(index);
    }

    /** 0x88 index → "e4" etc. */
    toAlgebraic(index: number): string {
        return this.board.toAlgebraic(index);
    }

    /** rank (0-7) + file (0-7) → 0x88 index */
    toIndex(rank: number, file: number): number {
        return this.board.idx(rank, file);
    }

    isOnBoard(index: number): boolean {
        return this.board.isOnBoard(index);
    }

    // ── Move API ─────────────────────────────────────────────────────────────

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
            throw new Error(`Illegal move: ${this.board.toAlgebraic(from)} → ${this.board.toAlgebraic(to)}`);
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

        return record;
    }

    /**
     * Undo the most recent move.
     * `record` must be the MoveRecord returned by `move()`.
     */
    undoMove(record: MoveRecord): void {
        execUndo(this.board, record, /*silent*/ false);
    }

    // ── Game-state queries ───────────────────────────────────────────────────

    /** Returns true when the side to move has no legal moves (checkmate or stalemate). */
    isGameOver(): boolean {
        return hasNoLegalMoves(this.board);
    }

    /** Returns true if the side to move is currently in check. */
    isCheck(): boolean {
        return isInCheck(this.board, this.board.turn);
    }

    /**
     * Determines the winner after `isGameOver()` returns true.
     *
     * Classical: the side that has no legal moves loses (if in check it's checkmate,
     *            otherwise stalemate → Draw).
     * Dominion:  highest accumulated territory points wins.
     */
    getWinner(): Color | 'Draw' {
        if (this.board.mode === GameMode.Classical) {
            if (isInCheck(this.board, this.board.turn)) {
                // Current player is in checkmate — opponent wins
                return this.board.enemy(this.board.turn);
            }
            return 'Draw'; // Stalemate
        }

        // Dominion
        const { whiteControlPoints: w, blackControlPoints: b } = this.board;
        if (w > b) return Color.White;
        if (b > w) return Color.Black;
        return 'Draw';
    }

    // ── Dominion helpers ─────────────────────────────────────────────────────

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

    // ── Utility ──────────────────────────────────────────────────────────────

    reset(): void {
        this.board.reset();
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