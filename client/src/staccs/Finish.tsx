import type { StaccsView } from '@staccs/shared';

interface Props {
  view: StaccsView;
  votes: number;
  needed: number;
  youVoted: boolean;
  onRematch: () => void;
  onLeave: () => void;
  onAdmire: () => void;
}

function headline(view: StaccsView): { title: string; detail: string } {
  const placed = view.board.placed.length;
  const reason = view.events.find((e) => e.type === 'finished');

  if (view.config.mode === 'solo') {
    return view.winners.length > 0
      ? { title: 'PERFECT WIN!', detail: `All ${view.totalCards} cards stacced in one go.` }
      : { title: 'Out of matches', detail: `You stacced ${placed} of ${view.totalCards} cards.` };
  }
  if (view.config.mode === 'wildout') {
    return { title: 'Everybody wins!', detail: `${placed} cards across four STACCS. Look at the STACCS. Appreciate the STACCS.` };
  }

  const names = view.winners.map((id) => (id === view.you.id ? 'You' : (view.seats.find((s) => s.id === id)?.name ?? '?')));
  const youWon = view.winners.includes(view.you.id);
  const title =
    names.length === 1 ? (youWon ? 'You win!' : `${names[0]} wins!`) : `${names.join(' & ')} tie for the win!`;
  const detail =
    reason?.type === 'finished' && reason.reason === 'fewestCards'
      ? 'The draw pile ran out, so the fewest cards left wins.'
      : 'First to stacc every card in their hand.';
  return { title, detail };
}

export function Finish({ view, votes, needed, youVoted, onRematch, onLeave, onAdmire }: Props) {
  const { title, detail } = headline(view);
  return (
    <div className="staccs-finish" role="dialog" aria-modal="true" aria-labelledby="staccs-finish-title">
      <div className="staccs-finish__card">
        <h2 id="staccs-finish-title" className="staccs-title staccs-title--small">
          {title}
        </h2>
        <p className="staccs-tagline">{detail}</p>
        <button type="button" className="staccs-primary" disabled={youVoted} onClick={onRematch}>
          {needed === 1 ? 'Play again' : youVoted ? `Waiting for the others (${votes}/${needed})` : `Play again (${votes}/${needed})`}
        </button>
        <button type="button" className="staccs-secondary" onClick={onAdmire}>
          Look at the STACC
        </button>
        <button type="button" className="staccs-link" onClick={onLeave}>
          Leave the table
        </button>
      </div>
    </div>
  );
}
