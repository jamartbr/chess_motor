import { describe, it, expect, beforeEach } from 'vitest';
import { Board } from './Board';
import { Color, PieceType } from './types';

describe('Board Initialization', () => {
    it('should have a White King on e1', () => {
        const board = new Board();
        // e1 = Rank 0, File 4. In 0x88: (0 << 4) | 4 = 4
        const piece = board.getPieceAt(0x04);
        expect(piece).toEqual({ type: 'k', color: 'w' });
    });

    it('should have a Black Queen on d8', () => {
        const board = new Board();
        // d8 = Rank 7, File 3. In 0x88: (7 << 4) | 3 = 115 (0x73)
        const piece = board.getPieceAt(0x73);
        expect(piece).toEqual({ type: 'q', color: 'b' });
    });

    it('should have empty squares in the middle (e4)', () => {
        const board = new Board();
        const piece = board.getPieceAt(0x34); // Rank 3, File 4
        expect(piece).toBeNull();
    });
});

describe('Knight Moves', () => {
    it('should calculate 8 moves for a knight in the center', () => {
        const board = new Board();
        (board as any).grid.fill(null); // Clear the board
        // Place a white knight at d4
        (board as any).grid[0x33] = { type: 'n', color: 'w' };
        const moves = board.getKnightMoves(0x33); 
        expect(moves.length).toBe(8);
    });

    it('should not allow jumping off the board', () => {
        const board = new Board();
        (board as any).grid.fill(null); // Clear the board
        // Place a white knight at a1
        (board as any).grid[0x00] = { type: 'n', color: 'w' };
        // A knight at a1 only has 2 legal moves
        const moves = board.getKnightMoves(0x00); 
        expect(moves.length).toBe(2);
    });
});

describe('Bishop Moves', () => {
    it('should allow Bishop to slide until blocked by a friend', () => {
        const board = new Board(); // resetBoard places pieces at start
        // White Bishops is at c1 (0x02)
        // It is blocked by a Pawn at c2 (0x12), and a Knight at b1 (0x01) and the Queen at d1 (0x03)
        const moves = board.getValidMoves(0x02); 
        
        // At the start of the game, a Bishop has 0 legal moves
        expect(moves.length).toBe(0);
    });
});

describe('Rook Moves', () => {
    it('should allow Rook to slide until blocked by a friend', () => {
        const board = new Board(); // resetBoard places pieces at start
        // White Rook is at a1 (0x00). 
        // It is blocked by a Pawn at a2 (0x10) and a Knight at b1 (0x01)
        const moves = board.getValidMoves(0x00); 
        
        // At the start of the game, a Rook has 0 legal moves
        expect(moves.length).toBe(0);
    });
});

describe('Queen Moves', () => {
    it('should allow a Queen in the center of an empty board to have 27 moves', () => {
        const board = new Board();
        (board as any).grid.fill(null); // Clear the board
        // Place a white queen at d4
        (board as any).grid[0x33] = { type: 'q', color: 'w' };
        const moves = board.getValidMoves(0x33);
        expect(moves.length).toBe(27);
    });
});

describe('Pawn Moves', () => {
    it('should allow white pawn to move 2 squares from start', () => {
        const board = new Board();
        const moves = board.getValidMoves(0x10); // a2
        expect(moves).toContain(0x20); // a3
        expect(moves).toContain(0x30); // a4
    });

    it('should not allow pawn to capture forward', () => {
        const board = new Board();
        (board as any).grid.fill(null); // Clear the board
        // Place a white pawn at a2
        (board as any).grid[0x10] = { type: 'p', color: 'w' };
        // Place a black pawn at a3
        (board as any).grid[0x20] = { type: 'p', color: 'b' };
        const moves = board.getValidMoves(0x10);
        expect(moves.length).toBe(0); // Blocked
    });
});

describe('Dominion Chess Engine', () => {
    let board: Board;

    beforeEach(() => {
        board = new Board();
    });

    it('should correctly identify the initial board state', () => {
        const whitePawn = board.getPieceAt(0x10); // a2
        expect(whitePawn?.type).toBe(PieceType.Pawn);
        expect(whitePawn?.color).toBe(Color.White);
    });

    it('should handle white pawn two-step move and en passant target', () => {
        // Move e2 to e4
        board.makeMove(0x14, 0x34); 
        // 0x24 is e3 (the square behind the pawn)
        expect(board['enPassantSquare']).toBe(0x24); 
    });

    it('should NOT allow black pawns to promote on their starting rank', () => {
        // Place a black pawn on rank 7 (its start)
        // Manually manipulating grid for testing is a common engine test pattern
        board['grid'][0x74] = { type: PieceType.Pawn, color: Color.Black };
        
        // Simulate a move that doesn't involve the pawn
        board.makeMove(0x10, 0x20); 
        
        // Verify black pawn is still a pawn
        expect(board.getPieceAt(0x74)?.type).toBe(PieceType.Pawn);
    });

    it('should correctly promote a white pawn on rank 7', () => {
        // Place white pawn on rank 6
        const from = 0x60; // a7
        const to = 0x70;   // a8
        board['grid'][from] = { type: PieceType.Pawn, color: Color.White };
        
        board.makeMove(from, to, PieceType.Queen);
        
        const piece = board.getPieceAt(to);
        expect(piece?.type).toBe(PieceType.Queen);
    });

    it('should prevent castling if the king has moved', () => {
        const whiteKingPos = 0x04; // e1
        // Move king out and back
        board.makeMove(whiteKingPos, 0x14);
        board.makeMove(0x14, whiteKingPos);
        
        // Check rights
        expect(board['castlingRights'].whiteKingSide).toBe(false);
        expect(board['castlingRights'].whiteQueenSide).toBe(false);
    });

    it('should accumulate dominion points after each turn', () => {
        // Initial control points should be 0
        expect(board.whiteControlPoints).toBe(0);
        
        // Simulate a move
        board.makeMove(0x14, 0x34); 
        board.updateControlPoints();
        
        // White should now have points because they control more of the board
        expect(board.whiteControlPoints).toBeGreaterThan(0);
    });
});