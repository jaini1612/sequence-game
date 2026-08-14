import { useCardSprite } from '../cards';

/**
 * The Jack of Spades, who runs this table and enjoys it far too much.
 *
 * He is a round badge rather than a card: the deck sprite's court art is drawn double-headed, so a
 * window onto the upper half lands on one complete face, and the badge is sized to the height of the
 * bubble beside it so the two read as a single bar.
 */
const CARD_W = 359;
const CARD_H = 539;

/** Wide enough to bring the crown in without dragging the body up with it. */
const FACE_CROP = '110 8 170 170';

export function Host({ line, onDismiss }: { line: string | null; onDismiss: () => void }) {
  const spriteReady = useCardSprite();

  return (
    <div className="bluff-host">
      <div className={`bluff-host__badge ${line ? 'bluff-host__badge--talking' : ''}`} aria-hidden="true">
        {spriteReady ? (
          <svg className="bluff-host__art" viewBox={FACE_CROP}>
            <use href="#face-JS" width={CARD_W} height={CARD_H} />
          </svg>
        ) : (
          <span className="bluff-host__fallback">J</span>
        )}
      </div>
      <button
        type="button"
        className={`bluff-host__bubble ${line ? 'bluff-host__bubble--on' : ''}`}
        onClick={onDismiss}
        // A heckle, not a dialog: tap it away, or leave it and it goes on its own.
        aria-live="polite"
      >
        {line ?? 'Watching. Judging.'}
      </button>
    </div>
  );
}
