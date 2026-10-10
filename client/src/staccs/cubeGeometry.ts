import { DIRECTIONS, mod6, surfaceDirection, toWorld, type Suit, type Surface } from '@staccs/shared';

/** The cube's geometry and palette in world units, shared by the cube drawing and the table. */

export interface XY {
  x: number;
  y: number;
}

export const vec = (i: number): XY => toWorld(DIRECTIONS[mod6(i)]);
export const plus = (p: XY, q: XY): XY => ({ x: p.x + q.x, y: p.y + q.y });

export const RED = '#e3173a';
export const INK = '#16161d';
export const PALE: Record<Suit, string> = { H: '#fcd3da', D: '#fcd3da', S: '#dcdee6', C: '#dcdee6' };
export const SHADE: Record<Surface, string> = { top: '#ffffff', face: '#eceff5', side: '#d9dee9' };
export const WILD_SHADE: Record<Surface, string> = { top: '#5b97ff', face: '#2d66dc', side: '#1f4fc2' };

export function suitColor(suit: Suit): string {
  return suit === 'H' || suit === 'D' ? RED : INK;
}

/** The rhombus for one surface: the centre and the three neighbours around its direction. */
export function surfacePolygon(center: XY, orient: number, surface: Surface): string {
  const d = surfaceDirection(orient, surface);
  return [center, plus(center, vec(d - 1)), plus(center, vec(d)), plus(center, vec(d + 1))]
    .map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)
    .join(' ');
}

export function hexPolygon(center: XY): string {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => plus(center, vec(i)))
    .map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)
    .join(' ');
}

/**
 * Maps a 100x100 drawing box onto a surface, skewed the way the cube's face is skewed, so artwork can
 * be drawn upright and land in perspective. Corner (0,0) is the surface's top-left as seen on a card
 * facing up.
 */
export function surfaceMatrix(center: XY, orient: number, surface: Surface): string {
  const k = orient;
  const [origin, u, v] =
    surface === 'top'
      ? [plus(center, vec(k + 5)), vec(k + 1), vec(k + 2)]
      : surface === 'side'
        ? [center, vec(k + 1), vec(k + 3)]
        : [plus(center, vec(k + 5)), vec(k + 2), vec(k + 3)];
  const s = 1 / 100;
  return `matrix(${u.x * s} ${u.y * s} ${v.x * s} ${v.y * s} ${origin.x} ${origin.y})`;
}

