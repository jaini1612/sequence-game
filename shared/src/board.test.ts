import { describe, expect, it } from 'vitest';
import { buildBoardLayout, CORNERS } from './board.js';
import { BOARD_SIZE, WILD } from './types.js';

describe('buildBoardLayout', () => {
  const board = buildBoardLayout();

  it('is a 10x10 grid', () => {
    expect(board.length).toBe(BOARD_SIZE);
    board.forEach((row) => expect(row.length).toBe(BOARD_SIZE));
  });

  it('marks all four corners as wild', () => {
    for (const { row, col } of CORNERS) {
      expect(board[row][col]).toBe(WILD);
    }
  });

  it('places every non-jack card exactly twice, and no jacks on the board', () => {
    const counts = new Map<string, number>();
    for (const row of board) {
      for (const cell of row) {
        if (cell === WILD) continue;
        expect(cell.startsWith('J')).toBe(false);
        counts.set(cell, (counts.get(cell) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(48);
    for (const count of counts.values()) {
      expect(count).toBe(2);
    }
  });
});
