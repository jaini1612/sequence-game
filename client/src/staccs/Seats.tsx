import type { StaccsView } from '@staccs/shared';

/** Who is at the table, whose turn it is, and how many cards each is holding. */
export function Seats({ view, connected }: { view: StaccsView; connected: Set<string> }) {
  const mode = view.config.mode;

  if (mode === 'solo') {
    return (
      <div className="staccs-seats staccs-seats--solo">
        <span className="staccs-stat">
          <strong>{view.board.placed.length}</strong>/{view.totalCards} stacced
        </span>
        <span className="staccs-stat">
          <strong>{view.drawCount}</strong> to draw
        </span>
        <span className="staccs-stat">
          <strong>{view.discardCount}</strong> discarded
        </span>
      </div>
    );
  }

  return (
    <div className="staccs-seats">
      {view.seats.map((seat) => {
        const current = !view.finished && seat.seat === view.currentSeat;
        const you = seat.id === view.you.id;
        const classes = [
          'staccs-seat',
          current ? 'staccs-seat--turn' : '',
          you ? 'staccs-seat--you' : '',
          connected.has(seat.id) ? '' : 'staccs-seat--away',
        ].join(' ');
        return (
          <div key={seat.id} className={classes}>
            <span className="staccs-seat__name">{you ? 'You' : seat.name}</span>
            <span className="staccs-seat__count" aria-label={`${seat.handCount} cards`}>
              🂠 {seat.handCount}
            </span>
            {seat.saidUhOh && seat.handCount <= 2 && <span className="staccs-seat__badge">UH OH!</span>}
          </div>
        );
      })}
      <span className="staccs-stat staccs-stat--pile" title="Draw pile">
        <strong>{view.drawCount}</strong> left {mode !== 'wildout' && (view.direction === 1 ? '↻' : '↺')}
      </span>
    </div>
  );
}
