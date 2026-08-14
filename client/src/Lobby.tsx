import { useState } from 'react';
import {
  colorsForPlayerCount,
  MAX_PLAYERS,
  PLAYABLE_PLAYER_COUNTS,
  type PlayerColor,
} from '@sequence/shared';
import { Card } from './cards';
import { Chip } from './Chip';

export interface CreateOptions {
  name: string;
  teams: number;
  size: number;
  color: PlayerColor;
}

/** Details a joiner needs before claiming a seat: how big the game is and what colours are free. */
export interface RoomInfo {
  code: string;
  size: number;
  players: { name: string; color: PlayerColor }[];
  availableColors: PlayerColor[];
}

const COLOR_LABEL: Record<PlayerColor, string> = { BLUE: 'Blue', RED: 'Red', GREEN: 'Green' };

/** Every player count the printed game allows for this many sides, up to the official cap of 12. */
function sizeOptions(teams: number): number[] {
  const options: number[] = [];
  for (let n = teams; n <= MAX_PLAYERS; n += teams) options.push(n);
  return options;
}

function ColorPicker({
  options,
  value,
  onChange,
}: {
  options: PlayerColor[];
  value: PlayerColor;
  onChange: (color: PlayerColor) => void;
}) {
  return (
    <div className="picker picker--colors">
      {options.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch swatch--${color.toLowerCase()} ${value === color ? 'swatch--on' : ''}`}
          onClick={() => onChange(color)}
          aria-pressed={value === color}
          aria-label={COLOR_LABEL[color]}
        >
          <Chip color={color} />
        </button>
      ))}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: number; enabled: boolean; note?: string }[];
  value: number;
  /** Omitted when the control only reports a derived value, as the player count does today. */
  onChange?: (v: number) => void;
}) {
  return (
    <div className="picker">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`seg ${value === opt.value ? 'seg--on' : ''}`}
          disabled={!opt.enabled || !onChange}
          title={opt.enabled ? undefined : opt.note}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.value}
        </button>
      ))}
    </div>
  );
}

export function Lobby({
  onCreate,
  onLookupRoom,
  onExit,
  error,
}: {
  onCreate: (options: CreateOptions) => void;
  /** Looks a code up; App then swaps this screen for ClaimColor once the room answers. */
  onLookupRoom: (code: string, name: string) => void;
  /** Back to the portal, where the other game is. */
  onExit: () => void;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const [teams, setTeams] = useState(2);
  const [color, setColor] = useState<PlayerColor>('BLUE');
  const [joinCode, setJoinCode] = useState('');

  // One player per side for now, so the game is as big as the number of sides.
  const size = teams;
  const colorOptions = colorsForPlayerCount(size);
  const activeColor = colorOptions.includes(color) ? color : colorOptions[0];

  return (
    <div className="lobby">
      <button type="button" className="portal-back" onClick={onExit}>
        ← All games
      </button>

      <div className="lobby__hero" aria-hidden="true">
        <div className="lobby__fan">
          <Card code="JS" />
          <Card code="QH" />
          <Card code="KD" />
        </div>
        <Chip color="BLUE" className="lobby__chip lobby__chip--blue" />
        <Chip color="RED" className="lobby__chip lobby__chip--red" />
      </div>

      <h1 className="lobby__title">Sequence</h1>
      <p className="lobby__tagline">Five in a row wins</p>

      <label className="lobby__field">
        <span className="lobby__field-label">Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player" maxLength={20} />
      </label>

      <div className="lobby__field">
        <span className="lobby__field-label">Teams</span>
        <Segmented
          options={[2, 3].map((n) => ({ value: n, enabled: true }))}
          value={teams}
          onChange={(n) => setTeams(n)}
        />
      </div>

      <div className="lobby__field">
        <span className="lobby__field-label">Players</span>
        <Segmented
          options={sizeOptions(teams).map((n) => ({
            value: n,
            enabled: PLAYABLE_PLAYER_COUNTS.includes(n) && n === teams,
            note: 'Needs team play, which is coming later',
          }))}
          value={size}
          onChange={() => {}}
        />
        <p className="lobby__hint">More than one player per team is coming later.</p>
      </div>

      <div className="lobby__field">
        <span className="lobby__field-label">Your colour</span>
        <ColorPicker options={colorOptions} value={activeColor} onChange={setColor} />
      </div>

      <button
        type="button"
        className="lobby__primary"
        onClick={() => onCreate({ name: name || 'Player 1', teams, size, color: activeColor })}
      >
        Create room
      </button>

      <div className="lobby__or">
        <span>or join a game</span>
      </div>

      {/*
        Joining is two steps: look the code up to learn how big the game is and which colours are
        free, then claim one. Picking blind would mean rejecting the join after the fact.
      */}
      <div className="lobby__join">
        <input
          className="lobby__code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="ROOM CODE"
          maxLength={5}
        />
        <button
          type="button"
          disabled={joinCode.length < 5}
          onClick={() => onLookupRoom(joinCode, name || 'Player')}
        >
          Join
        </button>
      </div>

      {error && <p className="lobby__error">{error}</p>}
    </div>
  );
}

/** Shown after a successful lookup, in place of the lobby, so the joiner can claim a colour. */
export function ClaimColor({
  info,
  name,
  onJoin,
  onCancel,
  error,
}: {
  info: RoomInfo;
  name: string;
  onJoin: (color: PlayerColor) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const [color, setColor] = useState<PlayerColor>(info.availableColors[0]);

  return (
    <div className="lobby">
      <h1 className="lobby__title">Join {info.code}</h1>
      <p className="lobby__tagline">
        {info.size}-player game · {info.players.length} seated
      </p>

      <ul className="claim__seated">
        {info.players.map((p) => (
          <li key={p.color}>
            <Chip color={p.color} />
            <span>{p.name}</span>
          </li>
        ))}
      </ul>

      <div className="lobby__field">
        <span className="lobby__field-label">Pick your colour</span>
        <ColorPicker options={info.availableColors} value={color} onChange={setColor} />
      </div>

      <button type="button" className="lobby__primary" onClick={() => onJoin(color)}>
        Join as {COLOR_LABEL[color]}
        {name ? ` · ${name}` : ''}
      </button>

      <div className="lobby__or">
        <span>or</span>
      </div>
      <button type="button" onClick={onCancel} className="lobby__secondary">
        Back to lobby
      </button>

      {error && <p className="lobby__error">{error}</p>}
    </div>
  );
}
