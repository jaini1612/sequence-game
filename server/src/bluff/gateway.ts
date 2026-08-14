import type { Namespace, Socket } from 'socket.io';
import {
  applyTimeout,
  challenge,
  createGame,
  letGo,
  pass,
  playCards,
  toBluffView,
  type CardCode,
  type Rank,
} from '@bluff/shared';
import { BluffRoomManager, cleanName, validateConfig, type BluffRoom } from './rooms.js';

/**
 * Everything Bluff needs from the socket layer, mounted on its own namespace so it shares no event
 * names, no room book and no timers with Sequence.
 */

type Ack = (res: any) => void;

export function registerBluffGateway(nsp: Namespace): void {
  const rooms = new BluffRoomManager();

  /**
   * One clock per room. It fires when the player on the spot has run out of time, passing their turn
   * for them so an abandoned seat can never freeze the table.
   */
  const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function roomPayload(room: BluffRoom) {
    return {
      code: room.code,
      status: room.status,
      config: room.config,
      players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
      rematchVotes: room.rematchVotes,
    };
  }

  function broadcastRoom(room: BluffRoom): void {
    const payload = roomPayload(room);
    for (const player of room.players) nsp.to(player.socketId).emit('room:update', payload);
  }

  function broadcastGame(room: BluffRoom): void {
    if (!room.game) return;
    if (room.game.finished) room.status = 'finished';
    for (const player of room.players) {
      nsp.to(player.socketId).emit('game:update', toBluffView(room.game, player.id));
    }
    scheduleTurnDeadline(room);
  }

  function scheduleTurnDeadline(room: BluffRoom): void {
    const running = turnTimers.get(room.code);
    if (running) {
      clearTimeout(running);
      turnTimers.delete(room.code);
    }
    if (!room.game || room.game.finished) return;

    // A small cushion past the deadline: firing exactly on it would find the turn not yet expired
    // and reschedule in a tight loop.
    const delay = Math.max(0, room.game.turnEndsAt - Date.now()) + 50;
    const timer = setTimeout(() => {
      turnTimers.delete(room.code);
      if (!room.game) return;
      if (applyTimeout(room.game, Date.now())) broadcastGame(room);
      else scheduleTurnDeadline(room);
    }, delay);
    timer.unref?.();
    turnTimers.set(room.code, timer);
  }

  function startGameIfReady(room: BluffRoom): void {
    if (room.status !== 'waiting' || room.players.length !== room.config.playerCount) return;
    room.status = 'playing';
    room.game = createGame(
      room.players.map((p) => ({ id: p.id, name: p.name })),
      room.config,
      Date.now(),
    );
    broadcastRoom(room);
    broadcastGame(room);
  }

  /** Resolves the room and the seat behind a socket, or explains why it cannot. */
  function seatOf(socket: Socket, roomCode: string) {
    const room = rooms.getRoom(roomCode);
    if (!room || !room.game) throw new Error('Game not found');
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) throw new Error('You are not at this table');
    return { room, player };
  }

  /** Every in-game action follows the same shape: mutate, acknowledge, broadcast. */
  function action(socket: Socket, roomCode: string, ack: Ack, apply: (room: BluffRoom, playerId: string) => void) {
    try {
      const { room, player } = seatOf(socket, roomCode);
      apply(room, player.id);
      ack({ ok: true });
      broadcastGame(room);
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
    }
  }

  nsp.on('connection', (socket: Socket) => {
    socket.on('room:create', (data: any, ack: Ack) => {
      try {
        const name = cleanName(data?.name);
        const config = validateConfig(data?.config);
        const playerId = data?.playerId || socket.id;
        const room = rooms.createRoom(name, playerId, socket.id, config);
        ack({ ok: true, roomCode: room.code, playerId });
        broadcastRoom(room);
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    });

    // Lets somebody with a code see the table before they sit down at it.
    socket.on('room:info', (data: any, ack: Ack) => {
      const room = rooms.getRoom(data?.roomCode);
      if (!room) return ack({ ok: false, error: 'Room not found' });
      if (room.status !== 'waiting') return ack({ ok: false, error: 'That game has already started' });
      if (room.players.length >= room.config.playerCount) {
        return ack({ ok: false, error: 'That table is full' });
      }
      ack({ ok: true, room: roomPayload(room) });
    });

    socket.on('room:join', (data: any, ack: Ack) => {
      try {
        const name = cleanName(data?.name);
        const playerId = data?.playerId || socket.id;
        const room = rooms.joinRoom(data?.roomCode, name, playerId, socket.id);
        ack({ ok: true, roomCode: room.code, playerId });
        broadcastRoom(room);
        startGameIfReady(room);
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    });

    // Every reconnect brings a new socket.id, so a refreshed tab has to be tied back to its seat.
    socket.on('room:rejoin', (data: any, ack: Ack) => {
      try {
        const room = rooms.rejoinRoom(data?.roomCode, data?.playerId, socket.id);
        ack({ ok: true, roomCode: room.code, playerId: data.playerId });
        broadcastRoom(room);
        if (room.game) {
          nsp.to(socket.id).emit('game:update', toBluffView(room.game, data.playerId));
        }
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    });

    socket.on('game:play', (data: any, ack: Ack) => {
      action(socket, data?.roomCode, ack, (room, playerId) => {
        const cards: CardCode[] = Array.isArray(data?.cards) ? data.cards.map(String) : [];
        playCards(room.game!, playerId, cards, String(data?.rank) as Rank, Date.now());
      });
    });

    socket.on('game:pass', (data: any, ack: Ack) => {
      action(socket, data?.roomCode, ack, (room, playerId) => {
        pass(room.game!, playerId, Date.now());
      });
    });

    socket.on('game:challenge', (data: any, ack: Ack) => {
      action(socket, data?.roomCode, ack, (room, playerId) => {
        challenge(room.game!, playerId, Date.now());
      });
    });

    // Waving through the claim that closed a round, rather than checking it.
    socket.on('game:letgo', (data: any, ack: Ack) => {
      action(socket, data?.roomCode, ack, (room, playerId) => {
        letGo(room.game!, playerId, Date.now());
      });
    });

    // Another deal with the same seats. It takes the whole table asking, and the vote count rides
    // along in the room payload so everyone can see who is still staring at the wreckage.
    socket.on('game:rematch', (data: any, ack: Ack) => {
      try {
        const room = rooms.getRoom(data?.roomCode);
        if (!room) throw new Error('Game not found');
        const player = room.players.find((p) => p.socketId === socket.id);
        if (!player) throw new Error('You are not at this table');

        const { ready } = rooms.voteRematch(room.code, player.id);
        ack({ ok: true });
        if (!ready) return broadcastRoom(room);

        room.rematchVotes = [];
        room.status = 'playing';
        room.game = createGame(
          room.players.map((p) => ({ id: p.id, name: p.name })),
          room.config,
          Date.now(),
        );
        broadcastRoom(room);
        broadcastGame(room);
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    });

    socket.on('disconnect', () => {
      const room = rooms.getRoomBySocketId(socket.id);
      if (!room) return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) player.connected = false;
      // A refresh drops the socket but not the seat, so the room is only ever marked for delayed
      // cleanup - which a reconnect cancels.
      rooms.scheduleCleanupIfAbandoned(room.code);
      broadcastRoom(room);
    });
  });
}
