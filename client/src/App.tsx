import { useEffect, useRef, useState } from 'react';
import type { CardCode, PlayerView, Position } from '@sequence/shared';
import { socket } from './socket';
import { clearStoredRoomCode, getPlayerId, getStoredRoomCode, storeRoomCode } from './playerId';
import { Lobby } from './Lobby';
import { WaitingRoom } from './WaitingRoom';
import { Board } from './Board';
import { Hand } from './Hand';
import { Hud } from './Hud';
import { computePlayableCells } from './gameHelpers';
import './App.css';

type Phase = 'lobby' | 'rejoining' | 'waiting' | 'playing';

interface RoomUpdate {
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  players: { name: string; connected: boolean }[];
}

interface AckResponse {
  ok: boolean;
  roomCode?: string;
  playerId?: string;
  error?: string;
}

function App() {
  const [playerId] = useState(getPlayerId);
  const [phase, setPhase] = useState<Phase>(() => (getStoredRoomCode() ? 'rejoining' : 'lobby'));
  const [roomCode, setRoomCode] = useState<string>(getStoredRoomCode);
  const [roomPlayers, setRoomPlayers] = useState<{ name: string; connected: boolean }[]>([]);
  const [gameView, setGameView] = useState<PlayerView | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  function leaveRoom(message: string | null) {
    clearStoredRoomCode();
    setRoomCode('');
    setGameView(null);
    setRoomPlayers([]);
    setSelectedCard(null);
    setPhase('lobby');
    setError(message);
  }

  useEffect(() => {
    function handleRoomUpdate(payload: RoomUpdate) {
      setRoomPlayers(payload.players);
      setPhase((current) => (current === 'rejoining' ? 'waiting' : current));
    }
    function handleGameUpdate(view: PlayerView) {
      setGameView(view);
      setSelectedCard(null);
      setPhase('playing');
    }
    // Re-claims our seat after any (re)connect, since every reconnect assigns a new socket.id.
    function handleConnect() {
      setConnected(true);
      const code = roomCodeRef.current;
      if (!code) return;
      socket
        .timeout(10000)
        .emit('room:rejoin', { roomCode: code, playerId }, (err: unknown, res?: AckResponse) => {
          if (err || !res?.ok) {
            // The room is gone (the server restarts with empty memory) or we were never seated.
            leaveRoom(res?.error ?? 'That game is no longer available. Start a new one.');
          }
        });
    }
    function handleDisconnect() {
      setConnected(false);
    }

    socket.on('room:update', handleRoomUpdate);
    socket.on('game:update', handleGameUpdate);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    // The socket connects on import, so it may already be connected before this effect runs -
    // in which case 'connect' has fired and will not fire again. Rejoin now instead of hanging.
    if (socket.connected) handleConnect();

    return () => {
      socket.off('room:update', handleRoomUpdate);
      socket.off('game:update', handleGameUpdate);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [playerId]);

  function handleCreate(name: string) {
    socket.emit('room:create', { name, playerId }, (res: AckResponse) => {
      if (res.ok && res.roomCode) {
        storeRoomCode(res.roomCode);
        setRoomCode(res.roomCode);
        setPhase('waiting');
        setError(null);
      } else {
        setError(res.error ?? 'Failed to create room');
      }
    });
  }

  function handleJoin(name: string, code: string) {
    socket.emit('room:join', { name, roomCode: code, playerId }, (res: AckResponse) => {
      if (res.ok && res.roomCode) {
        storeRoomCode(res.roomCode);
        setRoomCode(res.roomCode);
        setPhase('waiting');
        setError(null);
      } else {
        setError(res.error ?? 'Failed to join room');
      }
    });
  }

  function handlePlayCard(card: CardCode, position: Position) {
    socket.emit('game:playCard', { roomCode, card, position }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? 'Invalid move');
    });
  }

  function handleDiscardDeadCard(card: CardCode) {
    socket.emit('game:discardDeadCard', { roomCode, card }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? 'Could not discard card');
    });
  }

  if (phase === 'lobby') {
    return <Lobby onCreate={handleCreate} onJoin={handleJoin} error={error} />;
  }

  if (phase === 'rejoining') {
    return (
      <div className="waiting">
        <h2>Reconnecting…</h2>
        <p>Rejoining your game. The server may take a moment to wake up.</p>
        <button type="button" onClick={() => leaveRoom(null)}>
          Back to lobby
        </button>
      </div>
    );
  }

  if (phase === 'waiting' || !gameView) {
    return (
      <WaitingRoom roomCode={roomCode} players={roomPlayers} onLeave={() => leaveRoom(null)} />
    );
  }

  const playableCells = selectedCard && gameView.isYourTurn ? computePlayableCells(gameView, selectedCard) : [];

  return (
    <div className="game">
      {!connected && <p className="game__offline">Reconnecting…</p>}
      <Hud view={gameView} isMyTurn={gameView.isYourTurn} />
      {error && (
        <p className="game__error" onClick={() => setError(null)}>
          {error}
        </p>
      )}
      {gameView.winnerId && (
        <div className="win-banner">{gameView.winnerId === gameView.you.id ? 'You win! 🎉' : 'Opponent wins'}</div>
      )}
      <Board
        view={gameView}
        playableCells={playableCells}
        onCellClick={(pos) => selectedCard && handlePlayCard(selectedCard, pos)}
      />
      <Hand
        view={gameView}
        isMyTurn={gameView.isYourTurn && !gameView.winnerId}
        selectedCard={selectedCard}
        onSelectCard={setSelectedCard}
        onDiscardDeadCard={handleDiscardDeadCard}
      />
    </div>
  );
}

export default App;
