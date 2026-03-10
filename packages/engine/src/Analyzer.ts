import { Color, PieceType } from './types';
import type { Board } from './Board';
import { legalMoves, isInCheck, hasNoLegalMoves } from './MoveValidator';
import { makeMove, undoMove } from './MoveExecutor';
import { isSquareAttacked } from './AttackMap';

/**
 * Analyzer
 * --------
 * Provides per-move evaluation data for the Analysis game mode.
 *
 * For each legal target square of a selected piece, it computes:
 *   - `scoreDelta`  : material change from the moving side's perspective,
 *                     accounting for whether the moved piece will be
 *                     immediately en prise after the move.
 *   - `mateIn`      : number of moves until forced checkmate, or null.
 *
 * All board mutations are silent (stateStack-based) and fully reversed,
 * so the board is never permanently changed.
 */

// ---------------------------------------------------------------------------
// FIDE material values (centipawns)
// ---------------------------------------------------------------------------
export const PIECE_VALUE: Record<PieceType, number> = {
  [PieceType.Pawn]:   100,
  [PieceType.Knight]: 300,
  [PieceType.Bishop]: 300,
  [PieceType.Rook]:   500,
  [PieceType.Queen]:  900,
  [PieceType.King]:   0,   // King has no material value for scoring purposes
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Analysis annotation for a single candidate move. */
export interface MoveAnnotation {
  /** Target square (0x88 index). */
  to: number;
  /**
   * Net material change in centipawns from the perspective of the side
   * that is moving. Positive = gained material, negative = lost material.
   *
   * Examples:
   *   Capturing an undefended pawn  -> +100
   *   Moving queen to an en-prise square with no recapture -> -900
   *   Plain developing move         ->    0
   */
  scoreDelta: number;
  /**
   * If a forced checkmate is available after this move, this is the number
   * of moves (half-moves ÷ 2, rounded up) until mate. Otherwise null.
   *
   * "M1" means the opponent is checkmated immediately after this move.
   */
  mateIn: number | null;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Returns analysis annotations for every legal move of the piece at
 * `fromIndex`. Returns [] if the square is empty or it is not that
 * piece's turn.
 *
 * @param board     The current Board instance (will be temporarily mutated
 *                  but always restored on return).
 * @param fromIndex 0x88 index of the piece to analyse.
 */
export function analyseSquare(board: Board, fromIndex: number): MoveAnnotation[] {
  const piece = board.getPiece(fromIndex);
  if (!piece || piece.color !== board.turn) return [];

  const targets = legalMoves(board, fromIndex);
  const annotations: MoveAnnotation[] = [];

  for (const to of targets) {
    // -----------------------------------------------------------------------
    // 1. Apply the move silently
    // -----------------------------------------------------------------------
    const record = makeMove(board, fromIndex, to, PieceType.Queen, /*silent*/ true);

    // -----------------------------------------------------------------------
    // 2. Immediate material delta
    //    = value of captured piece (if any)
    //    - penalty if the moved piece is now en prise and cannot be
    //      recaptured favourably
    // -----------------------------------------------------------------------
    const capturedValue = record.captured ? PIECE_VALUE[record.captured.type] : 0;

    // The piece that just moved: after promotion it may be a Queen.
    const movedPiece = board.getPiece(to);
    const movedValue = movedPiece ? PIECE_VALUE[movedPiece.type] : PIECE_VALUE[piece.type];

    // Check if the moved piece is now attacked by the opponent.
    // board.turn has already been flipped, so the current turn is the opponent.
    const opponentColor = board.turn; // flipped inside makeMove
    const isEnPrise = isSquareAttacked(board, to, opponentColor);

    let enPrisePenalty = 0;
    if (isEnPrise) {
      // Can our side recapture on `to` with a piece of lesser or equal value?
      const cheapestRecapture = findCheapestRecapture(board, to, board.enemy(opponentColor));
      if (cheapestRecapture === null || cheapestRecapture >= movedValue) {
        // No recapture available, or recapture costs at least as much as we lose.
        enPrisePenalty = movedValue;
      } else {
        // We can recapture; net loss is (movedValue - cheapestRecapture piece gained)
        // but we simplified: if cheapestRecapture < movedValue we accept the exchange.
        enPrisePenalty = movedValue - cheapestRecapture;
        if (enPrisePenalty < 0) enPrisePenalty = 0;
      }
    }

    const scoreDelta = capturedValue - enPrisePenalty;

    // -----------------------------------------------------------------------
    // 3. Forced-mate detection (depth-limited minimax)
    // -----------------------------------------------------------------------
    const mateIn = findForcedMate(board, /*maxDepth*/ 5);

    // -----------------------------------------------------------------------
    // 4. Undo
    // -----------------------------------------------------------------------
    undoMove(board, record, /*silent*/ true);

    annotations.push({ to, scoreDelta, mateIn });
  }

  return annotations;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Finds the material value of the cheapest piece of `color` that can
 * recapture on `square`. Returns null if no recapture is possible.
 *
 * This is a single-ply look-ahead: we iterate over all pieces of `color`
 * and check if any legal move lands on `square`.
 */
function findCheapestRecapture(board: Board, square: number, color: Color): number | null {
  let cheapest: number | null = null;

  for (let i = 0; i < 128; i++) {
    if ((i & 0x88) !== 0) continue;
    const p = board.getPiece(i);
    if (!p || p.color !== color) continue;

    const moves = legalMoves(board, i);
    if (moves.includes(square)) {
      const val = PIECE_VALUE[p.type];
      if (cheapest === null || val < cheapest) cheapest = val;
    }
  }

  return cheapest;
}

/**
 * Depth-limited forced-mate search (negamax without alpha-beta).
 * Returns the number of moves (plies ÷ 2, rounded up) until checkmate
 * from the perspective of the side that just moved (i.e. the opponent
 * is the one getting mated). Returns null if no forced mate is found
 * within `maxDepth` plies.
 *
 * The board has already had the candidate move applied when this is called,
 * so `board.turn` is the side we are trying to checkmate.
 *
 * @param board    Board after the candidate move has been applied.
 * @param maxDepth Maximum search depth in half-moves (plies).
 */
function findForcedMate(board: Board, maxDepth: number): number | null {
  // Check immediate checkmate (depth 0 from the opponent's perspective):
  // After our move, if the opponent has no legal moves and is in check -> M1.
  if (hasNoLegalMoves(board) && isInCheck(board, board.turn)) {
    return 1; // Mate in 1 (our move was the final move)
  }

  if (maxDepth <= 1) return null;

  // Try all opponent responses; for forced mate ALL of them must lead to mate.
  // (If any opponent move escapes, it's not a *forced* mate.)
  const opponentMoves = collectAllLegalMoves(board, board.turn);
  if (opponentMoves.length === 0) return null; // stalemate or already handled above

  let maxMateIn: number | null = 0; // will store the worst case across opponent replies

  for (const [from, to] of opponentMoves) {
    const record = makeMove(board, from, to, PieceType.Queen, /*silent*/ true);

    // Now it's our turn again. Look for mate in the remaining depth.
    const subMate = findForcedMateForAttacker(board, maxDepth - 2);

    undoMove(board, record, /*silent*/ true);

    if (subMate === null) {
      // Opponent found an escape -> no forced mate along this line.
      return null;
    }

    if (maxMateIn === null || subMate + 1 > maxMateIn) {
      maxMateIn = subMate + 1;
    }
  }

  return maxMateIn === 0 ? 1 : maxMateIn;
}

/**
 * From the attacker's perspective (board.turn is the attacker), find the
 * minimum number of moves to force checkmate within `depth` plies.
 * Returns null if no forced mate is found.
 */
function findForcedMateForAttacker(board: Board, depth: number): number | null {
  const attackerMoves = collectAllLegalMoves(board, board.turn);
  if (attackerMoves.length === 0) return null;

  for (const [from, to] of attackerMoves) {
    const record = makeMove(board, from, to, PieceType.Queen, /*silent*/ true);

    let mateFound: number | null = null;

    if (hasNoLegalMoves(board) && isInCheck(board, board.turn)) {
      // Checkmate achieved in this move
      mateFound = 1;
    } else if (depth >= 2) {
      const sub = findForcedMate(board, depth - 1);
      if (sub !== null) mateFound = sub + 1;
    }

    undoMove(board, record, /*silent*/ true);

    if (mateFound !== null) return mateFound;
  }

  return null;
}

/**
 * Returns all [from, to] move pairs for `color` on the current board.
 */
function collectAllLegalMoves(board: Board, color: Color): [number, number][] {
  const moves: [number, number][] = [];
  for (let i = 0; i < 128; i++) {
    if ((i & 0x88) !== 0) continue;
    const p = board.getPiece(i);
    if (!p || p.color !== color) continue;
    for (const to of legalMoves(board, i)) {
      moves.push([i, to]);
    }
  }
  return moves;
}