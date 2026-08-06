import { BOARD_SIZE, WILD, type BoardCell, type Position } from './types.js';

export const CORNERS: Position[] = [
  { row: 0, col: 0 },
  { row: 0, col: BOARD_SIZE - 1 },
  { row: BOARD_SIZE - 1, col: 0 },
  { row: BOARD_SIZE - 1, col: BOARD_SIZE - 1 },
];

/** The standard printed Sequence board layout: 4 wild corners, each of the 48 non-jack cards twice. */
const BOARD_LAYOUT: BoardCell[][] = [
  [WILD, '6D', '7D', '8D', '9D', '10D', 'QD', 'KD', 'AD', WILD],
  ['5D', '3H', '2H', '2S', '3S', '4S', '5S', '6S', '7S', 'AC'],
  ['4D', '4H', 'KD', 'AD', 'AC', 'KC', 'QC', '10C', '8S', 'KC'],
  ['3D', '5H', 'QD', 'QH', '10H', '9H', '8H', '9C', '9S', 'QC'],
  ['2D', '6H', '10D', 'KH', '3H', '2H', '7H', '8C', '10S', '10C'],
  ['AS', '7H', '9D', 'AH', '4H', '5H', '6H', '7C', 'QS', '9C'],
  ['KS', '8H', '8D', '2C', '3C', '4C', '5C', '6C', 'KS', '8C'],
  ['QS', '9H', '7D', '6D', '5D', '4D', '3D', '2D', 'AS', '7C'],
  ['10S', '10H', 'QH', 'KH', 'AH', '2C', '3C', '4C', '5C', '6C'],
  [WILD, '9S', '8S', '7S', '6S', '5S', '4S', '3S', '2S', WILD],
];

export function buildBoardLayout(): BoardCell[][] {
  return BOARD_LAYOUT.map((row) => [...row]);
}
