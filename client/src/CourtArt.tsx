const GOLD = '#e0a80f';
const SKIN = '#f7e0c4';
const PANEL = '#fff';

/**
 * Top half of a court figure, drawn in a 44x68 viewBox. The full card mirrors this
 * around the midline, the way a real double-headed court card is printed.
 */
function CourtHalf({ rank, ink, suit }: { rank: 'J' | 'Q' | 'K'; ink: string; suit: string }) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {/* mantle / shoulders */}
      <path d="M3 34 V27 Q3 20 10 17.5 L22 13 L34 17.5 Q41 20 41 27 V34 Z" fill={ink} />
      <path d="M10 17.5 Q22 22.5 34 17.5" fill="none" stroke={GOLD} strokeWidth="0.9" />

      {/* pale tunic panel, so the two mirrored halves don't merge into one block of colour */}
      <path d="M16.5 21 L22 26 L27.5 21 V34 H16.5 Z" fill={PANEL} stroke={ink} strokeWidth="0.7" />
      <text
        x="22"
        y="31.4"
        textAnchor="middle"
        fontSize="6.5"
        fill={ink}
        stroke="none"
        fontFamily="serif"
      >
        {suit}
      </text>

      {/* white collar */}
      <path
        d="M15 17 L22 25 L29 17 L26.5 15.5 L22 19.5 L17.5 15.5 Z"
        fill="#fff"
        stroke={ink}
        strokeWidth="0.7"
      />

      {/* head */}
      <ellipse cx="22" cy="10.5" rx="5.6" ry="6.4" fill={SKIN} stroke={ink} strokeWidth="0.7" />
      <path d="M16.5 9.4 Q17.4 4.2 22 4.2 Q26.6 4.2 27.5 9.4 Q22 6.6 16.5 9.4 Z" fill={ink} />
      <circle cx="19.9" cy="10.4" r="0.8" fill={ink} />
      <circle cx="24.1" cy="10.4" r="0.8" fill={ink} />

      {rank === 'K' && (
        <>
          {/* beard */}
          <path d="M16.6 12.2 Q22 19.5 27.4 12.2 Q22 15 16.6 12.2 Z" fill={ink} opacity="0.55" />
          {/* tall crown */}
          <path
            d="M15 5.2 L15 1.4 L18.2 4.2 L22 0.6 L25.8 4.2 L29 1.4 L29 5.2 Z"
            fill={GOLD}
            stroke={ink}
            strokeWidth="0.7"
          />
          <rect x="14.8" y="5.2" width="14.4" height="1.9" rx="0.7" fill={GOLD} stroke={ink} strokeWidth="0.7" />
        </>
      )}

      {rank === 'Q' && (
        <>
          {/* hair falling to the shoulders */}
          <path d="M16.4 8 Q14 16 17.6 18 L18.4 12 Z" fill={ink} opacity="0.7" />
          <path d="M27.6 8 Q30 16 26.4 18 L25.6 12 Z" fill={ink} opacity="0.7" />
          {/* pointed tiara */}
          <path
            d="M16.4 5.4 L16.4 2.6 L19.2 4.6 L22 1.6 L24.8 4.6 L27.6 2.6 L27.6 5.4 Z"
            fill={GOLD}
            stroke={ink}
            strokeWidth="0.7"
          />
          <circle cx="22" cy="1.4" r="0.9" fill={GOLD} stroke={ink} strokeWidth="0.5" />
        </>
      )}

      {rank === 'J' && (
        <>
          {/* soft cap with a feather */}
          <path d="M16 5.6 Q16 1.4 22 1.4 Q28 1.4 28 5.6 Z" fill={ink} />
          <path d="M28 4.4 Q33.5 0.6 35.5 4" fill="none" stroke={ink} strokeWidth="0.9" />
          <rect x="15.6" y="5.2" width="12.8" height="1.6" rx="0.6" fill={GOLD} stroke={ink} strokeWidth="0.6" />
        </>
      )}
    </g>
  );
}

export function CourtArt({ rank, ink, suit }: { rank: 'J' | 'Q' | 'K'; ink: string; suit: string }) {
  return (
    <svg className="card__art" viewBox="0 0 44 68" aria-hidden="true">
      <CourtHalf rank={rank} ink={ink} suit={suit} />
      <g transform="rotate(180 22 34)">
        <CourtHalf rank={rank} ink={ink} suit={suit} />
      </g>
      <line x1="1" y1="34" x2="43" y2="34" stroke={ink} strokeWidth="0.6" opacity="0.7" />
    </svg>
  );
}
