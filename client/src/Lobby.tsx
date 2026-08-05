import { useState } from 'react';
import { Card } from './Card';

/** A blue/red playing chip, same moulded plastic look as the ones used on the board. */
function Chip({ color }: { color: 'blue' | 'red' }) {
  return (
    <span className={`chip chip--${color} lobby__chip`} aria-hidden="true">
      <span className="chip__emblem">
        <span>♥</span>
        <span>♠</span>
        <span>♦</span>
        <span>♣</span>
      </span>
    </span>
  );
}

export function Lobby({
  onCreate,
  onJoin,
  error,
}: {
  onCreate: (name: string) => void;
  onJoin: (name: string, roomCode: string) => void;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  return (
    <div className="lobby">
      <div className="lobby__hero" aria-hidden="true">
        <div className="lobby__fan">
          <Card code="JS" />
          <Card code="QH" />
          <Card code="KD" />
        </div>
        <Chip color="blue" />
        <Chip color="red" />
      </div>

      <h1 className="lobby__title">Sequence</h1>
      <p className="lobby__tagline">Two players · five in a row wins</p>

      <label className="lobby__field">
        <span className="lobby__field-label">Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player" maxLength={20} />
      </label>

      <button type="button" className="lobby__primary" onClick={() => onCreate(name || 'Player 1')}>
        Create room
      </button>

      <div className="lobby__or">
        <span>or join a game</span>
      </div>

      <div className="lobby__join">
        <input
          className="lobby__code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="ROOM CODE"
          maxLength={5}
        />
        <button type="button" disabled={!joinCode} onClick={() => onJoin(name || 'Player 2', joinCode)}>
          Join
        </button>
      </div>

      {error && <p className="lobby__error">{error}</p>}
    </div>
  );
}
