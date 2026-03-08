import { describe, it, expect, beforeEach } from 'vitest';
import { Engine } from './Engine';
import { Color, PieceType, GameMode } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Access the private Board instance inside Engine for low-level inspection. */
const rawBoard = (engine: Engine) => (engine as any).board;

/** Directly read/write the 0x88 grid, bypassing the Engine API. */
const grid = (engine: Engine) => rawBoard(engine).grid as any[];

/** Clear the board and place a single piece. */
const place = (engine: Engine, index: number, type: PieceType, color: Color) => {
    grid(engine).fill(null);
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
        // Check all squares in the 4 central rows (ranks 3-4, indices 0x30-0x3F and 0x40-0x4F)
        for (let rank = 3; rank <= 4; rank++) {
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
        for (const corner of corners) {
            place(engine, corner, PieceType.Knight, Color.White);
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
        for (let offset = 2; offset < 6; offset++) {
            // c2-f2
            place(engine, 0x10+offset, PieceType.Knight, Color.White);
            expect(engine.getLegalMoves(0x10+offset).length).toBe(6);
            // c6-f6
            place(engine, 0x60+offset, PieceType.Knight, Color.White);
            expect(engine.getLegalMoves(0x60+offset).length).toBe(6);
            // b3-b6
            place(engine, 0x01+offset*16, PieceType.Knight, Color.White);
            expect(engine.getLegalMoves(0x01+offset*16).length).toBe(6);
            // f3-f6
            place(engine, 0x06+offset*16, PieceType.Knight, Color.White);
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
        grid(engine)[0x00] = { type: PieceType.Knight, color: Color.White };
        grid(engine)[0x12] = { type: PieceType.Pawn,   color: Color.White }; // friendly blocker
        const moves = engine.getLegalMoves(0x00);
        expect(moves).not.toContain(0x12);
    });

    it('should capture an enemy piece', () => {
        const engine = new Engine();
        grid(engine).fill(null);
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
        grid(engine)[0x00] = { type: PieceType.Bishop, color: Color.White };
        grid(engine)[0x33] = { type: PieceType.Pawn,   color: Color.White }; // blocker
        const moves = engine.getLegalMoves(0x00);
        // Should reach 0x11, 0x22, but NOT 0x33 (friendly) or beyond
        expect(moves).toContain(0x11);
        expect(moves).toContain(0x22);
        expect(moves).not.toContain(0x33);
        expect(moves).not.toContain(0x44);
    });

    it('should capture an enemy piece but not pass through it', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x00] = { type: PieceType.Bishop, color: Color.White };
        grid(engine)[0x22] = { type: PieceType.Pawn,   color: Color.Black }; // enemy blocker
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
        place(engine, 0x00, PieceType.Rook, Color.White);
        expect(engine.getLegalMoves(0x00).length).toBe(14);
    });

    it('should slide until blocked by a friendly piece', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x30] = { type: PieceType.Pawn, color: Color.White }; // blocker at a4
        const moves = engine.getLegalMoves(0x00);
        expect(moves).toContain(0x10); // a2
        expect(moves).toContain(0x20); // a3
        expect(moves).not.toContain(0x30); // friendly — cannot capture
        expect(moves).not.toContain(0x40); // beyond blocker
    });

    it('should capture an enemy piece but not pass through it', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x30] = { type: PieceType.Pawn,   color: Color.Black }; // enemy blocker
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
        place(engine, 0x00, PieceType.Queen, Color.White);
        expect(engine.getLegalMoves(0x00).length).toBe(21);
    });

    it('should slide until blocked by a friendly piece', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x00] = { type: PieceType.Queen, color: Color.White };
        grid(engine)[0x33] = { type: PieceType.Pawn, color: Color.White }; // blocker at a4
        grid(engine)[0x30] = { type: PieceType.Pawn, color: Color.White }; // blocker at a4
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
        grid(engine)[0x00] = { type: PieceType.Queen, color: Color.White };
        grid(engine)[0x22] = { type: PieceType.Pawn,   color: Color.Black }; // enemy blocker
        grid(engine)[0x30] = { type: PieceType.Pawn,   color: Color.Black }; // enemy blocker
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
        grid(engine)[0x10] = { type: PieceType.Pawn, color: Color.White };
        grid(engine)[0x20] = { type: PieceType.Pawn, color: Color.Black }; // blocker
        expect(engine.getLegalMoves(0x10).length).toBe(0);
    });

    it('should not allow the 2-square move if the first square is blocked', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x10] = { type: PieceType.Pawn, color: Color.White };
        grid(engine)[0x20] = { type: PieceType.Pawn, color: Color.Black }; // blocks a3
        const moves = engine.getLegalMoves(0x10);
        expect(moves).not.toContain(0x30); // a4 must also be illegal
    });

    it('should allow a diagonal capture', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x10] = { type: PieceType.Pawn, color: Color.White }; // a2
        grid(engine)[0x21] = { type: PieceType.Pawn, color: Color.Black }; // b3 — capturable
        const moves = engine.getLegalMoves(0x10);
        expect(moves).toContain(0x21);
    });

    it('should not allow capturing a friendly piece diagonally', () => {
        const engine = new Engine();
        grid(engine).fill(null);
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
        engine.move(0x14, 0x34); // e2-e4
        engine.move(0x64, 0x54); // e7-e5
        engine.move(0x34, 0x44); // e4-e5 (no longer a two-step)
        expect(rawBoard(engine).enPassantSquare).toBeNull();
    });

    it('should allow en passant capture and remove the captured pawn', () => {
        const engine = new Engine();
        // 1. e4  d5
        engine.move(0x14, 0x34); // e4
        engine.move(0x63, 0x43); // d5
        // 2. exd5  e5  
        engine.move(0x34, 0x43); // exd5
        engine.move(0x64, 0x44); // e5 (black double-steps — sets en passant on e6)
        // 3. dxe6 en passant
        engine.move(0x43, 0x54); // e5 takes d6
        expect(engine.getPiece(0x54)).toEqual({ type: PieceType.Pawn, color: Color.White });
        expect(engine.getPiece(0x44)).toBeNull(); // captured pawn removed
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Promotion
// ─────────────────────────────────────────────────────────────────────────────

describe('Promotion', () => {
    it('should promote a white pawn to Queen by default', () => {
        const engine = new Engine();
        place(engine, 0x60, PieceType.Pawn, Color.White); // a7
        engine.move(0x60, 0x70, PieceType.Queen);
        expect(engine.getPiece(0x70)?.type).toBe(PieceType.Queen);
        expect(engine.getPiece(0x70)?.color).toBe(Color.White);
    });

    it('should promote a white pawn to Knight', () => {
        const engine = new Engine();
        place(engine, 0x60, PieceType.Pawn, Color.White); // a7
        engine.move(0x60, 0x70, PieceType.Knight);
        expect(engine.getPiece(0x70)?.type).toBe(PieceType.Knight);
        expect(engine.getPiece(0x70)?.color).toBe(Color.White);
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
        engine.move(0x04, 0x14); // king steps forward (illegal in real chess, but tests rights)
        expect(rawBoard(engine).castlingRights.whiteKingSide).toBe(false);
        expect(rawBoard(engine).castlingRights.whiteQueenSide).toBe(false);
    });

    it('should lose queen-side castling rights when the a1 rook moves', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White }; // a1
        engine.move(0x00, 0x01);
        expect(rawBoard(engine).castlingRights.whiteQueenSide).toBe(false);
        expect(rawBoard(engine).castlingRights.whiteKingSide).toBe(true);
    });

    it('should lose king-side castling rights when the h1 rook moves', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x07] = { type: PieceType.Rook, color: Color.White }; // h1
        engine.move(0x07, 0x06); // rook moves
        expect(rawBoard(engine).castlingRights.whiteKingSide).toBe(false);
        expect(rawBoard(engine).castlingRights.whiteQueenSide).toBe(true);
    });

    it('should perform king-side castling: king to g1, rook to f1', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White }; // e1
        grid(engine)[0x07] = { type: PieceType.Rook, color: Color.White }; // h1
        engine.move(0x04, 0x06); // O-O
        expect(engine.getPiece(0x06)?.type).toBe(PieceType.King);
        expect(engine.getPiece(0x05)?.type).toBe(PieceType.Rook);
        expect(engine.getPiece(0x04)).toBeNull();
        expect(engine.getPiece(0x07)).toBeNull();
    });

    it('should perform queen-side castling: king to c1, rook to d1', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White }; // e1
        grid(engine)[0x00] = { type: PieceType.Rook, color: Color.White }; // a1
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
        grid(engine)[0x07] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x75] = { type: PieceType.Rook, color: Color.Black }; // attacks f1
        const moves = engine.getLegalMoves(0x04);
        expect(moves).not.toContain(0x06); // g1 — castling blocked
    });

    it('should not castle while in check', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x07] = { type: PieceType.Rook, color: Color.White };
        grid(engine)[0x74] = { type: PieceType.Rook, color: Color.Black }; // attacks e1 (king)
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
        // King on e1, Black rook on e8 — any piece on e-file is pinned
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
        grid(engine)[0x14] = { type: PieceType.Rook, color: Color.White }; // pinned on e2
        grid(engine)[0x74] = { type: PieceType.Rook, color: Color.Black }; // attacker on e8
        const moves = engine.getLegalMoves(0x14);
        // The rook can only move along the e-file (stays between king and attacker)
        for (const move of moves) {
            expect(move & 7).toBe(4); // all legal moves must stay on file e (file index 4)
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
        // Manually construct a stalemate position:
        // White King on b1, Black Queen on a3, Black King on d2
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
        const record = engine.move(0x34, 0x43); // exd5 (capture)
        engine.undoMove(record);
        expect(engine.getPiece(0x43)).toEqual({ type: PieceType.Pawn, color: Color.Black });
        expect(engine.getPiece(0x34)).toEqual({ type: PieceType.Pawn, color: Color.White });
    });

    it('should restore castling rights after undo', () => {
        const engine = new Engine();
        grid(engine).fill(null);
        grid(engine)[0x04] = { type: PieceType.King, color: Color.White };
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
        // e1 has the White King at start
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