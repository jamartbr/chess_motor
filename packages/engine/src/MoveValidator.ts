import { Color, PieceType } from './types';
import type { Board } from './Board';
import { pseudoLegalMoves } from './MoveGenerator';
import { isSquareAttacked } from './AttackMap';
import { makeMove, undoMove } from './MoveExecutor';

/**
 * MoveValidator
 * -------------
 * Filters pseudo-legal moves down to fully legal moves by simulating each
 * candidate move and verifying the moving side's king is not left in check.
 *
 * Uses `silent` makeMove/undoMove so that moveHistory is never polluted by
 * simulation frames.
 */

/**
 * Returns every legal target square for the piece at `fromIndex`
 */
export function legalMoves(board: Board, fromIndex: number): number[] {
    const piece = board.getPiece(fromIndex);
    if (!piece) return [];

    const legal: number[] = [];

    for (const toIndex of pseudoLegalMoves(board, fromIndex)) {
        // Simulate silently
        const record = makeMove(board, fromIndex, toIndex, PieceType.Queen, /*silent*/ true);

        // After the move, it's the opponent's turn — check if the piece's original
        // color king is now under attack.
        const kingIdx    = board.findKing(piece.color);
        const enemyColor = board.enemy(piece.color);

        if (!isSquareAttacked(board, kingIdx, enemyColor)) {
            legal.push(toIndex);
        }

        undoMove(board, record, /*silent*/ true);
    }

    return legal;
}

/**
 * Returns true if the side whose turn it is has no legal moves.
 * Signals checkmate or stalemate (callers distinguish via `isInCheck`)
 */
export function hasNoLegalMoves(board: Board): boolean {
    for (let i = 0; i < 128; i++) {
        if (!board.isOnBoard(i)) continue;
        const p = board.getPiece(i);
        if (p && p.color === board.turn && legalMoves(board, i).length > 0) return false;
    }
    return true;
}

/**
 * Returns true if `color`'s king is currently in check
 */
export function isInCheck(board: Board, color: Color): boolean {
    return isSquareAttacked(board, board.findKing(color), board.enemy(color));
}