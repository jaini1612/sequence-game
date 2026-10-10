import type { Card, CardKind, Point, Surface } from './types.js';

/**
 * The geometry behind the 3D illusion.
 *
 * A STACCS card is a hexagon split into three rhombi - TOP, SIDE (right) and FACE (left) - so it
 * reads as a cube. Every card centre and corner sits on one triangular lattice, and each card covers
 * the six lattice triangles around its centre. Two cards overlap only when their centres are lattice
 * neighbours, and then they share exactly two triangles: one rhombus of the card underneath. That is
 * what "STACCING onto a surface" means on a flat table.
 *
 * Lattice points are written (a, b) = a·D1 + b·D0, where D0 points straight up the screen and D1 up
 * and to the right. The six neighbour directions, clockwise from straight up:
 */
export const DIRECTIONS: readonly Point[] = [
  { a: 0, b: 1 }, // 0 up
  { a: 1, b: 0 }, // 1 upper right
  { a: 1, b: -1 }, // 2 lower right
  { a: 0, b: -1 }, // 3 down
  { a: -1, b: 0 }, // 4 lower left
  { a: -1, b: 1 }, // 5 upper left
];

const HALF_ROOT3 = Math.sqrt(3) / 2;

/** How far a card reaches from its centre: half its width, and its full point-to-centre height. */
export const CARD_HALF_WIDTH = HALF_ROOT3;
export const CARD_HALF_HEIGHT = 1;

/**
 * Where each surface sits, as a turn clockwise from the direction the card's TOP faces. A card with
 * orientation k has its TOP towards direction k, its SIDE towards k+2 and its FACE towards k+4.
 */
export const SURFACE_TURN: Record<Surface, number> = { top: 0, side: 2, face: 4 };
export const SURFACES: Surface[] = ['top', 'side', 'face'];

export function mod6(n: number): number {
  return ((n % 6) + 6) % 6;
}

export function add(p: Point, q: Point): Point {
  return { a: p.a + q.a, b: p.b + q.b };
}

export function samePoint(p: Point, q: Point): boolean {
  return p.a === q.a && p.b === q.b;
}

/** Screen position of a lattice point, y growing downwards as on screen. */
export function toWorld(p: Point): { x: number; y: number } {
  return { x: p.a * HALF_ROOT3, y: -p.b - p.a / 2 };
}

/** The direction index (0-5) leading from `from` to its neighbour `to`, or -1 if not neighbours. */
export function directionBetween(from: Point, to: Point): number {
  const da = to.a - from.a;
  const db = to.b - from.b;
  return DIRECTIONS.findIndex((d) => d.a === da && d.b === db);
}

function pointKey(p: Point): string {
  return `${p.a},${p.b}`;
}

/** A lattice triangle, named by its three corners in a fixed order so any card names it the same. */
function triangleKey(points: Point[]): string {
  return points
    .map(pointKey)
    .sort()
    .join('|');
}

/** The i-th triangle around a centre: the centre and its neighbours in directions i and i+1. */
export function triangleAt(center: Point, i: number): string {
  return triangleKey([center, add(center, DIRECTIONS[mod6(i)]), add(center, DIRECTIONS[mod6(i + 1)])]);
}

/** All six triangles a card at `center` covers. */
export function cardTriangles(center: Point): string[] {
  return [0, 1, 2, 3, 4, 5].map((i) => triangleAt(center, i));
}

/** The direction a surface faces on a card with the given orientation. */
export function surfaceDirection(orient: number, surface: Surface): number {
  return mod6(orient + SURFACE_TURN[surface]);
}

/**
 * The two triangles making up one surface. A surface facing direction d is the rhombus between the
 * neighbours in directions d-1, d and d+1, so it is triangles d-1 and d.
 */
export function surfaceTriangles(center: Point, orient: number, surface: Surface): [string, string] {
  const d = surfaceDirection(orient, surface);
  return [triangleAt(center, d - 1), triangleAt(center, d)];
}

/** Which surface of a card faces direction `dir`, or null if that direction splits two surfaces. */
export function surfaceFacing(orient: number, dir: number): Surface | null {
  return SURFACES.find((s) => surfaceDirection(orient, s) === mod6(dir)) ?? null;
}

/** Where a card goes to land squarely on one surface of the card at `center`. */
export function spotOnSurface(center: Point, orient: number, surface: Surface): Point {
  return add(center, DIRECTIONS[surfaceDirection(orient, surface)]);
}

export function kindOf(card: Pick<Card, 'rank'>): CardKind {
  if (card.rank === 'W') return 'wild';
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' || card.rank === 'A') return 'letter';
  return 'number';
}

/**
 * Which surfaces of a card can ever take another card. Numbers match on their SIDE, letters on their
 * FACE, and a Wild only on its TOP - the rulebook's "mistaccs" pages rule out the rest.
 */
export function staccableSurfaces(card: Pick<Card, 'rank'>): Surface[] {
  switch (kindOf(card)) {
    case 'number':
      return ['top', 'side'];
    case 'letter':
      return ['top', 'face'];
    case 'wild':
      return ['top'];
  }
}
