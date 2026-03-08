import { Color, PieceType } from './types';
import type { Board } from './Board';

/**
 * AttackMap
 * ---------
 * Pure attack-detection helpers. Every function is stateless with respect to
 * Board: it reads from the board but never mutates it
 */

// Shared offset tables
export const KNIGHT_OFFSETS = [33, 31, 18, 14, -33, -31, -18, -14] as const;    // L-shape moves in 0x88
export const BISHOP_OFFSETS = [15, 17, -15, -17] as const;                      // Diagonal (1-square) moves in 0x88
export const ROOK_OFFSETS   = [1, 16, -1, -16] as const;                        // Horizontal/vertical (1-square) moves in 0x88
export const KING_OFFSETS   = [...BISHOP_OFFSETS, ...ROOK_OFFSETS] as const;    // 1-square moves in 0x88

/**
 * Returns true if `targetIndex` is attacked by any piece of `attackerColor`.
 */
export function isSquareAttacked(board: Board, targetIndex: number, attackerColor: Color): boolean {

    // 1. Knights
    for (const offset of KNIGHT_OFFSETS) {
        const sq = targetIndex + offset;
        if (board.isOnBoard(sq)) {
            const p = board.getPiece(sq);
            if (p && p.type === PieceType.Knight && p.color === attackerColor) return true;
        }
    }

    // 2. Diagonal sliders (Bishop / Queen)
    for (const offset of BISHOP_OFFSETS) {
        let sq = targetIndex + offset;
        while (board.isOnBoard(sq)) {
            const p = board.getPiece(sq);
            if (p) {
                if (p.color === attackerColor &&
                    (p.type === PieceType.Bishop || p.type === PieceType.Queen)) return true;
                break;
            }
            sq += offset;
        }
    }

    // 3. Straight sliders (Rook / Queen)
    for (const offset of ROOK_OFFSETS) {
        let sq = targetIndex + offset;
        while (board.isOnBoard(sq)) {
            const p = board.getPiece(sq);
            if (p) {
                if (p.color === attackerColor &&
                    (p.type === PieceType.Rook || p.type === PieceType.Queen)) return true;
                break;
            }
            sq += offset;
        }
    }

    // 4. Pawns: a black pawn attacks downward (offsets from target: +15, +17),
    //           a white pawn attacks upward  (offsets from target: -15, -17)
    const pawnOffsets = attackerColor === Color.White ? [-15, -17] : [15, 17];
    for (const offset of pawnOffsets) {
        const sq = targetIndex + offset;
        if (board.isOnBoard(sq)) {
            const p = board.getPiece(sq);
            if (p && p.type === PieceType.Pawn && p.color === attackerColor) return true;
        }
    }

    // 5. Enemy King (prevents kings from walking adjacent)
    for (const offset of KING_OFFSETS) {
        const sq = targetIndex + offset;
        if (board.isOnBoard(sq)) {
            const p = board.getPiece(sq);
            if (p && p.type === PieceType.King && p.color === attackerColor) return true;
        }
    }

    return false;
}

/**
 * Counts how many pieces of `attackerColor` attack `targetIndex`.
 * (Used for Dominion-mode territory scoring)
 */
export function countAttackers(board: Board, targetIndex: number, attackerColor: Color): number {
    let count = 0;

    // Knights
    for (const offset of KNIGHT_OFFSETS) {
        const sq = targetIndex + offset;
        if (board.isOnBoard(sq)) {
            const p = board.getPiece(sq);
            if (p && p.type === PieceType.Knight && p.color === attackerColor) count++;
        }
    }

    // Sliding pieces
    const sliders: { offsets: readonly number[]; types: PieceType[] }[] = [
        { offsets: ROOK_OFFSETS,   types: [PieceType.Rook,   PieceType.Queen] },
        { offsets: BISHOP_OFFSETS, types: [PieceType.Bishop, PieceType.Queen] },
    ];
    for (const { offsets, types } of sliders) {
        for (const offset of offsets) {
            let sq = targetIndex + offset;
            while (board.isOnBoard(sq)) {
                const p = board.getPiece(sq);
                if (p) {
                    if (p.color === attackerColor && types.includes(p.type)) count++;
                    break;
                }
                sq += offset;
            }
        }
    }

    // Pawns (same direction logic as isSquareAttacked)
    const pawnOffsets = attackerColor === Color.White ? [-15, -17] : [15, 17];
    for (const offset of pawnOffsets) {
        const sq = targetIndex + offset;
        if (board.isOnBoard(sq)) {
            const p = board.getPiece(sq);
            if (p && p.type === PieceType.Pawn && p.color === attackerColor) count++;
        }
    }

    // King
    for (const offset of KING_OFFSETS) {
        const sq = targetIndex + offset;
        if (board.isOnBoard(sq)) {
            const p = board.getPiece(sq);
            if (p && p.type === PieceType.King && p.color === attackerColor) count++;
        }
    }

    return count;
}