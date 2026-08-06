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

  // The card-count invariants below hold for any well-formed layout, so they cannot catch a
  // board whose cards are simply in the wrong squares. These two rows are the most recognisable
  // landmarks on the printed board: an ascending diamond run along the top edge and a
  // descending spade run along the bottom.
  it('matches the printed board on the top and bottom edges', () => {
    expect(board[0]).toEqual([WILD, '6D', '7D', '8D', '9D', '10D', 'QD', 'KD', 'AD', WILD]);
    expect(board[BOARD_SIZE - 1]).toEqual([WILD, '9S', '8S', '7S', '6S', '5S', '4S', '3S', '2S', WILD]);
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
