import type { CardCode } from '@sequence/shared';
import { CourtArt } from './CourtArt';

const SUIT_SYMBOL: Record<string, string> = { D: '♦', H: '♥', C: '♣', S: '♠' };
const RED_SUITS = new Set(['D', 'H']);
const COURT_RANKS = new Set(['J', 'Q', 'K']);

/** A pip's position on the card face, in % of the pip area, and whether it is printed upside-down. */
type Pip = { x: number; y: number; flip?: boolean };

const LEFT = 22;
const MID = 50;
const RIGHT = 78;
const TOP = 9;
const BOTTOM = 91;

const pip = (x: number, y: number, flip = false): Pip => ({ x, y, flip });

const SIX: Pip[] = [
  pip(LEFT, TOP),
  pip(RIGHT, TOP),
  pip(LEFT, MID),
  pip(RIGHT, MID),
  pip(LEFT, BOTTOM, true),
  pip(RIGHT, BOTTOM, true),
];

const FOUR_CORNERS: Pip[] = [pip(LEFT, TOP), pip(RIGHT, TOP), pip(LEFT, BOTTOM, true), pip(RIGHT, BOTTOM, true)];

/** Standard playing-card pip arrangements. */
const PIP_LAYOUTS: Record<string, Pip[]> = {
  '2': [pip(MID, TOP), pip(MID, BOTTOM, true)],
  '3': [pip(MID, TOP), pip(MID, MID), pip(MID, BOTTOM, true)],
  '4': FOUR_CORNERS,
  '5': [...FOUR_CORNERS, pip(MID, MID)],
  '6': SIX,
  '7': [...SIX, pip(MID, 30)],
  '8': [...SIX, pip(MID, 30), pip(MID, 70, true)],
  '9': [
    pip(LEFT, TOP),
    pip(RIGHT, TOP),
    pip(LEFT, 36),
    pip(RIGHT, 36),
    pip(MID, MID),
    pip(LEFT, 64, true),
    pip(RIGHT, 64, true),
    pip(LEFT, BOTTOM, true),
    pip(RIGHT, BOTTOM, true),
  ],
  '10': [
    pip(LEFT, TOP),
    pip(RIGHT, TOP),
    pip(MID, 23),
    pip(LEFT, 36),
    pip(RIGHT, 36),
    pip(LEFT, 64, true),
    pip(RIGHT, 64, true),
    pip(MID, 77, true),
    pip(LEFT, BOTTOM, true),
    pip(RIGHT, BOTTOM, true),
  ],
};

function parseCard(code: CardCode): { rank: string; suit: string } {
  const suit = code.slice(-1);
  const rank = code.slice(0, -1);
  return { rank, suit };
}

export function Card({
  code,
  selected,
  playable,
  dead,
  onClick,
}: {
  code: CardCode;
  selected?: boolean;
  playable?: boolean;
  dead?: boolean;
  onClick?: () => void;
}) {
  const { rank, suit } = parseCard(code);
  const isRed = RED_SUITS.has(suit);
  const symbol = SUIT_SYMBOL[suit];
  const className = [
    'card',
    isRed ? 'card--red' : 'card--black',
    selected ? 'card--selected' : '',
    playable ? 'card--playable' : '',
    dead ? 'card--dead' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const index = (corner: 'tl' | 'br') => (
    <span className={`card__index card__index--${corner}`} aria-hidden="true">
      <span className="card__index-rank">{rank}</span>
      <span className="card__index-suit">{symbol}</span>
    </span>
  );

  let body;
  if (COURT_RANKS.has(rank)) {
    body = <CourtArt rank={rank as 'J' | 'Q' | 'K'} ink={isRed ? '#d1121a' : '#1a1a1a'} suit={symbol} />;
  } else if (rank === 'A') {
    body = <span className="card__pip card__pip--ace">{symbol}</span>;
  } else {
    body = PIP_LAYOUTS[rank].map((p, i) => (
      <span
        key={i}
        className={['card__pip', p.flip ? 'card__pip--flip' : ''].filter(Boolean).join(' ')}
        style={{ left: `${p.x}%`, top: `${p.y}%` }}
      >
        {symbol}
      </span>
    ));
  }

  const face = (
    <>
      {index('tl')}
      <span
        className={['card__face', COURT_RANKS.has(rank) ? 'card__face--court' : ''].filter(Boolean).join(' ')}
        aria-hidden="true"
      >
        {body}
      </span>
      {index('br')}
    </>
  );

  // Render as a plain div (not a disabled button) when non-interactive: a disabled <button>
  // swallows the click instead of letting it bubble to the containing board cell's handler.
  if (!onClick) {
    return <div className={className}>{face}</div>;
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-label={code}>
      {face}
    </button>
  );
}
