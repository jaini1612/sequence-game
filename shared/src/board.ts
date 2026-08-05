import { BOARD_SIZE, WILD, type BoardCell, type CardCode, type Position, type Rank, type Suit } from './types.js';

const SUITS: Suit[] = ['D', 'C', 'H', 'S'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Q', 'K', 'A'];

export const CORNERS: Position[] = [
  { row: 0, col: 0 },
  { row: 0, col: BOARD_SIZE - 1 },
  { row: BOARD_SIZE - 1, col: 0 },
  { row: BOARD_SIZE - 1, col: BOARD_SIZE - 1 },
];

function isCorner(row: number, col: number): boolean {
  return CORNERS.some((c) => c.row === row && c.col === col);
}

/**
 * There isn't a machine-readable copy of the printed Funskool board available here, so rather
 * than guess exact cell positions from memory, this builds a layout that satisfies the real
 * constraints: 4 wild corners, and each of the 48 non-jack cards appearing exactly twice,
 * placed at centrally-symmetric positions (rotating the board 180 degrees maps each card onto
 * its duplicate) the way the printed board does.
 */
export function buildBoardLayout(): BoardCell[][] {
  const nonCornerPositions: Position[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!isCorner(row, col)) nonCornerPositions.push({ row, col });
    }
  }

  const uniqueCards: CardCode[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      uniqueCards.push(`${rank}${suit}`);
    }
  }

  const board: BoardCell[][] = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(WILD));

  const seen = new Set<string>();
  let cardIndex = 0;
  for (const pos of nonCornerPositions) {
    const key = `${pos.row},${pos.col}`;
    if (seen.has(key)) continue;
    const mirrored: Position = { row: BOARD_SIZE - 1 - pos.row, col: BOARD_SIZE - 1 - pos.col };
    const mirroredKey = `${mirrored.row},${mirrored.col}`;

    const card = uniqueCards[cardIndex];
    cardIndex++;

    board[pos.row][pos.col] = card;
    board[mirrored.row][mirrored.col] = card;
    seen.add(key);
    seen.add(mirroredKey);
  }

  return board;
}
