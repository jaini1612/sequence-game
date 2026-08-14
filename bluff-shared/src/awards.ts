/**
 * What the table learns about each other once the cards are down, written as a police blotter: a
 * charge, a verdict and a count of marks against your name. The counts behind these are kept private
 * for the whole game - handing them out mid-play would tell everyone exactly who to call - so they
 * only ever leave the engine through a finished view.
 */
import type { BluffPlayer, BluffStats } from './types.js';

export type AwardId = 'bluffmaster' | 'inspector' | 'samaritan' | 'escapist' | 'suspect';

export interface AwardPips {
  /** One pip per bluff - or per challenge, for the Inspector. */
  total: number;
  /** How many of those went wrong: bluffs that were caught, or calls that missed. */
  flagged: number;
  /** Whether a flagged pip is a crime (inked) or merely a miss (greyed). */
  tone: 'caught' | 'missed';
}

export interface Award {
  id: AwardId;
  /** The heading on the file, e.g. "The inspector". */
  title: string;
  /** Everyone who earned it. Ties share the honour rather than being broken arbitrarily. */
  playerIds: string[];
  /** The charge, e.g. "Wanted on nine counts of bluffing". */
  headline: string;
  /** A second line, for the panel that gets a whole card. Empty for the rest. */
  detail: string;
  /** The stamp: "At large", "Nicked", "Sharp", "No priors", "Slippery", "Caught out". */
  verdict: string;
  pips: AwardPips;
}

const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

/** Small counts read better spelled out; past a dozen the numeral is clearer than the word. */
function word(n: number): string {
  return WORDS[n] ?? String(n);
}

function Word(n: number): string {
  const w = word(n);
  return w[0].toUpperCase() + w.slice(1);
}

function plural(n: number, singular: string): string {
  return `${singular}${n === 1 ? '' : 's'}`;
}

/**
 * The candidates sharing the best score - or nobody, when the whole field ties. An award everyone
 * wins says nothing about anyone, so it is better left off the board entirely.
 */
function leaders<T>(candidates: T[], score: (candidate: T) => number): T[] {
  if (candidates.length === 0) return [];
  const scores = candidates.map(score);
  const best = Math.max(...scores);
  if (Math.min(...scores) === best) return [];
  return candidates.filter((_, i) => scores[i] === best);
}

/**
 * Same, but for rates: a percentage on its own would let a single lucky bluff outrank a season of
 * them, so an equal rate is settled by whoever risked it more often.
 */
function rateLeaders(candidates: BluffPlayer[], rate: (stats: BluffStats) => number): BluffPlayer[] {
  const top = leaders(candidates, (p) => rate(p.stats));
  if (top.length === 0 || rate(top[0].stats) === 0) return [];
  const most = Math.max(...top.map((p) => p.stats.bluffTurns));
  return top.filter((p) => p.stats.bluffTurns === most);
}

function ids(players: BluffPlayer[]): string[] {
  return players.map((p) => p.id);
}

function caughtPips(stats: BluffStats): AwardPips {
  return { total: stats.bluffTurns, flagged: stats.bluffsCaught, tone: 'caught' };
}

/**
 * The end-of-game honours, the Bluffmaster first. Any award nobody has a real claim to is simply left
 * out - there is no Inspector in a game where nobody called anybody.
 */
export function computeAwards(players: BluffPlayer[]): Award[] {
  const awards: Award[] = [];
  const played = players.filter((p) => p.stats.turns > 0);
  const liars = played.filter((p) => p.stats.bluffTurns > 0);

  const bluffmasters = leaders(played, (p) => p.stats.bluffTurns);
  if (bluffmasters.length > 0 && bluffmasters[0].stats.bluffTurns > 0) {
    const { bluffTurns, bluffsCaught } = bluffmasters[0].stats;
    const escaped = bluffTurns - bluffsCaught;
    awards.push({
      id: 'bluffmaster',
      title: 'Bluffmaster',
      playerIds: ids(bluffmasters),
      headline: `Wanted on ${word(bluffTurns)} ${plural(bluffTurns, 'count')} of bluffing`,
      detail:
        bluffsCaught === 0
          ? 'Never once caught'
          : escaped === 0
            ? 'Caught every single time'
            : `Nicked ${bluffsCaught}. ${Word(escaped)} got clean away.`,
      // Being caught more often than not is not mastery, it is a record - so the stamp says so.
      verdict: escaped > bluffsCaught ? 'At large' : 'Nicked',
      pips: caughtPips(bluffmasters[0].stats),
    });
  }

  const inspectors = leaders(played, (p) => p.stats.challengesMade);
  if (inspectors.length > 0 && inspectors[0].stats.challengesMade > 0) {
    const { challengesMade, challengesCorrect } = inspectors[0].stats;
    awards.push({
      id: 'inspector',
      title: 'The inspector',
      playerIds: ids(inspectors),
      headline: `Called it ${challengesMade} ${plural(challengesMade, 'time')}, right ${challengesCorrect}`,
      detail: '',
      verdict: 'Sharp',
      pips: {
        total: challengesMade,
        flagged: challengesMade - challengesCorrect,
        tone: 'missed',
      },
    });
  }

  const saints = leaders(played, (p) => -p.stats.bluffTurns);
  if (saints.length > 0) {
    const { bluffTurns } = saints[0].stats;
    awards.push({
      id: 'samaritan',
      title: 'Good samaritan',
      playerIds: ids(saints),
      headline:
        bluffTurns === 0
          ? 'Not one lie all night'
          : `${Word(bluffTurns)} little ${plural(bluffTurns, 'fib')} all night`,
      detail: '',
      verdict: 'No priors',
      pips: caughtPips(saints[0].stats),
    });
  }

  const escapists = rateLeaders(liars, (s) => (s.bluffTurns - s.bluffsCaught) / s.bluffTurns);
  if (escapists.length > 0) {
    const { bluffTurns, bluffsCaught } = escapists[0].stats;
    awards.push({
      id: 'escapist',
      title: 'The escapist',
      playerIds: ids(escapists),
      headline: `${bluffTurns - bluffsCaught} of ${bluffTurns} walked free`,
      detail: '',
      verdict: 'Slippery',
      pips: caughtPips(escapists[0].stats),
    });
  }

  const suspects = rateLeaders(liars, (s) => s.bluffsCaught / s.bluffTurns);
  if (suspects.length > 0) {
    const { bluffTurns, bluffsCaught } = suspects[0].stats;
    awards.push({
      id: 'suspect',
      title: 'Usual suspect',
      playerIds: ids(suspects),
      headline: `Nicked in ${bluffsCaught} of ${bluffTurns}`,
      detail: '',
      verdict: 'Caught out',
      pips: caughtPips(suspects[0].stats),
    });
  }

  return awards;
}
