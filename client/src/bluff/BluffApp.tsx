import { useEffect, useMemo, useRef, useState } from 'react';
import {
  describeClaim,
  winnersNeeded,
  type BluffConfig,
  type BluffEvent,
  type BluffView,
} from '@bluff/shared';
import { bluffSocket } from './socket';
import {
  clearStoredRoomCode,
  getPlayerId,
  getStoredRoomCode,
  storeName,
  storeRoomCode,
} from './identity';
import { BluffLobby, BluffWaiting } from './BluffLobby';
import { Arena, type Flight, type Reveal } from './Arena';
import { Tray } from './Tray';
import { Host } from './Host';
import { Finish } from './Finish';
import { HOST_PRIORITY, pickHostLine, type HostContext, type HostEvent } from './hostLines';
import { useCardSelection } from './useCardSelection';
import * as sound from './sound';
import { spotForSeat } from './seats';
import './bluff.css';

type Phase = 'lobby' | 'rejoining' | 'waiting' | 'playing';

interface RoomUpdate {
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  config: BluffConfig;
  players: { id: string; name: string; connected: boolean }[];
  rematchVotes: string[];
}

interface Ack {
  ok: boolean;
  roomCode?: string;
  playerId?: string;
  error?: string;
  room?: RoomUpdate;
}

/** How long the Jack's line stays up before he goes back to silent judgement. */
const HOST_LINE_MS = 5200;
const FLIGHT_MS = 700;
const REVEAL_MS = 2900;

/** Everything the last action might be worth saying, ready to be ranked. */
type Candidate = { event: HostEvent; context: HostContext };

function nameOf(view: BluffView, id: string): string {
  if (id === view.you.id) return view.you.name;
  return view.opponents.find((o) => o.id === id)?.name ?? 'Somebody';
}

/**
 * Turns what the engine reported into what the Jack might say about it. Everything is offered up as
 * a candidate; HOST_PRIORITY decides which one actually gets said.
 */
function candidatesFor(events: BluffEvent[], view: BluffView): Candidate[] {
  const you = view.you.id;
  const candidates: Candidate[] = [];

  for (const event of events) {
    switch (event.type) {
      case 'deal':
        candidates.push({ event: 'dealt', context: {} });
        break;
      case 'play':
        candidates.push(
          event.playerId === you
            ? { event: 'youPlayed', context: {} }
            : {
                event: 'played',
                context: { name: nameOf(view, event.playerId), claim: describeClaim(event.rank, event.count) },
              },
        );
        break;
      case 'pass': {
        const mine = event.playerId === you;
        const key: HostEvent = event.timedOut
          ? mine
            ? 'youTimedOut'
            : 'timedOut'
          : mine
            ? 'youPassed'
            : 'passed';
        candidates.push({ event: key, context: { name: nameOf(view, event.playerId) } });
        break;
      }
      case 'challenge': {
        // pileSize already counts the disputed cards - they were laid on the pile when claimed.
        const context = { n: event.pileSize };
        if (event.bluffed) {
          if (event.claimerId === you) candidates.push({ event: 'youWereCaught', context });
          else if (event.challengerId === you) candidates.push({ event: 'youCaught', context });
          else candidates.push({ event: 'caught', context: { ...context, name: nameOf(view, event.claimerId) } });
        } else if (event.challengerId === you) {
          candidates.push({ event: 'youCalledWrong', context });
        } else if (event.claimerId === you) {
          candidates.push({ event: 'vindicated', context });
        } else {
          candidates.push({ event: 'wrongCall', context: { ...context, name: nameOf(view, event.challengerId) } });
        }
        break;
      }
      case 'burn':
        candidates.push({ event: 'burned', context: { n: event.count } });
        break;
      case 'challengeEarned':
        candidates.push(
          event.playerId === you
            ? { event: 'challengeEarned', context: {} }
            : { event: 'someoneEarned', context: { name: nameOf(view, event.playerId) } },
        );
        break;
      case 'out':
        candidates.push(
          event.playerId === you
            ? { event: 'youAreOut', context: {} }
            : { event: 'someoneOut', context: { name: nameOf(view, event.playerId) } },
        );
        break;
      case 'finished':
        candidates.push({ event: event.winnerIds.includes(you) ? 'youWon' : 'youLost', context: {} });
        break;
    }
  }
  return candidates;
}

/**
 * Turns a batch of engine events into noise. A challenge gets two beats - the accusation, then the
 * verdict a moment later - because hearing the verdict land after the strike is most of the drama.
 */
function playSounds(events: BluffEvent[], view: BluffView): void {
  for (const event of events) {
    switch (event.type) {
      case 'deal':
        sound.playDeal();
        break;
      case 'play':
        sound.playPlay(event.count);
        break;
      case 'pass':
        sound.playPass();
        break;
      case 'challenge':
        sound.playChallengeCalled();
        window.setTimeout(() => (event.bluffed ? sound.playCaught() : sound.playVindicated()), 340);
        break;
      case 'burn':
        sound.playBurn();
        break;
      case 'challengeEarned':
        if (event.playerId === view.you.id) sound.playChallengeEarned();
        break;
      case 'out':
        sound.playOut();
        break;
      case 'finished':
        // After the challenge verdict has had its moment, so the two never talk over each other.
        window.setTimeout(
          () => (event.winnerIds.includes(view.you.id) ? sound.playWin() : sound.playLose()),
          700,
        );
        break;
    }
  }
}

function mostNotable(candidates: Candidate[]): Candidate | null {
  for (const key of HOST_PRIORITY) {
    const found = candidates.find((c) => c.event === key);
    if (found) return found;
  }
  return null;
}

export default function BluffApp({ onExit }: { onExit: () => void }) {
  const [playerId] = useState(getPlayerId);
  const [phase, setPhase] = useState<Phase>(() => (getStoredRoomCode() ? 'rejoining' : 'lobby'));
  const [roomCode, setRoomCode] = useState(getStoredRoomCode);
  const [room, setRoom] = useState<RoomUpdate | null>(null);
  const [view, setView] = useState<BluffView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(bluffSocket.connected);
  const [hostLine, setHostLine] = useState<string | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);

  /**
   * Which cards are picked up ready to play. It lives here, above both, because the hand you tap and
   * the play button down on the table are now separate components that have to agree.
   *
   * Called before any of the early returns below, so the hook order never changes between phases.
   */
  const selection = useCardSelection(view, () =>
    setHostLine(pickHostLine('tooManyCards', { n: (view?.maxClaim ?? 0) + 1 })),
  );

  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;
  // Which batch of events has already been played out, so a re-render never replays an animation.
  const seenSeqRef = useRef(0);
  const wasYourTurnRef = useRef<boolean | null>(null);

  useEffect(() => {
    function handleRoom(payload: RoomUpdate) {
      setRoom(payload);
      setPhase((current) => (current === 'rejoining' ? 'waiting' : current));
    }

    function handleGame(next: BluffView) {
      setView(next);
      setPhase('playing');

      if (next.eventSeq <= seenSeqRef.current) return;
      seenSeqRef.current = next.eventSeq;

      playSounds(next.events, next);

      const candidates = candidatesFor(next.events, next);
      // Being handed the turn is worth a nudge, but only ever the quietest one.
      if (wasYourTurnRef.current === false && next.isYourTurn && !next.finished) {
        candidates.push({ event: 'yourTurn', context: {} });
        sound.playTurn();
      }
      wasYourTurnRef.current = next.isYourTurn;

      const spoken = mostNotable(candidates);
      if (spoken) setHostLine(pickHostLine(spoken.event, spoken.context));

      const played = next.events.find((e) => e.type === 'play');
      if (played) {
        const seat =
          played.playerId === next.you.id
            ? next.you.seat
            : (next.opponents.find((o) => o.id === played.playerId)?.seat ?? next.you.seat);
        setFlight({
          key: next.eventSeq,
          from: spotForSeat(seat, next.you.seat, next.config.playerCount),
          count: played.count,
        });
      }

      const called = next.events.find((e) => e.type === 'challenge');
      if (called) {
        const loserSeat =
          called.loserId === next.you.id
            ? next.you.seat
            : (next.opponents.find((o) => o.id === called.loserId)?.seat ?? next.you.seat);
        setReveal({
          key: next.eventSeq,
          cards: called.cards,
          rank: called.rank,
          bluffed: called.bluffed,
          claimerName: nameOf(next, called.claimerId),
          challengerName: nameOf(next, called.challengerId),
          loserName: nameOf(next, called.loserId),
          loserId: called.loserId,
          to: spotForSeat(loserSeat, next.you.seat, next.config.playerCount),
        });
      }
    }

    // Every reconnect brings a new socket id, so the seat has to be re-claimed each time.
    function handleConnect() {
      setOnline(true);
      const code = roomCodeRef.current;
      if (!code) return;
      bluffSocket
        .timeout(10000)
        .emit('room:rejoin', { roomCode: code, playerId }, (err: unknown, res?: Ack) => {
          if (err || !res?.ok) {
            leaveTable(res?.error ?? 'That table is no longer there. Start a new one.');
          }
        });
    }

    function handleDisconnect() {
      setOnline(false);
    }

    bluffSocket.on('room:update', handleRoom);
    bluffSocket.on('game:update', handleGame);
    bluffSocket.on('connect', handleConnect);
    bluffSocket.on('disconnect', handleDisconnect);
    // The socket connects on import, so it may already be up before this effect runs - in which case
    // 'connect' has fired and will not fire again. Re-claim the seat now rather than hanging.
    if (bluffSocket.connected) handleConnect();

    return () => {
      bluffSocket.off('room:update', handleRoom);
      bluffSocket.off('game:update', handleGame);
      bluffSocket.off('connect', handleConnect);
      bluffSocket.off('disconnect', handleDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  // The heckle, the flight and the reveal all clear themselves.
  useEffect(() => {
    if (!hostLine) return;
    const timer = setTimeout(() => setHostLine(null), HOST_LINE_MS);
    return () => clearTimeout(timer);
  }, [hostLine]);

  useEffect(() => {
    if (!flight) return;
    const timer = setTimeout(() => setFlight(null), FLIGHT_MS);
    return () => clearTimeout(timer);
  }, [flight]);

  useEffect(() => {
    if (!reveal) return;
    const timer = setTimeout(() => setReveal(null), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [reveal]);

  function leaveTable(message: string | null) {
    clearStoredRoomCode();
    seenSeqRef.current = 0;
    wasYourTurnRef.current = null;
    setRoomCode('');
    setRoom(null);
    setView(null);
    setHostLine(null);
    setFlight(null);
    setReveal(null);
    setPhase('lobby');
    setError(message);
  }

  /** Fire-and-forget action: the server answers with either an error or a fresh view. */
  /**
   * Every in-game action goes through here, and every one of them is sent with a deadline.
   *
   * `busy` disables the controls until the server answers, so an acknowledgement that never arrives
   * - a dropped socket, a server restart, a lost packet - would leave the player locked out of their
   * own turn with no way back. The timeout guarantees the controls always come back.
   */
  function send(event: string, data: Record<string, unknown>, fallback: string) {
    setBusy(true);
    bluffSocket.timeout(8000).emit(event, { roomCode, ...data }, (err: unknown, res?: Ack) => {
      setBusy(false);
      if (err) setError('The table did not answer — check your connection and try again.');
      else if (!res?.ok) setError(res?.error ?? fallback);
      else setError(null);
    });
  }

  /** Opening or claiming a seat. Same deadline as the in-game actions, and for the same reason. */
  function takeSeat(event: 'room:create' | 'room:join', data: Record<string, unknown>, fallback: string) {
    setBusy(true);
    bluffSocket.timeout(10000).emit(event, { playerId, ...data }, (err: unknown, res?: Ack) => {
      setBusy(false);
      if (err || !res?.ok || !res.roomCode) {
        setError(err ? 'The server did not answer — it may still be waking up.' : (res?.error ?? fallback));
        return;
      }
      storeRoomCode(res.roomCode);
      setRoomCode(res.roomCode);
      setPhase('waiting');
      setError(null);
    });
  }

  function handleCreate(name: string, config: BluffConfig) {
    storeName(name);
    takeSeat('room:create', { name, config }, 'Could not open a table');
  }

  function handleJoin(name: string, code: string) {
    storeName(name);
    takeSeat('room:join', { name, roomCode: code }, 'Could not join that table');
  }

  const connected = useMemo(
    () => new Set((room?.players ?? []).filter((p) => p.connected).map((p) => p.id)),
    [room],
  );

  // Picked once per finish, so it does not reshuffle underneath the player as rematch votes come in.
  const finished = view?.finished ?? false;
  const youWon = !!view && finished && view.winners.includes(view.you.id);
  const finishLine = useMemo(
    () => (finished ? pickHostLine(youWon ? 'youWon' : 'youLost') : ''),
    [finished, youWon],
  );

  if (phase === 'lobby') {
    return (
      <div className="bluff">
        <BluffLobby
          onCreate={handleCreate}
          onJoin={handleJoin}
          onExit={onExit}
          error={error}
          busy={busy}
        />
      </div>
    );
  }

  if (phase === 'rejoining') {
    return (
      <div className="bluff">
        <div className="bluff-lobby bluff-waiting">
          <h2 className="bluff-lobby__title">Sitting back down…</h2>
          <p className="bluff-lobby__tagline">Finding your seat. The server may take a moment to wake.</p>
          <button type="button" className="bluff-secondary" onClick={() => leaveTable(null)}>
            Back to the lobby
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'waiting' || !view) {
    return (
      <div className="bluff">
        <BluffWaiting
          code={roomCode}
          config={room?.config ?? { playerCount: 4, deckCount: 1, composition: 'standard', turnSeconds: 20 }}
          players={room?.players ?? []}
          onLeave={() => leaveTable(null)}
        />
      </div>
    );
  }

  const votes = room?.rematchVotes ?? [];

  return (
    <div className="bluff bluff--table">
      <div className="bluff__bar">
        <button type="button" className="portal-back" onClick={() => leaveTable(null)}>
          ← Leave
        </button>
        <span className="bluff__code">{roomCode}</span>
        {!online && <span className="bluff__offline">Reconnecting…</span>}
      </div>

      <Host line={hostLine} onDismiss={() => setHostLine(null)} />

      {error && (
        <p className="bluff-error bluff-error--tap" onClick={() => setError(null)}>
          {error}
        </p>
      )}

      <Arena
        view={view}
        connected={connected}
        flight={flight}
        reveal={reveal}
        play={
          view.isYourTurn
            ? {
                count: selection.selected.length,
                label:
                  selection.selected.length === 0
                    ? 'Pick cards to play'
                    : `Play ${describeClaim(selection.rank, selection.selected.length)}`,
                disabled: selection.selected.length === 0 || busy,
                onPlay: () =>
                  send(
                    'game:play',
                    {
                      cards: selection.selected.map((i) => view.you.hand[i]),
                      rank: selection.rank,
                    },
                    'That play was refused',
                  ),
              }
            : null
        }
      />

      <Tray
        view={view}
        selection={selection}
        busy={busy}
        onPass={() => send('game:pass', {}, 'Could not pass')}
        onChallenge={() => send('game:challenge', {}, 'Could not call that')}
        onMeterInfo={() => setHostLine(pickHostLine('meterActive'))}
      />

      {view.finished && (
        <Finish
          view={view}
          line={finishLine}
          caseCode={roomCode}
          votes={votes.length}
          needed={room?.players.length ?? votes.length + 1}
          youVoted={votes.includes(playerId)}
          onRematch={() => send('game:rematch', {}, 'Could not ask for another')}
          onLeave={() => leaveTable(null)}
        />
      )}

      <p className="bluff__footnote">
        First {winnersNeeded(view.config.playerCount)} home{' '}
        {winnersNeeded(view.config.playerCount) === 1 ? 'wins' : 'win'} · {view.burned} cards burned
      </p>
    </div>
  );
}
