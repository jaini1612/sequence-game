import { useState } from 'react';
import { MODE_NAME, MODE_PLAYERS, MODES, type Mode, type StaccsConfig } from '@staccs/shared';
import { CubeIcon } from './Cube';
import { getStoredName } from './identity';

export interface RoomSummary {
  code: string;
  config: StaccsConfig;
  players: { id: string; name: string; connected: boolean }[];
}

const MODE_BLURB: Record<Mode, string> = {
  uhoh: 'The classic way to STACC. First to stacc their whole hand wins.',
  party: 'UH OH! with two DECCS shuffled together for a big table.',
  solo: 'Solitaire style. Stacc all 60 cards in one go.',
  wildout: 'Co-op. Grow four STACCS out of the Wilds together.',
};

function playersLabel(mode: Mode): string {
  const { min, max } = MODE_PLAYERS[mode];
  return min === max ? `${min} player` : `${min}-${max} players`;
}

function range(mode: Mode): number[] {
  const { min, max } = MODE_PLAYERS[mode];
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

interface LobbyProps {
  onCreate: (name: string, config: StaccsConfig) => void;
  onJoin: (name: string, code: string) => void;
  onExit: () => void;
  error: string | null;
  busy: boolean;
  online: boolean;
  connectError: string | null;
  onRetry: () => void;
}

export function StaccsLobby({ onCreate, onJoin, onExit, error, busy, online, connectError, onRetry }: LobbyProps) {
  const [name, setName] = useState(getStoredName);
  const [mode, setMode] = useState<Mode>('uhoh');
  const [playerCount, setPlayerCount] = useState(2);
  const [noWilds, setNoWilds] = useState(false);
  const [secondChances, setSecondChances] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const trimmed = name.trim();
  const counts = range(mode);

  function pickMode(next: Mode) {
    setMode(next);
    const allowed = range(next);
    if (!allowed.includes(playerCount)) setPlayerCount(allowed[0]);
  }

  function create() {
    onCreate(trimmed, { mode, playerCount, noWilds: mode === 'solo' && noWilds, secondChances: mode === 'solo' && secondChances });
  }

  return (
    <div className="staccs-lobby">
      <button type="button" className="portal-back" onClick={onExit}>
        ← All games
      </button>

      <div className="staccs-lobby__hero" aria-hidden="true">
        <CubeIcon card={{ id: 'h1', suit: 'S', rank: 'A' }} size={60} />
        <CubeIcon card={{ id: 'h2', suit: 'H', rank: 'W' }} size={72} />
        <CubeIcon card={{ id: 'h3', suit: 'H', rank: '7' }} size={60} />
      </div>
      <h1 className="staccs-title">STACCS</h1>
      <p className="staccs-tagline">The card game with 3D energy</p>

      {!online && (
        <p className="staccs-note">
          Reaching the game server…{connectError ? ` (${connectError})` : ''}{' '}
          <button type="button" className="staccs-link" onClick={onRetry}>
            Try now
          </button>
        </p>
      )}

      <label className="staccs-field">
        <span className="staccs-field__label">Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Who's staccing?" maxLength={16} autoComplete="off" />
      </label>

      <div className="staccs-field">
        <span className="staccs-field__label">Play mode</span>
        <div className="staccs-modes">
          {MODES.map((m, i) => (
            <button
              key={m}
              type="button"
              className={`staccs-mode ${mode === m ? 'staccs-mode--on' : ''}`}
              aria-pressed={mode === m}
              aria-label={`${MODE_NAME[m]}, ${playersLabel(m)}`}
              onClick={() => pickMode(m)}
            >
              <span className="staccs-mode__num">{i + 1}</span>
              <span className="staccs-mode__body">
                <strong>{MODE_NAME[m]}</strong>
                <small>{MODE_BLURB[m]}</small>
              </span>
              <span className="staccs-mode__players">{playersLabel(m)}</span>
            </button>
          ))}
          <div className="staccs-mode staccs-mode--soon" aria-disabled="true">
            <span className="staccs-mode__num">5</span>
            <span className="staccs-mode__body">
              <strong>Face Off</strong>
              <small>Coming soon, says the rulebook.</small>
            </span>
            <span className="staccs-mode__players">2 players</span>
          </div>
        </div>
      </div>

      {counts.length > 1 && (
        <div className="staccs-field">
          <span className="staccs-field__label">Players</span>
          <div className="staccs-choice">
            {counts.map((n) => (
              <button
                key={n}
                type="button"
                className={`staccs-choice__opt ${playerCount === n ? 'staccs-choice__opt--on' : ''}`}
                aria-pressed={playerCount === n}
                onClick={() => setPlayerCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'solo' && (
        <div className="staccs-field">
          <span className="staccs-field__label">Variations</span>
          <label className="staccs-toggle">
            <input type="checkbox" checked={noWilds} onChange={(e) => setNoWilds(e.target.checked)} />
            No Wilds: take the four Wilds out first
          </label>
          <label className="staccs-toggle">
            <input type="checkbox" checked={secondChances} onChange={(e) => setSecondChances(e.target.checked)} />
            Second Chances: flip the discard pile over once
          </label>
        </div>
      )}

      <button type="button" className="staccs-primary" disabled={!trimmed || busy} onClick={create}>
        {playerCount === 1 ? 'Start staccing' : 'Open a table'}
      </button>

      <div className="staccs-join">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Room code"
          maxLength={5}
          autoComplete="off"
          aria-label="Room code"
        />
        <button type="button" className="staccs-secondary" disabled={!trimmed || joinCode.length < 5 || busy} onClick={() => onJoin(trimmed, joinCode)}>
          Join
        </button>
      </div>

      {error && <p className="staccs-error">{error}</p>}
    </div>
  );
}

interface WaitingProps {
  room: RoomSummary | null;
  code: string;
  onLeave: () => void;
}

export function StaccsWaiting({ room, code, onLeave }: WaitingProps) {
  const seated = room?.players ?? [];
  const needed = room?.config.playerCount ?? 0;
  return (
    <div className="staccs-lobby staccs-waiting">
      <h2 className="staccs-title staccs-title--small">{room ? MODE_NAME[room.config.mode] : 'STACCS'}</h2>
      <p className="staccs-tagline">Share this code so everyone can sit down</p>
      <p className="staccs-code">{code}</p>
      <ul className="staccs-seated">
        {seated.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'staccs-seated--away'}>
            {p.name}
          </li>
        ))}
        {Array.from({ length: Math.max(0, needed - seated.length) }, (_, i) => (
          <li key={`empty-${i}`} className="staccs-seated--empty">
            Waiting…
          </li>
        ))}
      </ul>
      <button type="button" className="staccs-secondary" onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}
