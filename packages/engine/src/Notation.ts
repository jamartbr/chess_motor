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

    // TODO: disambiguation when two identical pieces can reach the same square
    // (add from-file and/or from-rank letter here).

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