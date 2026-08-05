import { describe, expect, it } from 'vitest';
import { buildDrawPile } from './deck.js';

describe('buildDrawPile', () => {
  it('has 104 cards (two 52-card decks)', () => {
    expect(buildDrawPile().length).toBe(104);
  });

  it('contains exactly two copies of every card, including jacks', () => {
    const counts = new Map<string, number>();
    for (const card of buildDrawPile()) {
      counts.set(card, (counts.get(card) ?? 0) + 1);
    }
    expect(counts.size).toBe(52);
    for (const count of counts.values()) {
      expect(count).toBe(2);
    }
    expect(counts.get('JD')).toBe(2);
    expect(counts.get('JH')).toBe(2);
  });
});
