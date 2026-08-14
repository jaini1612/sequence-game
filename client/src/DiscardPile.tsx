import type { PlayerView } from '@sequence/shared';
import { Card } from './cards';

/** The face-up pile beside the board, showing the most recent card played by either player. */
export function DiscardPile({ view }: { view: PlayerView }) {
  const topCard = view.discardPile.at(-1);

  return (
    <div className="discard">
      {/* "Last" rather than "Discard": it is the last card played, and it has to fit a narrow column. */}
      <span className="discard__label">Last</span>
      <div className="discard__slot" aria-label={topCard ? `Last card played: ${topCard}` : 'Discard pile empty'}>
        {topCard && <Card code={topCard} />}
      </div>
    </div>
  );
}
