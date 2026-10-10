import { kindOf } from './geometry.js';
import type { Attacc, Card, Mode, Phase, Rank } from './types.js';

/**
 * The turn-level rules that decide whether a card may be played at all, before asking where it would
 * go. Shared by the engine, which enforces them, and the client, which greys out what you cannot play.
 */
export interface TurnContext {
  mode: Mode;
  phase: Phase;
  attacc: Attacc | null;
  multiRank: Rank | null;
  handSize: number;
}

export function isUhOh(mode: Mode): boolean {
  return mode === 'uhoh' || mode === 'party';
}

/** Why `card` cannot be played right now regardless of where it goes, or null if it can. */
export function cardRestriction(ctx: TurnContext, card: Card): string | null {
  if (!isUhOh(ctx.mode)) return ctx.phase === 'turn' ? null : 'Draw first';

  if (ctx.phase === 'respond') {
    const rank = ctx.attacc?.rank;
    return card.rank === rank ? null : `Only another ${rank} can counter that ATTACC`;
  }
  if (ctx.phase !== 'turn') return 'Not now';
  if (ctx.multiRank && card.rank !== ctx.multiRank) return `You are playing ${ctx.multiRank}s this turn`;
  if (kindOf(card) === 'wild' && ctx.handSize === 1) return "You can't win with a Wild - draw instead";
  return null;
}

/** Cards dealt to each player in UH OH! and UH OH! PARTY: seven, or five at a table of 5 or 10. */
export function handSizeFor(playerCount: number): number {
  return playerCount === 5 || playerCount === 10 ? 5 : 7;
}

export function decksFor(mode: Mode): number {
  return mode === 'party' ? 2 : 1;
}
