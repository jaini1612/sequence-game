import { describe, expect, it } from 'vitest';
import { buildBoardLayout } from './board.js';
import { discardDeadCard, getCardPositions, isDeadCard, playCard } from './engine.js';
import { BOARD_SIZE, GameState, Player } from './types.js';

function makeState(overrides: Partial<GameState> = {}): GameState {
  const board = buildBoardLayout();
  const chips = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  const sequenceUse = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  const players: [Player, Player] = [
    { id: 'p1', color: 'BLUE', hand: [] },
    { id: 'p2', color: 'RED', hand: [] },
  ];
  return {
    board,
    chips,
    sequenceUse,
    players,
    currentPlayerIndex: 0,
    drawPile: [],
    discardPile: [],
    sequences: [],
    winnerId: null,
    deadCardDiscardedThisTurn: false,
    ...overrides,
  };
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
  it('places a chip on the matching space, draws a replacement, and passes the turn', () => {
    const state = makeState();
    const [pos] = getCardPositions(state, '2D');
    state.players[0].hand = ['2D'];
    state.drawPile = ['3D'];

    playCard(state, 'p1', '2D', pos);

    expect(state.chips[pos.row][pos.col]).toBe('BLUE');
    expect(state.players[0].hand).toEqual(['3D']);
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
