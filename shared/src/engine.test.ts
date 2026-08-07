import { describe, expect, it } from 'vitest';
import { buildBoardLayout } from './board.js';
import {
  canDraw,
  createGame,
  discardDeadCard,
  drawCard,
  getCardPositions,
  isDeadCard,
  playCard,
  resolveExpiredDraws,
  toPlayerView,
} from './engine.js';
import { BOARD_SIZE, GameState, Player } from './types.js';

function makeState(overrides: Partial<GameState> = {}): GameState {
  const board = buildBoardLayout();
  const chips = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  const sequenceUse = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  const players: Player[] = [
    { id: 'p1', color: 'BLUE', hand: [] },
    { id: 'p2', color: 'RED', hand: [] },
  ];
  return {
    board,
    chips,
    sequenceUse,
    players,
    currentPlayerIndex: 0,
    sequencesToWin: 2,
    drawPile: [],
    discardPile: [],
    sequences: [],
    lastPlacement: null,
    drawQueue: [],
    lastPlayerId: null,
    missedDraws: {},
    winnerId: null,
    deadCardDiscardedThisTurn: false,
    ...overrides,
  };
}

/** A three-way game: blue, red, green, all seated in that order. */
function makeThreePlayerState(overrides: Partial<GameState> = {}): GameState {
  return makeState({
    players: [
      { id: 'p1', color: 'BLUE', hand: [] },
      { id: 'p2', color: 'RED', hand: [] },
      { id: 'p3', color: 'GREEN', hand: [] },
    ],
    sequencesToWin: 1,
    ...overrides,
  });
}

describe('isDeadCard', () => {
  it('is false when a matching board space is open, true once both are taken', () => {
    const state = makeState();
    const [posA, posB] = getCardPositions(state, '2D');
    expect(isDeadCard(state, '2D')).toBe(false);

    state.chips[posA.row][posA.col] = 'BLUE';
    expect(isDeadCard(state, '2D')).toBe(false);

    state.chips[posB.row][posB.col] = 'RED';
    expect(isDeadCard(state, '2D')).toBe(true);
  });

  it('jacks are never dead', () => {
    const state = makeState();
    expect(isDeadCard(state, 'JD')).toBe(false);
    expect(isDeadCard(state, 'JH')).toBe(false);
  });
});

describe('discardDeadCard', () => {
  it('replaces the card without ending the turn', () => {
    const state = makeState();
    const [posA, posB] = getCardPositions(state, '2D');
    state.chips[posA.row][posA.col] = 'BLUE';
    state.chips[posB.row][posB.col] = 'RED';
    state.players[0].hand = ['2D'];
    state.drawPile = ['3D'];

    discardDeadCard(state, 'p1', '2D');

    expect(state.players[0].hand).toEqual(['3D']);
    expect(state.discardPile).toEqual(['2D']);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('throws if the card is not actually dead', () => {
    const state = makeState();
    state.players[0].hand = ['2D'];
    expect(() => discardDeadCard(state, 'p1', '2D')).toThrow();
  });

  it('only allows one dead-card discard per turn', () => {
    const state = makeState();
    const [a1, a2] = getCardPositions(state, '2D');
    const [b1, b2] = getCardPositions(state, '3D');
    state.chips[a1.row][a1.col] = 'BLUE';
    state.chips[a2.row][a2.col] = 'RED';
    state.chips[b1.row][b1.col] = 'BLUE';
    state.chips[b2.row][b2.col] = 'RED';
    state.players[0].hand = ['2D', '3D'];
    state.drawPile = ['4D', '5D'];

    discardDeadCard(state, 'p1', '2D');
    expect(() => discardDeadCard(state, 'p1', '3D')).toThrow('Already discarded a dead card this turn');
  });
});

describe('playCard - normal cards', () => {
  it('places a chip on the matching space, owes a replacement, and passes the turn', () => {
    const state = makeState();
    const [pos] = getCardPositions(state, '2D');
    state.players[0].hand = ['2D'];
    state.drawPile = ['3D'];

    playCard(state, 'p1', '2D', pos);

    expect(state.chips[pos.row][pos.col]).toBe('BLUE');
    // The replacement is queued, not dealt - the player has to tap the pile for it.
    expect(state.players[0].hand).toEqual([]);
    expect(state.drawQueue.map((d) => d.playerId)).toEqual(['p1']);
    expect(state.discardPile).toEqual(['2D']);
    expect(state.lastPlacement).toEqual(pos);
    expect(state.currentPlayerIndex).toBe(1);
  });

  it('rejects playing on the wrong space', () => {
    const state = makeState();
    const [pos] = getCardPositions(state, '3D');
    state.players[0].hand = ['2D'];
    expect(() => playCard(state, 'p1', '2D', pos)).toThrow();
  });

  it('rejects playing when it is not your turn', () => {
    const state = makeState();
    const [pos] = getCardPositions(state, '2D');
    state.players[1].hand = ['2D'];
    expect(() => playCard(state, 'p2', '2D', pos)).toThrow('Not your turn');
  });

  it('rejects playing on an occupied space', () => {
    const state = makeState();
    const [pos] = getCardPositions(state, '2D');
    state.chips[pos.row][pos.col] = 'RED';
    state.players[0].hand = ['2D'];
    expect(() => playCard(state, 'p1', '2D', pos)).toThrow();
  });
});

describe('playCard - two-eyed jacks (wild)', () => {
  it('places a chip on any open, non-corner space', () => {
    const state = makeState();
    state.players[0].hand = ['JD'];
    state.drawPile = ['3D'];

    playCard(state, 'p1', 'JD', { row: 5, col: 5 });

    expect(state.chips[5][5]).toBe('BLUE');
  });

  it('rejects targeting a corner', () => {
    const state = makeState();
    state.players[0].hand = ['JD'];
    expect(() => playCard(state, 'p1', 'JD', { row: 0, col: 0 })).toThrow();
  });
});

describe('playCard - one-eyed jacks (remove)', () => {
  it('removes an opponent chip that is not part of a sequence', () => {
    const state = makeState();
    state.chips[5][5] = 'RED';
    state.players[0].hand = ['JH'];
    state.drawPile = ['3D'];

    playCard(state, 'p1', 'JH', { row: 5, col: 5 });

    expect(state.chips[5][5]).toBeNull();
  });

  it('clears lastPlacement when it is the chip being removed', () => {
    const state = makeState();
    state.chips[5][5] = 'RED';
    state.lastPlacement = { row: 5, col: 5 };
    state.players[0].hand = ['JH'];
    state.drawPile = ['3D'];

    playCard(state, 'p1', 'JH', { row: 5, col: 5 });

    expect(state.lastPlacement).toBeNull();
  });

  it('keeps lastPlacement when some other chip is removed', () => {
    const state = makeState();
    state.chips[5][5] = 'RED';
    state.lastPlacement = { row: 2, col: 3 };
    state.players[0].hand = ['JH'];
    state.drawPile = ['3D'];

    playCard(state, 'p1', 'JH', { row: 5, col: 5 });

    expect(state.lastPlacement).toEqual({ row: 2, col: 3 });
  });

  it('rejects removing your own chip', () => {
    const state = makeState();
    state.chips[5][5] = 'BLUE';
    state.players[0].hand = ['JH'];
    expect(() => playCard(state, 'p1', 'JH', { row: 5, col: 5 })).toThrow('Cannot remove your own chip');
  });

  it('rejects removing a chip that is part of a sequence', () => {
    const state = makeState();
    state.chips[5][5] = 'RED';
    state.sequenceUse[5][5] = 1;
    state.players[0].hand = ['JH'];
    expect(() => playCard(state, 'p1', 'JH', { row: 5, col: 5 })).toThrow(
      'Cannot remove a chip that is part of a sequence',
    );
  });
});

describe('sequence detection', () => {
  it('detects a straight line of 5 and awards a win at 2 sequences', () => {
    const state = makeState();

    state.chips[1][1] = 'BLUE';
    state.chips[1][2] = 'BLUE';
    state.chips[1][3] = 'BLUE';
    state.chips[1][4] = 'BLUE';
    const [completingPos] = getCardPositions(state, state.board[1][5] as string);
    state.players[0].hand = [state.board[1][5] as string];
    state.drawPile = ['3D'];

    playCard(state, 'p1', state.board[1][5] as string, { row: 1, col: 5 });

    expect(state.sequences.length).toBe(1);
    expect(state.winnerId).toBeNull();

    // Second, non-overlapping sequence for the same player wins the game.
    state.currentPlayerIndex = 0;
    state.chips[2][8] = 'BLUE';
    state.chips[3][8] = 'BLUE';
    state.chips[4][8] = 'BLUE';
    state.chips[5][8] = 'BLUE';
    state.players[0].hand = [state.board[6][8] as string];
    state.drawPile = ['4D'];

    playCard(state, 'p1', state.board[6][8] as string, { row: 6, col: 8 });

    expect(state.sequences.length).toBe(2);
    expect(state.winnerId).toBe('p1');
  });

  it('lets a wild corner count as part of a sequence', () => {
    const state = makeState();
    state.chips[0][1] = 'BLUE';
    state.chips[0][2] = 'BLUE';
    state.chips[0][3] = 'BLUE';
    state.players[0].hand = [state.board[0][4] as string];
    state.drawPile = ['4D'];

    playCard(state, 'p1', state.board[0][4] as string, { row: 0, col: 4 });

    expect(state.sequences.length).toBe(1);
    expect(state.sequences[0].cells).toContainEqual({ row: 0, col: 0 });
  });

  it('does not double-count an overlapping run as a second sequence', () => {
    const state = makeState();
    state.chips[1][1] = 'BLUE';
    state.chips[1][2] = 'BLUE';
    state.chips[1][3] = 'BLUE';
    state.chips[1][4] = 'BLUE';
    state.players[0].hand = [state.board[1][5] as string];
    state.drawPile = ['3D'];
    playCard(state, 'p1', state.board[1][5] as string, { row: 1, col: 5 });
    expect(state.sequences.length).toBe(1);

    // Shifting the same run by one column (cols 2-6) shares 4 cells with the
    // existing sequence, which exceeds the "one shared chip" allowance.
    state.currentPlayerIndex = 0;
    state.players[0].hand = ['JD'];
    state.drawPile = ['4D'];
    playCard(state, 'p1', 'JD', { row: 1, col: 6 });

    expect(state.sequences.length).toBe(1);
    expect(state.winnerId).toBeNull();
  });
});

describe('three-player games', () => {
  it('deals six cards each, three colours, and needs only one sequence to win', () => {
    const state = createGame([
      { id: 'p1', color: 'BLUE' },
      { id: 'p2', color: 'RED' },
      { id: 'p3', color: 'GREEN' },
    ]);

    expect(state.players.map((p) => p.hand.length)).toEqual([6, 6, 6]);
    expect(state.players.map((p) => p.color)).toEqual(['BLUE', 'RED', 'GREEN']);
    expect(state.sequencesToWin).toBe(1);
  });

  it('cycles the turn through all three seats and back', () => {
    const state = makeThreePlayerState();
    const order: string[] = [];

    for (const id of ['p1', 'p2', 'p3', 'p1']) {
      order.push(state.players[state.currentPlayerIndex].id);
      state.players[state.currentPlayerIndex].hand = ['JD'];
      state.drawPile = ['3D'];
      playCard(state, id, 'JD', { row: 5, col: order.length });
    }

    expect(order).toEqual(['p1', 'p2', 'p3', 'p1']);
  });

  it('wins on a single sequence', () => {
    const state = makeThreePlayerState();
    state.chips[1][1] = 'BLUE';
    state.chips[1][2] = 'BLUE';
    state.chips[1][3] = 'BLUE';
    state.chips[1][4] = 'BLUE';
    state.players[0].hand = [state.board[1][5] as string];
    state.drawPile = ['3D'];

    playCard(state, 'p1', state.board[1][5] as string, { row: 1, col: 5 });

    expect(state.sequences.length).toBe(1);
    expect(state.winnerId).toBe('p1');
  });

  it('lets a one-eyed jack lift either opponent’s chip but never your own', () => {
    const state = makeThreePlayerState();
    state.chips[4][4] = 'RED';
    state.chips[4][5] = 'GREEN';
    state.chips[4][6] = 'BLUE';
    state.players[0].hand = ['JH', 'JH', 'JH'];
    state.drawPile = ['3D', '4D', '5D'];

    playCard(state, 'p1', 'JH', { row: 4, col: 4 });
    expect(state.chips[4][4]).toBeNull();

    state.currentPlayerIndex = 0;
    playCard(state, 'p1', 'JH', { row: 4, col: 5 });
    expect(state.chips[4][5]).toBeNull();

    state.currentPlayerIndex = 0;
    expect(() => playCard(state, 'p1', 'JH', { row: 4, col: 6 })).toThrow('Cannot remove your own chip');
  });

  it('rejects a game where two players claim the same colour', () => {
    expect(() =>
      createGame([
        { id: 'p1', color: 'BLUE' },
        { id: 'p2', color: 'BLUE' },
      ]),
    ).toThrow('distinct colour');
  });
});

describe('drawing is manual', () => {
  /** Plays a jack as `id` at a throwaway square, so tests can advance turns cheaply. */
  function playSomething(state: GameState, id: string, col: number, now: number) {
    const player = state.players.find((p) => p.id === id)!;
    player.hand = ['JD'];
    playCard(state, id, 'JD', { row: 5, col }, now);
  }

  it('does not deal a replacement when a card is played', () => {
    const state = makeState();
    const [pos] = getCardPositions(state, '2D');
    state.players[0].hand = ['2D'];
    state.drawPile = ['3D'];

    playCard(state, 'p1', '2D', pos, 1000);

    expect(state.players[0].hand).toEqual([]);
    expect(state.drawPile).toEqual(['3D']);
    expect(state.drawQueue).toEqual([{ playerId: 'p1', deadlineAt: null }]);
  });

  it('gives the card when the pile is tapped', () => {
    const state = makeState();
    state.drawPile = ['3D', '4D'];
    playSomething(state, 'p1', 1, 1000);

    drawCard(state, 'p1', 1100);

    expect(state.players[0].hand).toEqual(['3D']);
    expect(state.drawQueue).toEqual([]);
  });

  it('leaves you off the clock until somebody else plays', () => {
    const state = makeState();
    state.drawPile = ['3D', '4D'];
    playSomething(state, 'p1', 1, 1000);
    expect(state.drawQueue[0].deadlineAt).toBeNull();

    // An hour later, with nobody having moved, the card is still there for the taking.
    expect(resolveExpiredDraws(state, 1000 + 3_600_000)).toEqual([]);
    expect(canDraw(state, 'p1')).toBe(true);
  });

  it('starts a two second grace period once the next player plays', () => {
    const state = makeState();
    state.drawPile = ['3D', '4D', '5D'];
    playSomething(state, 'p1', 1, 1000);
    playSomething(state, 'p2', 2, 5000);

    expect(state.drawQueue[0]).toEqual({ playerId: 'p1', deadlineAt: 7000 });
    // Still in time at the very end of the window.
    expect(resolveExpiredDraws(state, 7000)).toEqual([]);
    drawCard(state, 'p1', 7000);
    expect(state.players[0].hand).toContain('3D');
  });

  it('writes the card off once the grace period lapses, and only that card', () => {
    const state = makeState();
    state.drawPile = ['3D', '4D', '5D'];
    playSomething(state, 'p1', 1, 1000);
    playSomething(state, 'p2', 2, 5000);

    expect(resolveExpiredDraws(state, 7001)).toEqual(['p1']);
    expect(state.missedDraws).toEqual({ p1: 1 });
    expect(() => drawCard(state, 'p1', 7001)).toThrow('not owed a card');
    // The lost card is gone for good - it cannot be picked up on a later turn.
    expect(state.players[0].hand).toEqual([]);
  });

  it('locks the pile for the next player until the older debt clears', () => {
    const state = makeState();
    state.drawPile = ['3D', '4D', '5D'];
    playSomething(state, 'p1', 1, 1000);
    playSomething(state, 'p2', 2, 5000);

    // p2 is owed a card too, but p1 is ahead of them and still inside the grace period.
    expect(canDraw(state, 'p2')).toBe(false);
    expect(() => drawCard(state, 'p2', 5500)).toThrow('still owed the top card');

    resolveExpiredDraws(state, 7001);

    // p1 let it go, so the pile is p2's now - and p2 played last, so they are under no pressure.
    expect(canDraw(state, 'p2')).toBe(true);
    expect(state.drawQueue[0].deadlineAt).toBeNull();
    drawCard(state, 'p2', 7002);
    expect(state.players[1].hand).toContain('3D');
  });

  it('unlocks the pile for the next player the moment the older debt is settled', () => {
    const state = makeState();
    state.drawPile = ['3D', '4D', '5D'];
    playSomething(state, 'p1', 1, 1000);
    playSomething(state, 'p2', 2, 5000);

    drawCard(state, 'p1', 6000);

    expect(canDraw(state, 'p2')).toBe(true);
    expect(state.drawQueue[0].deadlineAt).toBeNull();
  });

  it('gives a debtor a fresh grace period once the queue reaches them', () => {
    const state = makeThreePlayerState();
    state.drawPile = ['3D', '4D', '5D', '6D'];
    playSomething(state, 'p1', 1, 1000);
    playSomething(state, 'p2', 2, 2000); // p1 on the clock until 4000
    playSomething(state, 'p3', 3, 2500); // p3 played fast; p1's deadline must not move
    expect(state.drawQueue[0]).toEqual({ playerId: 'p1', deadlineAt: 4000 });

    resolveExpiredDraws(state, 4001);

    // p2 was locked out behind p1 for that whole window, so their own two seconds run from the
    // moment p1's card actually lapsed (4000) rather than from whenever this check happened to run.
    expect(state.drawQueue[0]).toEqual({ playerId: 'p2', deadlineAt: 6000 });
    expect(canDraw(state, 'p2')).toBe(true);
  });

  it('clears several lapsed debts in one sweep', () => {
    const state = makeThreePlayerState();
    state.drawPile = ['3D', '4D', '5D', '6D'];
    playSomething(state, 'p1', 1, 1000);
    playSomething(state, 'p2', 2, 2000);
    playSomething(state, 'p3', 3, 2500);

    // Nothing polled for a long stretch: p1 lapses, then p2's fresh window lapses too.
    expect(resolveExpiredDraws(state, 100_000)).toEqual(['p1', 'p2']);
    expect(state.missedDraws).toEqual({ p1: 1, p2: 1 });
    // p3 played last, so they are never put on the clock and keep their card.
    expect(canDraw(state, 'p3')).toBe(true);
    expect(state.drawQueue[0].deadlineAt).toBeNull();
  });

  it('still discards a dead card straight into the hand, mid-turn', () => {
    const state = makeState();
    const [a, b] = getCardPositions(state, '2D');
    state.chips[a.row][a.col] = 'RED';
    state.chips[b.row][b.col] = 'RED';
    state.players[0].hand = ['2D'];
    state.drawPile = ['9C'];

    discardDeadCard(state, 'p1', '2D');

    // No queue involved: it is your own turn and there is nobody to race.
    expect(state.players[0].hand).toEqual(['9C']);
    expect(state.drawQueue).toEqual([]);
  });

  it('does not strand the queue when the pile and discards are empty', () => {
    const state = makeState();
    state.drawPile = [];
    playSomething(state, 'p1', 1, 1000);
    state.discardPile = [];

    drawCard(state, 'p1', 1100);

    expect(state.drawQueue).toEqual([]);
    expect(state.missedDraws).toEqual({});
  });
});

describe('toPlayerView', () => {
  it('lists opponents in the order play reaches them', () => {
    const state = makeThreePlayerState();

    expect(toPlayerView(state, 'p1').opponents.map((o) => o.id)).toEqual(['p2', 'p3']);
    expect(toPlayerView(state, 'p2').opponents.map((o) => o.id)).toEqual(['p3', 'p1']);
    expect(toPlayerView(state, 'p3').opponents.map((o) => o.id)).toEqual(['p1', 'p2']);
  });

  it('reports whose turn it is, and hides other hands behind a count', () => {
    const state = makeThreePlayerState();
    state.players[1].hand = ['2D', '3D'];
    const view = toPlayerView(state, 'p1');

    expect(view.currentPlayerId).toBe('p1');
    expect(view.isYourTurn).toBe(true);
    expect(view.opponents[0]).toEqual({ id: 'p2', color: 'RED', handSize: 2 });
  });
});
