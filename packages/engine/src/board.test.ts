import { describe, it, expect } from 'vitest';
import { Board } from './board';

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