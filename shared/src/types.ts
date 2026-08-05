export type Suit = 'D' | 'C' | 'H' | 'S';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

/** e.g. "9H", "10D", "JD" (two-eyed jack), "JS" (one-eyed jack) */
export type CardCode = string;

export const TWO_EYED_JACKS: CardCode[] = ['JD', 'JC'];
export const ONE_EYED_JACKS: CardCode[] = ['JH', 'JS'];

export const WILD = 'WILD';

export type BoardCell = CardCode | typeof WILD;

export interface Position {
  row: number;
  col: number;
}

export type PlayerColor = 'BLUE' | 'RED';

export interface Player {
  id: string;
  color: PlayerColor;
  hand: CardCode[];
}

export interface SequenceRecord {
  playerId: string;
  cells: Position[];
}

export interface GameState {
  board: BoardCell[][];
  /** Which player's chip occupies a cell, if any. Corners are never occupied (always wild). */
  chips: (PlayerColor | null)[][];
  /** How many recorded sequences already claim a cell (corners are uncapped). */
  sequenceUse: number[][];
  players: [Player, Player];
  currentPlayerIndex: 0 | 1;
  drawPile: CardCode[];
  discardPile: CardCode[];
  sequences: SequenceRecord[];
  winnerId: string | null;
  /** Official rules allow discarding only one dead card per turn, before your actual play. */
  deadCardDiscardedThisTurn: boolean;
}

export const SEQUENCES_TO_WIN = 2;
export const HAND_SIZE = 7;
export const BOARD_SIZE = 10;
