import { describe, expect, it } from 'vitest';
import { applyAction } from './engine.js';
import { cardTriangles } from './geometry.js';
import { legalPlacements } from './placement.js';
import { cardRestriction } from './rules.js';
import { createGame } from './setup.js';
import { seats, seeded } from './testHelpers.js';
import { SUITS, type Mode, type StaccsAction, type StaccsState } from './types.js';
import { toStaccsView } from './view.js';

/**
 * Plays whole games with random legal moves and checks nothing is ever lost, duplicated or stuck.
 * Every turn a real player could take is one of these, so this shakes out rule interactions the
 * hand-written cases miss.
 */

const MAX_ACTIONS = 4000;

type Pick = <T>(items: T[]) => T;

function cardCount(state: StaccsState): number {
  return (
    state.drawPile.length +
    state.discard.length +
    state.board.placed.length +
    state.players.reduce((n, p) => n + p.hand.length, 0)
  );
}

function checkInvariants(state: StaccsState): void {
  expect(cardCount(state)).toBe(state.totalCards);
  const ids = [
    ...state.drawPile,
    ...state.discard,
    ...state.board.placed.map((p) => p.card),
    ...state.players.flatMap((p) => p.hand),
  ].map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);

  // Every triangle is owned by the latest card covering it.
  const owner: Record<string, number> = {};
  for (const placed of state.board.placed) for (const t of cardTriangles(placed.pos)) owner[t] = placed.seq;
  expect(state.board.cover).toEqual(owner);
}

/** One random thing someone at the table could legally do right now. */
function randomMove(state: StaccsState, pick: Pick, rng: () => number): { playerId: string; action: StaccsAction } {
  const current = state.players[state.currentSeat];
  const mode = state.config.mode;

  if (state.phase === 'give') {
    const giver = state.players.find((p) => p.id === state.attacc!.fromId)!;
    const owed = toStaccsView(state, giver.id).youGive;
    return { playerId: giver.id, action: { type: 'give', cardIds: giver.hand.slice(0, owed).map((c) => c.id) } };
  }

  if (mode === 'uhoh' || mode === 'party') {
    const exposed = state.players.find((p) => p.exposed);
    if (exposed && rng() < 0.3) {
      const caller = state.players.find((p) => p.id !== exposed.id)!;
      return { playerId: caller.id, action: { type: 'callOut', targetId: exposed.id } };
    }
    if (current.hand.length <= 2 && !current.saidUhOh && rng() < 0.7) {
      return { playerId: current.id, action: { type: 'uhOh' } };
    }
  }

  if (mode === 'wildout' && state.phase === 'draw') return { playerId: current.id, action: { type: 'draw' } };

  const pool =
    mode === 'solo' && current.hand.length === 0 ? (state.discard.slice(-1) as typeof current.hand) : current.hand;
  const ctx = {
    mode,
    phase: state.phase,
    attacc: state.attacc,
    multiRank: state.multiRank,
    handSize: current.hand.length,
  };
  const plays = pool
    .filter((c) => !cardRestriction(ctx, c))
    .flatMap((c) => legalPlacements(state.board, c, state.blockedTops).map((p) => ({ card: c, p })));

  if (mode === 'solo') {
    if (current.hand.length > 0 && plays.length === 0) return { playerId: current.id, action: { type: 'discard' } };
    if (plays.length > 0 && (current.hand.length > 0 || rng() < 0.5 || state.drawPile.length === 0)) {
      const { card, p } = pick(plays);
      return { playerId: current.id, action: { type: 'play', cardId: card.id, placement: p, calledSuit: pick(SUITS) } };
    }
    if (state.drawPile.length > 0) return { playerId: current.id, action: { type: 'draw' } };
    return { playerId: current.id, action: { type: 'recycle' } };
  }

  if (plays.length > 0 && rng() < 0.9) {
    const { card, p } = pick(plays);
    return { playerId: current.id, action: { type: 'play', cardId: card.id, placement: p, calledSuit: pick(SUITS) } };
  }
  if (mode === 'wildout' || state.multiRank) return { playerId: current.id, action: { type: 'endTurn' } };
  if (state.phase === 'respond') return { playerId: current.id, action: { type: 'acceptAttacc' } };
  if (plays.length > 0) {
    const { card, p } = pick(plays);
    return { playerId: current.id, action: { type: 'play', cardId: card.id, placement: p, calledSuit: pick(SUITS) } };
  }
  return { playerId: current.id, action: { type: 'draw' } };
}

function playOut(mode: Mode, players: number, seed: number, extra: Partial<StaccsState['config']> = {}): StaccsState {
  const rng = seeded(seed);
  const pick: Pick = (items) => items[Math.floor(rng() * items.length)];
  let state = createGame(seats(players), { mode, playerCount: players, noWilds: false, secondChances: false, ...extra }, { rng });
  checkInvariants(state);

  for (let i = 0; i < MAX_ACTIONS && !state.finished; i++) {
    const { playerId, action } = randomMove(state, pick, rng);
    state = applyAction(state, playerId, action);
    checkInvariants(state);
  }
  return state;
}

describe('random full games', () => {
  const cases: [Mode, number[]][] = [
    ['uhoh', [2, 3, 4, 5]],
    ['party', [6, 8, 10]],
    ['solo', [1]],
    ['wildout', [1, 2, 3, 4]],
  ];

  for (const [mode, counts] of cases) {
    for (const players of counts) {
      it(`${mode} with ${players} player(s) always reaches an end`, () => {
        for (let seed = 1; seed <= 12; seed++) {
          const end = playOut(mode, players, seed * 31 + players);
          expect(end.finished).toBe(true);
        }
      });
    }
  }

  it('solo variations reach an end too', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(playOut('solo', 1, seed, { noWilds: true }).finished).toBe(true);
      expect(playOut('solo', 1, seed, { secondChances: true }).finished).toBe(true);
    }
  });
});
