import { describe, expect, it } from 'vitest';
import { computeAwards, type Award, type AwardId, type BluffPlayer, type BluffStats } from './index.js';

function player(id: string, stats: Partial<BluffStats>): BluffPlayer {
  return {
    id,
    name: id,
    seat: 0,
    hand: [],
    status: 'active',
    place: null,
    challenges: 4,
    bluffMeter: 0,
    stats: {
      turns: 10,
      bluffTurns: 0,
      bluffsCaught: 0,
      challengesMade: 0,
      challengesCorrect: 0,
      ...stats,
    },
  };
}

function award(awards: Award[], id: AwardId): Award | undefined {
  return awards.find((a) => a.id === id);
}

describe('awards', () => {
  it('charges the most prolific liar, and counts the marks against them', () => {
    const awards = computeAwards([
      player('a', { bluffTurns: 9, bluffsCaught: 3 }),
      player('b', { bluffTurns: 4, bluffsCaught: 1 }),
      player('c', { bluffTurns: 1 }),
    ]);

    expect(award(awards, 'bluffmaster')).toMatchObject({
      playerIds: ['a'],
      headline: 'Wanted on nine counts of bluffing',
      detail: 'Nicked 3. Six got clean away.',
      verdict: 'At large',
      pips: { total: 9, flagged: 3, tone: 'caught' },
    });
  });

  it('leads with the bluffmaster', () => {
    const awards = computeAwards([
      player('a', { bluffTurns: 9, bluffsCaught: 3, challengesMade: 2 }),
      player('b', { bluffTurns: 4, bluffsCaught: 1, challengesMade: 6 }),
    ]);

    expect(awards[0].id).toBe('bluffmaster');
  });

  it('stamps a bluffmaster who was caught more often than not', () => {
    const awards = computeAwards([
      player('a', { bluffTurns: 8, bluffsCaught: 6 }),
      player('b', { bluffTurns: 2 }),
    ]);

    expect(award(awards, 'bluffmaster')?.verdict).toBe('Nicked');
  });

  it('says so plainly when a bluffmaster was never caught at all', () => {
    const awards = computeAwards([player('a', { bluffTurns: 5 }), player('b', { bluffTurns: 1 })]);

    expect(award(awards, 'bluffmaster')).toMatchObject({
      detail: 'Never once caught',
      verdict: 'At large',
    });
  });

  it('names the busiest challenger and greys out the calls that missed', () => {
    const awards = computeAwards([
      player('a', { challengesMade: 7, challengesCorrect: 5 }),
      player('b', { challengesMade: 2, challengesCorrect: 2 }),
    ]);

    expect(award(awards, 'inspector')).toMatchObject({
      playerIds: ['a'],
      headline: 'Called it 7 times, right 5',
      verdict: 'Sharp',
      pips: { total: 7, flagged: 2, tone: 'missed' },
    });
  });

  it('gives the samaritan to the least dishonest player', () => {
    const awards = computeAwards([
      player('a', { bluffTurns: 9, bluffsCaught: 3 }),
      player('b', { bluffTurns: 2, bluffsCaught: 1 }),
    ]);

    expect(award(awards, 'samaritan')).toMatchObject({
      playerIds: ['b'],
      headline: 'Two little fibs all night',
      verdict: 'No priors',
      pips: { total: 2, flagged: 1, tone: 'caught' },
    });
  });

  it('says so plainly when the samaritan never lied at all', () => {
    const awards = computeAwards([player('a', { bluffTurns: 5 }), player('b', {})]);

    expect(award(awards, 'samaritan')).toMatchObject({
      playerIds: ['b'],
      headline: 'Not one lie all night',
      pips: { total: 0, flagged: 0 },
    });
  });

  it('ranks the escapist and the suspect by rate, not by count', () => {
    const awards = computeAwards([
      // Lied twice as often as anyone, but is caught half the time.
      player('a', { bluffTurns: 10, bluffsCaught: 5 }),
      player('b', { bluffTurns: 5, bluffsCaught: 1 }),
      player('c', { bluffTurns: 4, bluffsCaught: 3 }),
    ]);

    expect(award(awards, 'escapist')).toMatchObject({
      playerIds: ['b'],
      headline: '4 of 5 walked free',
      verdict: 'Slippery',
    });
    expect(award(awards, 'suspect')).toMatchObject({
      playerIds: ['c'],
      headline: 'Nicked in 3 of 4',
      verdict: 'Caught out',
    });
  });

  it('settles an equal rate on whoever lied more often', () => {
    const awards = computeAwards([
      player('a', { bluffTurns: 8, bluffsCaught: 0 }),
      player('b', { bluffTurns: 2, bluffsCaught: 0 }),
      player('c', { bluffTurns: 3, bluffsCaught: 3 }),
    ]);

    expect(award(awards, 'escapist')?.playerIds).toEqual(['a']);
  });

  it('shares an award between players who genuinely tie', () => {
    const awards = computeAwards([
      player('a', { bluffTurns: 6, bluffsCaught: 2 }),
      player('b', { bluffTurns: 6, bluffsCaught: 2 }),
      player('c', { bluffTurns: 1 }),
    ]);

    expect(award(awards, 'bluffmaster')?.playerIds).toEqual(['a', 'b']);
  });

  it('drops an award the whole table would win', () => {
    const awards = computeAwards([
      player('a', { bluffTurns: 3, bluffsCaught: 1, challengesMade: 2 }),
      player('b', { bluffTurns: 3, bluffsCaught: 1, challengesMade: 2 }),
    ]);

    expect(awards).toEqual([]);
  });

  it('hands out nothing for a game nobody lied or called in', () => {
    const awards = computeAwards([player('a', {}), player('b', {})]);

    expect(award(awards, 'bluffmaster')).toBeUndefined();
    expect(award(awards, 'inspector')).toBeUndefined();
    expect(award(awards, 'escapist')).toBeUndefined();
    expect(award(awards, 'suspect')).toBeUndefined();
  });

  it('has no suspect when every bluff got away', () => {
    const awards = computeAwards([player('a', { bluffTurns: 5 }), player('b', { bluffTurns: 2 })]);

    expect(award(awards, 'suspect')).toBeUndefined();
    expect(award(awards, 'escapist')).toBeUndefined();
  });

  it('ignores a player who never took a turn', () => {
    const awards = computeAwards([
      player('a', { turns: 0 }),
      player('b', { bluffTurns: 4 }),
      player('c', { bluffTurns: 1 }),
    ]);

    expect(award(awards, 'samaritan')?.playerIds).toEqual(['c']);
  });
});
