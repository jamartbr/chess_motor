export enum Color {
    White = 'white',
    Black = 'black',
}

export enum PieceType {
    Pawn   = 'pawn',
    Knight = 'knight',
    Bishop = 'bishop',
    Rook   = 'rook',
    Queen  = 'queen',
    King   = 'king',
}

export enum GameMode {
    Classical = 'classical',
    Dominion  = 'dominion',
}

export interface Piece {
    type:  PieceType;
    color: Color;
}

export interface CastlingRights {
    whiteQueenSide: boolean;
    whiteKingSide:  boolean;
    blackQueenSide: boolean;
    blackKingSide:  boolean;
}

export interface SavedState {
    rights:     CastlingRights;
    enPassant:  number | null;
    promotion:  number | null;
}

/** A fully-described half-move, ready to apply or undo. */
export interface MoveRecord {
    from:          number;
    to:            number;
    piece:         Piece;
    captured:      Piece | null;
    promotionType: PieceType;
    san:           string;
}