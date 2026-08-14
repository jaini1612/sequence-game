import { describe, expect, it } from 'vitest';
import {
  applyTimeout,
  canChallenge,
  canLetGo,
  letGo,
  challenge,
  createGame,
  pass,
  playCards,
  toBluffView,
  type BluffConfig,
  type BluffState,
  type CardCode,
  type Rank,
  type Seat,
} from './index.js';

const NOW = 1_000_000;

function config(overrides: Partial<BluffConfig> = {}): BluffConfig {
  return { playerCount: 3, deckCount: 1, composition: 'standard', turnSeconds: 20, ...overrides };
}

function seats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
}

/** A deterministic rng, so a deal can be reasoned about. Always picks the first option. */
const firstAlways = () => 0;

function game(overrides: Partial<BluffConfig> = {}): BluffState {
  return createGame(seats(overrides.playerCount ?? 3), config(overrides), NOW, firstAlways);
}

/** Forces a hand, so tests can set up an honest claim or a lie without fighting the shuffle. */
function setHand(state: BluffState, seat: number, hand: CardCode[]): void {
  state.players[seat].hand = [...hand];
}

function turnOf(state: BluffState): string {
  return state.players[state.currentSeat].id;
}

describe('dealing', () => {
  it('deals the whole deck out, within one card of even', () => {
    const state = game({ playerCount: 5 });
    const sizes = state.players.map((p) => p.hand.length);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(52);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('deals 104 cards across two decks', () => {
    const state = game({ playerCount: 4, deckCount: 2 });
    expect(state.players.reduce((n, p) => n + p.hand.length, 0)).toBe(104);
  });

  it('keeps a standard deck honest: exactly four of every rank per deck', () => {
    const state = game({ playerCount: 2 });
    const nines = state.players.flatMap((p) => p.hand).filter((c) => c.startsWith('9'));
    expect(nines).toHaveLength(4);
  });

  it('scrambles rank counts when asked, while keeping the deck size', () => {
    const state = createGame(seats(3), config({ composition: 'scrambled' }), NOW, firstAlways);
    expect(state.players.reduce((n, p) => n + p.hand.length, 0)).toBe(52);
  });
});

describe('claims', () => {
  it('locks the round to the rank the opener named', () => {
    const state = game();
    const opener = state.currentSeat;
    setHand(state, opener, ['9H', '9S', '2C']);
    playCards(state, `p${opener}`, ['9H'], '9', NOW);

    expect(state.roundRank).toBe('9');
    expect(state.pile).toHaveLength(1);
    expect(state.lastClaim).toMatchObject({ rank: '9', count: 1 });
  });

  it('refuses a different rank once the round has a rank', () => {
    const state = game();
    const opener = state.currentSeat;
    setHand(state, opener, ['9H']);
    playCards(state, `p${opener}`, ['9H'], '9', NOW);

    const next = turnOf(state);
    setHand(state, state.currentSeat, ['KD']);
    expect(() => playCards(state, next, ['KD'], 'K', NOW)).toThrow(/9s/);
  });

  it('lets a player lie about what they put down', () => {
    const state = game();
    const opener = state.currentSeat;
    setHand(state, opener, ['2C', '3D']);
    playCards(state, `p${opener}`, ['2C', '3D'], 'K', NOW);

    expect(state.lastClaim).toMatchObject({ rank: 'K', count: 2 });
    expect(state.pile).toEqual(['2C', '3D']);
  });

  it('lets the next player cover a claim rather than forcing a challenge', () => {
    const state = game();
    setHand(state, state.currentSeat, ['9H', '2C']);
    const first = turnOf(state);
    playCards(state, first, ['9H'], '9', NOW);

    // Both moves are open to the seat that follows: doubt it, or play on top of it.
    const next = turnOf(state);
    expect(next).not.toBe(first);
    expect(canChallenge(state, next)).toBe(true);

    setHand(state, state.currentSeat, ['9S', '3D']);
    expect(() => playCards(state, next, ['9S'], '9', NOW)).not.toThrow();
    expect(state.pile).toEqual(['9H', '9S']);
    // ...and the turn carries on round the table rather than sticking.
    expect(turnOf(state)).not.toBe(next);
  });

  it('rejects a play that is not your turn, or cards you do not hold', () => {
    const state = game();
    const notYou = state.players[(state.currentSeat + 1) % 3].id;
    expect(() => playCards(state, notYou, ['9H'], '9', NOW)).toThrow(/Not your turn/);
    setHand(state, state.currentSeat, ['9H']);
    expect(() => playCards(state, turnOf(state), ['9D'], '9', NOW)).toThrow(/do not hold/);
  });
});

describe('how big a claim may be', () => {
  it('allows twice the commonest rank in the deck', () => {
    // A proper single deck holds four of every rank, so a claim may run to eight.
    expect(game().maxClaim).toBe(8);
    expect(game({ playerCount: 4, deckCount: 2 }).maxClaim).toBe(16);
  });

  it('follows a scrambled deck wherever it lands', () => {
    const state = createGame(seats(3), config({ composition: 'scrambled' }), NOW, firstAlways);
    // firstAlways picks the same card every time, so every one of the 52 is the same rank.
    expect(state.maxClaim).toBe(104);
  });

  it('refuses a claim past the cap', () => {
    const state = game();
    const hand = Array.from({ length: 9 }, (_, i) => `${i + 2}H`);
    setHand(state, state.currentSeat, hand);
    expect(() => playCards(state, turnOf(state), hand, '9', NOW)).toThrow(/No more than 8/);
    expect(() => playCards(state, turnOf(state), hand.slice(0, 8), '9', NOW)).not.toThrow();
  });
});

describe('challenges', () => {
  function openWith(state: BluffState, cards: CardCode[], rank: Rank) {
    setHand(state, state.currentSeat, [...cards, 'AH', 'AS']);
    const claimer = turnOf(state);
    playCards(state, claimer, cards, rank, NOW);
    return claimer;
  }

  it('buries the liar under the pile', () => {
    const state = game();
    state.pile = ['2D', '3C'];
    const claimer = openWith(state, ['4H'], 'K');
    const challenger = turnOf(state);
    const before = state.players.find((p) => p.id === claimer)!.hand.length;

    challenge(state, challenger, NOW);

    const liar = state.players.find((p) => p.id === claimer)!;
    expect(liar.hand).toHaveLength(before + 3);
    expect(state.pile).toHaveLength(0);
    expect(state.roundRank).toBeNull();
    // The challenger was right, so the challenger opens the next round.
    expect(turnOf(state)).toBe(challenger);
  });

  it('punishes a challenger who was wrong', () => {
    const state = game();
    const claimer = openWith(state, ['KD', 'KS'], 'K');
    const challenger = turnOf(state);
    const before = state.players.find((p) => p.id === challenger)!.hand.length;

    challenge(state, challenger, NOW);

    expect(state.players.find((p) => p.id === challenger)!.hand).toHaveLength(before + 2);
    // The claim was honest, so the claimer won it and opens the next round.
    expect(turnOf(state)).toBe(claimer);
  });

  it('reveals the disputed cards to everyone', () => {
    const state = game();
    openWith(state, ['4H', '5S'], 'K');
    challenge(state, turnOf(state), NOW);

    const event = state.events.find((e) => e.type === 'challenge');
    expect(event).toMatchObject({ bluffed: true, cards: ['4H', '5S'], rank: 'K' });
  });

  it('cannot be started by the claimer, or when nothing has been claimed', () => {
    const state = game();
    expect(canChallenge(state, 'p0')).toBe(false);
    const claimer = openWith(state, ['KD'], 'K');
    expect(canChallenge(state, claimer)).toBe(false);
    expect(canChallenge(state, turnOf(state))).toBe(true);
  });

  it('only stands against the most recent claim', () => {
    const state = game();
    openWith(state, ['4H'], 'K');
    // The next player covers it, and the earlier lie is buried for good.
    setHand(state, state.currentSeat, ['KC']);
    playCards(state, turnOf(state), ['KC'], 'K', NOW);

    challenge(state, turnOf(state), NOW);
    expect(state.events.find((e) => e.type === 'challenge')).toMatchObject({ bluffed: false });
  });
});

describe('the challenge budget', () => {
  /** Opens a round with `cards` claimed as `rank`, and hands back the seat now on the spot. */
  function claim(state: BluffState, cards: CardCode[], rank: Rank) {
    setHand(state, state.currentSeat, [...cards, 'AH', 'AS']);
    playCards(state, turnOf(state), cards, rank, NOW);
    return turnOf(state);
  }

  it('starts everybody with a full set', () => {
    expect(game().players.map((p) => p.challenges)).toEqual([4, 4, 4]);
  });

  it('costs a challenge to be wrong and never charges for being right', () => {
    const state = game();
    const challenger = claim(state, ['KD', 'KS'], 'K');
    challenge(state, challenger, NOW);
    // Honest claim, so the call was wrong.
    expect(state.players.find((p) => p.id === challenger)!.challenges).toBe(3);

    const next = claim(state, ['4H'], 'K');
    challenge(state, next, NOW);
    expect(state.players.find((p) => p.id === next)!.challenges).toBe(4);
  });

  it('earns one back for a correct call, but never past the cap', () => {
    const state = game();
    state.players[1].challenges = 2;
    state.currentSeat = 0;
    claim(state, ['4H'], 'K');
    challenge(state, 'p1', NOW);
    expect(state.players[1].challenges).toBe(3);

    state.players[1].challenges = 4;
    state.currentSeat = 0;
    claim(state, ['5H'], 'K');
    challenge(state, 'p1', NOW);
    expect(state.players[1].challenges).toBe(4);
  });

  it('locks a player out once they run dry', () => {
    const state = game();
    state.players[1].challenges = 0;
    state.currentSeat = 0;
    claim(state, ['4H'], 'K');

    expect(canChallenge(state, 'p1')).toBe(false);
    expect(() => challenge(state, 'p1', NOW)).toThrow(/out of challenges/);
    // Everybody else is unaffected.
    expect(canChallenge(state, 'p2')).toBe(true);
  });
});

describe('the bluff meter', () => {
  it('only runs for a player with no challenges left', () => {
    const state = game();
    state.currentSeat = 0;
    setHand(state, 0, ['2C', '3D', '4H']);
    playCards(state, 'p0', ['2C', '3D', '4H'], 'K', NOW);
    // Still holding challenges, so lying earns nothing.
    expect(state.players[0].bluffMeter).toBe(0);
  });

  it('counts only the cards that were actually lies', () => {
    const state = game();
    state.players[0].challenges = 0;
    state.currentSeat = 0;
    setHand(state, 0, ['KC', '3D', '4H']);
    playCards(state, 'p0', ['KC', '3D', '4H'], 'K', NOW);
    // The King was honest; the other two were not.
    expect(state.players[0].bluffMeter).toBe(2);
  });

  it('buys a challenge back when it fills, and empties itself', () => {
    const state = game();
    state.players[0].challenges = 0;
    state.players[0].bluffMeter = 18;
    state.currentSeat = 0;
    setHand(state, 0, ['2C', '3D']);
    playCards(state, 'p0', ['2C', '3D'], 'K', NOW);

    expect(state.players[0].challenges).toBe(1);
    expect(state.players[0].bluffMeter).toBe(0);
    expect(state.events).toContainEqual({ type: 'challengeEarned', playerId: 'p0' });
  });

  it('is never shown to anybody else', () => {
    const state = game();
    state.players[0].bluffMeter = 12;
    const mine = toBluffView(state, 'p0');
    const theirs = toBluffView(state, 'p1');

    expect(mine.you.bluffMeter).toBe(12);
    // Your own meter is yours to see; no opponent entry carries one at all, whatever it holds.
    expect(theirs.opponents.find((o) => o.id === 'p0')).not.toHaveProperty('bluffMeter');
    expect(JSON.stringify(theirs.opponents)).not.toContain('bluffMeter');
    expect(JSON.stringify(theirs.opponents)).not.toContain('12');
  });
});

describe('passing', () => {
  it('burns the pile once a pass has gone all the way round', () => {
    const state = game();
    setHand(state, state.currentSeat, ['9H', '2C']);
    playCards(state, turnOf(state), ['9H'], '9', NOW);

    pass(state, turnOf(state), NOW);
    pass(state, turnOf(state), NOW);
    expect(state.pile).toHaveLength(1);
    const lastToPass = turnOf(state);
    pass(state, lastToPass, NOW);

    expect(state.pile).toHaveLength(0);
    expect(state.burned).toBe(1);
    expect(state.roundRank).toBeNull();
    expect(state.events.some((e) => e.type === 'burn')).toBe(true);
    // Whoever passed last opens the round their pass killed.
    expect(turnOf(state)).toBe(lastToPass);
  });

  it('keeps a player who passed out of the rest of the round', () => {
    const state = game();
    // Hands deep enough that nobody empties one and leaves the round by going out instead.
    state.players.forEach((p, i) => setHand(state, i, ['9H', '9S', '9D', '9C', '2H']));
    state.currentSeat = 0;
    playCards(state, 'p0', ['9H'], '9', NOW);

    pass(state, 'p1', NOW);
    expect(state.players[1].passedRound).toBe(true);

    // Two are still in, so the round runs on - and the turn steps over the one who stood down.
    playCards(state, 'p2', ['9H'], '9', NOW);
    expect(turnOf(state)).toBe('p0');
    expect(() => playCards(state, 'p1', ['9S'], '9', NOW)).toThrow(/passed this round/);
  });

  it('passes the turn on when the clock runs out', () => {
    const state = game();
    const stalling = turnOf(state);
    expect(applyTimeout(state, NOW)).toBeNull();

    applyTimeout(state, state.turnEndsAt);
    expect(turnOf(state)).not.toBe(stalling);
    expect(state.events).toContainEqual({ type: 'pass', playerId: stalling, timedOut: true });
  });
});

describe('closing a round', () => {
  /** Opens a round from seat 0 and stands everyone else down, leaving p0 alone in it. */
  function leaveOneStanding(state: BluffState) {
    state.currentSeat = 0;
    setHand(state, 0, ['9H', '9S', '9D']);
    playCards(state, 'p0', ['9H'], '9', NOW);
    pass(state, 'p1', NOW);
    pass(state, 'p2', NOW);
    return state;
  }

  it('hands the last player left one closing claim, then stops the round', () => {
    const state = leaveOneStanding(game());
    // Everyone else is out of the round, so the turn comes back to the one still in it.
    expect(turnOf(state)).toBe('p0');
    expect(state.finalClaimBy).toBeNull();

    playCards(state, 'p0', ['9S'], '9', NOW);
    expect(state.finalClaimBy).toBe('p0');
    expect(state.events).toContainEqual({ type: 'roundClosing', playerId: 'p0' });

    // And that really is the last of it - they cannot simply carry on.
    expect(() => playCards(state, 'p0', ['9D'], '9', NOW)).toThrow(/closing/);
  });

  it('ends the round once everybody lets the closing claim go', () => {
    const state = leaveOneStanding(game());
    playCards(state, 'p0', ['9S'], '9', NOW);
    expect(state.pile).toHaveLength(2);

    expect(canLetGo(state, 'p1')).toBe(true);
    expect(canLetGo(state, 'p0')).toBe(false);

    letGo(state, 'p1', NOW);
    expect(state.finalClaimBy).toBe('p0');

    letGo(state, 'p2', NOW);
    expect(state.finalClaimBy).toBeNull();
    expect(state.pile).toHaveLength(0);
    expect(state.burned).toBe(2);
    expect(state.roundRank).toBeNull();
    // Everyone is back in for the next round, which the survivor opens.
    expect(state.players.every((p) => !p.passedRound && !p.letGo)).toBe(true);
    expect(turnOf(state)).toBe('p0');
  });

  it('still lets a player who passed check the closing claim', () => {
    const state = leaveOneStanding(game());
    setHand(state, 0, ['2C']);
    playCards(state, 'p0', ['2C'], '9', NOW);

    expect(canChallenge(state, 'p1')).toBe(true);
    challenge(state, 'p1', NOW);
    expect(state.events.find((e) => e.type === 'challenge')).toMatchObject({ bluffed: true });
    // A challenge ends the round outright, so nobody is left sitting it out.
    expect(state.finalClaimBy).toBeNull();
    expect(state.players.every((p) => !p.passedRound)).toBe(true);
  });

  it('cannot run on for ever with one player laying cards and the rest passing', () => {
    // The bug this replaced: passes reset on every play, so a single round never ended.
    const state = game();
    state.currentSeat = 0;
    setHand(state, 0, ['9H', '9S', '9D', '9C']);
    playCards(state, 'p0', ['9H'], '9', NOW);

    let guard = 0;
    while (!state.finalClaimBy && state.pile.length > 0 && guard++ < 20) {
      const on = turnOf(state);
      if (on === 'p0') playCards(state, 'p0', [state.players[0].hand[0]], '9', NOW);
      else pass(state, on, NOW);
    }
    expect(guard).toBeLessThan(20);
    expect(state.finalClaimBy).toBe('p0');
  });

  it('burns the pile when even the last player stands down', () => {
    const state = leaveOneStanding(game());
    pass(state, 'p0', NOW);

    expect(state.pile).toHaveLength(0);
    expect(state.burned).toBe(1);
    expect(state.finalClaimBy).toBeNull();
    expect(turnOf(state)).toBe('p0');
  });

  it('lets the clock wave a closing claim through', () => {
    const state = leaveOneStanding(game());
    playCards(state, 'p0', ['9S'], '9', NOW);

    applyTimeout(state, state.turnEndsAt);
    expect(state.finalClaimBy).toBeNull();
    expect(state.pile).toHaveLength(0);
    expect(state.events.filter((e) => e.type === 'letGo')).toHaveLength(2);
  });
});

describe('going out', () => {
  /** Drives the table to a state where `seat` is about to play its final card. */
  function aboutToWin(state: BluffState, seat: number, card: CardCode) {
    state.currentSeat = seat;
    setHand(state, seat, [card]);
  }

  it('holds a finished player in limbo until their last claim survives', () => {
    const state = game();
    aboutToWin(state, 0, 'KD');
    playCards(state, 'p0', ['KD'], 'K', NOW);
    expect(state.players[0].status).toBe('pendingOut');
    expect(state.winners).toHaveLength(0);

    pass(state, turnOf(state), NOW);
    expect(state.players[0].status).toBe('out');
    expect(state.winners).toEqual(['p0']);
  });

  it('drags a caught liar back into the game', () => {
    const state = game();
    state.pile = ['2D', '3C', '4H'];
    aboutToWin(state, 0, '5S');
    playCards(state, 'p0', ['5S'], 'K', NOW);
    expect(state.players[0].status).toBe('pendingOut');

    challenge(state, turnOf(state), NOW);
    expect(state.players[0].status).toBe('active');
    expect(state.players[0].hand).toHaveLength(4);
    expect(state.winners).toHaveLength(0);
  });

  it('confirms an honest finisher when a challenge backfires', () => {
    const state = game({ playerCount: 4 });
    aboutToWin(state, 0, 'KD');
    playCards(state, 'p0', ['KD'], 'K', NOW);
    challenge(state, 'p2', NOW);

    expect(state.players[0].status).toBe('out');
    expect(state.players[0].place).toBe(1);
    // p0 won the challenge but that same claim sent them home, so the seat after them opens.
    expect(turnOf(state)).toBe('p1');
  });

  it('skips players who are already home', () => {
    const state = game({ playerCount: 4 });
    [1, 2, 3].forEach((seat) => setHand(state, seat, ['KC', 'KH', 'KS', '2D']));
    aboutToWin(state, 0, 'KD');
    playCards(state, 'p0', ['KD'], 'K', NOW);

    // Everyone plays rather than passes, so the round stays open and only p0 has left the game.
    playCards(state, 'p1', ['KC'], 'K', NOW);
    expect(state.players[0].status).toBe('out');
    playCards(state, 'p2', ['KC'], 'K', NOW);
    playCards(state, 'p3', ['KC'], 'K', NOW);

    // Back round to p1, never to p0.
    expect(turnOf(state)).toBe('p1');
  });
});

describe('ending the game', () => {
  it('stops at one winner head to head', () => {
    const state = game({ playerCount: 2 });
    state.currentSeat = 0;
    setHand(state, 0, ['KD']);
    playCards(state, 'p0', ['KD'], 'K', NOW);
    pass(state, 'p1', NOW);

    expect(state.finished).toBe(true);
    expect(state.winners).toEqual(['p0']);
    expect(state.events).toContainEqual({ type: 'finished', winnerIds: ['p0'] });
  });

  it('runs on to a second winner at a bigger table', () => {
    const state = game({ playerCount: 4 });
    state.currentSeat = 0;
    setHand(state, 0, ['KD']);
    playCards(state, 'p0', ['KD'], 'K', NOW);
    pass(state, 'p1', NOW);
    expect(state.finished).toBe(false);

    state.currentSeat = 2;
    setHand(state, 2, ['KC']);
    playCards(state, 'p2', ['KC'], 'K', NOW);
    pass(state, 'p3', NOW);

    expect(state.finished).toBe(true);
    expect(state.winners).toEqual(['p0', 'p2']);
    expect(state.players[2].place).toBe(2);
  });

  it('refuses any further action once it is over', () => {
    const state = game({ playerCount: 2 });
    state.currentSeat = 0;
    setHand(state, 0, ['KD']);
    playCards(state, 'p0', ['KD'], 'K', NOW);
    pass(state, 'p1', NOW);

    expect(() => pass(state, 'p1', NOW)).toThrow(/over/);
    expect(() => challenge(state, 'p1', NOW)).toThrow(/over/);
  });
});

describe('the record kept for the end-of-game honours', () => {
  it('counts a mixed play as one bluff, not one per lying card', () => {
    const state = game();
    setHand(state, state.currentSeat, ['KD', 'KS', '4H', '7C', 'AH']);
    const claimer = turnOf(state);
    playCards(state, claimer, ['KD', 'KS', '4H', '7C'], 'K', NOW);

    const stats = state.players.find((p) => p.id === claimer)!.stats;
    expect(stats.turns).toBe(1);
    expect(stats.bluffTurns).toBe(1);
  });

  it('leaves an honest play off the bluff count', () => {
    const state = game();
    setHand(state, state.currentSeat, ['KD', 'KS', 'AH']);
    const claimer = turnOf(state);
    playCards(state, claimer, ['KD', 'KS'], 'K', NOW);

    expect(state.players.find((p) => p.id === claimer)!.stats).toMatchObject({
      turns: 1,
      bluffTurns: 0,
    });
  });

  it('records a caught bluff against the liar and for the caller', () => {
    const state = game();
    setHand(state, state.currentSeat, ['4H', 'AH', 'AS']);
    const claimer = turnOf(state);
    playCards(state, claimer, ['4H'], 'K', NOW);
    const challenger = turnOf(state);
    challenge(state, challenger, NOW);

    expect(state.players.find((p) => p.id === claimer)!.stats.bluffsCaught).toBe(1);
    expect(state.players.find((p) => p.id === challenger)!.stats).toMatchObject({
      challengesMade: 1,
      challengesCorrect: 1,
    });
  });

  it('counts a wrong call as a call all the same', () => {
    const state = game();
    setHand(state, state.currentSeat, ['KD', 'AH', 'AS']);
    const claimer = turnOf(state);
    playCards(state, claimer, ['KD'], 'K', NOW);
    const challenger = turnOf(state);
    challenge(state, challenger, NOW);

    expect(state.players.find((p) => p.id === challenger)!.stats).toMatchObject({
      challengesMade: 1,
      challengesCorrect: 0,
    });
    expect(state.players.find((p) => p.id === claimer)!.stats.bluffsCaught).toBe(0);
  });

  it('does not count passing as a turn', () => {
    const state = game();
    const passer = turnOf(state);
    pass(state, passer, NOW);

    expect(state.players.find((p) => p.id === passer)!.stats.turns).toBe(0);
  });
});

describe('player view', () => {
  it('shows your own hand but only counts for everyone else', () => {
    const state = game();
    const view = toBluffView(state, 'p1');

    expect(view.you.hand).toEqual(state.players[1].hand);
    expect(view.opponents.map((o) => o.id)).toEqual(['p2', 'p0']);
    expect(view.opponents[0].handCount).toBe(state.players[2].hand.length);
    expect(view.opponents[0]).not.toHaveProperty('hand');
  });

  it('never leaks what is face down on the pile', () => {
    const state = game();
    setHand(state, state.currentSeat, ['2C']);
    playCards(state, turnOf(state), ['2C'], 'A', NOW);

    const view = toBluffView(state, 'p1');
    expect(view.pileCount).toBe(1);
    expect(view.lastClaim).toMatchObject({ rank: 'A', count: 1 });
    expect(JSON.stringify(view.lastClaim)).not.toContain('2C');
  });

  it('withholds the honours until the game is over, so nobody is named as a liar mid-hand', () => {
    const state = game();
    setHand(state, state.currentSeat, ['4H', 'AH']);
    playCards(state, turnOf(state), ['4H'], 'K', NOW);

    expect(toBluffView(state, 'p1').awards).toEqual([]);
  });

  it('hands the honours out once it is over', () => {
    const state = game({ playerCount: 2 });
    // p0 lies its way home; p1 tells the truth and never calls it.
    setHand(state, 0, ['4H', 'AH']);
    setHand(state, 1, ['KC', '9D']);
    state.currentSeat = 0;
    playCards(state, 'p0', ['4H'], 'K', NOW);
    playCards(state, 'p1', ['KC'], 'K', NOW);
    playCards(state, 'p0', ['AH'], 'K', NOW);
    pass(state, 'p1', NOW);

    const view = toBluffView(state, 'p1');
    expect(view.finished).toBe(true);
    expect(view.awards.find((a) => a.id === 'bluffmaster')).toMatchObject({
      playerIds: ['p0'],
      headline: 'Wanted on two counts of bluffing',
      pips: { total: 2, flagged: 0 },
    });
    expect(view.awards.find((a) => a.id === 'samaritan')?.playerIds).toEqual(['p1']);
  });
});
