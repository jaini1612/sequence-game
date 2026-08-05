const INK = '#1a1a1a';

/** Positions the four suits evenly around the centre of the rosette. */
const SUITS = [
  { symbol: '♠', x: 0, y: -7 },
  { symbol: '♥', x: 7, y: 0 },
  { symbol: '♦', x: 0, y: 7 },
  { symbol: '♣', x: -7, y: 0 },
];

/** The printed emblem on the four free corners: a ringed rosette of all four suits. */
export function CornerTile() {
  return (
    <svg className="card__art" viewBox="0 0 44 68" aria-hidden="true">
      <g transform="translate(22 34)" fill={INK}>
        <circle r="15" fill="none" stroke={INK} strokeWidth="1.7" />
        <circle r="12.4" fill="none" stroke={INK} strokeWidth="0.7" />

        {/* petals filling the ring between the suits */}
        {[45, 135, 225, 315].map((angle) => (
          <ellipse key={angle} cx="0" cy="-9.4" rx="1.5" ry="2.6" transform={`rotate(${angle})`} />
        ))}

        {SUITS.map((s) => (
          <text
            key={s.symbol}
            x={s.x}
            y={s.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9"
            fontFamily="serif"
          >
            {s.symbol}
          </text>
        ))}

        <circle r="2" />
        <circle r="3.4" fill="none" stroke={INK} strokeWidth="0.6" />
      </g>
    </svg>
  );
}
