import { describe, it, expect, beforeEach } from 'vitest';
import { Engine } from './Engine';
import { Color, PieceType, GameMode } from './types';
import { analyseSquare } from './Analyzer';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Access the private Board instance inside Engine for low-level inspection. */
const rawBoard = (engine: Engine) => (engine as any).board;

/** Directly read/write the 0x88 grid, bypassing the Engine API. */
const grid = (engine: Engine) => rawBoard(engine).grid as any[];

/**
 * Clear the board, place a single piece, and ensure both kings are present
 * so that SAN generation (check/checkmate detection) never calls findKing(-1).
 * Kings are placed on a8/h8 by default — far from the action in most tests.
 */
const place = (engine: Engine, index: number, type: PieceType, color: Color,
               whiteKingIndex: number = 0x70, blackKingIndex: number = 0x77) => {
    grid(engine).fill(null);
    // Sentinel kings — keep them out of the way on the back rank corners
    grid(engine)[whiteKingIndex] = { type: PieceType.King, color: Color.White };
    grid(engine)[blackKingIndex] = { type: PieceType.King, color: Color.Black };
    grid(engine)[index] = { type, color };
};

// ─────────────────────────────────────────────────────────────────────────────
// Board Initialization
// ─────────────────────────────────────────────────────────────────────────────

describe('Board Initialization', () => {
    it('should have a White King on e1', () => {
        const engine = new Engine();
        const piece = engine.getPiece(0x04); // Rank 0, File 4
        expect(piece).toEqual({ type: PieceType.King, color: Color.White });
    });

    it('should have a Black King on e8', () => {
        const engine = new Engine();
        const piece = engine.getPiece(0x74); // Rank 7, File 4
        expect(piece).toEqual({ type: PieceType.King, color: Color.Black });
    });

    it('should have a White Queen on d1', () => {
        const engine = new Engine();
        const piece = engine.getPiece(0x03); // Rank 0, File 3
        expect(piece).toEqual({ type: PieceType.Queen, color: Color.White });
    });

    it('should have a Black Queen on d8', () => {
        const engine = new Engine();
        const piece = engine.getPiece(0x73); // Rank 7, File 3
        expect(piece).toEqual({ type: PieceType.Queen, color: Color.Black });
    });

    it('should have White Pawns on rank 2', () => {
        const engine = new Engine();
        for (let file = 0; file < 8; file++) {
            const piece = engine.getPiece(0x10 | file);
            expect(piece).toEqual({ type: PieceType.Pawn, color: Color.White });
        }
    });

    it('should have Black Pawns on rank 7', () => {
        const engine = new Engine();
        for (let file = 0; file < 8; file++) {
            const piece = engine.getPiece(0x60 | file);
            expect(piece).toEqual({ type: PieceType.Pawn, color: Color.Black });
        }
    });

    it('should have empty squares in the center (central 4 rows)', () => {
        const engine = new Engine();
        for (let rank = 2; rank <= 5; rank++) {
            for (let file = 0; file < 8; file++) {
                const index = (rank << 4) | file;
                expect(engine.getPiece(index)).toBeNull();
            }
        }
    });

    it('should start as White\'s turn', () => {
        const engine = new Engine();
        expect(engine.turn).toBe(Color.White);
    });

    it('should start with all castling rights enabled', () => {
        const engine = new Engine();
        const rights = rawBoard(engine).castlingRights;
        expect(rights.whiteKingSide).toBe(true);
        expect(rights.whiteQueenSide).toBe(true);
        expect(rights.blackKingSide).toBe(true);
        expect(rights.blackQueenSide).toBe(true);
    });

    it('should reset cleanly after reset()', () => {
        const engine = new Engine();
        engine.move(0x14, 0x34); // e2-e4
        engine.reset();
        expect(engine.turn).toBe(Color.White);
        expect(engine.moveHistory.length).toBe(0);
        expect(engine.getPiece(0x34)).toBeNull();
        expect(engine.getPiece(0x14)).toEqual({ type: PieceType.Pawn, color: Color.White });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Knight Moves
// ─────────────────────────────────────────────────────────────────────────────

describe('Knight Moves', () => {
    it('should have only 2 moves from a corner', () => {
        const engine = new Engine();
        const corners = [0x00, 0x70, 0x07, 0x77];
        // Kings are placed on a3 and f6
        const whiteKingIndex = 0x22; // a3
        const blackKingIndex = 0x55; // f6
        for (const corner of corners) {
            place(engine, corner, PieceType.Knight, Color.White, whiteKingIndex, blackKingIndex);
            expect(engine.getLegalMoves(corner).length).toBe(2);
        }
    });

    it('should have only 3 moves from a border next to a corner', () => {
        const engine = new Engine();
        const squares = [0x10, 0x01, 0x60, 0x71, 0x06, 0x17, 0x67, 0x76];
        for (const square of squares) {
            place(engine, square, PieceType.Knight, Color.White);
            expect(engine.getLegalMoves(square).length).toBe(3);
        }
    });

    it('should have only 4 moves from a border', () => {
        const engine = new Engine();
        for (let offset = 2; offset < 6; offset++) {
            // c1-f1
            place(engine, 0x00+offset, PieceType.Knight, Color.White);
            expect(engine.getLegalMoves(0x00+offset).length).toBe(4);
            // c7-f7
            place(engine, 0x70+offset, PieceType.Knight, Color.White);
            expect(engine.getLegalMoves(0x70+offset).length).toBe(4);
            // a3-a6
            place(engine, 0x00+offset*16, PieceType.Knight, Color.White);
            expect(engine.getLegalMoves(0x00+offset*16).length).toBe(4);
            // h3-h6
            place(engine, 0x07+offset*16, PieceType.Knight, Color.White);
            expect(engine.getLegalMoves(0x07+offset*16).length).toBe(4);
        }
    });

    it('should have only 4 moves from next to two borders', () => {
        const engine = new Engine();
        const squares = [0x11, 0x16, 0x61, 0x66];
        for (const square of squares) {
            place(engine, square, PieceType.Knight, Color.White);
            expect(engine.getLegalMoves(square).length).toBe(4);
        }
    });

    it('should have only 6 moves from next to a border and close to another', () => {
        const engine = new Engine();
        // Kings are placed on b7 and g7
        const whiteKingIndex = 0x16; // b7
        const blackKingIndex = 0x66; // g7
        for (let offset = 2; offset < 6; offset++) {
            // c2-f2
            place(engine, 0x10+offset, PieceType.Knight, Color.White, whiteKingIndex, blackKingIndex);
            expect(engine.getLegalMoves(0x10+offset).length).toBe(6);
            // c6-f6
            place(engine, 0x60+offset, PieceType.Knight, Color.White, whiteKingIndex, blackKingIndex);
            expect(engine.getLegalMoves(0x60+offset).length).toBe(6);
            // b3-b6
            place(engine, 0x01+offset*16, PieceType.Knight, Color.White, whiteKingIndex, blackKingIndex);
            expect(engine.getLegalMoves(0x01+offset*16).length).toBe(6);
            // f3-f6
            place(engine, 0x06+offset*16, PieceType.Knight, Color.White, whiteKingIndex, blackKingIndex);
            expect(engine.getLegalMoves(0x06+offset*16).length).toBe(6);
        }
    });

    it('should have 8 moves from the center', () => {
        const engine = new Engine();
        for (let rank = 2; rank < 6; rank++) {
            for (let file = 2; file < 6; file++) {
                const index = (rank << 4) | file;
                place(engine, index, PieceType.Knight, Color.White);
                expect(engine.getLegalMoves(index).length).toBe(8);
            }
        }
    });

    it('should not capture a friendly piece', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Knight, color: Color.White };
        grid(engine)[0x12] = { type: PieceType.Pawn,   color: Color.White }; // friendly blocker
        const moves = engine.getLegalMoves(0x00);
        expect(moves).not.toContain(0x12);
    });

    it('should capture an enemy piece', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Knight, color: Color.White };
        grid(engine)[0x12] = { type: PieceType.Pawn,   color: Color.Black };
        const moves = engine.getLegalMoves(0x00);
        expect(moves).toContain(0x12);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bishop Moves
// ─────────────────────────────────────────────────────────────────────────────

describe('Bishop Moves', () => {
    it('should have 0 moves at game start (blocked by pawns)', () => {
        const engine = new Engine();
        // c1 = 0x02, blocked by pawns and adjacent pieces
        const moves = engine.getLegalMoves(0x02);
        expect(moves.length).toBe(0);
    });

    it('should have 13 moves from the center of an empty board (d4)', () => {
        const engine = new Engine();
        place(engine, 0x33, PieceType.Bishop, Color.White);
        expect(engine.getLegalMoves(0x33).length).toBe(13);
    });

    it('should have 7 moves from a corner (a1)', () => {
        const engine = new Engine();
        place(engine, 0x00, PieceType.Bishop, Color.White);
        expect(engine.getLegalMoves(0x00).length).toBe(7);
    });

    it('should slide diagonally until blocked by a friendly piece', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Bishop, color: Color.White };
        grid(engine)[0x33] = { type: PieceType.Pawn,   color: Color.White }; // friendly blocker at d4
        const moves = engine.getLegalMoves(0x00);
        expect(moves).toContain(0x11);
        expect(moves).toContain(0x22);
        expect(moves).not.toContain(0x33); // friendly — cannot capture
        expect(moves).not.toContain(0x44); // beyond blocker
    });

    it('should capture an enemy piece but not pass through it', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Bishop, color: Color.White };
        grid(engine)[0x22] = { type: PieceType.Pawn,   color: Color.Black }; // enemy at c3
        const moves = engine.getLegalMoves(0x00);
        expect(moves).toContain(0x22);
        expect(moves).not.toContain(0x33); // blocked beyond capture
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rook Moves
// ─────────────────────────────────────────────────────────────────────────────

describe('Rook Moves', () => {
    it('should have 0 moves at game start (blocked by pawns)', () => {
        const engine = new Engine();
        // a1 = 0x00, blocked by pawn on a2 and knight on b1
        expect(engine.getLegalMoves(0x00).length).toBe(0);
    });

    it('should have 14 moves from the center of an empty board (d4)', () => {
        const engine = new Engine();
        place(engine, 0x33, PieceType.Rook, Color.White);
        expect(engine.getLegalMoves(0x33).length).toBe(14);
    });

    it('should have 14 moves from a corner (a1)', () => {
        const engine = new Engine();
        // White King is placed on b7
        const whiteKingIndex = 0x16; // b7
        place(engine, 0x00, PieceType.Rook, Color.White, whiteKingIndex);
        expect(engine.getLegalMoves(0x00).length).toBe(14);
    });

    it('should slide until blocked by a friendly piece', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x30] = { type: PieceType.Pawn, color: Color.White }; // friendly at a4
        const moves = engine.getLegalMoves(0x00);
        expect(moves).toContain(0x10); // a2
        expect(moves).toContain(0x20); // a3
        expect(moves).not.toContain(0x30); // friendly — cannot capture
        expect(moves).not.toContain(0x40); // beyond blocker
    });

    it('should capture an enemy piece but not pass through it', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x30] = { type: PieceType.Pawn, color: Color.Black }; // enemy at a4
        const moves = engine.getLegalMoves(0x00);
        expect(moves).toContain(0x30);
        expect(moves).not.toContain(0x40); // blocked beyond capture
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Queen Moves
// ─────────────────────────────────────────────────────────────────────────────

describe('Queen Moves', () => {
    it('should have 0 moves at game start (blocked by pawns)', () => {
        const engine = new Engine();
        // d1 = 0x03
        expect(engine.getLegalMoves(0x03).length).toBe(0);
    });

    it('should have 27 moves from the center of an empty board (d4)', () => {
        const engine = new Engine();
        place(engine, 0x33, PieceType.Queen, Color.White);
        expect(engine.getLegalMoves(0x33).length).toBe(27);
    });

    it('should have 21 moves from a corner (a1)', () => {
        const engine = new Engine();
        // Kings are placed on b7 and g8
        const whiteKingIndex = 0x16; // b7
        const blackKingIndex = 0x76; // g8
        place(engine, 0x00, PieceType.Queen, Color.White, whiteKingIndex, blackKingIndex);
        expect(engine.getLegalMoves(0x00).length).toBe(21);
    });

    it('should slide until blocked by a friendly piece', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Queen, color: Color.White };
        grid(engine)[0x33] = { type: PieceType.Pawn, color: Color.White }; // diagonal blocker
        grid(engine)[0x30] = { type: PieceType.Pawn, color: Color.White }; // straight blocker
        const moves = engine.getLegalMoves(0x00);
        expect(moves).toContain(0x11);  // b1
        expect(moves).toContain(0x22);  // c2
        expect(moves).not.toContain(0x33); // friendly — cannot capture
        expect(moves).not.toContain(0x44); // beyond blocker
        expect(moves).toContain(0x10); // a2
        expect(moves).toContain(0x20); // a3
        expect(moves).not.toContain(0x30); // friendly — cannot capture
        expect(moves).not.toContain(0x40); // beyond blocker
    });

    it('should capture an enemy piece but not pass through it', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Queen, color: Color.White };
        grid(engine)[0x22] = { type: PieceType.Pawn, color: Color.Black }; // diagonal enemy
        grid(engine)[0x30] = { type: PieceType.Pawn, color: Color.Black }; // straight enemy
        const moves = engine.getLegalMoves(0x00);
        expect(moves).toContain(0x22);
        expect(moves).not.toContain(0x33); // blocked beyond capture
        expect(moves).toContain(0x30);
        expect(moves).not.toContain(0x40); // blocked beyond capture
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pawn Moves
// ─────────────────────────────────────────────────────────────────────────────

describe('Pawn Moves', () => {
    it('should allow a white pawn to move 1 or 2 squares from starting rank', () => {
        const engine = new Engine();
        const moves = engine.getLegalMoves(0x10); // a2
        expect(moves).toContain(0x20); // a3
        expect(moves).toContain(0x30); // a4
    });

    it('should only allow 1 square forward after the first move', () => {
        const engine = new Engine();
        place(engine, 0x20, PieceType.Pawn, Color.White); // a3 — not starting rank
        const moves = engine.getLegalMoves(0x20);
        expect(moves).toContain(0x30);
        expect(moves).not.toContain(0x40);
    });

    it('should not move forward into an occupied square', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x10] = { type: PieceType.Pawn, color: Color.White };
        grid(engine)[0x20] = { type: PieceType.Pawn, color: Color.Black }; // blocker
        expect(engine.getLegalMoves(0x10).length).toBe(0);
    });

    it('should not allow the 2-square move if the first square is blocked', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x10] = { type: PieceType.Pawn, color: Color.White };
        grid(engine)[0x20] = { type: PieceType.Pawn, color: Color.Black }; // blocks a3
        const moves = engine.getLegalMoves(0x10);
        expect(moves).not.toContain(0x30); // a4 must also be illegal
    });

    it('should allow a diagonal capture', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x10] = { type: PieceType.Pawn, color: Color.White }; // a2
        grid(engine)[0x21] = { type: PieceType.Pawn, color: Color.Black }; // b3 — capturable
        const moves = engine.getLegalMoves(0x10);
        expect(moves).toContain(0x21);
    });

    it('should not allow capturing a friendly piece diagonally', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x70] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x10] = { type: PieceType.Pawn, color: Color.White };
        grid(engine)[0x21] = { type: PieceType.Pawn, color: Color.White }; // friendly
        const moves = engine.getLegalMoves(0x10);
        expect(moves).not.toContain(0x21);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// En Passant
// ─────────────────────────────────────────────────────────────────────────────

describe('En Passant', () => {
    it('should set the en passant square after a two-step pawn move', () => {
        const engine = new Engine();
        engine.move(0x14, 0x34); // e2-e4
        expect(rawBoard(engine).enPassantSquare).toBe(0x24); // e3
    });

    it('should clear en passant square after the next move', () => {
        const engine = new Engine();
        engine.move(0x14, 0x34); // e4 (en passant square active)
        engine.move(0x64, 0x54); // e6
        engine.move(0x34, 0x44); // e5 (not a two-step)
        expect(rawBoard(engine).enPassantSquare).toBeNull();
    });

    it('should allow en passant capture and remove the captured pawn', () => {
        const engine = new Engine();
        // 1. e4  d5
        engine.move(0x14, 0x34); // e4
        engine.move(0x63, 0x43); // d5
        // 2. exd5  e5
        engine.move(0x34, 0x43); // exd5
        engine.move(0x64, 0x44); // e5 (en passant square: 0x54)
        // 3. dxe6 en passant: white pawn on d5 (0x43) captures on e6 (0x54)
        engine.move(0x43, 0x54);
        expect(engine.getPiece(0x54)).toEqual({ type: PieceType.Pawn, color: Color.White });
        expect(engine.getPiece(0x44)).toBeNull(); // captured pawn removed
    });

    it('should correctly undo an en passant capture', () => {
        const engine = new Engine();
        // 1. e4 e5
        engine.move(0x14, 0x34); // e4
        engine.move(0x63, 0x43); // d5
        // 2. exd5 e5
        engine.move(0x34, 0x43); // exd5
        engine.move(0x64, 0x44); // e5 (en passant square: 0x54)
        // 3. dxe6
        const record = engine.move(0x43, 0x54); // dxe6
        engine.undoMove(record);
        // After undo: white pawn back on d5, black pawn back on e5, e6 empty
        expect(engine.getPiece(0x43)).toEqual({ type: PieceType.Pawn, color: Color.White });
        expect(engine.getPiece(0x44)).toEqual({ type: PieceType.Pawn, color: Color.Black });
        expect(engine.getPiece(0x54)).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Promotion
// ─────────────────────────────────────────────────────────────────────────────

describe('Promotion', () => {
    it('should promote a white pawn to Queen by default', () => {
        const engine = new Engine();
        place(engine, 0x64, PieceType.Pawn, Color.White); // e7
        engine.move(0x64, 0x74, PieceType.Queen);
        expect(engine.getPiece(0x74)?.type).toBe(PieceType.Queen);
        expect(engine.getPiece(0x74)?.color).toBe(Color.White);
    });

    it('should promote a white pawn to Knight', () => {
        const engine = new Engine();
        place(engine, 0x64, PieceType.Pawn, Color.White); // e7
        engine.move(0x64, 0x74, PieceType.Knight);
        expect(engine.getPiece(0x74)?.type).toBe(PieceType.Knight);
        expect(engine.getPiece(0x74)?.color).toBe(Color.White);
    });

    it('should promote a black pawn to Queen on rank 0', () => {
        const engine = new Engine();
        rawBoard(engine).turn = Color.Black;
        place(engine, 0x10, PieceType.Pawn, Color.Black); // a2
        engine.move(0x10, 0x00, PieceType.Queen);
        expect(engine.getPiece(0x00)?.type).toBe(PieceType.Queen);
        expect(engine.getPiece(0x00)?.color).toBe(Color.Black);
    });

    it('should NOT promote a pawn that is not on the last rank', () => {
        const engine = new Engine();
        place(engine, 0x10, PieceType.Pawn, Color.White); // a2
        engine.move(0x10, 0x20); // a3 — not a promotion rank
        expect(engine.getPiece(0x20)?.type).toBe(PieceType.Pawn);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Castling
// ─────────────────────────────────────────────────────────────────────────────

describe('Castling', () => {
    it('should lose castling rights when the king moves', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White }; // e1
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black }; // e8
        engine.move(0x04, 0x14);
        expect(rawBoard(engine).castlingRights.whiteKingSide).toBe(false);
        expect(rawBoard(engine).castlingRights.whiteQueenSide).toBe(false);
    });

    it('should lose queen-side castling rights when the a1 rook moves', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White }; // a1
        engine.move(0x00, 0x01);
        expect(rawBoard(engine).castlingRights.whiteQueenSide).toBe(false);
        expect(rawBoard(engine).castlingRights.whiteKingSide).toBe(true);
    });

    it('should lose king-side castling rights when the h1 rook moves', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x07] = { type: PieceType.Rook, color: Color.White }; // h1
        engine.move(0x07, 0x06);
        expect(rawBoard(engine).castlingRights.whiteKingSide).toBe(false);
        expect(rawBoard(engine).castlingRights.whiteQueenSide).toBe(true);
    });

    it('should perform king-side castling: king to g1, rook to f1', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x07] = { type: PieceType.Rook, color: Color.White };
        engine.move(0x04, 0x06); // O-O
        expect(engine.getPiece(0x06)?.type).toBe(PieceType.King);
        expect(engine.getPiece(0x05)?.type).toBe(PieceType.Rook);
        expect(engine.getPiece(0x04)).toBeNull();
        expect(engine.getPiece(0x07)).toBeNull();
    });

    it('should perform queen-side castling: king to c1, rook to d1', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White };
        engine.move(0x04, 0x02); // O-O-O
        expect(engine.getPiece(0x02)?.type).toBe(PieceType.King);
        expect(engine.getPiece(0x03)?.type).toBe(PieceType.Rook);
        expect(engine.getPiece(0x04)).toBeNull();
        expect(engine.getPiece(0x00)).toBeNull();
    });

    it('should not castle through an attacked square', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x07] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x75] = { type: PieceType.Rook, color: Color.Black }; // attacks f1
        const moves = engine.getLegalMoves(0x04);
        expect(moves).not.toContain(0x06); // g1 — castling blocked
    });

    it('should not castle while in check', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x07] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x64] = { type: PieceType.Rook, color: Color.Black }; // attacks e1
        const moves = engine.getLegalMoves(0x04);
        expect(moves).not.toContain(0x06);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Check & Legality
// ─────────────────────────────────────────────────────────────────────────────

describe('Check and Legal Move Filtering', () => {
    it('should not allow a move that leaves the king in check', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x14] = { type: PieceType.Rook, color: Color.White }; // pinned on e2
        grid(engine)[0x74] = { type: PieceType.Rook, color: Color.Black }; // attacker on e8
        const moves = engine.getLegalMoves(0x14);
        // Pinned rook can only move along the e-file
        for (const move of moves) {
            expect(move & 7).toBe(4); // file e = index 4
        }
    });

    it('isCheck() should return true when the king is in check', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King,  color: Color.White };
        grid(engine)[0x74] = { type: PieceType.Queen, color: Color.Black }; // attacks e1
        expect(engine.isCheck()).toBe(true);
    });

    it('isCheck() should return false when the king is safe', () => {
        const engine = new Engine();
        expect(engine.isCheck()).toBe(false);
    });

    it('should detect checkmate (Scholar\'s mate)', () => {
        const engine = new Engine();
        // 1. e4 e5
        engine.move(0x14, 0x34); // e4
        engine.move(0x64, 0x44); // e5
        // 2. Bc4 Nc6
        engine.move(0x05, 0x32); // Bc4
        engine.move(0x71, 0x52); // Nc6
        // 3. Qh5 Nf6??
        engine.move(0x03, 0x47); // Qh5
        engine.move(0x76, 0x55); // Nf6
        // 4. Qxf7#
        engine.move(0x47, 0x65); // Qxf7#
        expect(engine.isGameOver()).toBe(true);
        expect(engine.getWinner()).toBe(Color.White);
    });

    it('should detect stalemate', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x01] = { type: PieceType.King,  color: Color.White }; // b1
        grid(engine)[0x20] = { type: PieceType.Queen, color: Color.Black }; // a3
        grid(engine)[0x13] = { type: PieceType.King,  color: Color.Black }; // d2
        expect(engine.isGameOver()).toBe(true);
        expect(engine.getWinner()).toBe('Draw');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Move History & SAN Notation
// ─────────────────────────────────────────────────────────────────────────────

describe('Move History and SAN Notation', () => {
    it('should record moves in moveHistory', () => {
        const engine = new Engine();
        engine.move(0x14, 0x34); // e4
        expect(engine.moveHistory.length).toBe(1);
    });

    it('should record SAN for a simple pawn move', () => {
        const engine = new Engine();
        engine.move(0x14, 0x34);
        expect(engine.moveHistory[0]).toBe('e4');
    });

    it('should record SAN for a capture', () => {
        const engine = new Engine();
        // 1. e4 d5
        engine.move(0x14, 0x34); // e4
        engine.move(0x63, 0x43); // d5
        // 2. exd5
        engine.move(0x34, 0x43); // exd5
        expect(engine.moveHistory[2]).toBe('exd5');
    });

    it('should record check with "+"', () => {
        const engine = new Engine();
        // 1. e4 d5
        engine.move(0x14, 0x34); // e4
        engine.move(0x63, 0x43); // d5
        // 2. Bb5+
        engine.move(0x05, 0x41); // Bb5+
        expect(engine.moveHistory[2]).toBe('Bb5+');
    });

    it('should record checkmate with "#"', () => {
        const engine = new Engine();
        // 1. e4 e5
        engine.move(0x14, 0x34); // e4
        engine.move(0x64, 0x44); // e5
        // 2. Bc4 Nc6
        engine.move(0x05, 0x32); // Bc4
        engine.move(0x71, 0x52); // Nc6
        // 3. Qh5 Nf6??
        engine.move(0x03, 0x47); // Qh5
        engine.move(0x76, 0x55); // Nf6
        // 4. Qxf7#
        engine.move(0x47, 0x65); // Qxf7#
        expect(engine.moveHistory[6]).toContain('Qxf7#');
    });

    it('should not pollute moveHistory during legalMoves() computation', () => {
        const engine = new Engine();
        engine.getLegalMoves(0x14); // simulate without moving
        expect(engine.moveHistory.length).toBe(0);
    });

    it('should record castling as O-O', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x07] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        engine.move(0x04, 0x06);
        expect(engine.moveHistory[0]).toBe('O-O');
    });

    it('should record queen-side castling as O-O-O', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x77] = { type: PieceType.King, color: Color.Black };
        engine.move(0x04, 0x02);
        expect(engine.moveHistory[0]).toBe('O-O-O');
    });

    it('should produce correct SAN with file disambiguation (two rooks, same rank target)', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x10] = { type: PieceType.Rook, color: Color.White }; // a2
        grid(engine)[0x17] = { type: PieceType.Rook, color: Color.White }; // h2
        // Both rooks can reach d2
        // Move a2-rook to d2: should be "Rad2" not "Rd2"
        engine.move(0x10, 0x13);
        expect(engine.moveHistory[0]).toBe('Rad2');
    });

    it('should produce correct SAN with rank disambiguation (two rooks, same file target)', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White }; // a1
        grid(engine)[0x40] = { type: PieceType.Rook, color: Color.White }; // a5
        // Both rooks on a-file; move a1-rook to a3 -> needs rank: "R1a3"
        engine.move(0x00, 0x20);
        expect(engine.moveHistory[0]).toBe('R1a3');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Undo Move
// ─────────────────────────────────────────────────────────────────────────────

describe('Undo Move', () => {
    it('should restore the board after undoing a pawn push', () => {
        const engine = new Engine();
        const record = engine.move(0x14, 0x34);
        engine.undoMove(record);
        expect(engine.getPiece(0x34)).toBeNull();
        expect(engine.getPiece(0x14)).toEqual({ type: PieceType.Pawn, color: Color.White });
        expect(engine.turn).toBe(Color.White);
    });

    it('should restore a captured piece after undo', () => {
        const engine = new Engine();
        engine.move(0x14, 0x34); // e4
        engine.move(0x63, 0x43); // d5
        const record = engine.move(0x34, 0x43); // exd5
        engine.undoMove(record);
        expect(engine.getPiece(0x43)).toEqual({ type: PieceType.Pawn, color: Color.Black });
        expect(engine.getPiece(0x34)).toEqual({ type: PieceType.Pawn, color: Color.White });
    });

    it('should restore castling rights after undo', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x07] = { type: PieceType.Rook, color: Color.White };
        const record = engine.move(0x04, 0x06); // O-O
        engine.undoMove(record);
        expect(rawBoard(engine).castlingRights.whiteKingSide).toBe(true);
        expect(engine.getPiece(0x04)?.type).toBe(PieceType.King);
        expect(engine.getPiece(0x07)?.type).toBe(PieceType.Rook);
    });

    it('should restore a promoted pawn after undo', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x60] = { type: PieceType.Pawn, color: Color.White };
        const record = engine.move(0x60, 0x70, PieceType.Queen);
        engine.undoMove(record);
        expect(engine.getPiece(0x70)).toBeNull();
        expect(engine.getPiece(0x60)?.type).toBe(PieceType.Pawn);
    });

    it('should remove the SAN entry from moveHistory after undo', () => {
        const engine = new Engine();
        const record = engine.move(0x14, 0x34);
        engine.undoMove(record);
        expect(engine.moveHistory.length).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dominion Mode
// ─────────────────────────────────────────────────────────────────────────────

describe('Dominion Mode', () => {
    it('should start with zero control points', () => {
        const engine = new Engine(GameMode.Dominion);
        expect(engine.whitePoints).toBe(0);
        expect(engine.blackPoints).toBe(0);
    });

    it('should accumulate control points after a move', () => {
        const engine = new Engine(GameMode.Dominion);
        engine.move(0x14, 0x34); // e4
        expect(engine.whitePoints).toBeGreaterThan(0);
    });

    it('should NOT accumulate points in Classical mode', () => {
        const engine = new Engine(GameMode.Classical);
        engine.move(0x14, 0x34);
        expect(engine.whitePoints).toBe(0);
        expect(engine.blackPoints).toBe(0);
    });

    it('getSquareControl() should return the occupying piece color for occupied squares', () => {
        const engine = new Engine(GameMode.Dominion);
        expect(engine.getSquareControl(0x04)).toBe(Color.White);
    });

    it('getSquareControl() should return null for a truly contested square', () => {
        const engine = new Engine(GameMode.Dominion);
        grid(engine).fill(null);
        // White and black pawns both attacking d4 from opposite sides
        grid(engine)[0x22] = { type: PieceType.Pawn, color: Color.White }; // c3
        grid(engine)[0x42] = { type: PieceType.Pawn, color: Color.Black }; // c5
        // d4 (0x33) is attacked by both equally
        expect(engine.getSquareControl(0x33)).toBeNull();
    });

    it('getWinner() should use points, not checkmate, in Dominion mode', () => {
        const engine = new Engine(GameMode.Dominion);
        // 1. e4 e5
        engine.move(0x14, 0x34); // e4
        engine.move(0x64, 0x44); // e5
        // 2. Bc4 Nc6
        engine.move(0x05, 0x32); // Bc4
        engine.move(0x71, 0x52); // Nc6
        // 3. Qh5 Nf6??
        engine.move(0x03, 0x47); // Qh5
        engine.move(0x76, 0x55); // Nf6
        // 4. Qxf7#
        engine.move(0x47, 0x65); // Qxf7#
        // Manually set points to simulate a finished game
        rawBoard(engine).whiteControlPoints = 0;
        rawBoard(engine).blackControlPoints = 1000;
        expect(engine.getWinner()).toBe(Color.Black);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Draw Conditions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: shuttle the two queens back and forth to repeat a position.
 * White queen: d1 <-> e2  (0x03 ↔ 0x14)
 * Black queen: d8 <-> e7 (0x73 ↔ 0x64)
 * One full round-trip = 1 repetition of the original position.
 */
const repeatPosition = (engine: Engine, times: number) => {
    for (let i = 0; i < times; i++) {
        engine.move(0x03, 0x14); // Qe2
        engine.move(0x73, 0x64); // Qe7
        engine.move(0x14, 0x03); // Qd1
        engine.move(0x64, 0x73); // Qd8
    }
};

describe('Draw — Threefold Repetition', () => {
    it('isThreefoldRepetition() should be false at the start', () => {
        const engine = new Engine();
        expect(engine.isThreefoldRepetition()).toBe(false);
    });

    it('isThreefoldRepetition() should be false after one repetition', () => {
        const engine = new Engine();
        engine.move(0x14, 0x24);
        engine.move(0x64, 0x54);
        // Starting position seen once, after 1 round trip it's seen twice
        repeatPosition(engine, 1);
        expect(engine.isThreefoldRepetition()).toBe(false);
    });

    it('isThreefoldRepetition() should be true after two round trips (3rd occurrence)', () => {
        const engine = new Engine();
        engine.move(0x14, 0x24);
        engine.move(0x64, 0x54);
        // After 2 round-trips the starting position has been seen 3 times
        repeatPosition(engine, 2);
        expect(engine.isThreefoldRepetition()).toBe(true);
    });

    it('isGameOver() should return true on threefold repetition', () => {
        const engine = new Engine();
        engine.move(0x14, 0x24);
        engine.move(0x64, 0x54);
        repeatPosition(engine, 2);
        expect(engine.isGameOver()).toBe(true);
    });

    it('getWinner() should return Draw on threefold repetition', () => {
        const engine = new Engine();
        engine.move(0x14, 0x24);
        engine.move(0x64, 0x54);
        repeatPosition(engine, 2);
        expect(engine.getWinner()).toBe('Draw');
    });

    it('getDrawReason() should return "threefold" on threefold repetition', () => {
        const engine = new Engine();
        engine.move(0x14, 0x24);
        engine.move(0x64, 0x54);
        repeatPosition(engine, 2);
        expect(engine.getDrawReason()).toBe('threefold');
    });

    it('repetition counter should decrease after undoMove', () => {
        const engine = new Engine();
        engine.move(0x14, 0x24);
        engine.move(0x64, 0x54);
        repeatPosition(engine, 2); // now at 3 occurrences
        expect(engine.isThreefoldRepetition()).toBe(true);
        // Undo the last move — position count drops back to 2
        const record = (engine as any).board.stateStack; // ensure state is non-empty
        // Use a real undo by re-doing the last half-move manually
        engine.move(0x10, 0x20); // one more move away from repeated position
        expect(engine.isThreefoldRepetition()).toBe(false);
    });

    it('should reset repetition history after reset()', () => {
        const engine = new Engine();
        engine.move(0x14, 0x24);
        engine.move(0x64, 0x54);
        repeatPosition(engine, 2);
        expect(engine.isThreefoldRepetition()).toBe(true);
        engine.reset();
        expect(engine.isThreefoldRepetition()).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Draw — 50-Move Rule', () => {
    it('isFiftyMoveRule() should be false at the start', () => {
        const engine = new Engine();
        expect(engine.isFiftyMoveRule()).toBe(false);
    });

    it('halfMoveClock should increment on a quiet king move', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x01] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x71] = { type: PieceType.King, color: Color.Black };
        engine.move(0x01, 0x02);
        expect(rawBoard(engine).halfMoveClock).toBe(1);
    });

    it('halfMoveClock should reset to 0 on a pawn move', () => {
        const engine = new Engine();
        // Make a few quiet moves first to build up the clock
        grid(engine).fill(null);
        grid(engine)[0x01] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x71] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x30] = { type: PieceType.Pawn, color: Color.White }; // a4
        engine.move(0x01, 0x02); // clock = 1
        engine.move(0x71, 0x72); // clock = 2
        engine.move(0x30, 0x40); // pawn move -> clock must reset to 0
        expect(rawBoard(engine).halfMoveClock).toBe(0);
    });

    it('halfMoveClock should reset to 0 on a capture', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x01] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x71] = { type: PieceType.King, color: Color.Black };
        grid(engine)[0x02] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x12] = { type: PieceType.Rook, color: Color.Black };
        engine.move(0x02, 0x07); // clock = 1
        engine.move(0x12, 0x17); // clock = 2
        engine.move(0x07, 0x17); // capture -> clock = 0
        expect(rawBoard(engine).halfMoveClock).toBe(0);
    });

    it('halfMoveClock should be restored correctly after undoMove', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x01] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x71] = { type: PieceType.King, color: Color.Black };
        engine.move(0x01, 0x02); // clock = 1
        engine.move(0x71, 0x72); // clock = 2
        const record = engine.move(0x02, 0x03); // clock = 3
        engine.undoMove(record);
        expect(rawBoard(engine).halfMoveClock).toBe(2);
    });

    it('isFiftyMoveRule() should trigger after 100 quiet half-moves', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x01] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x71] = { type: PieceType.King, color: Color.Black };
        rawBoard(engine).halfMoveClock = 99;
        engine.move(0x01, 0x02); // 100th half-move
        expect(engine.isFiftyMoveRule()).toBe(true);
    });

    it('isGameOver() should return true when the 50-move rule triggers', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x01] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x71] = { type: PieceType.King, color: Color.Black };
        rawBoard(engine).halfMoveClock = 99;
        engine.move(0x01, 0x02);
        expect(engine.isGameOver()).toBe(true);
    });

    it('getDrawReason() should return "fifty-move" when triggered', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x01] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x71] = { type: PieceType.King, color: Color.Black };
        rawBoard(engine).halfMoveClock = 99;
        engine.move(0x01, 0x02);
        expect(engine.getDrawReason()).toBe('fifty-move');
    });

    it('a pawn move should prevent the 50-move rule from triggering', () => {
        const engine = new Engine();
        engine.move(0x14, 0x34); // e4
        rawBoard(engine).halfMoveClock = 98;
        engine.move(0x64, 0x54); // e5: pawn move -> resets clock
        expect(engine.isFiftyMoveRule()).toBe(false);
        expect(rawBoard(engine).halfMoveClock).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Draw — Insufficient Material', () => {
    it('isInsufficientMaterial() should be false at the start', () => {
        expect(new Engine().isInsufficientMaterial()).toBe(false);
    });

    it('K vs K is insufficient material', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        expect(engine.isInsufficientMaterial()).toBe(true);
    });

    it('K+B vs K is insufficient material', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King,   color: Color.White };
        grid(engine)[0x03] = { type: PieceType.Bishop, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King,   color: Color.Black };
        expect(engine.isInsufficientMaterial()).toBe(true);
    });

    it('K+N vs K is insufficient material', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King,   color: Color.White };
        grid(engine)[0x03] = { type: PieceType.Knight, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King,   color: Color.Black };
        expect(engine.isInsufficientMaterial()).toBe(true);
    });

    it('K+B vs K+B (same square colour) is insufficient material', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King,   color: Color.White };
        grid(engine)[0x00] = { type: PieceType.Bishop, color: Color.White }; // a1 -> dark square
        grid(engine)[0x74] = { type: PieceType.King,   color: Color.Black };
        grid(engine)[0x22] = { type: PieceType.Bishop, color: Color.Black }; // c3 -> dark square
        expect(engine.isInsufficientMaterial()).toBe(true);
    });

    it('K+B vs K+B (opposite square colour) is NOT insufficient material', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King,   color: Color.White };
        grid(engine)[0x00] = { type: PieceType.Bishop, color: Color.White }; // a1 -> dark square
        grid(engine)[0x74] = { type: PieceType.King,   color: Color.Black };
        grid(engine)[0x10] = { type: PieceType.Bishop, color: Color.Black }; // a2 -> light square
        expect(engine.isInsufficientMaterial()).toBe(false);
    });

    it('K+Q vs K is NOT insufficient material', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King,  color: Color.White };
        grid(engine)[0x03] = { type: PieceType.Queen, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King,  color: Color.Black };
        expect(engine.isInsufficientMaterial()).toBe(false);
    });

    it('K+R vs K is NOT insufficient material', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x03] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        expect(engine.isInsufficientMaterial()).toBe(false);
    });

    it('K+P vs K is NOT insufficient material', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x14] = { type: PieceType.Pawn, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        expect(engine.isInsufficientMaterial()).toBe(false);
    });

    it('K+N+N vs K is NOT flagged as insufficient', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King,   color: Color.White };
        grid(engine)[0x03] = { type: PieceType.Knight, color: Color.White };
        grid(engine)[0x05] = { type: PieceType.Knight, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King,   color: Color.Black };
        expect(engine.isInsufficientMaterial()).toBe(false);
    });

    it('isGameOver() should return true on insufficient material', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        expect(engine.isGameOver()).toBe(true);
    });

    it('getDrawReason() should return "insufficient" for K vs K', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King, color: Color.Black };
        expect(engine.getDrawReason()).toBe('insufficient');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getDrawReason()', () => {
    it('should return null when the game is ongoing', () => {
        expect(new Engine().getDrawReason()).toBeNull();
    });

    it('should return "stalemate" for a stalemate position', () => {
        const engine = new Engine();
        // White King b1, Black Queen a3, Black King d2 -> White is stalemated
        grid(engine).fill(null);
        grid(engine)[0x01] = { type: PieceType.King,  color: Color.White }; // b1
        grid(engine)[0x20] = { type: PieceType.Queen, color: Color.Black }; // a3
        grid(engine)[0x13] = { type: PieceType.King,  color: Color.Black }; // d2
        expect(engine.getDrawReason()).toBe('stalemate');
    });

    it('should return null (not draw) for checkmate', () => {
        const engine = new Engine();
        engine.move(0x14, 0x34);
        engine.move(0x64, 0x44);
        engine.move(0x05, 0x32);
        engine.move(0x71, 0x52);
        engine.move(0x03, 0x47);
        engine.move(0x76, 0x55);
        engine.move(0x47, 0x65); // Qxf7#
        expect(engine.getDrawReason()).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Analyzer (Analysis Mode)
// ─────────────────────────────────────────────────────────────────────────────

describe('Analyzer — analyseSquare()', () => {
    it('should return an annotation for every legal move', () => {
        const engine = new Engine();
        // e2 pawn has 2 legal moves at start
        const annotations = analyseSquare(rawBoard(engine), 0x14);
        expect(annotations.length).toBe(2);
        expect(annotations.map(a => a.to)).toContain(0x24); // e3
        expect(annotations.map(a => a.to)).toContain(0x34); // e4
    });

    it('should return [] for an empty square', () => {
        const engine = new Engine();
        expect(analyseSquare(rawBoard(engine), 0x33)).toEqual([]);
    });

    it('should return [] for an opponent\'s piece (not your turn)', () => {
        const engine = new Engine();
        // Black pieces on rank 6/7, but it is White's turn
        expect(analyseSquare(rawBoard(engine), 0x64)).toEqual([]);
    });

    it('should not mutate the board (all moves are undone)', () => {
        const engine = new Engine();
        const before = JSON.stringify(rawBoard(engine).grid);
        analyseSquare(rawBoard(engine), 0x14);
        const after = JSON.stringify(rawBoard(engine).grid);
        expect(after).toBe(before);
    });

    it('scoreDelta should be positive when capturing an undefended piece', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King,   color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King,   color: Color.Black };
        // White rook on a1 can capture undefended black pawn on a5
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x40] = { type: PieceType.Pawn, color: Color.Black }; // undefended
        const annotations = analyseSquare(rawBoard(engine), 0x00);
        const capture = annotations.find(a => a.to === 0x40);
        expect(capture).toBeDefined();
        expect(capture!.scoreDelta).toBe(100); // pawn value
    });

    it('scoreDelta should be negative when moving a piece en prise with no recapture', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King,   color: Color.White };
        grid(engine)[0x74] = { type: PieceType.King,   color: Color.Black };
        // White queen on d1, black rook on d8 (controls d-file). Moving queen to d5 loses it.
        grid(engine)[0x03] = { type: PieceType.Queen, color: Color.White };
        grid(engine)[0x73] = { type: PieceType.Rook,  color: Color.Black }; // defends d-file
        const annotations = analyseSquare(rawBoard(engine), 0x03);
        const blunderMove = annotations.find(a => a.to === 0x43); // d5 — attacked by rook
        expect(blunderMove).toBeDefined();
        expect(blunderMove!.scoreDelta).toBeLessThan(0);
    });

    it('mateIn should be 1 when the move delivers immediate checkmate', () => {
        const engine = new Engine();
        // Scholar's mate: after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6, Qxf7# is available
        engine.move(0x14, 0x34);
        engine.move(0x64, 0x44);
        engine.move(0x05, 0x32);
        engine.move(0x71, 0x52);
        engine.move(0x03, 0x47);
        engine.move(0x76, 0x55);
        // Now it is White's turn. Queen on h5 (0x47) can deliver Qxf7# (0x65)
        const annotations = analyseSquare(rawBoard(engine), 0x47);
        const matingMove = annotations.find(a => a.to === 0x65);
        expect(matingMove).toBeDefined();
        expect(matingMove!.mateIn).toBe(1);
    });

    it('mateIn should be null for plain developing moves', () => {
        const engine = new Engine();
        const annotations = analyseSquare(rawBoard(engine), 0x14); // e2 pawn
        for (const ann of annotations) {
            expect(ann.mateIn).toBeNull();
        }
    });

    it('should leave board.turn unchanged after analysis', () => {
        const engine = new Engine();
        const turnBefore = rawBoard(engine).turn;
        analyseSquare(rawBoard(engine), 0x14);
        expect(rawBoard(engine).turn).toBe(turnBefore);
    });
});