import { RANKS, SUITS, type Card } from './types.js';

/** Injected so tests can pin a deal down. Defaults to Math.random everywhere else. */
export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * One DECC is 15 cards in each of 4 suits: 0, 2-10, J, Q, K, A and a Wild - 60 in all. UH OH! PARTY
 * shuffles two together, so every id carries its deck number to stay unique.
 */
export function buildDeck(deckCount: number, { wilds = true }: { wilds?: boolean } = {}): Card[] {
  const cards: Card[] = [];
  for (let deck = 0; deck < deckCount; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        if (rank === 'W' && !wilds) continue;
        cards.push({ id: `${deck}-${rank}${suit}`, suit, rank });
      }
    }
  }
  return cards;
}
