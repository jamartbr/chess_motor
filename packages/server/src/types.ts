/**
 * types.ts
 * --------
 * Server-side type definitions
 */

// Game

export const enum Color {
  White = 'w',
  Black = 'b'
}

export const enum PieceType {
  Pawn = 'p',
  Knight = 'n',
  Bishop = 'b',
  Rook = 'r',
  Queen = 'q',
  King = 'k'
}

export interface Piece {
  type: PieceType;
  color: Color;
}

export const enum GameMode {
  Classical = 'classical',
  Dominion = 'dominion'
}

// Matchmaking

/**
 * A player waiting in a matchmaking queue.
 * `color` is null when the player chose "Random" and has no preference
 */
export interface WaitingPlayer {
    socketId: string;
    color:    Color | null;
}

// Socket event payloads

export interface FindMatchPayload {
    mode:   string;
    roomId: string;
    color:  Color | null;
}

export interface MakeMovePayload {
    roomId:    string;
    from:      number;
    to:        number;
    promotion: PieceType;
}