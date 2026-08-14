/**
 * Where each chair sits around the table, as a percentage of the arena.
 *
 * Hand-placed per table size rather than computed on an ellipse: a formula puts a seat exactly on
 * the arena's edge for four and five players, where half of it would hang off a phone screen. These
 * are ordered anticlockwise on screen - bottom, left, top, right - which is the order play actually
 * travels, so the eye follows the turn round the table.
 */
export interface Spot {
  left: number;
  top: number;
}

/** Your own chair, just below the felt. The flight of a card you play starts here. */
export const YOUR_SPOT: Spot = { left: 50, top: 103 };

/**
 * Chairs sit on the rail rather than inside the cloth.
 *
 * The table stands on end - taller than it is wide - because a phone is, so the long straight sides
 * run down the left and right where there is room for chairs, and only one chair ever has to fit
 * across the narrow top. Every position is kept between 11% and 89% across, so a seat never hangs
 * off the side of a 375px screen.
 */
const LAYOUTS: Record<number, Spot[]> = {
  2: [{ left: 50, top: 7 }],
  3: [
    { left: 15, top: 22 },
    { left: 85, top: 22 },
  ],
  4: [
    { left: 13, top: 40 },
    { left: 50, top: 7 },
    { left: 87, top: 40 },
  ],
  5: [
    { left: 12, top: 56 },
    { left: 16, top: 21 },
    { left: 84, top: 21 },
    { left: 88, top: 56 },
  ],
};

/** The chairs for everyone but you, in the order the view lists them (the seat after yours first). */
export function opponentSpots(playerCount: number): Spot[] {
  return LAYOUTS[playerCount] ?? LAYOUTS[5];
}

/**
 * The chair a given seat number is sitting in, from your point of view - which is the only point of
 * view the client ever has.
 */
export function spotForSeat(seat: number, yourSeat: number, playerCount: number): Spot {
  if (seat === yourSeat) return YOUR_SPOT;
  const step = (seat - yourSeat + playerCount) % playerCount;
  return opponentSpots(playerCount)[step - 1] ?? YOUR_SPOT;
}
