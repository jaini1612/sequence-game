import { isDeadCard, type CardCode, type PlayerView } from '@sequence/shared';
import { Card } from './Card';

export function Hand({
  view,
  isMyTurn,
  selectedCard,
  onSelectCard,
  onDiscardDeadCard,
}: {
  view: PlayerView;
  isMyTurn: boolean;
  selectedCard: CardCode | null;
  onSelectCard: (card: CardCode) => void;
  onDiscardDeadCard: (card: CardCode) => void;
}) {
  return (
    <div className="hand">
      {view.you.hand.map((card, idx) => {
        const dead = isMyTurn && !view.deadCardDiscardedThisTurn && isDeadCard(view, card);
        return (
          <div key={`${card}-${idx}`} className="hand__slot">
            <Card
              code={card}
              selected={selectedCard === card}
              onClick={isMyTurn ? () => onSelectCard(card) : undefined}
              dead={dead}
            />
            {dead && (
              <button type="button" className="hand__discard" onClick={() => onDiscardDeadCard(card)}>
                Discard dead card
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
