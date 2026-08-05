import { BOARD_SIZE, WILD, type BoardCell, type Position } from './types.js';

export const CORNERS: Position[] = [
  { row: 0, col: 0 },
  { row: 0, col: BOARD_SIZE - 1 },
  { row: BOARD_SIZE - 1, col: 0 },
  { row: BOARD_SIZE - 1, col: BOARD_SIZE - 1 },
];

/** The standard printed Sequence board layout: 4 wild corners, each of the 48 non-jack cards twice. */
const BOARD_LAYOUT: BoardCell[][] = [
  [WILD, '2S', '3S', '4S', '5S', '10D', 'QD', 'KD', 'AD', WILD],
  ['6C', '5C', '4C', '3C', '2C', '4S', '5S', '6S', '7S', 'AC'],
  ['7C', 'AS', '2D', '3D', '4D', 'KC', 'QC', '10C', '8S', 'KC'],
  ['8C', 'KS', '6C', '5C', '4C', '9H', '8H', '9C', '9S', 'QC'],
  ['9C', 'QS', '7C', '6H', '5H', '2H', '7H', '8C', '10S', '10C'],
  ['AS', '7H', '9D', 'AH', '4H', '3H', 'KH', '10D', '6H', '2D'],
  ['KS', '8H', '8D', '2C', '3C', '10H', 'QH', 'QD', '5H', '3D'],
  ['QS', '9H', '7D', '6D', '5D', 'AC', 'AD', 'KD', '4H', '4D'],
  ['10S', '10H', 'QH', 'KH', 'AH', '3S', '2S', '2H', '3H', '5D'],
  [WILD, '9S', '8S', '7S', '6S', '9D', '8D', '7D', '6D', WILD],
];

export function buildBoardLayout(): BoardCell[][] {
  return BOARD_LAYOUT.map((row) => [...row]);
}
