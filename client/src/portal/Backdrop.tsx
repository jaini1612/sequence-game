import type { CSSProperties, ReactNode } from 'react';
import { Card, CardBack } from '../cards';
import { Chip } from '../Chip';
import { CubeIcon } from '../staccs/Cube';

/** A die face, pips laid out on a 3x3 grid (0-8, reading order). */
const DIE_PIPS: Record<number, number[]> = { 3: [2, 4, 6], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function Die({ face }: { face: 3 | 5 | 6 }) {
  return (
    <svg viewBox="0 0 30 30" className="backdrop__die">
      <rect x={1} y={1} width={28} height={28} rx={6} fill="#f6f1e6" />
      {DIE_PIPS[face].map((p) => (
        <circle key={p} cx={7.5 + (p % 3) * 7.5} cy={7.5 + Math.floor(p / 3) * 7.5} r={2.6} fill="#1d1d22" />
      ))}
    </svg>
  );
}

type Piece = {
  /** Where it sits, in % of the viewport. */
  x: number;
  y: number;
  /** Resting tilt, in degrees. */
  r: number;
  /** One loop of its drift, in seconds - all different, so the room never moves in lockstep. */
  d: number;
  /** Scale; the small ones read as further away and are blurred to match. */
  s: number;
  art: ReactNode;
  far?: boolean;
};

/**
 * The room behind the tables: cards, chips, dice and cubes strewn across the felt and drifting on
 * their own slow loops. Spread round the edges more than the middle, so the game panels sit over
 * the quietest part of it.
 */
const PIECES: Piece[] = [
  { x: 4, y: 6, r: -18, d: 19, s: 1, art: <Card code="AS" /> },
  { x: 82, y: 4, r: 14, d: 23, s: 0.9, art: <CardBack /> },
  { x: 70, y: 18, r: 0, d: 17, s: 0.8, art: <span className="backdrop__chip"><Chip color="RED" /></span>, far: true },
  { x: 12, y: 28, r: 8, d: 21, s: 0.7, art: <Die face={5} />, far: true },
  { x: 88, y: 32, r: -10, d: 25, s: 1, art: <Card code="KH" /> },
  { x: -2, y: 46, r: 22, d: 18, s: 0.9, art: <CubeIcon card={{ id: 'b1', suit: 'S', rank: 'Q' }} size={56} /> },
  { x: 46, y: 40, r: -6, d: 27, s: 0.6, art: <span className="backdrop__chip"><Chip color="BLUE" /></span>, far: true },
  { x: 78, y: 52, r: 18, d: 20, s: 0.8, art: <Die face={3} /> },
  { x: 8, y: 64, r: -14, d: 24, s: 1, art: <Card code="QD" /> },
  { x: 90, y: 68, r: 6, d: 22, s: 0.9, art: <span className="backdrop__chip"><Chip color="GREEN" /></span> },
  { x: 30, y: 76, r: 12, d: 26, s: 0.65, art: <CardBack />, far: true },
  { x: 64, y: 84, r: -20, d: 19, s: 1, art: <Card code="JC" /> },
  { x: 2, y: 88, r: 4, d: 21, s: 0.8, art: <span className="backdrop__chip"><Chip color="RED" /></span> },
  { x: 84, y: 90, r: -8, d: 23, s: 0.9, art: <CubeIcon card={{ id: 'b2', suit: 'H', rank: 'W' }} size={56} /> },
  { x: 40, y: 2, r: 10, d: 28, s: 0.6, art: <Die face={6} />, far: true },
  { x: 54, y: 62, r: 26, d: 30, s: 0.55, art: <Card code="7H" />, far: true },
];

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__suits" />
      {PIECES.map((p, i) => (
        <div
          key={i}
          className={`backdrop__piece${p.far ? ' backdrop__piece--far' : ''}`}
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              '--r': `${p.r}deg`,
              '--s': p.s,
              '--d': `${p.d}s`,
              // Negative, so every piece is already mid-drift on the first frame instead of all
              // setting off together from rest.
              '--delay': `${-((i * 7) % p.d)}s`,
            } as CSSProperties
          }
        >
          {p.art}
        </div>
      ))}
      <div className="backdrop__vignette" />
    </div>
  );
}
