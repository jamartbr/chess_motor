// Public API — consumers import from here, not from internal modules.
export { Engine } from './Engine';
export { Color, GameMode, PieceType } from './types';
export type { Piece, MoveRecord, CastlingRights } from './types';
export { analyseSquare } from './Analyzer';
export type { MoveAnnotation } from './Analyzer';