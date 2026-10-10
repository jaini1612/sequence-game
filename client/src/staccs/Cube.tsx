import { SUIT_SYMBOL, kindOf, type Card, type Suit, type Surface } from '@staccs/shared';
import { INK, PALE, RED, SHADE, WILD_SHADE, hexPolygon, suitColor, surfaceMatrix, surfacePolygon, type XY } from './cubeGeometry';

/**
 * One STACCS card drawn as the little cube it pretends to be: three rhombi around a centre, the TOP
 * brightest. Everything is in world units (one card edge = 1), so the same drawing serves the table
 * and the hand.
 */

export type Glow = 'touch' | 'open';

const TEXT = {
  textAnchor: 'middle' as const,
  dominantBaseline: 'central' as const,
  fontFamily: "'Silkscreen', 'Courier New', monospace",
  fontWeight: 700,
};

function TopArt({ card, calledSuit }: { card: Card; calledSuit: Suit | null }) {
  if (kindOf(card) === 'wild') {
    return calledSuit ? (
      <text x={50} y={52} fontSize={58} fill="#fff" {...TEXT}>
        {SUIT_SYMBOL[calledSuit]}
      </text>
    ) : (
      <rect x={30} y={30} width={40} height={40} rx={6} fill="none" stroke="#9cc0ff" strokeWidth={5} />
    );
  }
  return (
    <>
      <text x={50} y={52} fontSize={62} fill={PALE[card.suit]} {...TEXT}>
        {SUIT_SYMBOL[card.suit]}
      </text>
      <text x={16} y={20} fontSize={13} fill={suitColor(card.suit)} {...TEXT}>
        {SUIT_SYMBOL[card.suit]}
      </text>
    </>
  );
}

function SideArt({ card }: { card: Card }) {
  if (kindOf(card) === 'wild') {
    return (
      <>
        <rect x={18} y={18} width={64} height={64} rx={4} fill="none" stroke="#3d74e6" strokeWidth={6} />
        <rect x={36} y={36} width={28} height={28} rx={3} fill="none" stroke="#3d74e6" strokeWidth={6} />
      </>
    );
  }
  return (
    <>
      <text x={52} y={54} fontSize={card.rank.length > 1 ? 46 : 66} fill={suitColor(card.suit)} {...TEXT}>
        {card.rank}
      </text>
      <text x={86} y={88} fontSize={13} fill={suitColor(card.suit)} {...TEXT}>
        {SUIT_SYMBOL[card.suit]}
      </text>
    </>
  );
}

const HAT: Partial<Record<Card['rank'], string>> = { J: '🧢', Q: '👑', K: '👑' };

function LetterFace({ card }: { card: Card }) {
  const colour = suitColor(card.suit);
  return (
    <>
      <text x={13} y={18} fontSize={15} fill={colour} {...TEXT}>
        {card.rank}
      </text>
      {HAT[card.rank] && (
        <text x={50} y={22} fontSize={card.rank === 'K' ? 30 : 24} {...TEXT}>
          {HAT[card.rank]}
        </text>
      )}
      {card.rank === 'A' && (
        <text x={76} y={26} fontSize={14} fill={colour} {...TEXT}>
          1UP
        </text>
      )}
      <rect x={30} y={42} width={9} height={13} fill={INK} />
      <rect x={60} y={42} width={9} height={13} fill={INK} />
      {card.rank === 'K' && <rect x={30} y={62} width={40} height={7} fill={INK} />}
      <rect x={34} y={card.rank === 'K' ? 74 : 68} width={32} height={6} fill={card.rank === 'Q' ? RED : INK} />
    </>
  );
}

function FaceArt({ card }: { card: Card }) {
  const kind = kindOf(card);
  if (kind === 'wild') {
    return (
      <>
        <rect x={24} y={24} width={20} height={26} fill="#fff" />
        <rect x={56} y={24} width={20} height={26} fill="#fff" />
        <rect x={32} y={32} width={8} height={12} fill={INK} />
        <rect x={64} y={32} width={8} height={12} fill={INK} />
        <rect x={32} y={62} width={36} height={14} fill="#fff" />
        <rect x={38} y={68} width={24} height={8} fill={RED} />
      </>
    );
  }
  if (kind === 'letter') return <LetterFace card={card} />;
  return (
    <>
      <text x={13} y={18} fontSize={15} fill={suitColor(card.suit)} {...TEXT}>
        {card.rank}
      </text>
      <text x={50} y={56} fontSize={68} fill={suitColor(card.suit)} {...TEXT}>
        {SUIT_SYMBOL[card.suit]}
      </text>
    </>
  );
}

export interface CubeProps {
  card: Card;
  center: XY;
  orient: number;
  calledSuit?: Suit | null;
  /** Surfaces to light up: where a new card would land, or which ones are open. */
  glow?: Partial<Record<Surface, Glow>>;
  /** Played before the latest Wild: UNSTACCABLE, so drawn faded. */
  locked?: boolean;
  /** A Zero whose TOP is off limits this turn. */
  blockedTop?: boolean;
  ghost?: boolean;
}

const ORDER: Surface[] = ['face', 'side', 'top'];

export function Cube({ card, center, orient, calledSuit = null, glow, locked, blockedTop, ghost }: CubeProps) {
  const wild = kindOf(card) === 'wild';
  const shade = wild ? WILD_SHADE : SHADE;

  return (
    <g className={`cube${ghost ? ' cube--ghost' : ''}`}>
      {ORDER.map((surface) => (
        <g key={surface}>
          <polygon points={surfacePolygon(center, orient, surface)} fill={shade[surface]} />
          <g transform={surfaceMatrix(center, orient, surface)}>
            {surface === 'top' && <TopArt card={card} calledSuit={calledSuit} />}
            {surface === 'side' && <SideArt card={card} />}
            {surface === 'face' && <FaceArt card={card} />}
          </g>
        </g>
      ))}
      <polygon points={hexPolygon(center)} fill="none" className="cube__edge" />
      {locked && <polygon points={hexPolygon(center)} className="cube__locked" />}
      {ORDER.map((surface) =>
        glow?.[surface] ? (
          <polygon
            key={`glow-${surface}`}
            points={surfacePolygon(center, orient, surface)}
            className={`cube__glow cube__glow--${glow[surface]}`}
          />
        ) : null,
      )}
      {blockedTop && (
        <g transform={surfaceMatrix(center, orient, 'top')}>
          <circle cx={50} cy={50} r={24} className="cube__block" />
          <line x1={33} y1={67} x2={67} y2={33} className="cube__block" />
        </g>
      )}
    </g>
  );
}

/** A single card as a standalone picture, for the hand and the lobby. */
export function CubeIcon({ card, size = 56 }: { card: Card; size?: number }) {
  const w = Math.sqrt(3);
  return (
    <svg className="cube-icon" viewBox={`${-w / 2 - 0.06} -1.06 ${w + 0.12} 2.12`} width={size} height={(size * 2.12) / (w + 0.12)}>
      <Cube card={card} center={{ x: 0, y: 0 }} orient={0} />
    </svg>
  );
}
