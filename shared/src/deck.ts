import type { CardCode, Rank, Suit } from './types.js';

const SUITS: Suit[] = ['D', 'C', 'H', 'S'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function buildSingleDeck(): CardCode[] {
  const deck: CardCode[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

/** Sequence is played with two standard 52-card decks combined (104 cards, including all 8 jacks). */
export function buildDrawPile(): CardCode[] {
  return [...buildSingleDeck(), ...buildSingleDeck()];
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
