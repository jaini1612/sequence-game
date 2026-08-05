import { useEffect, useRef, useState } from 'react';
import type { CardCode, PlayerView, Position } from '@sequence/shared';
import { socket } from './socket';
import { getPlayerId } from './playerId';
import { Lobby } from './Lobby';
import { WaitingRoom } from './WaitingRoom';
import { Board } from './Board';
import { Hand } from './Hand';
import { Hud } from './Hud';
import { computePlayableCells } from './gameHelpers';
import './App.css';

type Phase = 'lobby' | 'waiting' | 'playing';

const ROOM_CODE_KEY = 'sequence:roomCode';

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
  const [phase, setPhase] = useState<Phase>(() => (localStorage.getItem(ROOM_CODE_KEY) ? 'waiting' : 'lobby'));
  const [roomCode, setRoomCode] = useState<string>(() => localStorage.getItem(ROOM_CODE_KEY) ?? '');
  const [roomPlayers, setRoomPlayers] = useState<{ name: string; connected: boolean }[]>([]);
  const [gameView, setGameView] = useState<PlayerView | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;

  useEffect(() => {
    function handleRoomUpdate(payload: RoomUpdate) {
      setRoomPlayers(payload.players);
    }
    function handleGameUpdate(view: PlayerView) {
      setGameView(view);
      setSelectedCard(null);
      setPhase('playing');
    }
    // Fires on the initial connection and again on every reconnect (dropped WebSocket from a
    // backgrounded phone, network switch, server restart, ...), each of which hands the socket a
    // new socket.id. Re-claim our existing player record so a reconnect mid-game doesn't lock us
    // out of our own turn.
    function handleConnect() {
      const code = roomCodeRef.current;
      if (!code) return;
      socket.emit('room:rejoin', { roomCode: code, playerId }, (res: AckResponse) => {
        if (!res.ok) {
          localStorage.removeItem(ROOM_CODE_KEY);
          setRoomCode('');
          setPhase('lobby');
        }
      });
    }
    socket.on('room:update', handleRoomUpdate);
    socket.on('game:update', handleGameUpdate);
    socket.on('connect', handleConnect);
    return () => {
      socket.off('room:update', handleRoomUpdate);
      socket.off('game:update', handleGameUpdate);
      socket.off('connect', handleConnect);
    };
  }, [playerId]);

  function handleCreate(name: string) {
    socket.emit('room:create', { name, playerId }, (res: AckResponse) => {
      if (res.ok && res.roomCode) {
        localStorage.setItem(ROOM_CODE_KEY, res.roomCode);
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
        localStorage.setItem(ROOM_CODE_KEY, res.roomCode);
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

  if (phase === 'waiting' || !gameView) {
    return <WaitingRoom roomCode={roomCode} players={roomPlayers} />;
  }

  const playableCells = selectedCard && gameView.isYourTurn ? computePlayableCells(gameView, selectedCard) : [];

  return (
    <div className="game">
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
