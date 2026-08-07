import { useEffect, useRef, useState } from 'react';
import type { PlayerView } from '@sequence/shared';
import { playCardDraw } from './sound';

/** Kept in step with the flight animation in App.css. */
const FLIGHT_MS = 380;

/**
 * The pile you tap to take the card you are owed.
 *
 * It looks exactly the same whether or not you are owed a card. That is deliberate: remembering to
 * draw is part of playing, so nothing here highlights, counts down or otherwise nags - the only
 * state it shows is being locked behind another player who is owed an older card, which is a rule
 * the player cannot act on rather than one they can forget.
 */
export function DrawPile({ view, onDraw }: { view: PlayerView; onDraw: () => void }) {
  const [flying, setFlying] = useState(0);
  const flightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(flightTimer.current), []);

  function handleClick() {
    if (!view.canDraw) return;
    playCardDraw();
    // Bumping a counter rather than toggling a flag restarts the animation on rapid draws.
    setFlying((n) => n + 1);
    clearTimeout(flightTimer.current);
    flightTimer.current = setTimeout(() => setFlying(0), FLIGHT_MS);
    onDraw();
  }

  return (
    <div className="draw">
      <span className="discard__label">Draw</span>
      <button
        type="button"
        className={[
          'draw__pile',
          view.canDraw ? 'draw__pile--ready' : '',
          view.owedDraw && !view.canDraw ? 'draw__pile--locked' : '',
          view.drawPileSize === 0 ? 'draw__pile--empty' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={handleClick}
        disabled={!view.canDraw}
        aria-label="Draw pile"
      >
        {/* Two stacked backs behind the top one, so the pile reads as a pile. */}
        <span className="draw__back draw__back--under2" aria-hidden="true" />
        <span className="draw__back draw__back--under1" aria-hidden="true" />
        <span className="draw__back" aria-hidden="true" />
        {flying > 0 && <span key={flying} className="draw__back draw__fly" aria-hidden="true" />}
        <span className="draw__count">{view.drawPileSize}</span>
      </button>
    </div>
  );
}
