import { useEffect, useMemo, useRef, useState } from 'react';
import type { StaccsAction, StaccsConfig, StaccsView } from '@staccs/shared';
import { clearStoredRoomCode, getPlayerId, getStoredRoomCode, storeName, storeRoomCode } from './identity';
import { Play } from './Play';
import { getConnectError, retryConnection, SERVER_ORIGIN, staccsSocket } from './socket';
import { StaccsLobby, StaccsWaiting, type RoomSummary } from './StaccsLobby';
import './staccs.css';

type Phase = 'lobby' | 'rejoining' | 'waiting' | 'playing';

interface RoomUpdate extends RoomSummary {
  status: 'waiting' | 'playing' | 'finished';
  rematchVotes: string[];
}

interface Ack {
  ok: boolean;
  roomCode?: string;
  error?: string;
}

/** Sitting down can wait on a free server waking up; a move never should. */
const SEAT_TIMEOUT_MS = 75_000;
const ACTION_TIMEOUT_MS = 8_000;

export default function StaccsApp({ onExit }: { onExit: () => void }) {
  const [playerId] = useState(getPlayerId);
  const [phase, setPhase] = useState<Phase>(() => (getStoredRoomCode() ? 'rejoining' : 'lobby'));
  const [roomCode, setRoomCode] = useState(getStoredRoomCode);
  const [room, setRoom] = useState<RoomUpdate | null>(null);
  const [view, setView] = useState<StaccsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(staccsSocket.connected);
  const [connectError, setConnectError] = useState<string | null>(getConnectError);

  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  useEffect(() => {
    function handleRoom(payload: RoomUpdate) {
      setRoom(payload);
      setPhase((current) => (current === 'rejoining' ? 'waiting' : current));
    }

    function handleGame(next: StaccsView) {
      setView(next);
      setPhase('playing');
    }

    // Every reconnect brings a new socket id, so the seat has to be re-claimed each time.
    function handleConnect() {
      setOnline(true);
      setConnectError(null);
      const code = roomCodeRef.current;
      if (!code) return;
      staccsSocket.timeout(10_000).emit('room:rejoin', { roomCode: code, playerId }, (err: unknown, res?: Ack) => {
        if (err || !res?.ok) leaveTable(res?.error ?? 'That table is no longer there. Start a new one.');
      });
    }

    function handleDisconnect() {
      setOnline(false);
    }

    function handleConnectError(err: Error) {
      setOnline(false);
      setConnectError(err.message);
    }

    staccsSocket.on('room:update', handleRoom);
    staccsSocket.on('game:update', handleGame);
    staccsSocket.on('connect', handleConnect);
    staccsSocket.on('disconnect', handleDisconnect);
    staccsSocket.on('connect_error', handleConnectError);
    // The socket connected on import, possibly before these listeners existed.
    if (staccsSocket.connected) handleConnect();
    else setConnectError(getConnectError());

    return () => {
      staccsSocket.off('room:update', handleRoom);
      staccsSocket.off('game:update', handleGame);
      staccsSocket.off('connect', handleConnect);
      staccsSocket.off('disconnect', handleDisconnect);
      staccsSocket.off('connect_error', handleConnectError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  function leaveTable(message: string | null) {
    clearStoredRoomCode();
    setRoomCode('');
    setRoom(null);
    setView(null);
    setPhase('lobby');
    setError(message);
  }

  function noAnswer(): string {
    return staccsSocket.connected
      ? 'The table did not answer in time. Try that again.'
      : `Cannot reach the game server at ${SERVER_ORIGIN}. If it has been idle it may take a minute to start.`;
  }

  /** Every request carries a deadline, so a lost acknowledgement can never leave the controls locked. */
  function send(event: string, data: Record<string, unknown>, timeout = ACTION_TIMEOUT_MS, onOk?: (res: Ack) => void) {
    setBusy(true);
    staccsSocket.timeout(timeout).emit(event, data, (err: unknown, res?: Ack) => {
      setBusy(false);
      if (err) return setError(noAnswer());
      if (!res?.ok) return setError(res?.error ?? 'That did not work');
      setError(null);
      onOk?.(res);
    });
  }

  function takeSeat(event: 'room:create' | 'room:join', data: Record<string, unknown>) {
    send(event, { playerId, ...data }, SEAT_TIMEOUT_MS, (res) => {
      if (!res.roomCode) return;
      storeRoomCode(res.roomCode);
      setRoomCode(res.roomCode);
      setPhase((current) => (current === 'playing' ? current : 'waiting'));
    });
  }

  function handleCreate(name: string, config: StaccsConfig) {
    storeName(name);
    takeSeat('room:create', { name, config });
  }

  function handleJoin(name: string, code: string) {
    storeName(name);
    takeSeat('room:join', { name, roomCode: code });
  }

  const connected = useMemo(
    () => new Set((room?.players ?? []).filter((p) => p.connected).map((p) => p.id)),
    [room],
  );

  if (phase === 'lobby') {
    return (
      <div className="staccs">
        <StaccsLobby
          onCreate={handleCreate}
          onJoin={handleJoin}
          onExit={onExit}
          error={error}
          busy={busy}
          online={online}
          connectError={connectError}
          onRetry={retryConnection}
        />
      </div>
    );
  }

  if (phase === 'rejoining') {
    return (
      <div className="staccs">
        <div className="staccs-lobby staccs-waiting">
          <h2 className="staccs-title staccs-title--small">Sitting back down…</h2>
          <p className="staccs-tagline">Finding your seat. The server may take a moment to wake.</p>
          <button type="button" className="staccs-secondary" onClick={() => leaveTable(null)}>
            Back to the lobby
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'waiting' || !view) {
    return (
      <div className="staccs">
        <StaccsWaiting room={room} code={roomCode} onLeave={() => leaveTable(null)} />
      </div>
    );
  }

  return (
    <>
      <Play
        view={view}
        roomCode={roomCode}
        busy={busy}
        online={online}
        connected={connected}
        rematchVotes={room?.rematchVotes ?? []}
        onAction={(action: StaccsAction) => send('game:action', { roomCode, action })}
        onRematch={() => send('game:rematch', { roomCode })}
        onLeave={() => leaveTable(null)}
      />
      {error && (
        <p className="staccs-error staccs-error--toast" role="alert" onClick={() => setError(null)}>
          {error}
        </p>
      )}
    </>
  );
}
