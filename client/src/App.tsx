import { useEffect, useRef, useState } from 'react';
import type { CardCode, PlayerColor, PlayerView, Position } from '@sequence/shared';
import { socket } from './socket';
import { clearStoredRoomCode, getPlayerId, getStoredRoomCode, storeRoomCode } from './playerId';
import { ClaimColor, Lobby, type CreateOptions, type RoomInfo } from './Lobby';
import { WaitingRoom } from './WaitingRoom';
import { Board } from './Board';
import { DiscardPile } from './DiscardPile';
import { DrawPile } from './DrawPile';
import { Hand } from './Hand';
import { Hud } from './Hud';
import { computePlayableCells } from './gameHelpers';
import { playTurnChime } from './sound';
import { mostNotable, pickRefereeLine, type RefereeEvent } from './refereeLines';
import './App.css';

type Phase = 'lobby' | 'claiming' | 'rejoining' | 'waiting' | 'playing';

interface RoomUpdate {
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  teams: number;
  size: number;
  players: { name: string; color: PlayerColor; connected: boolean }[];
  availableColors: PlayerColor[];
}

interface AckResponse {
  ok: boolean;
  roomCode?: string;
  playerId?: string;
  error?: string;
  room?: RoomUpdate;
}

/**
 * A snapshot of the things worth reacting to. Comparing two of these turns a state update into a
 * list of events, which is all the referee needs to know.
 */
interface Tally {
  missedDraws: number;
  yourSequences: number;
  theirSequences: number;
  yourChips: number;
  otherChips: number;
  winnerId: string | null;
}

function tally(view: PlayerView): Tally {
  let yourChips = 0;
  let otherChips = 0;
  for (const row of view.chips) {
    for (const chip of row) {
      if (!chip) continue;
      if (chip === view.you.color) yourChips++;
      else otherChips++;
    }
  }
  return {
    missedDraws: view.missedDraws[view.you.id] ?? 0,
    yourSequences: view.sequences.filter((s) => s.playerId === view.you.id).length,
    theirSequences: view.sequences.filter((s) => s.playerId !== view.you.id).length,
    yourChips,
    otherChips,
    winnerId: view.winnerId,
  };
}

function eventsBetween(before: Tally, after: Tally, view: PlayerView): RefereeEvent[] {
  const events: RefereeEvent[] = [];
  if (!before.winnerId && after.winnerId) {
    events.push(after.winnerId === view.you.id ? 'youWon' : 'youLost');
  }
  if (after.yourSequences > before.yourSequences) events.push('yourSequence');
  if (after.theirSequences > before.theirSequences) events.push('theirSequence');
  // Chips only ever leave the board via a one-eyed jack, so a drop in either count is a removal.
  if (after.yourChips < before.yourChips) events.push('chipStolen');
  if (after.otherChips < before.otherChips && view.lastPlayerId === view.you.id) {
    events.push('chipRemoved');
  }
  if (after.missedDraws > before.missedDraws) events.push('missedDraw');
  return events;
}

/** The winning player's colour, capitalised for display. */
function winnerColor(view: PlayerView): string | null {
  const winner = view.opponents.find((o) => o.id === view.winnerId);
  if (!winner) return null;
  return winner.color[0] + winner.color.slice(1).toLowerCase();
}

function App() {
  const [playerId] = useState(getPlayerId);
  const [phase, setPhase] = useState<Phase>(() => (getStoredRoomCode() ? 'rejoining' : 'lobby'));
  const [roomCode, setRoomCode] = useState<string>(getStoredRoomCode);
  const [room, setRoom] = useState<RoomUpdate | null>(null);
  const [claiming, setClaiming] = useState<{ info: RoomInfo; name: string } | null>(null);
  const [gameView, setGameView] = useState<PlayerView | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [refereeLine, setRefereeLine] = useState<string | null>(null);
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;
  // null until we have seen a view, so the chime only fires on a real change of turn.
  const wasMyTurnRef = useRef<boolean | null>(null);
  // What the last view looked like, so an update can be read as "what just happened".
  const lastTallyRef = useRef<Tally | null>(null);

  function heckle(event: RefereeEvent) {
    setRefereeLine(pickRefereeLine(event));
  }

  // The heckle is a nudge, not a dialog - it clears itself, or on a tap.
  useEffect(() => {
    if (!refereeLine) return;
    const timer = setTimeout(() => setRefereeLine(null), 5000);
    return () => clearTimeout(timer);
  }, [refereeLine]);

  function leaveRoom(message: string | null) {
    clearStoredRoomCode();
    wasMyTurnRef.current = null;
    lastTallyRef.current = null;
    setRefereeLine(null);
    setRoomCode('');
    setGameView(null);
    setRoom(null);
    setClaiming(null);
    setSelectedCard(null);
    setPhase('lobby');
    setError(message);
  }

  useEffect(() => {
    function handleRoomUpdate(payload: RoomUpdate) {
      setRoom(payload);
      setPhase((current) => (current === 'rejoining' ? 'waiting' : current));
    }
    function handleGameUpdate(view: PlayerView) {
      // Only on the handover into your turn, so a reload or reconnect mid-turn stays silent.
      if (wasMyTurnRef.current === false && view.isYourTurn && !view.winnerId) playTurnChime();
      wasMyTurnRef.current = view.isYourTurn;

      // The first view we ever see is the baseline, not a set of things that just happened.
      const next = tally(view);
      if (lastTallyRef.current) {
        const event = mostNotable(eventsBetween(lastTallyRef.current, next, view));
        if (event) setRefereeLine(pickRefereeLine(event));
      }
      lastTallyRef.current = next;

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

  function handleCreate(options: CreateOptions) {
    socket.emit('room:create', { ...options, playerId }, (res: AckResponse) => {
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

  function handleLookupRoom(code: string, name: string) {
    socket.emit('room:info', { roomCode: code }, (res: AckResponse) => {
      if (res.ok && res.room) {
        setClaiming({ info: { ...res.room }, name });
        setPhase('claiming');
        setError(null);
      } else {
        setError(res.error ?? 'Room not found');
      }
    });
  }

  function handleJoin(name: string, code: string, color: PlayerColor) {
    socket.emit('room:join', { name, roomCode: code, playerId, color }, (res: AckResponse) => {
      if (res.ok && res.roomCode) {
        storeRoomCode(res.roomCode);
        setRoomCode(res.roomCode);
        setClaiming(null);
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

  function handleDraw() {
    socket.emit('game:draw', { roomCode }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? 'Could not draw');
    });
  }

  function handleDiscardDeadCard(card: CardCode) {
    socket.emit('game:discardDeadCard', { roomCode, card }, (res: AckResponse) => {
      if (!res.ok) setError(res.error ?? 'Could not discard card');
    });
  }

  if (phase === 'claiming' && claiming) {
    return (
      <ClaimColor
        info={claiming.info}
        name={claiming.name}
        onJoin={(color) => handleJoin(claiming.name, claiming.info.code, color)}
        onCancel={() => {
          setClaiming(null);
          setPhase('lobby');
          setError(null);
        }}
        error={error}
      />
    );
  }

  if (phase === 'lobby') {
    return <Lobby onCreate={handleCreate} onLookupRoom={handleLookupRoom} error={error} />;
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
      <WaitingRoom
        roomCode={roomCode}
        size={room?.size ?? 2}
        players={room?.players ?? []}
        onLeave={() => leaveRoom(null)}
      />
    );
  }

  // Positions light up as soon as a card is picked, even off-turn, so you can plan ahead. Playing
  // stays gated on it actually being your turn.
  const canPlay = gameView.isYourTurn && !gameView.winnerId;
  const highlightedCells = selectedCard ? computePlayableCells(gameView, selectedCard) : [];

  return (
    <div className="game">
      {!connected && <p className="game__offline">Reconnecting…</p>}
      <Hud
        view={gameView}
        refereeMessage={refereeLine}
        onDismissRefereeMessage={() => setRefereeLine(null)}
      />
      {error && (
        <p className="game__error" onClick={() => setError(null)}>
          {error}
        </p>
      )}
      {gameView.winnerId && (
        <div className="win-banner">
          {gameView.winnerId === gameView.you.id
            ? 'You win! 🎉'
            : // With three players "opponent" is ambiguous, so name the colour that won.
              `${winnerColor(gameView) ?? 'Opponent'} wins`}
        </div>
      )}
      <div className="game__table">
        <Board
          view={gameView}
          highlightedCells={highlightedCells}
          canPlay={canPlay}
          // Highlighted squares stay tappable off-turn so the referee can point out why nothing
          // happened, rather than the tap vanishing into thin air.
          onCellClick={(pos) => {
            if (!canPlay) return heckle('outOfTurn');
            if (selectedCard) handlePlayCard(selectedCard, pos);
          }}
        />
        <div className="game__tray">
          <Hand
            view={gameView}
            canPlay={canPlay}
            selectedCard={selectedCard}
            onSelectCard={setSelectedCard}
            onDiscardDeadCard={handleDiscardDeadCard}
          />
          <div className="game__piles">
            <DrawPile view={gameView} onDraw={handleDraw} />
            <DiscardPile view={gameView} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
