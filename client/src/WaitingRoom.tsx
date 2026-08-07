import type { PlayerColor } from '@sequence/shared';
import { Chip } from './Chip';

export function WaitingRoom({
  roomCode,
  size,
  players,
  onLeave,
}: {
  roomCode: string;
  size: number;
  players: { name: string; color: PlayerColor; connected: boolean }[];
  onLeave: () => void;
}) {
  const missing = Math.max(0, size - players.length);

  return (
    <div className="waiting">
      <h2>
        {missing === 0
          ? 'Starting…'
          : `Waiting for ${missing} more player${missing === 1 ? '' : 's'}…`}
      </h2>
      <p className="waiting__code">
        Room code: <strong>{roomCode}</strong>
      </p>
      <p>Share this code with the {size === 2 ? 'person' : 'people'} you want to play against.</p>
      <ul className="waiting__players">
        {players.map((p) => (
          <li key={p.color} className={p.connected ? '' : 'waiting__player--away'}>
            <Chip color={p.color} />
            <span>{p.name}</span>
            {!p.connected && <em>reconnecting…</em>}
          </li>
        ))}
        {Array.from({ length: missing }, (_, i) => (
          <li key={`empty-${i}`} className="waiting__player--empty">
            <span className="waiting__slot" aria-hidden="true" />
            <span>Empty seat</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onLeave}>
        Back to lobby
      </button>
    </div>
  );
}
