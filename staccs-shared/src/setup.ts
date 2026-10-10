import { buildDeck, shuffle, type Rng } from './deck.js';
import { kindOf, spotOnSurface } from './geometry.js';
import { createBoard, placeOnBoard } from './placement.js';
import { decksFor, handSizeFor, isUhOh } from './rules.js';
import { ranksOnBoard } from './state.js';
import { MODE_PLAYERS, MODE_NAME, type Bounds, type Card, type Point, type StaccsConfig, type StaccsState } from './types.js';

/**
 * Dealing and laying out the table for each play mode.
 *
 * Table sizes are in card edges. The first card of a single STACC sits at the origin near the bottom
 * edge, leaving room above it "so there's room for your STACC to grow". UH OH! PARTY's STACC is
 * "twice as long, twice as wide", so its table is too.
 */
const TABLES: Record<StaccsConfig['mode'], Bounds> = {
  uhoh: { minX: -14, maxX: 14, minY: -24, maxY: 4 },
  party: { minX: -28, maxX: 28, minY: -48, maxY: 8 },
  solo: { minX: -15, maxX: 15, minY: -26, maxY: 4 },
  wildout: { minX: -14.5, maxX: 15.5, minY: -14.25, maxY: 15.75 },
};

/**
 * Wild Out's four Wilds, touching in the middle of the table with each TOP facing out a different
 * way. Placed edge to edge, so none of them overlaps another.
 */
const WILD_OUT_LAYOUT: { pos: Point; orient: number }[] = [
  { pos: { a: 0, b: 0 }, orient: 5 },
  { pos: { a: 2, b: -1 }, orient: 1 },
  { pos: { a: 1, b: -2 }, orient: 2 },
  { pos: { a: -1, b: -1 }, orient: 4 },
];

const ORIGIN: Point = { a: 0, b: 0 };

export interface Seat {
  id: string;
  name: string;
}

export interface CreateOptions {
  rng?: Rng;
  /** Who plays first - "the player to the left of the dealer". */
  startSeat?: number;
}

function isPlainNumber(card: Card): boolean {
  return kindOf(card) === 'number' && card.rank !== '0';
}

function emptyState(seats: Seat[], config: StaccsConfig, totalCards: number, startSeat: number): StaccsState {
  return {
    config,
    players: seats.map((s, seat) => ({
      id: s.id,
      name: s.name,
      seat,
      hand: [],
      saidUhOh: false,
      exposed: false,
    })),
    drawPile: [],
    discard: [],
    board: createBoard(TABLES[config.mode], [0]),
    totalCards,
    currentSeat: startSeat,
    direction: 1,
    phase: 'turn',
    attacc: null,
    blockedTops: [],
    blocksForNext: [],
    multiRank: null,
    ranksAtTurnStart: [],
    recycled: false,
    winners: [],
    finished: false,
    events: [{ type: 'deal' }],
    eventSeq: 1,
  };
}

/**
 * UH OH!: deal seven each (five at a table of 5 or 10), then flip until a number card 2-10 turns up.
 * Anything special flipped on the way goes back in, and the pile gets one more shuffle.
 */
function dealUhOh(state: StaccsState, rng: Rng): void {
  let pile = shuffle(buildDeck(decksFor(state.config.mode)), rng);
  const handSize = handSizeFor(state.players.length);
  for (const player of state.players) player.hand = pile.splice(pile.length - handSize, handSize);

  const skipped: Card[] = [];
  let first = pile.pop()!;
  while (!isPlainNumber(first)) {
    skipped.push(first);
    first = pile.pop()!;
  }
  if (skipped.length > 0) pile = shuffle([...pile, ...skipped], rng);

  state.drawPile = pile;
  state.board = placeOnBoard(state.board, first, { pos: ORIGIN, orient: 0, stack: 0 });
}

/** SOLOSTACCS: the first card can be anything but a Wild, which slides back into the middle. */
function dealSolo(state: StaccsState, rng: Rng): void {
  const pile = shuffle(buildDeck(1, { wilds: !state.config.noWilds }), rng);
  let first = pile.pop()!;
  while (kindOf(first) === 'wild') {
    const middle = Math.floor(pile.length / 4 + rng() * (pile.length / 2));
    pile.splice(middle, 0, first);
    first = pile.pop()!;
  }
  state.drawPile = pile;
  state.board = placeOnBoard(state.board, first, { pos: ORIGIN, orient: 0, stack: 0 });
}

/** WILD OUT: the four Wilds go in the middle and one card is dealt onto each TOP. */
function dealWildOut(state: StaccsState, rng: Rng): void {
  const deck = buildDeck(1);
  const wilds = deck.filter((c) => kindOf(c) === 'wild');
  const pile = shuffle(
    deck.filter((c) => kindOf(c) !== 'wild'),
    rng,
  );

  let board = createBoard(
    TABLES.wildout,
    WILD_OUT_LAYOUT.map((w) => w.orient),
  );
  WILD_OUT_LAYOUT.forEach((w, stack) => {
    board = placeOnBoard(board, wilds[stack], { pos: w.pos, orient: w.orient, stack });
  });
  WILD_OUT_LAYOUT.forEach((w, stack) => {
    const pos = spotOnSurface(w.pos, w.orient, 'top');
    board = placeOnBoard(board, pile.pop()!, { pos, orient: w.orient, stack });
  });

  state.board = board;
  state.drawPile = pile;
  state.phase = 'draw';
}

export function createGame(seats: Seat[], config: StaccsConfig, options: CreateOptions = {}): StaccsState {
  const range = MODE_PLAYERS[config.mode];
  if (!range) throw new Error('Unknown play mode');
  if (seats.length !== config.playerCount || seats.length < range.min || seats.length > range.max) {
    throw new Error(`${MODE_NAME[config.mode]} is for ${range.min}-${range.max} players`);
  }

  const rng = options.rng ?? Math.random;
  const startSeat = (options.startSeat ?? 0) % seats.length;
  const wilds = !(config.mode === 'solo' && config.noWilds);
  const totalCards = decksFor(config.mode) * (wilds ? 60 : 56);
  const state = emptyState(seats, config, totalCards, startSeat);

  if (isUhOh(config.mode)) dealUhOh(state, rng);
  else if (config.mode === 'solo') dealSolo(state, rng);
  else dealWildOut(state, rng);

  state.ranksAtTurnStart = ranksOnBoard(state.board);
  return state;
}
