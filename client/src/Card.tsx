import type { CardCode } from '@sequence/shared';
import { useCardSprite } from './cardSprite';

const RED_SUITS = new Set(['D', 'H']);
const COURT_RANKS = new Set(['J', 'Q', 'K']);

/** The pip symbols are 60 wide by 76.5 tall - the sheet's 60x90 with 15% taken off the height. */
const PIP_VIEWBOX = '0 0 60 76.5';

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
  return { rank: code.slice(0, -1), suit: code.slice(-1) };
}

/** One suit pip drawn from the sprite, so its shape never depends on the available fonts. */
function SuitPip({
  suit,
  className = '',
  style,
}: {
  suit: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg className={`suit ${className}`.trim()} viewBox={PIP_VIEWBOX} style={style} aria-hidden="true">
      <use href={`#pip-${suit}`} />
    </svg>
  );
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
  const spriteReady = useCardSprite();
  const { rank, suit } = parseCard(code);
  const isRed = RED_SUITS.has(suit);
  const isCourt = COURT_RANKS.has(rank);
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
      {/* "10" is the only two-character rank, and it needs to be set narrower to stay in its column. */}
      <span className={`card__index-rank ${rank.length > 1 ? 'card__index-rank--double' : ''}`.trim()}>
        {rank}
      </span>
      <SuitPip suit={suit} className="card__index-suit" />
    </span>
  );

  // Court cards are the engraved faces straight from the deck, complete with their own indices, so
  // they replace the whole face rather than sitting inside it.
  if (isCourt && spriteReady) {
    const art = (
      <svg className="card__face card__face--court" viewBox="0 0 359 539" aria-hidden="true">
        <use href={`#face-${rank}${suit}`} />
      </svg>
    );
    return onClick ? (
      <button type="button" className={className} onClick={onClick} aria-label={code}>
        {art}
      </button>
    ) : (
      <div className={className}>{art}</div>
    );
  }

  const body = isCourt ? (
    // Until the sprite arrives, a court card shows its rank and one large pip rather than a blank.
    <SuitPip suit={suit} className="card__pip card__pip--centre" />
  ) : rank === 'A' ? (
    <SuitPip suit={suit} className="card__pip card__pip--ace" />
  ) : (
    PIP_LAYOUTS[rank].map((p, i) => (
      <SuitPip
        key={i}
        suit={suit}
        className={['card__pip', p.flip ? 'card__pip--flip' : ''].filter(Boolean).join(' ')}
        style={{ left: `${p.x}%`, top: `${p.y}%` }}
      />
    ))
  );

  const face = (
    <>
      {index('tl')}
      <span className="card__face" aria-hidden="true">
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
