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
 * Called after makeMove has been applied.
 */
function findAmbiguousPieces(board: Board, from: number, to: number, piece: Piece): number[] {
    const ambiguous: number[] = [];
    
    // Temporarily remove the moved piece from `to` to check if other pieces could reach it
    const movedPiece = board.grid[to];
    board.grid[to] = null;
    
    for (let i = 0; i < 128; i++) {
        if (!board.isOnBoard(i)) continue;
        const p = board.grid[i];
        if (!p || p.type !== piece.type || p.color !== piece.color) continue;
        
        // Check if this piece can legally move to `to`
        const moves = legalMoves(board, i);
        if (moves.some(m => m === to)) {
            ambiguous.push(i);
        }
    }
    
    // Restore the moved piece
    board.grid[to] = movedPiece;
    
    return ambiguous;
}
