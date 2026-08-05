import { useState } from 'react';

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
      <h1>Sequence</h1>
      <label className="lobby__field">
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player" maxLength={20} />
      </label>

      <div className="lobby__actions">
        <button type="button" onClick={() => onCreate(name || 'Player 1')}>
          Create room
        </button>

        <div className="lobby__join">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Room code"
            maxLength={5}
          />
          <button type="button" disabled={!joinCode} onClick={() => onJoin(name || 'Player 2', joinCode)}>
            Join room
          </button>
        </div>
      </div>

      {error && <p className="lobby__error">{error}</p>}
    </div>
  );
}
