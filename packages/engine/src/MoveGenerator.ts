import { Color, PieceType } from './types';
import type { Board } from './Board';
import { isSquareAttacked, KNIGHT_OFFSETS, BISHOP_OFFSETS, ROOK_OFFSETS, KING_OFFSETS } from './AttackMap';

/**
 * MoveGenerator
 * -------------
 * Produces pseudo-legal target squares for every piece type.
 * "Pseudo-legal" means the moves are geometrically valid but may leave the
 * moving side's king in check — that filtering happens in MoveValidator.
 *
 * All functions are pure with respect to Board (read-only).
 */

// ----------------------------------------------------------------------------
//                                   Helpers                                   
// ----------------------------------------------------------------------------

/** 
 * Walk one ray from `origin` in `offset` direction; stop at board edge or blocker
 */
function ray(board: Board, origin: number, offset: number): number[] {
    const squares: number[] = [];
    let sq = origin + offset;
    while (board.isOnBoard(sq)) {
        squares.push(sq);
        if (board.getPiece(sq)) break; // blocker
        sq += offset;
    }
    return squares;
}

/**
 * Remove the last element of `squares` if it's occupied by a friendly piece
 */
function trimFriendly(board: Board, squares: number[], color: Color): number[] {
    if (squares.length === 0) return squares;
    const last = squares[squares.length - 1]!;
    const p = board.getPiece(last);
    if (p && p.color === color) squares.pop();
    return squares;
}

// ----------------------------------------------------------------------------
//                             Per-piece generators                            
// ----------------------------------------------------------------------------

export function knightMoves(board: Board, index: number): number[] {
    const piece = board.getPiece(index);
    if (!piece) return [];

    return KNIGHT_OFFSETS.flatMap(offset => {
        const sq = index + offset;
        if (!board.isOnBoard(sq)) return [];
        const target = board.getPiece(sq);
        if (target && target.color === piece.color) return [];
        return [sq];
    });
}

export function slidingMoves(board: Board, index: number, offsets: readonly number[]): number[] {
    const piece = board.getPiece(index);
    if (!piece) return [];

    return offsets.flatMap(offset => {
        const squares = ray(board, index, offset);
        return trimFriendly(board, squares, piece.color);
    });
}

export function bishopMoves(board: Board, index: number): number[] {
    return slidingMoves(board, index, BISHOP_OFFSETS);
}

export function rookMoves(board: Board, index: number): number[] {
    return slidingMoves(board, index, ROOK_OFFSETS);
}

export function queenMoves(board: Board, index: number): number[] {
    return slidingMoves(board, index, [...BISHOP_OFFSETS, ...ROOK_OFFSETS]);
}

export function kingMoves(board: Board, index: number): number[] {
    const piece = board.getPiece(index);
    if (!piece) return [];

    const isWhite    = piece.color === Color.White;
    const enemyColor = board.enemy(piece.color);
    const rankOffset = isWhite ? 0x00 : 0x70; // rank 0 or rank 7

    const moves: number[] = [];

    // Normal one-step king moves
    for (const offset of KING_OFFSETS) {
        const sq = index + offset;
        if (!board.isOnBoard(sq)) continue;
        const target = board.getPiece(sq);
        if (!target || target.color !== piece.color) moves.push(sq);
    }

    // Castling
    // King-side: f and g squares must be empty and not attacked
    if (canCastleKingSide(board, isWhite, index, rankOffset, enemyColor)) {
        moves.push(index + 2); // g1 / g8
    }

    // Queen-side: b, c, d squares must be empty; c and d must not be attacked
    if (canCastleQueenSide(board, isWhite, index, rankOffset, enemyColor)) {
        moves.push(index - 2); // c1 / c8
    }

    return moves;
}

function canCastleKingSide(
    board:      Board,
    isWhite:    boolean,
    kingIndex:  number,
    rankOffset: number,
    enemy:      Color,
): boolean {
    const rights = isWhite
        ? board.castlingRights.whiteKingSide
        : board.castlingRights.blackKingSide;
    if (!rights) return false;

    const f = rankOffset + 5;
    const g = rankOffset + 6;

    if (board.getPiece(f) || board.getPiece(g)) return false;

    // King must not currently be in check, nor pass through / land in check
    return (
        !isSquareAttacked(board, kingIndex, enemy) &&
        !isSquareAttacked(board, f, enemy) &&
        !isSquareAttacked(board, g, enemy)
    );
}

function canCastleQueenSide(
    board:      Board,
    isWhite:    boolean,
    kingIndex:  number,
    rankOffset: number,
    enemy:      Color,
): boolean {
    const rights = isWhite
        ? board.castlingRights.whiteQueenSide
        : board.castlingRights.blackQueenSide;
    if (!rights) return false;

    const b = rankOffset + 1;
    const c = rankOffset + 2;
    const d = rankOffset + 3;

    // b, c, d must all be empty (b is between rook and c)
    if (board.getPiece(b) || board.getPiece(c) || board.getPiece(d)) return false;

    // King must not currently be in check, nor pass through (d) or land in check (c)
    return (
        !isSquareAttacked(board, kingIndex, enemy) &&
        !isSquareAttacked(board, d, enemy) &&
        !isSquareAttacked(board, c, enemy)
    );
}

export function pawnMoves(board: Board, index: number): number[] {
    const piece = board.getPiece(index);
    if (!piece) return [];

    const moves:   number[] = [];
    const forward  = piece.color === Color.White ? 16 : -16;
    const rank     = index >> 4;

    // 1. One step forward — target square must be on board AND empty
    const oneStep = index + forward;
    if (board.isOnBoard(oneStep) && !board.getPiece(oneStep)) {
        moves.push(oneStep);

        // 2. Two steps forward from starting rank
        const onStart = (piece.color === Color.White && rank === 1) ||
                        (piece.color === Color.Black && rank === 6);
        const twoStep = oneStep + forward;
        if (onStart && board.isOnBoard(twoStep) && !board.getPiece(twoStep)) {
            moves.push(twoStep);
        }
    }

    // 3. Diagonal captures (standard + en passant)
    const captureOffsets = piece.color === Color.White ? [15, 17] : [-15, -17];
    for (const offset of captureOffsets) {
        const sq = index + offset;
        if (!board.isOnBoard(sq)) continue;

        const target = board.getPiece(sq);
        if ((target && target.color !== piece.color) || sq === board.enPassantSquare) {
            moves.push(sq);
        }
    }

    return moves;
}

/**
 * Returns all pseudo-legal target squares for the piece at `index`.
 */
export function pseudoLegalMoves(board: Board, index: number): number[] {
    const piece = board.getPiece(index);
    if (!piece) return [];

    switch (piece.type) {
        case PieceType.Pawn:   return pawnMoves(board, index);
        case PieceType.Knight: return knightMoves(board, index);
        case PieceType.Bishop: return bishopMoves(board, index);
        case PieceType.Rook:   return rookMoves(board, index);
        case PieceType.Queen:  return queenMoves(board, index);
        case PieceType.King:   return kingMoves(board, index);
        default:               return [];
    }
}