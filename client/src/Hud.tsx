import type { PlayerColor, PlayerView } from '@sequence/shared';
import { Referee } from './Referee';

/**
 * One counter per player: a chip in their colour carrying their sequence count. Small enough to sit
 * in a single row on a phone, where the old labelled tiles ate a third of the screen.
 */
function SeatCounter({
  color,
  sequences,
  target,
  isYou,
  isTheirTurn,
}: {
  color: PlayerColor;
  sequences: number;
  target: number;
  isYou: boolean;
  isTheirTurn: boolean;
}) {
  const who = isYou ? 'You' : `${color[0]}${color.slice(1).toLowerCase()}`;
  return (
    <div
      className={['seat', isTheirTurn ? 'seat--active' : ''].filter(Boolean).join(' ')}
      title={`${who}: ${sequences} of ${target} sequences`}
    >
      <span className={`seat__chip chip chip--${color.toLowerCase()}`} aria-hidden="true">
        <span className="seat__count">{sequences}</span>
      </span>
      {/* No name beside the chip - the colour says who it is. Your own seat is always first. */}
      <span className="sr-only">
        {who}: {sequences} of {target} sequences
      </span>
    </div>
  );
}

export function Hud({
  view,
  refereeMessage,
  onDismissRefereeMessage,
}: {
  view: PlayerView;
  /** What the Jack in the corner has to say, if anything. */
  refereeMessage: string | null;
  onDismissRefereeMessage: () => void;
}) {
  const countFor = (id: string) => view.sequences.filter((s) => s.playerId === id).length;
  const seats = [
    { id: view.you.id, color: view.you.color, isYou: true },
    ...view.opponents.map((o) => ({ id: o.id, color: o.color, isYou: false })),
  ];

  return (
    <div className="hud">
      <div className="hud__seats">
        {seats.map((seat) => (
          <SeatCounter
            key={seat.id}
            color={seat.color}
            sequences={countFor(seat.id)}
            target={view.sequencesToWin}
            isYou={seat.isYou}
            isTheirTurn={seat.id === view.currentPlayerId}
          />
        ))}
      </div>
      {/* No turn text here any more - the ringed chip on the left already says whose turn it is,
          and this corner belongs to the referee. */}
      <Referee message={refereeMessage} onDismiss={onDismissRefereeMessage} />
    </div>
  );
}
