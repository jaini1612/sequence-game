import { RANKS, SUITS, type CardCode, type DeckComposition, type DeckCount } from './types.js';

/** Injected so tests can pin a deal down. Defaults to Math.random everywhere else. */
export type Rng = () => number;

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function everyCard(): CardCode[] {
  const cards: CardCode[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) cards.push(`${rank}${suit}`);
  }
  return cards;
}

/**
 * Builds the deck for a game.
 *
 * A `standard` deck is the real thing repeated `deckCount` times, so a player who counts knows there
 * are exactly four (or eight) of every rank. A `scrambled` deck holds the same number of cards but
 * draws each one at random, so the rank counts are lopsided and unknowable - "there can't be a fifth
 * Nine" stops being an argument.
 */
export function buildDeck(
  deckCount: DeckCount,
  composition: DeckComposition,
  rng: Rng = Math.random,
): CardCode[] {
  const catalogue = everyCard();
  const size = catalogue.length * deckCount;

  if (composition === 'standard') {
    const cards: CardCode[] = [];
    for (let i = 0; i < deckCount; i++) cards.push(...catalogue);
    return shuffle(cards, rng);
  }

  const cards: CardCode[] = [];
  for (let i = 0; i < size; i++) cards.push(catalogue[Math.floor(rng() * catalogue.length)]);
  return cards;
}

/**
 * The largest number of any one rank in a deck - the biggest claim that could possibly be honest.
 * Four in a proper single deck, eight in a proper double, and anybody's guess once it is scrambled.
 */
export function maxRankCount(cards: CardCode[]): number {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const rank = card.slice(0, -1);
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  return Math.max(...counts.values());
}

/**
 * Deals the whole deck round-robin from seat 0, so hand sizes differ by at most one card and nothing
 * is held back - there is no draw pile in Bluff, the cards you are dealt are the cards you get.
 */
export function dealAll(cards: CardCode[], playerCount: number): CardCode[][] {
  const hands: CardCode[][] = Array.from({ length: playerCount }, () => []);
  cards.forEach((card, i) => hands[i % playerCount].push(card));
  return hands;
}
