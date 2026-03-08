import { Color, PieceType, GameMode } from './types';
import type { Piece, CastlingRights, SavedState } from './types';

/**
 * Board
 * -----
 * Owns the raw 0x88 grid and all mutable game state
 * (turn, castling rights, en-passant square, promotion square, state stack).
 *
 * It intentionally contains NO move-generation or attack logic —
 * those live in MoveGenerator and AttackMap respectively.
 */
export class Board {

    // 0x88 grid
    readonly grid: (Piece | null)[] = new Array(128).fill(null);

    // Game state
    mode:             GameMode = GameMode.Classical;
    turn:             Color = Color.White;
    castlingRights:   CastlingRights = Board.defaultCastlingRights();
    enPassantSquare:  number | null = null;
    promotionSquare:  number | null = null;

    /**
     * Half-move clock for the 50-move rule.
     * Increments every half-move; resets to 0 on any pawn move or capture.
     */
    halfMoveClock: number = 0;

    /** Accumulated territory points (Dominion mode only). */
    whiteControlPoints: number = 0;
    blackControlPoints: number = 0;

    // State / history stacks
    /** Saved per-move state for undoMove. */
    readonly stateStack: SavedState[] = [];
    /** SAN strings, one entry per half-move. */
    readonly moveHistory: string[] = [];

    // Piece-letter lookup
    static readonly PIECE_LETTER: Record<PieceType, string> = {
        [PieceType.Knight]: 'N',
        [PieceType.Bishop]: 'B',
        [PieceType.Rook]:   'R',
        [PieceType.Queen]:  'Q',
        [PieceType.King]:   'K',
        [PieceType.Pawn]:   '',
    };

    // Construction / reset
    constructor() { this.reset(); }

    reset(): void {
        this.grid.fill(null);
        this.turn               = Color.White;
        this.castlingRights     = Board.defaultCastlingRights();
        this.enPassantSquare    = null;
        this.promotionSquare    = null;
        this.halfMoveClock      = 0;
        this.whiteControlPoints = 0;
        this.blackControlPoints = 0;
        this.stateStack.length  = 0;
        this.moveHistory.length = 0;

        const backRank: PieceType[] = [
            PieceType.Rook, PieceType.Knight, PieceType.Bishop, PieceType.Queen,
            PieceType.King, PieceType.Bishop, PieceType.Knight, PieceType.Rook,
        ];

        for (let file = 0; file < 8; file++) {
            this.setPiece(0, file, backRank[file]!, Color.White);
            this.setPiece(1, file, PieceType.Pawn,       Color.White);
            this.setPiece(6, file, PieceType.Pawn,       Color.Black);
            this.setPiece(7, file, backRank[file]!, Color.Black);
        }
    }

    // Grid helpers

    /** Returns true when `index` maps to a valid board square. */
    isOnBoard(index: number): boolean {
        return (index & 0x88) === 0;
    }

    /** rank 0-7, file 0-7 -> 0x88 index */
    idx(rank: number, file: number): number {
        return (rank << 4) | file;
    }

    /** 0x88 index -> algebraic square name, e.g. 0x04 -> "e1" */
    toAlgebraic(index: number): string {
        return String.fromCharCode(97 + (index & 7)) + ((index >> 4) + 1);
    }

    getPiece(index: number): Piece | null {
        return this.isOnBoard(index) ? this.grid[index] ?? null : null;
    }

    setPiece(rank: number, file: number, type: PieceType, color: Color): void {
        this.grid[this.idx(rank, file)] = { type, color };
    }

    setRaw(index: number, piece: Piece | null): void {
        this.grid[index] = piece;
    }

    enemy(color: Color): Color {
        return color === Color.White ? Color.Black : Color.White;
    }

    /** Locate the king of `color`. Returns -1 if not found (should never happen). */
    findKing(color: Color): number {
        for (let i = 0; i < 128; i++) {
            if (this.isOnBoard(i)) {
                const p = this.grid[i];
                if (p && p.type === PieceType.King && p.color === color) return i;
            }
        }
        return -1;
    }

    // Castling-rights helpers

    static defaultCastlingRights(): CastlingRights {
        return { whiteQueenSide: true, whiteKingSide: true, blackQueenSide: true, blackKingSide: true };
    }

    /**
     * Strip castling rights whenever a king or rook moves away from
     * its starting square, or when the destination rook square is captured.
     */
    updateCastlingRights(from: number, to: number, piece: Piece): void {
        if (piece.type === PieceType.King) {
            if (piece.color === Color.White) {
                this.castlingRights.whiteKingSide  = false;
                this.castlingRights.whiteQueenSide = false;
            } else {
                this.castlingRights.blackKingSide  = false;
                this.castlingRights.blackQueenSide = false;
            }
        }

        const strip = (sq: number) => {
            if (sq === 0x00) this.castlingRights.whiteQueenSide = false;
            if (sq === 0x07) this.castlingRights.whiteKingSide  = false;
            if (sq === 0x70) this.castlingRights.blackQueenSide = false;
            if (sq === 0x77) this.castlingRights.blackKingSide  = false;
        };
        strip(from);
        strip(to);
    }
}