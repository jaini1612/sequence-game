/**
 * The face on the wanted notice: a card sharp caught mid-smirk. Everything else on this screen is a
 * flat gold glyph, so the one place a real drawing belongs is the mugshot - it is the only element
 * that has to carry a personality rather than a meaning.
 *
 * The whole joke is asymmetry: one eye blown wide, the other screwed shut, and a grin that climbs the
 * right side of the face. Drawn straight it would just be a smiling man, which is not the same thing
 * at all as a man who knows something you don't.
 */
export function BluffFace({ className = '' }: { className?: string }) {
  return (
    <svg className={`bluff-face ${className}`.trim()} viewBox="0 0 64 66" aria-hidden="true">
      {/* Tilted, because a straight head reads as a passport photo. */}
      <g transform="rotate(-5 32 34)">
        <circle className="bluff-face__skin" cx="9" cy="32" r="4.4" />
        <circle className="bluff-face__skin" cx="55" cy="32" r="4.4" />
        <path
          className="bluff-face__skin"
          d="M32 4c12.6 0 21.8 8.6 21.8 21.8 0 14.6-8.8 32.2-21.8 32.2S10.2 40.4 10.2 25.8C10.2 12.6 19.4 4 32 4Z"
        />

        {/* One brow shoved up the forehead - the tell of somebody enjoying themselves too much. */}
        <path
          className="bluff-face__line"
          d="M37.5 13.5c4-3.4 10-3.6 14.5-.8"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* The domino mask, same shape as the Bluffmaster's glyph, worn rather than drawn. */}
        <path
          className="bluff-face__mask"
          fillRule="evenodd"
          d="M4.6 21.6C7.8 15 19.4 12.4 31 18.4c11.6-6 23.2-3.4 26.4 3.2 0 9.4-8 18.6-15.6 18.6-4.4 0-7-3.4-9.8-6.4-2.8 3-5.4 6.4-9.8 6.4-7.6 0-15.6-9.2-15.6-18.6Z M12.6 25.4a7 5.6 0 1 0 14 0 7 5.6 0 1 0-14 0Z M37.4 25.4a7 5.6 0 1 0 14 0 7 5.6 0 1 0-14 0Z"
        />

        {/* Left eye wide open, right eye shut mid-wink. */}
        <ellipse className="bluff-face__white" cx="19.6" cy="25.4" rx="5.4" ry="4.2" />
        <circle className="bluff-face__mask" cx="21.6" cy="26.2" r="2.4" />
        <path
          className="bluff-face__line"
          d="M39.4 26.6c2.6 2.4 6.4 2.4 9 0"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
        />

        {/* The grin: climbs to one side, wider than the face has any business being. */}
        <path className="bluff-face__mask" d="M15.4 41.2c1.6 9 8.4 13.6 15.4 13.4 8.4-.2 17-6.4 19.4-19-6.6 5-25.4 8-34.8 5.6Z" />
        <path className="bluff-face__white" d="M16 41.6c9 2.2 26.6-.4 33.4-5-1 4-2.4 6.4-2.4 6.4-8.4 4.2-22.6 5.6-29.6 3.2Z" />
        <g className="bluff-face__teeth" strokeWidth="1.1" strokeLinecap="round">
          <path d="M25.4 43.4 25 47" />
          <path d="M33 43.6 33 47.2" />
          <path d="M40.4 42.4 40.8 45.8" />
        </g>
      </g>
    </svg>
  );
}
