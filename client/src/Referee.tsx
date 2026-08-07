import type { CardCode } from '@sequence/shared';
import { useCardSprite } from './cardSprite';

/**
 * The Jack who referees the game: a round badge in the corner that speaks up when a player needs
 * telling something.
 *
 * The badge is a circular crop of the real Jack of Spades from the deck sprite. Court cards are
 * drawn double-headed, so this window onto the upper half lands on one complete face.
 */
const REFEREE_CARD: CardCode = 'JS';

/**
 * The sprite's court symbols carry their own viewBox, so a <use> without explicit dimensions gets
 * scaled to whatever viewport it lands in - and a crop window would then be measured against the
 * wrong thing. Pinning the card to its real 359x539 puts the outer viewBox in card coordinates,
 * where this window frames the upper of the two heads.
 */
const CARD_W = 359;
const CARD_H = 539;
/**
 * A slightly wider window than the head strictly needs, which pulls the crown into frame without
 * dragging the body in with it. The art is mirrored in CSS so he faces left, into the screen,
 * rather than off the right edge he sits against.
 */
const FACE_CROP = '110 8 170 170';

export function Referee({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  const spriteReady = useCardSprite();

  return (
    <div className="referee">
      {message && (
        <div className="referee__bubble" role="status" onClick={onDismiss}>
          {message}
        </div>
      )}
      <div
        className={['referee__badge', message ? 'referee__badge--talking' : ''].filter(Boolean).join(' ')}
        aria-hidden={!message}
      >
        {spriteReady ? (
          <svg className="referee__art" viewBox={FACE_CROP} aria-hidden="true">
            <use href={`#face-${REFEREE_CARD}`} width={CARD_W} height={CARD_H} />
          </svg>
        ) : (
          <span className="referee__fallback" aria-hidden="true">
            J
          </span>
        )}
      </div>
    </div>
  );
}
