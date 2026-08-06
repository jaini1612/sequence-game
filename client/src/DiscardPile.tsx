import type { PlayerView } from '@sequence/shared';
import { Card } from './Card';

/** The face-up pile beside the board, showing the most recent card played by either player. */
export function DiscardPile({ view }: { view: PlayerView }) {
  const topCard = view.discardPile.at(-1);

  return (
    <div className="discard">
      <span className="discard__label">Discard</span>
      <div className="discard__slot" aria-label={topCard ? `Last card played: ${topCard}` : 'Discard pile empty'}>
        {topCard && <Card code={topCard} />}
      </div>
    </div>
  );
}
