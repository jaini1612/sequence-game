import { useState } from 'react';
import {
  DECK_COUNTS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TURN_SECONDS_OPTIONS,
  type BluffConfig,
  type DeckComposition,
} from '@bluff/shared';
import { Card, CardBack, Fleur } from '../cards';
import { getStoredName } from './identity';

export interface RoomSummary {
  code: string;
  config: BluffConfig;
  players: { id: string; name: string; connected: boolean }[];
}

const PLAYER_COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

function Choice<T extends string | number>({
  options,
  value,
  onChange,
  format = (v: T) => String(v),
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="bluff-choice">
      {options.map((option) => (
        <button
          key={String(option)}
          type="button"
          className={`bluff-choice__opt ${value === option ? 'bluff-choice__opt--on' : ''}`}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}

export function BluffLobby({
  onCreate,
  onJoin,
  onExit,
  error,
  busy,
}: {
  onCreate: (name: string, config: BluffConfig) => void;
  onJoin: (name: string, code: string) => void;
  onExit: () => void;
  error: string | null;
  busy: boolean;
}) {
  const [name, setName] = useState(getStoredName);
  const [playerCount, setPlayerCount] = useState(4);
  const [deckCount, setDeckCount] = useState<1 | 2>(1);
  const [composition, setComposition] = useState<DeckComposition>('standard');
  const [turnSeconds, setTurnSeconds] = useState(20);
  const [joinCode, setJoinCode] = useState('');

  // A name is compulsory: calling "Player 3" a liar has none of the same satisfaction.
  const trimmedName = name.trim();
  const nameMissing = trimmedName.length === 0;

  return (
    <div className="bluff-lobby">
      <button type="button" className="portal-back" onClick={onExit}>
        ← All games
      </button>

      <div className="bluff-lobby__hero" aria-hidden="true">
        <div className="bluff-lobby__fan">
          <div className="bluff-lobby__fan-card">
            <Card code="AS" />
          </div>
          <div className="bluff-lobby__fan-card">
            <CardBack />
          </div>
          <div className="bluff-lobby__fan-card">
            <Card code="KH" />
          </div>
        </div>
      </div>

      <h1 className="bluff-lobby__title">SparrowBluff</h1>
      <p className="bluff-lobby__tagline">Say anything. Prove nothing.</p>

      {/* The same crest that is printed on the cards and the cloth, as a rule under the title. */}
      <div className="bluff-rule" aria-hidden="true">
        <span />
        <Fleur />
        <span />
      </div>

      <label className="bluff-field">
        <span className="bluff-field__label">
          Your name <em>required</em>
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Who is sitting down?"
          maxLength={16}
          autoComplete="off"
        />
      </label>

      <div className="bluff-field">
        <span className="bluff-field__label">Players</span>
        <Choice<number> options={PLAYER_COUNTS} value={playerCount} onChange={setPlayerCount} />
      </div>

      <div className="bluff-field">
        <span className="bluff-field__label">Decks</span>
        <Choice<1 | 2>
          options={DECK_COUNTS}
          value={deckCount}
          onChange={setDeckCount}
          format={(v) => (v === 1 ? '1 deck' : '2 decks')}
        />
      </div>

      <div className="bluff-field">
        <span className="bluff-field__label">Deck make-up</span>
        <Choice<DeckComposition>
          options={['standard', 'scrambled']}
          value={composition}
          onChange={setComposition}
          format={(v) => (v === 'standard' ? 'Proper deck' : 'Random')}
        />
        <p className="bluff-field__hint">
          {composition === 'standard'
            ? `A real deck: exactly ${deckCount * 4} of every rank, so a counted claim can be proved impossible.`
            : 'Same number of cards, lopsided make-up. Nobody knows how many Nines exist, so counting is useless.'}
        </p>
      </div>

      <div className="bluff-field">
        <span className="bluff-field__label">Turn clock</span>
        <Choice<number>
          options={TURN_SECONDS_OPTIONS}
          value={turnSeconds}
          onChange={setTurnSeconds}
          format={(v) => `${v}s`}
        />
        <p className="bluff-field__hint">Run out of time and your turn is simply passed.</p>
      </div>

      <button
        type="button"
        className="bluff-primary"
        disabled={nameMissing || busy}
        onClick={() => onCreate(trimmedName, { playerCount, deckCount, composition, turnSeconds })}
      >
        {nameMissing ? 'Enter your name first' : `Create a table for ${playerCount}`}
      </button>

      <div className="bluff-or">
        <span>or join a table</span>
      </div>

      <div className="bluff-join">
        <input
          className="bluff-join__code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
          placeholder="ROOM CODE"
          maxLength={5}
          autoComplete="off"
        />
        <button
          type="button"
          disabled={joinCode.length < 5 || nameMissing || busy}
          onClick={() => onJoin(trimmedName, joinCode)}
        >
          Join
        </button>
      </div>

      {error && <p className="bluff-error">{error}</p>}
    </div>
  );
}

export function BluffWaiting({
  code,
  config,
  players,
  onLeave,
}: {
  code: string;
  config: BluffConfig;
  players: { id: string; name: string; connected: boolean }[];
  onLeave: () => void;
}) {
  const empty = Math.max(0, config.playerCount - players.length);

  return (
    <div className="bluff-lobby bluff-waiting">
      <h2 className="bluff-lobby__title">Table {code}</h2>
      <p className="bluff-lobby__tagline">
        {players.length} of {config.playerCount} seated · {config.deckCount === 1 ? '1 deck' : '2 decks'} ·{' '}
        {config.composition === 'standard' ? 'proper' : 'random'} · {config.turnSeconds}s
      </p>

      <p className="bluff-waiting__code">
        Share this code: <strong>{code}</strong>
      </p>

      <ul className="bluff-waiting__players">
        {players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'bluff-waiting__player--away'}>
            <span className="bluff-waiting__avatar">{p.name.slice(0, 1).toUpperCase()}</span>
            <span>{p.name}</span>
            {!p.connected && <em>away</em>}
          </li>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <li key={`empty-${i}`} className="bluff-waiting__player--empty">
            <span className="bluff-waiting__avatar bluff-waiting__avatar--empty">?</span>
            <span>Waiting…</span>
          </li>
        ))}
      </ul>

      <button type="button" className="bluff-secondary" onClick={onLeave}>
        Leave table
      </button>
    </div>
  );
}
