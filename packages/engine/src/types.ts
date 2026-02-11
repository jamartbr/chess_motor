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