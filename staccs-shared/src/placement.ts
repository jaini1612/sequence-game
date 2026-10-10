import {
  CARD_HALF_HEIGHT,
  CARD_HALF_WIDTH,
  cardTriangles,
  directionBetween,
  kindOf,
  spotOnSurface,
  staccableSurfaces,
  surfaceFacing,
  toWorld,
} from './geometry.js';
import {
  SUIT_NAME,
  type Board,
  type Bounds,
  type Card,
  type PlacedCard,
  type Placement,
  type PlacementResult,
  type Suit,
  type Surface,
  type Touch,
} from './types.js';

/**
 * The CARDINAL RULES, applied to a flat table of overlapping hexagons.
 *
 * A card may go down only if every surface it lands squarely on is still fully showing and matches:
 * TOP by suit, SIDE by number, FACE by letter. It must land on at least one. Half-covering a surface
 * is not touching it - it just blocks it. Wilds go on any open TOP and must turn to a new direction.
 */

/** A little slack so floating point never refuses a card that sits exactly on the table edge. */
const EDGE_SLACK = 1e-6;

const SURFACE_LABEL: Record<Surface, string> = { top: 'TOP', side: 'SIDE', face: 'FACE' };

export function createBoard(bounds: Bounds, stackOrient: number[]): Board {
  return { placed: [], cover: {}, stackOrient: [...stackOrient], lockedBefore: 0, bounds };
}

/** True when the board is Wild Out's: several STACCS that never join up. */
function separateStacks(board: Board): boolean {
  return board.stackOrient.length > 1;
}

export function isLocked(board: Board, seq: number): boolean {
  return seq < board.lockedBefore;
}

function insideTable(board: Board, placement: Placement): boolean {
  const { x, y } = toWorld(placement.pos);
  const { minX, maxX, minY, maxY } = board.bounds;
  return (
    x - CARD_HALF_WIDTH >= minX - EDGE_SLACK &&
    x + CARD_HALF_WIDTH <= maxX + EDGE_SLACK &&
    y - CARD_HALF_HEIGHT >= minY - EDGE_SLACK &&
    y + CARD_HALF_HEIGHT <= maxY + EDGE_SLACK
  );
}

/** Why `card` cannot go on this surface of `under`, or null if it matches. */
function mismatch(card: Card, under: PlacedCard, surface: Surface): string | null {
  const incoming = kindOf(card);
  if (incoming === 'wild') return surface === 'top' ? null : 'Wilds only stacc on TOP surfaces';

  if (surface === 'top') {
    if (kindOf(under.card) === 'wild') {
      if (under.calledSuit === null || under.calledSuit === card.suit) return null;
      return `That Wild called ${SUIT_NAME[under.calledSuit]}`;
    }
    return card.suit === under.card.suit ? null : `Only ${SUIT_NAME[under.card.suit]} stacc on that TOP`;
  }
  if (surface === 'side') {
    return incoming === 'number' && card.rank === under.card.rank
      ? null
      : `Only a ${under.card.rank} staccs on that SIDE`;
  }
  return incoming === 'letter' && card.rank === under.card.rank
    ? null
    : `Only another ${under.card.rank} staccs on that FACE`;
}

function fail(reason: string): PlacementResult {
  return { ok: false, reason, touches: [] };
}

/** Groups the triangles a new card would cover by the card currently uppermost on each. */
function ownersBeneath(board: Board, placement: Placement): Map<number, number> {
  const owners = new Map<number, number>();
  for (const tri of cardTriangles(placement.pos)) {
    const seq = board.cover[tri];
    if (seq !== undefined) owners.set(seq, (owners.get(seq) ?? 0) + 1);
  }
  return owners;
}

/**
 * Checks a single card going down. `blockedTops` are Zero cards whose TOP is out of bounds this turn.
 */
export function evaluatePlacement(
  board: Board,
  card: Card,
  placement: Placement,
  blockedTops: readonly number[] = [],
): PlacementResult {
  const { stack, orient } = placement;
  if (!Number.isInteger(stack) || stack < 0 || stack >= board.stackOrient.length) return fail('No such STACC');
  if (!Number.isInteger(orient) || orient < 0 || orient > 5) return fail('Cards can only turn in sixths');

  const heading = board.stackOrient[stack];
  if (kindOf(card) === 'wild') {
    if (orient === heading) return fail('You must ROTATE the Wild to a new direction');
  } else if (orient !== heading) {
    return fail('Cards all have to face the same way as the STACC');
  }
  if (!insideTable(board, placement)) return fail('That would hang off the edge of the table');

  const touches: Touch[] = [];
  for (const [seq, count] of ownersBeneath(board, placement)) {
    const under = board.placed[seq];
    const dir = directionBetween(under.pos, placement.pos);
    if (dir < 0) return fail('That would bury a card completely');

    // Overlapping half of two surfaces reads as a cube sitting diagonally off this one: the two only
    // share an edge, so nothing touches and nothing has to match. Those surfaces are blocked now.
    const surface = surfaceFacing(under.orient, dir);
    if (!surface) continue;

    // Wild Out's STACCS never connect, though one can overlap another diagonally and block it.
    if (separateStacks(board) && under.stack !== stack) return fail('The STACCS never connect');
    if (isLocked(board, seq)) return fail('Cards played before the last Wild are locked');
    if (count !== 2) return fail(`That ${SURFACE_LABEL[surface]} is partly covered`);
    if (!staccableSurfaces(under.card).includes(surface)) {
      return fail(`Nothing staccs on the ${SURFACE_LABEL[surface]} of that card`);
    }
    if (surface === 'top' && blockedTops.includes(seq)) return fail('A Zero has blocked that TOP this turn');

    const reason = mismatch(card, under, surface);
    if (reason) return fail(reason);
    touches.push({ seq, surface });
  }

  if (touches.length === 0) return fail('Stacc it onto a matching surface');
  return { ok: true, touches };
}

export interface LegalPlacement extends Placement {
  touches: Touch[];
}

/** Every way `card` could legally go down right now. */
export function legalPlacements(
  board: Board,
  card: Card,
  blockedTops: readonly number[] = [],
): LegalPlacement[] {
  const wild = kindOf(card) === 'wild';
  const seen = new Set<string>();
  const found: LegalPlacement[] = [];

  for (const under of board.placed) {
    if (isLocked(board, under.seq)) continue;
    const heading = board.stackOrient[under.stack];
    const orients = wild ? [0, 1, 2, 3, 4, 5].filter((o) => o !== heading) : [heading];

    for (const surface of staccableSurfaces(under.card)) {
      if (wild && surface !== 'top') continue;
      const pos = spotOnSurface(under.pos, under.orient, surface);
      for (const orient of orients) {
        const key = `${pos.a},${pos.b},${orient},${under.stack}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const placement = { pos, orient, stack: under.stack };
        const result = evaluatePlacement(board, card, placement, blockedTops);
        if (result.ok) found.push({ ...placement, touches: result.touches });
      }
    }
  }
  return found;
}

export function canPlace(board: Board, card: Card, blockedTops: readonly number[] = []): boolean {
  return legalPlacements(board, card, blockedTops).length > 0;
}

/**
 * Puts a card down without checking it, returning a new board. A Wild turns its STACC to face the
 * new way, and on a single-STACC table it locks every card played before it.
 */
export function placeOnBoard(board: Board, card: Card, placement: Placement, calledSuit: Suit | null = null): Board {
  const seq = board.placed.length;
  const wild = kindOf(card) === 'wild';
  const placed: PlacedCard = {
    card,
    pos: { ...placement.pos },
    orient: placement.orient,
    seq,
    stack: placement.stack,
    calledSuit: wild ? calledSuit : null,
  };

  const cover = { ...board.cover };
  for (const tri of cardTriangles(placement.pos)) cover[tri] = seq;

  const stackOrient = board.stackOrient.map((o, i) => (wild && i === placement.stack ? placement.orient : o));
  const lockedBefore = wild && !separateStacks(board) ? seq : board.lockedBefore;

  return { ...board, placed: [...board.placed, placed], cover, stackOrient, lockedBefore };
}
