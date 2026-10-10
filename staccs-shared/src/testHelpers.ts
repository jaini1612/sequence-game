import { createBoard, placeOnBoard } from './placement.js';
import { createGame } from './setup.js';
import { ranksOnBoard } from './state.js';
import type { Board, Card, Mode, Placement, Point, Rank, StaccsState, Suit } from './types.js';

/** Fixtures for the tests. Not exported from the package. */

let serial = 0;

/** "5S", "10H", "JD", "0C", "WS" -> a card with a fresh unique id. */
export function card(code: string): Card {
  const suit = code.slice(-1) as Suit;
  const rank = code.slice(0, -1) as Rank;
  return { id: `t${serial++}-${code}`, suit, rank };
}

export const ORIGIN: Point = { a: 0, b: 0 };

export function at(a: number, b: number, orient = 0, stack = 0): Placement {
  return { pos: { a, b }, orient, stack };
}

export const UH_OH_TABLE = { minX: -9, maxX: 9, minY: -19, maxY: 3 };

/** A board built card by card, skipping the rules - for setting up a position to test against. */
export function boardOf(cards: [string, Placement, Suit?][], stackOrient = [0]): Board {
  let board = createBoard(UH_OH_TABLE, stackOrient);
  for (const [code, placement, suit] of cards) board = placeOnBoard(board, card(code), placement, suit ?? null);
  return board;
}

export function seeded(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seats(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
}

/**
 * A game in progress with a known table: `first` alone on the board at the origin, the given hands,
 * and the given draw pile (last entry on top).
 */
export function rigged(
  mode: Mode,
  hands: string[][],
  { first = '5S', pile = ['2D', '3D', '4D', '6D', '7D', '8D'] }: { first?: string; pile?: string[] } = {},
): StaccsState {
  const state = createGame(
    seats(hands.length),
    { mode, playerCount: hands.length, noWilds: false, secondChances: false },
    { rng: seeded() },
  );
  state.board = placeOnBoard(createBoard(state.board.bounds, [0]), card(first), at(0, 0));
  state.players.forEach((p, i) => (p.hand = hands[i].map(card)));
  state.drawPile = pile.map(card);
  state.ranksAtTurnStart = ranksOnBoard(state.board);
  state.phase = 'turn';
  return state;
}

export function handCodes(state: StaccsState, seat: number): string[] {
  return state.players[seat].hand.map((c) => `${c.rank}${c.suit}`);
}

export function idOf(state: StaccsState, seat: number, code: string): string {
  const found = state.players[seat].hand.find((c) => `${c.rank}${c.suit}` === code);
  if (!found) throw new Error(`P${seat} has no ${code}`);
  return found.id;
}
