export enum Color {
  White = 'w',
  Black = 'b'
}

export enum PieceType {
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

export type BoardGrid = (Piece | null)[];