import { describe, expect, it } from 'vitest';
import { applyAction } from './engine.js';
import { kindOf } from './geometry.js';
import { createGame } from './setup.js';
import { at, handCodes, idOf, rigged, seats, seeded } from './testHelpers.js';
import type { Mode, StaccsState } from './types.js';
import { toStaccsView } from './view.js';

// First card at the origin facing up: TOP is landed on from (0,1), SIDE from (1,-1), FACE (-1,0).
const TOP = at(0, 1);
const SIDE = at(1, -1);

function config(mode: Mode, playerCount: number, extra: Partial<{ noWilds: boolean; secondChances: boolean }> = {}) {
  return { mode, playerCount, noWilds: false, secondChances: false, ...extra };
}

function play(state: StaccsState, seat: number, code: string, placement = TOP, calledSuit?: 'S' | 'H' | 'C' | 'D') {
  return applyAction(state, `p${seat}`, { type: 'play', cardId: idOf(state, seat, code), placement, calledSuit });
}

function allCards(state: StaccsState): number {
  return (
    state.drawPile.length +
    state.discard.length +
    state.board.placed.length +
    state.players.reduce((n, p) => n + p.hand.length, 0)
  );
}

describe('setup', () => {
  it.each([
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 5],
  ])('UH OH! with %i players deals %i cards each from one 60-card DECC', (n, handSize) => {
    const state = createGame(seats(n), config('uhoh', n), { rng: seeded(n) });
    expect(state.players.every((p) => p.hand.length === handSize)).toBe(true);
    expect(allCards(state)).toBe(60);
  });

  it.each([
    [6, 7],
    [9, 7],
    [10, 5],
  ])('UH OH! PARTY with %i players deals %i each from two DECCS', (n, handSize) => {
    const state = createGame(seats(n), config('party', n), { rng: seeded(n) });
    expect(state.players.every((p) => p.hand.length === handSize)).toBe(true);
    expect(allCards(state)).toBe(120);
  });

  it('always starts the STACC with a number card 2-10', () => {
    for (let seed = 1; seed < 60; seed++) {
      const state = createGame(seats(2), config('uhoh', 2), { rng: seeded(seed) });
      const first = state.board.placed[0].card;
      expect(kindOf(first)).toBe('number');
      expect(first.rank).not.toBe('0');
    }
  });

  it('refuses a player count the mode is not for', () => {
    expect(() => createGame(seats(6), config('uhoh', 6))).toThrow(/2-5/);
    expect(() => createGame(seats(5), config('party', 5))).toThrow(/6-10/);
    expect(() => createGame(seats(2), config('solo', 2))).toThrow(/1-1/);
    expect(() => createGame(seats(5), config('wildout', 5))).toThrow(/1-4/);
  });

  it('starts SoloStaccs on anything but a Wild, with the rest face down', () => {
    for (let seed = 1; seed < 40; seed++) {
      const state = createGame(seats(1), config('solo', 1), { rng: seeded(seed) });
      expect(kindOf(state.board.placed[0].card)).not.toBe('wild');
      expect(state.drawPile).toHaveLength(59);
    }
    const noWilds = createGame(seats(1), config('solo', 1, { noWilds: true }), { rng: seeded() });
    expect(noWilds.totalCards).toBe(56);
    expect(noWilds.drawPile.some((c) => c.rank === 'W')).toBe(false);
  });

  it('lays out Wild Out with four Wilds facing four ways, each topped with a card', () => {
    const state = createGame(seats(3), config('wildout', 3), { rng: seeded() });
    const wilds = state.board.placed.filter((p) => p.card.rank === 'W');
    expect(wilds).toHaveLength(4);
    expect(new Set(wilds.map((w) => w.orient)).size).toBe(4);
    expect(state.board.placed).toHaveLength(8);
    expect(state.drawPile).toHaveLength(52);
    expect(state.phase).toBe('draw');
  });
});

describe('UH OH! turns', () => {
  it('passes the turn after a play', () => {
    const next = play(rigged('uhoh', [['6S', '9H'], ['2C']]), 0, '6S');
    expect(next.currentSeat).toBe(1);
    expect(next.board.placed).toHaveLength(2);
    expect(handCodes(next, 0)).toEqual(['9H']);
  });

  it('refuses to let a player draw while they hold a match', () => {
    expect(() => applyAction(rigged('uhoh', [['6S', '9H'], ['2C']]), 'p0', { type: 'draw' })).toThrow(/play it/);
  });

  it('draws one card and ends the turn when nothing matches', () => {
    const next = applyAction(rigged('uhoh', [['9H', '2C'], ['2C']]), 'p0', { type: 'draw' });
    expect(next.players[0].hand).toHaveLength(3);
    expect(next.currentSeat).toBe(1);
  });

  it('refuses a play out of turn', () => {
    expect(() => play(rigged('uhoh', [['9H'], ['6S']]), 1, '6S')).toThrow(/not your turn/);
  });

  it('wins for whoever empties their hand first', () => {
    const next = play(rigged('uhoh', [['6S'], ['2C']]), 0, '6S');
    expect(next.finished).toBe(true);
    expect(next.winners).toEqual(['p0']);
  });

  it('gives the win to the fewest cards when the draw pile runs dry', () => {
    const state = rigged('uhoh', [['9H', '2C'], ['2C']], { pile: [] });
    const next = applyAction(state, 'p0', { type: 'draw' });
    expect(next.finished).toBe(true);
    expect(next.winners).toEqual(['p1']);
  });
});

describe('special cards', () => {
  it('JACK: the next player draws 1, then still takes their turn', () => {
    const next = play(rigged('uhoh', [['JS', '9H'], ['2C', '3C']]), 0, 'JS');
    expect(next.players[1].hand).toHaveLength(3);
    expect(next.currentSeat).toBe(1);
    expect(next.phase).toBe('turn');
  });

  it('KING: the next player draws 2', () => {
    const next = play(rigged('uhoh', [['KS', '9H'], ['2C', '3C']]), 0, 'KS');
    expect(next.players[1].hand).toHaveLength(4);
  });

  it('ATTACCS can be countered, and the effect grows as it passes on', () => {
    const state = rigged('uhoh', [['JS', '9H'], ['JH', '3C'], ['2C', '4C']]);
    const hit = play(state, 0, 'JS');
    expect(hit.phase).toBe('respond');
    expect(hit.currentSeat).toBe(1);

    // P1 staccs their Jack on the first Jack's FACE: P2 now has to draw 2.
    const countered = play(hit, 1, 'JH', at(-1, 1));
    expect(countered.currentSeat).toBe(2);
    expect(countered.players[2].hand).toHaveLength(4);
    expect(countered.phase).toBe('turn');
  });

  it('lets an ATTACC be taken even when it could be countered', () => {
    const hit = play(rigged('uhoh', [['KS', '9H'], ['KH', '3C']]), 0, 'KS');
    const taken = applyAction(hit, 'p1', { type: 'acceptAttacc' });
    expect(taken.players[1].hand).toHaveLength(4);
    expect(taken.phase).toBe('turn');
    expect(taken.currentSeat).toBe(1);
  });

  it('QUEEN: the player who played it gives the next player a card of their choosing', () => {
    const hit = play(rigged('uhoh', [['QS', '9H', '2D'], ['3C']]), 0, 'QS');
    expect(hit.phase).toBe('give');
    expect(toStaccsView(hit, 'p0').youGive).toBe(1);

    const given = applyAction(hit, 'p0', { type: 'give', cardIds: [idOf(hit, 0, '2D')] });
    expect(handCodes(given, 0)).toEqual(['9H']);
    expect(handCodes(given, 1)).toEqual(['3C', '2D']);
    expect(given.phase).toBe('turn');
    expect(given.currentSeat).toBe(1);
  });

  it('QUEEN SWEEP: giving away your last card wins', () => {
    const hit = play(rigged('uhoh', [['QS', '9H'], ['3C']]), 0, 'QS');
    const given = applyAction(hit, 'p0', { type: 'give', cardIds: [idOf(hit, 0, '9H')] });
    expect(given.winners).toEqual(['p0']);
  });

  it('ACE: take another turn straight away', () => {
    const next = play(rigged('uhoh', [['AS', '9H'], ['3C']]), 0, 'AS');
    expect(next.currentSeat).toBe(0);
    expect(next.phase).toBe('turn');
    expect(next.events.some((e) => e.type === 'extraTurn')).toBe(true);
  });

  it('ACE as your last card wins without drawing', () => {
    const next = play(rigged('uhoh', [['AS'], ['3C']]), 0, 'AS');
    expect(next.winners).toEqual(['p0']);
  });

  it('ZERO blocks its TOP for the next player only, and reverses with three or more', () => {
    const state = rigged('uhoh', [['0S', '9H'], ['8S', '2C'], ['3S', '4C']]);
    const next = play(state, 0, '0S');
    expect(next.direction).toBe(-1);
    expect(next.currentSeat).toBe(2);
    expect(next.blockedTops).toEqual([1]);
    expect(() => play(next, 2, '3S', at(0, 2))).toThrow(/Zero/);
    // The block lifts once that turn is over.
    const after = applyAction(next, 'p2', { type: 'draw' });
    expect(after.blockedTops).toEqual([]);
  });

  it('ZERO does not reverse with two players', () => {
    const next = play(rigged('uhoh', [['0S', '9H'], ['8S', '2C']]), 0, '0S');
    expect(next.direction).toBe(1);
    expect(next.currentSeat).toBe(1);
    expect(() => play(next, 1, '8S', at(0, 2))).toThrow(/Zero/);
  });

  it('WILD: call a suit, the STACC turns, and you cannot win with one', () => {
    const state = rigged('uhoh', [['WS', '9H'], ['8C', '2D']]);
    expect(() => play(state, 0, 'WS', at(0, 1, 2))).toThrow(/suit/);
    const next = play(state, 0, 'WS', at(0, 1, 2), 'C');
    expect(next.board.stackOrient).toEqual([2]);
    expect(next.board.lockedBefore).toBe(1);

    // The Wild faces down and right now, so its TOP is landed on from (1,0).
    const after = play(next, 1, '8C', at(1, 0, 2));
    expect(after.board.placed).toHaveLength(3);

    const lastWild = rigged('uhoh', [['WS'], ['8C']]);
    expect(() => play(lastWild, 0, 'WS', at(0, 1, 2), 'C')).toThrow(/Wild/);
    expect(applyAction(lastWild, 'p0', { type: 'draw' }).players[0].hand).toHaveLength(2);
  });
});

describe('multiple numbers', () => {
  it('plays several of a number already on the STACC in one turn', () => {
    const state = rigged('uhoh', [['5H', '5C', '9D'], ['2C']]);
    const first = play(state, 0, '5H', SIDE);
    expect(first.currentSeat).toBe(0);
    expect(first.multiRank).toBe('5');

    // The second 5 goes on the first one's SIDE.
    const second = play(first, 0, '5C', at(2, -2));
    expect(second.currentSeat).toBe(1);
    expect(handCodes(second, 0)).toEqual(['9D']);
  });

  it('can stop part way through', () => {
    const first = play(rigged('uhoh', [['5H', '5C', '9D'], ['2C']]), 0, '5H', SIDE);
    expect(() => play(first, 0, '9D')).toThrow(/5s/);
    expect(applyAction(first, 'p0', { type: 'endTurn' }).currentSeat).toBe(1);
  });

  it('does not allow multiples of a number that was not already on the STACC', () => {
    const next = play(rigged('uhoh', [['6S', '6C', '9D'], ['2C']]), 0, '6S');
    expect(next.currentSeat).toBe(1);
  });

  it('wins by playing multiples as your last cards', () => {
    const first = play(rigged('uhoh', [['5H', '5C'], ['2C']]), 0, '5H', SIDE);
    expect(play(first, 0, '5C', at(2, -2)).winners).toEqual(['p0']);
  });
});

describe('UH OH!', () => {
  it('leaves a player who forgets to say it open to a three-card penalty', () => {
    const next = play(rigged('uhoh', [['6S', '9H'], ['2C', '3C']]), 0, '6S');
    expect(next.players[0].exposed).toBe(true);
    const caught = applyAction(next, 'p1', { type: 'callOut', targetId: 'p0' });
    expect(caught.players[0].hand).toHaveLength(4);
    expect(caught.players[0].exposed).toBe(false);
  });

  it('keeps a player who said it safe', () => {
    const said = applyAction(rigged('uhoh', [['6S', '9H'], ['2C', '3C']]), 'p0', { type: 'uhOh' });
    const next = play(said, 0, '6S');
    expect(next.players[0].exposed).toBe(false);
    expect(() => applyAction(next, 'p1', { type: 'callOut', targetId: 'p0' })).toThrow(/safe/);
  });

  it('closes the window once their next turn comes round', () => {
    const next = play(rigged('uhoh', [['6S', '9H'], ['2C', '3C']]), 0, '6S');
    const drawn = applyAction(next, 'p1', { type: 'draw' });
    expect(drawn.currentSeat).toBe(0);
    expect(drawn.players[0].exposed).toBe(false);
  });

  it('cannot be said early', () => {
    expect(() => applyAction(rigged('uhoh', [['6S', '9H', '2D'], ['2C']]), 'p0', { type: 'uhOh' })).toThrow();
  });
});

describe('SoloStaccs', () => {
  function solo(pile: string[], first = '5S', extra = {}) {
    const state = rigged('solo', [[]], { first, pile });
    state.config = { ...state.config, ...extra };
    state.totalCards = pile.length + 1;
    return state;
  }

  it('draws, then plays the drawn card', () => {
    const drawn = applyAction(solo(['9D', '6S']), 'p0', { type: 'draw' });
    expect(handCodes(drawn, 0)).toEqual(['6S']);
    const played = play(drawn, 0, '6S');
    expect(played.board.placed).toHaveLength(2);
  });

  it('only discards a card that cannot be played, then lets the discard top be played instead of drawing', () => {
    const drawn = applyAction(solo(['6S', '9D']), 'p0', { type: 'draw' });
    const discarded = applyAction(drawn, 'p0', { type: 'discard' });
    expect(discarded.discard.map((c) => c.rank)).toEqual(['9']);

    const six = applyAction(discarded, 'p0', { type: 'draw' });
    expect(() => applyAction(six, 'p0', { type: 'discard' })).toThrow(/play it/);
  });

  it('wins by staccing every card', () => {
    const drawn = applyAction(solo(['6S']), 'p0', { type: 'draw' });
    const played = play(drawn, 0, '6S');
    expect(played.finished).toBe(true);
    expect(played.winners).toEqual(['p0']);
  });

  it('ends without a win when no cards or matches are left', () => {
    const drawn = applyAction(solo(['9D']), 'p0', { type: 'draw' });
    const done = applyAction(drawn, 'p0', { type: 'discard' });
    expect(done.finished).toBe(true);
    expect(done.winners).toEqual([]);
  });

  it('with SECOND CHANCES, flips the discard pile over once', () => {
    const drawn = applyAction(solo(['9D'], '5S', { secondChances: true }), 'p0', { type: 'draw' });
    const discarded = applyAction(drawn, 'p0', { type: 'discard' });
    expect(discarded.finished).toBe(false);
    const flipped = applyAction(discarded, 'p0', { type: 'recycle' });
    expect(flipped.drawPile).toHaveLength(1);
    expect(flipped.recycled).toBe(true);
  });

  it('ignores special card powers', () => {
    const drawn = applyAction(solo(['2D', 'JS']), 'p0', { type: 'draw' });
    const played = play(drawn, 0, 'JS');
    expect(played.attacc).toBeNull();
  });
});

describe('Wild Out', () => {
  function wildOut(players = 2): StaccsState {
    return createGame(seats(players), config('wildout', players), { rng: seeded(7) });
  }

  it('draws first, then plays as many cards as match, then passes the turn', () => {
    const state = wildOut();
    expect(() => applyAction(state, 'p0', { type: 'endTurn' })).toThrow(/Draw/);
    const drawn = applyAction(state, 'p0', { type: 'draw' });
    expect(drawn.players[0].hand).toHaveLength(1);
    expect(() => applyAction(drawn, 'p0', { type: 'draw' })).toThrow();
    const passed = applyAction(drawn, 'p0', { type: 'endTurn' });
    expect(passed.currentSeat).toBe(1);
    expect(passed.phase).toBe('draw');
  });

  it('accepts any card on the TOP of a fresh STACC, but keeps the four STACCS apart', () => {
    const state = wildOut();
    // The card dealt onto Wild 0's TOP: anything of its suit can follow it there.
    const dealt = state.board.placed[4];
    expect(dealt.stack).toBe(0);
    expect(state.board.stackOrient).toEqual([5, 1, 2, 4]);
  });

  it('ends with everybody winning when no cards or matches are left', () => {
    const state = { ...wildOut(2), drawPile: [] };
    const done = applyAction(state, 'p0', { type: 'draw' });
    expect(done.finished).toBe(true);
    expect(done.winners).toEqual(['p0', 'p1']);
  });
});

describe('immutability', () => {
  it('never changes the state it was given', () => {
    const state = rigged('uhoh', [['6S', '9H'], ['2C']]);
    const before = JSON.stringify(state);
    play(state, 0, '6S');
    expect(JSON.stringify(state)).toBe(before);
  });
});
