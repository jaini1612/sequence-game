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

export type PlayerColor = 'BLUE' | 'RED' | 'GREEN';

/**
 * Seating order for colours. Green only ever appears in a three-way game - the printed game ships
 * blue and red for head-to-head play and adds green as the third set.
 */
export const PLAYER_COLORS: PlayerColor[] = ['BLUE', 'RED', 'GREEN'];

export function colorsForPlayerCount(playerCount: number): PlayerColor[] {
  return PLAYER_COLORS.slice(0, Math.min(playerCount, PLAYER_COLORS.length));
}

export interface Player {
  id: string;
  color: PlayerColor;
  hand: CardCode[];
}

/**
 * The official rules table. Sequence seats 2 to 12, but every count above 3 has to be played in
 * teams, and team play is not built yet - so ALLOWED_PLAYER_COUNTS describes the printed game
 * while PLAYABLE_PLAYER_COUNTS describes what this app can currently deal.
 */
export const MAX_PLAYERS = 12;
export const ALLOWED_PLAYER_COUNTS = [2, 3, 4, 6, 8, 9, 10, 12];
export const PLAYABLE_PLAYER_COUNTS = [2, 3];

export const HAND_SIZE_BY_PLAYER_COUNT: Record<number, number> = {
  2: 7,
  3: 6,
  4: 6,
  6: 5,
  8: 4,
  9: 4,
  10: 3,
  12: 3,
};

/** Two sides race to two sequences; three race to one. */
export function sequencesToWin(teamCount: number): number {
  return teamCount >= 3 ? 1 : 2;
}

/**
 * How long you still have to take your card once the next player has played. The rule is that a
 * card not drawn before the next play is lost for the rest of the game, which is unforgiving over a
 * network, so the deadline only starts when someone else plays and then runs for this long.
 */
export const DRAW_GRACE_MS = 2000;

/**
 * A card owed to a player after they played one. Debts are settled strictly in the order they were
 * incurred - only the oldest may draw - otherwise a fast player could empty the pile past someone
 * who is still owed a card.
 *
 * `deadlineAt` is null while the debtor is under no pressure yet: it is set once they are at the
 * head of the queue *and* somebody else has played since.
 */
export interface DrawDebt {
  playerId: string;
  deadlineAt: number | null;
}

export function handSizeFor(playerCount: number): number {
  const size = HAND_SIZE_BY_PLAYER_COUNT[playerCount];
  if (!size) throw new Error(`Unsupported player count: ${playerCount}`);
  return size;
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
  players: Player[];
  currentPlayerIndex: number;
  /** Fixed at deal time from the number of sides, so clients never have to recompute it. */
  sequencesToWin: number;
  drawPile: CardCode[];
  discardPile: CardCode[];
  sequences: SequenceRecord[];
  /** Where the most recent chip was placed, so the UI can point it out. Removals do not count. */
  lastPlacement: Position | null;
  /** Cards owed but not yet taken, oldest debt first. Only the first entry may draw. */
  drawQueue: DrawDebt[];
  /** Who played last, which decides whether a new head of the queue is already under pressure. */
  lastPlayerId: string | null;
  /** Cards each player let slip, so the UI can tease them and hand sizes stay explainable. */
  missedDraws: Record<string, number>;
  winnerId: string | null;
  /** Official rules allow discarding only one dead card per turn, before your actual play. */
  deadCardDiscardedThisTurn: boolean;
}

export const BOARD_SIZE = 10;
