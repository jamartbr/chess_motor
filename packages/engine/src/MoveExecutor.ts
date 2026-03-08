import { Color, PieceType } from './types';
import type { Piece, MoveRecord } from './types';
import type { Board } from './Board';

/**
 * MoveExecutor
 * ------------
 * Responsible for physically applying and reversing half-moves on the board.
 *
 * Two modes are provided:
 *   - `makeMove`   : full move -> records SAN, updates moveHistory (used by Engine)
 *   - `makeSilent` : simulation move > no SAN, no history entry (used by MoveValidator)
 *
 * Both return a `MoveRecord` that can be passed to `undoMove`.
 */

/**
 * Apply a move on `board`.
 * If `silent` is true, moveHistory is not updated (for king-safety simulation)
 */
export function makeMove(
    board:         import('./Board').Board,
    from:          number,
    to:            number,
    promotionType: PieceType = PieceType.Queen,
    silent:        boolean   = false,
): MoveRecord {

    // Save state
    board.stateStack.push({
        rights:    { ...board.castlingRights },
        enPassant: board.enPassantSquare,
        promotion: board.promotionSquare,
    });

    const piece: Piece    = { ...board.grid[from]! }; // copy so promotions don't mutate origin
    let captured: Piece | null = board.grid[to] ?? null;

    // En passant capture
    let enPassantCaptureIdx: number | null = null;
    if (piece.type === PieceType.Pawn && to === board.enPassantSquare) {
        enPassantCaptureIdx = piece.color === Color.White ? to - 16 : to + 16;
        captured            = board.grid[enPassantCaptureIdx] ?? null;
        board.grid[enPassantCaptureIdx] = null;
    }

    // Castling -> move rook
    if (piece.type === PieceType.King && Math.abs(to - from) === 2) {
        const kingSide = to > from;
        const rookFrom = kingSide ? from + 3 : from - 4;
        const rookTo   = kingSide ? from + 1 : from - 1;
        board.grid[rookTo]   = board.grid[rookFrom];
        board.grid[rookFrom] = null;
    }

    // Standar move
    board.grid[to]   = piece;
    board.grid[from] = null;

    // En passant square update
    board.enPassantSquare = null;
    if (piece.type === PieceType.Pawn && Math.abs(to - from) === 32) {
        board.enPassantSquare = (from + to) / 2;
    }

    // Promotion
    board.promotionSquare = null;
    const rank = to >> 4;
    const originalPieceType = piece.type;
    if (piece.type === PieceType.Pawn && (rank === 0 || rank === 7)) {
        piece.type            = promotionType;
        board.grid[to]        = piece;          // write promoted piece
        board.promotionSquare = to;
    }

    // Castling rights
    // Pass original type so a promoted pawn is never mistaken
    board.updateCastlingRights(from, to, { ...piece, type: originalPieceType });

    // Flip turn
    board.turn = board.enemy(board.turn);

    // Build record (SAN filled in by Notation layer, not here)
    // Store original piece type so undoMove can reliably identify the piece
    const record: MoveRecord = {
        from,
        to,
        piece: { ...piece, type: originalPieceType },
        captured,
        promotionType,
        san: '', // populated by Engine after the fact
    };

    if (!silent) {
        // placeholder; Engine will overwrite with real SAN
        board.moveHistory.push('');
    }

    return record;
}

/**
 * Reverse a previously applied move.
 * `record` must be the MoveRecord returned by the corresponding makeMove call
 */
export function undoMove(
    board:   import('./Board').Board,
    record:  MoveRecord,
    silent:  boolean = false,
): void {
    const state = board.stateStack.pop();
    if (!state) return;

    const { from, to, piece, captured, promotionType } = record;

    // The piece currently at `to` (may have been promoted)
    let movingPiece = board.grid[to];

    // Revert promotion:
    // record.piece.type is always the *original* type (Pawn if a promotion occurred),
    // so we detect a promotion when: the original piece was a Pawn, it moved to a
    // back rank, and a non-Pawn promotionType was chosen.
    const destRank = to >> 4;
    const wasPromotion = piece.type === PieceType.Pawn
        && (destRank === 0 || destRank === 7)
        && (promotionType !== PieceType.Pawn && promotionType !== PieceType.King);
    if (wasPromotion && movingPiece) {
        movingPiece = { ...movingPiece, type: PieceType.Pawn };
    }

    // Restore state flags
    board.castlingRights  = { ...state.rights };
    board.promotionSquare = state.promotion;
    board.enPassantSquare = state.enPassant;

    // Move piece back
    board.grid[from] = movingPiece;
    board.grid[to]   = captured;

    // En passant: restore captured pawn
    if (piece.type === PieceType.Pawn && to === state.enPassant) {
        board.grid[to] = null; // destination was empty before the capture
        const capturedPawnIdx = piece.color === Color.White ? to - 16 : to + 16;
        board.grid[capturedPawnIdx] = captured;
    }

    // Castling: put rook back
    // Note: piece.type reflects the type at time of move (before any promotion),
    // which is correct because the king never gets promoted.
    if (piece.type === PieceType.King && Math.abs(to - from) === 2) {
        const kingSide = to > from;
        const rookFrom = kingSide ? from + 3 : from - 4;
        const rookTo   = kingSide ? from + 1 : from - 1;
        board.grid[rookFrom] = board.grid[rookTo];
        board.grid[rookTo]   = null;
    }

    // Flip turn back
    board.turn = board.enemy(board.turn);

    // History
    if (!silent) {
        board.moveHistory.pop();
    }
}