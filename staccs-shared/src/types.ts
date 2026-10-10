/**
 * STACCS: hexagonal cards drawn as little cubes, matched onto each other in (pretend) 3D space.
 *
 * Like Bluff, this package is standalone - it shares no code with the other games so each can evolve
 * on its own.
 */

export type Suit = 'S' | 'H' | 'C' | 'D';
/** Numbers 0 and 2-10, letters J Q K A, and W for a Wild. There is no 1. */
export type Rank = '0' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'W';

export const SUITS: Suit[] = ['S', 'H', 'C', 'D'];
export const RANKS: Rank[] = ['0', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'W'];
export const NUMBER_RANKS: Rank[] = ['0', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
export const LETTER_RANKS: Rank[] = ['J', 'Q', 'K', 'A'];

export const SUIT_NAME: Record<Suit, string> = { S: 'Spades', H: 'Hearts', C: 'Clubs', D: 'Diamonds' };
export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', C: '♣', D: '♦' };

export interface Card {
  /** Unique across the whole game, even with two decks shuffled together. */
  id: string;
  suit: Suit;
  rank: Rank;
}

export type CardKind = 'number' | 'letter' | 'wild';

/**
 * The three surfaces a card shows. TOP matches by suit, SIDE (the right) by number, FACE (the left)
 * by letter.
 */
export type Surface = 'top' | 'side' | 'face';

/** A point on the triangular lattice that every card centre and corner sits on. */
export interface Point {
  a: number;
  b: number;
}

/**
 * The play modes from the rulebook. `party` is Uh Oh! with two decks for a bigger table; Face Off is
 * "coming soon" in the rulebook, so it is not here either.
 */
export type Mode = 'uhoh' | 'party' | 'solo' | 'wildout';

export const MODES: Mode[] = ['uhoh', 'party', 'solo', 'wildout'];

export const MODE_PLAYERS: Record<Mode, { min: number; max: number }> = {
  uhoh: { min: 2, max: 5 },
  party: { min: 6, max: 10 },
  solo: { min: 1, max: 1 },
  wildout: { min: 1, max: 4 },
};

export const MODE_NAME: Record<Mode, string> = {
  uhoh: 'Uh Oh!',
  party: 'Uh Oh! Party',
  solo: 'SoloStaccs',
  wildout: 'Wild Out',
};

export interface StaccsConfig {
  mode: Mode;
  playerCount: number;
  /** SoloStaccs variation: take the four Wilds out before starting. */
  noWilds: boolean;
  /** SoloStaccs variation: once the draw pile is spent, flip the discard pile over and go again. */
  secondChances: boolean;
}

export interface PlacedCard {
  card: Card;
  pos: Point;
  /** Which of the six lattice directions this card's TOP faces. Changed only by a Wild. */
  orient: number;
  /** Place in the order of play. Doubles as the card's index in `Board.placed`. */
  seq: number;
  /** Which STACC the card belongs to. Only Wild Out has more than one. */
  stack: number;
  /** The suit called when a Wild was played. Null on a Wild that takes anything on its TOP. */
  calledSuit: Suit | null;
}

/** The table's edge, in world units where one card edge is 1. Cards cannot hang past it. */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Board {
  placed: PlacedCard[];
  /** Which card lies uppermost on each lattice triangle, by seq. */
  cover: Record<string, number>;
  /** The direction each STACC is currently heading in, i.e. the orientation new cards take. */
  stackOrient: number[];
  /** Cards with a lower seq than this were played before the latest Wild and are UNSTACCABLE. */
  lockedBefore: number;
  bounds: Bounds;
}

/** A card about to go down: where, which way up, and onto which STACC. */
export interface Placement {
  pos: Point;
  orient: number;
  stack: number;
}

/** A surface the new card would land on. */
export interface Touch {
  seq: number;
  surface: Surface;
}

export interface PlacementResult {
  ok: boolean;
  reason?: string;
  touches: Touch[];
}

/** The ATTACC cards, and what countering them adds. */
export type AttaccRank = 'J' | 'Q' | 'K';
export const ATTACC_STEP: Record<AttaccRank, number> = { J: 1, Q: 1, K: 2 };

export interface Attacc {
  rank: AttaccRank;
  /** Cards to draw (J, K) or to be given (Q). Grows each time it is countered. */
  count: number;
  /** Who played the most recent card of the chain. For a Queen, they are the one who gives. */
  fromId: string;
  targetId: string;
}

export interface StaccsPlayer {
  id: string;
  name: string;
  seat: number;
  hand: Card[];
  /** Said "UH OH!" while down to their last card (or about to be). */
  saidUhOh: boolean;
  /** On one card without having said it, and so open to being called out until their next turn. */
  exposed: boolean;
}

/**
 * Where the game is waiting.
 *
 * - `turn`: the current player plays or draws.
 * - `respond`: the current player has been hit by an ATTACC and may counter it or take it.
 * - `give`: a Queen landed; the player who played it chooses which cards to hand over.
 * - `draw`: Wild Out only - the current player draws before they play.
 */
export type Phase = 'turn' | 'respond' | 'give' | 'draw' | 'finished';

export type DrawReason = 'stuck' | 'attacc' | 'penalty' | 'turn';

export type StaccsEvent =
  | { type: 'deal' }
  | { type: 'play'; playerId: string; cardId: string; seq: number }
  | { type: 'draw'; playerId: string; count: number; reason: DrawReason }
  | { type: 'discard'; playerId: string; cardId: string }
  | { type: 'recycle'; count: number }
  | { type: 'attacc'; rank: AttaccRank; count: number; targetId: string }
  | { type: 'countered'; playerId: string; rank: AttaccRank; count: number }
  | { type: 'give'; fromId: string; toId: string; count: number }
  | { type: 'reverse' }
  | { type: 'extraTurn'; playerId: string }
  | { type: 'wild'; playerId: string; suit: Suit | null }
  | { type: 'uhOh'; playerId: string }
  | { type: 'calledOut'; callerId: string; targetId: string }
  | { type: 'pileEmpty' }
  | { type: 'finished'; winnerIds: string[]; reason: 'emptyHand' | 'fewestCards' | 'solo' | 'wildout' };

export interface StaccsState {
  config: StaccsConfig;
  players: StaccsPlayer[];
  drawPile: Card[];
  /** SoloStaccs only: cards that could not be played, face up. The last one is on top. */
  discard: Card[];
  board: Board;
  /** How many cards the game started with, for SoloStaccs' "every card stacced" win. */
  totalCards: number;
  currentSeat: number;
  /** 1 is clockwise. A Zero flips it at a table of three or more. */
  direction: 1 | -1;
  phase: Phase;
  attacc: Attacc | null;
  /** Zero cards whose TOP the current player may not use this turn. */
  blockedTops: number[];
  /** Zeros played this turn, which will block the next player. */
  blocksForNext: number[];
  /**
   * Set mid-turn once a number has been played onto a STACC that already showed it: the player may go
   * on to play the rest of that number before ending the turn.
   */
  multiRank: Rank | null;
  /** Numbers that were on the STACC when this turn began - only those can be played in multiples. */
  ranksAtTurnStart: Rank[];
  /** SoloStaccs: whether the discard pile has already been flipped back over. */
  recycled: boolean;
  winners: string[];
  finished: boolean;
  events: StaccsEvent[];
  eventSeq: number;
}

/** The actions a player can send. Every one is validated by the engine. */
export type StaccsAction =
  | { type: 'play'; cardId: string; placement: Placement; calledSuit?: Suit | null }
  | { type: 'draw' }
  | { type: 'endTurn' }
  | { type: 'acceptAttacc' }
  | { type: 'give'; cardIds: string[] }
  | { type: 'uhOh' }
  | { type: 'callOut'; targetId: string }
  | { type: 'discard' }
  | { type: 'recycle' };
