import { Color, GameMode } from './types';
import type { Board } from './Board';
import { countAttackers } from './AttackMap';

/**
 * DominionScorer
 * --------------
 * Calculates territorial control for the Dominion game mode and
 * accumulates points on the Board.
 *
 * Called once per completed turn (after makeMove).
 */

/**
 * Determine which color, if any, controls a given square
 *
 * Rules:
 *   1. A piece occupying the square -> that side controls it
 *   2. Otherwise -> the side with more attackers controls it
 *   3. Equal attackers -> null (contested)
 */
export function squareControl(board: Board, index: number): Color | null {
    const piece = board.grid[index];
    if (piece) return piece.color;

    const white = countAttackers(board, index, Color.White);
    const black = countAttackers(board, index, Color.Black);

    if (white > black) return Color.White;
    if (black > white) return Color.Black;
    return null;
}

/**
 * Iterate every valid square, tally control, and add to cumulative totals
 */
export function updateControlPoints(board: Board): void {
    if (board.mode !== GameMode.Dominion) return;

    let white = 0;
    let black = 0;

    for (let i = 0; i < 128; i++) {
        if ((i & 0x88) !== 0) continue; // off-board square
        const ctrl = squareControl(board, i);
        if (ctrl === Color.White) white++;
        else if (ctrl === Color.Black) black++;
    }

    board.whiteControlPoints += white;
    board.blackControlPoints += black;
}