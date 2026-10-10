import { describe, expect, it } from 'vitest';
import { cardTriangles, DIRECTIONS, surfaceTriangles } from './geometry.js';
import { evaluatePlacement, legalPlacements, placeOnBoard } from './placement.js';
import { at, boardOf, card } from './testHelpers.js';

// With the first card at the origin facing up, its TOP is landed on from (0,1), its SIDE from (1,-1)
// and its FACE from (-1,0).
const TOP = at(0, 1);
const SIDE = at(1, -1);
const FACE = at(-1, 0);

describe('geometry', () => {
  it('shares exactly the covered surface between a card and one stacced squarely on it', () => {
    const under = cardTriangles({ a: 0, b: 0 });
    for (const [spot, surface] of [
      [TOP, 'top'],
      [SIDE, 'side'],
      [FACE, 'face'],
    ] as const) {
      const shared = cardTriangles(spot.pos).filter((t) => under.includes(t));
      expect(shared.sort()).toEqual([...surfaceTriangles({ a: 0, b: 0 }, 0, surface)].sort());
    }
  });

  it('never overlaps cards whose centres are not lattice neighbours', () => {
    const under = cardTriangles({ a: 0, b: 0 });
    const twoAway = cardTriangles({ a: 1, b: 1 });
    expect(twoAway.filter((t) => under.includes(t))).toEqual([]);
    expect(DIRECTIONS).toHaveLength(6);
  });
});

describe('CARDINAL RULE #1: matching suits stacc on the TOP', () => {
  const board = boardOf([['3S', at(0, 0)]]);

  it('takes another spade on the top', () => {
    expect(evaluatePlacement(board, card('4S'), TOP)).toMatchObject({ ok: true, touches: [{ seq: 0, surface: 'top' }] });
  });

  it('refuses a different suit on the top', () => {
    expect(evaluatePlacement(board, card('3H'), TOP).ok).toBe(false);
  });
});

describe('CARDINAL RULE #2: matching numbers stacc on the SIDE', () => {
  const board = boardOf([['5S', at(0, 0)]]);

  it('takes the same number in any suit on the side', () => {
    expect(evaluatePlacement(board, card('5H'), SIDE)).toMatchObject({ ok: true, touches: [{ surface: 'side' }] });
  });

  it('refuses a different number, even of the same suit', () => {
    expect(evaluatePlacement(board, card('6S'), SIDE).ok).toBe(false);
  });

  it('never lets a number stacc on the FACE', () => {
    expect(evaluatePlacement(board, card('5H'), FACE).ok).toBe(false);
  });

  it('treats zero as a number', () => {
    const zero = boardOf([['0S', at(0, 0)]]);
    expect(evaluatePlacement(zero, card('0D'), SIDE).ok).toBe(true);
  });
});

describe('CARDINAL RULE #3: matching letters stacc on the FACE', () => {
  const board = boardOf([['JS', at(0, 0)]]);

  it('takes another Jack on the face', () => {
    expect(evaluatePlacement(board, card('JH'), FACE)).toMatchObject({ ok: true, touches: [{ surface: 'face' }] });
  });

  it("refuses a King on a Jack's face", () => {
    expect(evaluatePlacement(board, card('KS'), FACE).ok).toBe(false);
  });

  it('never lets a letter stacc on the SIDE', () => {
    expect(evaluatePlacement(board, card('JH'), SIDE).ok).toBe(false);
  });
});

describe('playable surfaces', () => {
  it('needs every surface a card lands on to match (only the 5 of clubs fits here)', () => {
    // A 3 of clubs, and a 5 of hearts whose SIDE ends where the 3's TOP is landed on.
    const board = boardOf([
      ['3C', at(0, 0)],
      ['5H', at(-1, 2)],
    ]);
    expect(evaluatePlacement(board, card('5C'), TOP)).toMatchObject({
      ok: true,
      touches: expect.arrayContaining([
        { seq: 0, surface: 'top' },
        { seq: 1, surface: 'side' },
      ]),
    });
    expect(evaluatePlacement(board, card('5D'), TOP).ok).toBe(false);
    expect(evaluatePlacement(board, card('7C'), TOP).ok).toBe(false);
  });

  it('refuses a surface that is partly covered', () => {
    // A card sitting diagonally up and right covers half of the first card's TOP.
    const board = boardOf([
      ['5S', at(0, 0)],
      ['5H', at(1, 0)],
    ]);
    expect(evaluatePlacement(board, card('6S'), TOP)).toMatchObject({ ok: false });
  });

  it('allows a card to half-cover a neighbouring surface diagonally without matching it', () => {
    // A Jack stacced on the 5's TOP; another Jack on that Jack's FACE half-covers the 5's FACE.
    const board = boardOf([
      ['5S', at(0, 0)],
      ['JS', at(0, 1)],
    ]);
    expect(evaluatePlacement(board, card('JH'), at(-1, 1))).toMatchObject({
      ok: true,
      touches: [{ seq: 1, surface: 'face' }],
    });
  });

  it('needs at least one surface to land on', () => {
    const board = boardOf([['5S', at(0, 0)]]);
    expect(evaluatePlacement(board, card('5H'), at(3, 3))).toMatchObject({ ok: false });
  });

  it('refuses to bury a card completely', () => {
    const board = boardOf([['5S', at(0, 0)]]);
    expect(evaluatePlacement(board, card('5H'), at(0, 0)).ok).toBe(false);
  });

  it("stops at the table's edge", () => {
    const board = boardOf([['5S', at(0, 18)]]);
    expect(evaluatePlacement(board, card('6S'), at(0, 19)).reason).toMatch(/edge/);
  });

  it('respects a Zero blocking its TOP', () => {
    const board = boardOf([['0S', at(0, 0)]]);
    expect(evaluatePlacement(board, card('6S'), TOP, [0]).ok).toBe(false);
    expect(evaluatePlacement(board, card('0H'), SIDE, [0]).ok).toBe(true);
  });
});

describe('Wild cards', () => {
  const board = boardOf([['4H', at(0, 0)]]);

  it('stacc on any open TOP once rotated to a new direction', () => {
    expect(evaluatePlacement(board, card('WS'), at(0, 1, 1)).ok).toBe(true);
    expect(evaluatePlacement(board, card('WS'), at(0, 1, 0)).reason).toMatch(/ROTATE/);
  });

  it('never stacc on a SIDE or FACE', () => {
    expect(evaluatePlacement(board, card('WS'), at(1, -1, 1)).ok).toBe(false);
  });

  it('lock everything played before them and send the STACC a new way', () => {
    const wildBoard = placeOnBoard(board, card('WC'), at(0, 1, 1), 'C');
    expect(wildBoard.stackOrient).toEqual([1]);
    expect(wildBoard.lockedBefore).toBe(1);

    // The Wild's TOP now faces up and right, and takes only the called suit.
    expect(evaluatePlacement(wildBoard, card('9C'), at(1, 1, 1)).ok).toBe(true);
    expect(evaluatePlacement(wildBoard, card('9H'), at(1, 1, 1)).reason).toMatch(/Clubs/);
    // The 4 of hearts is locked now, and cards must face the new way.
    expect(evaluatePlacement(wildBoard, card('4D'), at(1, -1, 1)).ok).toBe(false);
    expect(evaluatePlacement(wildBoard, card('9C'), at(1, 1, 0)).ok).toBe(false);
  });

  it('can go on another Wild, turned again', () => {
    const wildBoard = placeOnBoard(board, card('WC'), at(0, 1, 1), 'C');
    expect(evaluatePlacement(wildBoard, card('WD'), at(1, 1, 3)).ok).toBe(true);
    expect(evaluatePlacement(wildBoard, card('WD'), at(1, 1, 1)).ok).toBe(false);
  });
});

describe('legalPlacements', () => {
  it('lists the top and side of a lone number card for a card that matches both', () => {
    const board = boardOf([['5S', at(0, 0)]]);
    const spots = legalPlacements(board, card('5S')).map((p) => p.pos);
    expect(spots).toEqual(expect.arrayContaining([TOP.pos, SIDE.pos]));
    expect(spots).toHaveLength(2);
  });

  it('offers a Wild every new direction on every open TOP', () => {
    const board = boardOf([['5S', at(0, 0)]]);
    expect(legalPlacements(board, card('WS'))).toHaveLength(5);
  });
});
