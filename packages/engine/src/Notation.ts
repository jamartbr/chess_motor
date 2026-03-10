import { Color, PieceType } from './types';
import type { Piece } from './types';
import { Board } from './Board';
import { isSquareAttacked } from './AttackMap';
import { legalMoves, hasNoLegalMoves, isInCheck } from './MoveValidator';

/**
 * Notation
 * --------
 * Converts a completed half-move into Standard Algebraic Notation.
 *
 * `buildSAN` is called *after* `makeMove` has already been applied, so
 * the board reflects the position following the move. This lets us detect
 * check / checkmate directly.
 *
 * Parameters describe the move that was just played (not the position after).
 */
export function buildSAN(
    board:         Board,
    from:          number,
    to:            number,
    piece:         Piece,             // piece as it was when it moved (pre-promotion type)
    captured:      Piece | null,
    promotionType: PieceType,
    wasEnPassant:  boolean,
): string {

    // Castling
    if (piece.type === PieceType.King) {
        const diff = to - from;
        if (diff === 2)  return decorateCheck(board, piece.color, 'O-O');
        if (diff === -2) return decorateCheck(board, piece.color, 'O-O-O');
    }

    let san = '';

    // Piece letter
    if (piece.type !== PieceType.Pawn) {
        san += Board.PIECE_LETTER[piece.type];
    }

    // Disambiguation: check if another piece of the same type can reach `to`
    if (piece.type !== PieceType.Pawn) {
        const ambiguous = findAmbiguousPieces(board, from, to, piece);
        if (ambiguous.length > 0) {
            const fromFile = from & 7;
            const fromRank = from >> 4;
            const sameFile = ambiguous.some(sq => (sq & 7) === fromFile);
            const sameRank = ambiguous.some(sq => (sq >> 4) === fromRank);

            if (!sameFile) {
                // File is unique — append just the file letter (e.g. "Rae1")
                san += String.fromCharCode(97 + fromFile);
            } else if (!sameRank) {
                // Rank is unique — append just the rank number (e.g. "R1e1")
                san += String.fromCharCode(49 + fromRank);
            } else {
                // Both file and rank needed (e.g. "Qa1b2" — rare but possible with promotions)
                san += String.fromCharCode(97 + fromFile);
                san += String.fromCharCode(49 + fromRank);
            }
        }
    }

    // Capture marker
    if (captured || wasEnPassant) {
        if (piece.type === PieceType.Pawn) {
            san += board.toAlgebraic(from)[0]; // originating file, e.g. "e"
        }
        san += 'x';
    }

    // Destination square
    san += board.toAlgebraic(to);

    // Promotion
    const rank = to >> 4;
    if (piece.type === PieceType.Pawn && (rank === 0 || rank === 7)) {
        san += '=' + Board.PIECE_LETTER[promotionType];
    }

    // Check / checkmate
    return decorateCheck(board, piece.color, san);
}

/**
 * Appends '+' or '#' to `san` based on the current board state.
 * `moverColor` is the side that just moved
 */
function decorateCheck(board: Board, moverColor: Color, san: string): string {
    const opponentColor = board.enemy(moverColor);

    if (!isInCheck(board, opponentColor)) return san;

    // Opponent is in check -> is it mate?
    if (hasNoLegalMoves(board)) {
        return san + '#';
    }
    return san + '+';
}

/**
 * Returns the 0x88 indices of all OTHER pieces of the same type and color
 * as the piece at `from` that can also legally reach `to`.
 * Called after makeMove has been applied, so we reconstruct from the record.
 *
 * Note: `board` is in the POST-move state when buildSAN is called.
 * We need pre-move legal moves, so we pass `from`, `to`, and `piece`
 * (which describe the move that was just made) and re-derive from there.
 */
function findAmbiguousPieces(board: Board, from: number, to: number, piece: Piece): number[] {
    const ambiguous: number[] = [];
    for (let i = 0; i < 128; i++) {
        if (i === from) continue;                    // skip the piece that just moved
        if (!board.isOnBoard(i)) continue;
        const p = board.grid[i];
        if (!p || p.type !== piece.type || p.color !== piece.color) continue;
        // Check if this piece could also reach `to` — but the board is post-move,
        // so `from` is empty and `to` has our piece. Temporarily restore original
        // state to get accurate legal moves for the sibling piece.
        const savedFrom = board.grid[from];
        const savedTo   = board.grid[to];
        board.grid[from] = piece;                    // restore moving piece to origin
        board.grid[to]   = savedTo?.color === piece.color ? savedTo : null; // clear if we put ours there
        // Flip turn back so legalMoves accepts our color
        board.turn = board.enemy(board.turn);
        const moves = legalMoves(board, i);
        board.turn = board.enemy(board.turn);        // restore turn
        board.grid[from] = savedFrom;
        board.grid[to]   = savedTo;
        if (moves.includes(to)) ambiguous.push(i);
    }
    return ambiguous;
}