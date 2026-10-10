import type { Namespace, Socket } from 'socket.io';
import { applyAction, createGame, toStaccsView, type StaccsAction } from '@staccs/shared';
import { StaccsRoomManager, cleanName, validateConfig, type StaccsRoom } from './rooms.js';

/**
 * Everything Staccs needs from the socket layer, mounted on its own namespace so it shares no event
 * names, no room book and no timers with the other games.
 *
 * Every move goes through one `game:action` event and the engine decides whether it is legal, so the
 * server never has to know the rules.
 */

type Ack = (res: unknown) => void;

export function registerStaccsGateway(nsp: Namespace): void {
  const rooms = new StaccsRoomManager();

  function roomPayload(room: StaccsRoom) {
    return {
      code: room.code,
      status: room.status,
      config: room.config,
      players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
      rematchVotes: room.rematchVotes,
    };
  }

  function broadcastRoom(room: StaccsRoom): void {
    const payload = roomPayload(room);
    for (const player of room.players) nsp.to(player.socketId).emit('room:update', payload);
  }

  function broadcastGame(room: StaccsRoom): void {
    if (!room.game) return;
    if (room.game.finished) room.status = 'finished';
    for (const player of room.players) {
      nsp.to(player.socketId).emit('game:update', toStaccsView(room.game, player.id));
    }
  }

  function deal(room: StaccsRoom): void {
    room.status = 'playing';
    room.rematchVotes = [];
    room.game = createGame(
      room.players.map((p) => ({ id: p.id, name: p.name })),
      room.config,
      { startSeat: room.gamesPlayed },
    );
    room.gamesPlayed++;
    broadcastRoom(room);
    broadcastGame(room);
  }

  function startGameIfReady(room: StaccsRoom): void {
    if (room.status === 'waiting' && room.players.length === room.config.playerCount) deal(room);
  }

  nsp.on('connection', (socket: Socket) => {
    /**
     * Registers an event whose acknowledgement is always safe to call. A client can emit without a
     * callback; calling a missing ack would throw outside any handler and kill the whole server, so
     * every reply goes through here and every error becomes a refusal.
     */
    function on(event: string, handler: (data: any, reply: Ack) => void): void {
      socket.on(event, (data: unknown, ack: unknown) => {
        const reply: Ack = typeof ack === 'function' ? (ack as Ack) : () => {};
        try {
          handler(data ?? {}, reply);
        } catch (err) {
          reply({ ok: false, error: (err as Error).message });
        }
      });
    }

    /** The seat behind this socket. Matched on socket id, which only the server ever hands out. */
    function seatOf(roomCode: unknown) {
      const room = rooms.getRoom(String(roomCode ?? ''));
      if (!room) throw new Error('Game not found');
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) throw new Error('You are not at this table');
      return { room, player };
    }

    on('room:create', (data, reply) => {
      const name = cleanName(data.name);
      const config = validateConfig(data.config);
      const room = rooms.createRoom(name, String(data.playerId || socket.id), socket.id, config);
      reply({ ok: true, roomCode: room.code });
      broadcastRoom(room);
      // A one-player table is ready the moment it is opened.
      startGameIfReady(room);
    });

    on('room:info', (data, reply) => {
      const room = rooms.getRoom(String(data.roomCode ?? ''));
      if (!room) return reply({ ok: false, error: 'Room not found' });
      if (room.status !== 'waiting') return reply({ ok: false, error: 'That game has already started' });
      if (room.players.length >= room.config.playerCount) return reply({ ok: false, error: 'That table is full' });
      reply({ ok: true, room: roomPayload(room) });
    });

    on('room:join', (data, reply) => {
      const name = cleanName(data.name);
      const room = rooms.joinRoom(String(data.roomCode ?? ''), name, String(data.playerId || socket.id), socket.id);
      reply({ ok: true, roomCode: room.code });
      broadcastRoom(room);
      startGameIfReady(room);
    });

    // Every reconnect brings a new socket.id, so a refreshed tab reclaims its seat with its secret.
    on('room:rejoin', (data, reply) => {
      const { room, player } = rooms.rejoinRoom(String(data.roomCode ?? ''), String(data.playerId ?? ''), socket.id);
      reply({ ok: true, roomCode: room.code });
      broadcastRoom(room);
      if (room.game) nsp.to(socket.id).emit('game:update', toStaccsView(room.game, player.id));
    });

    on('game:action', (data, reply) => {
      const { room, player } = seatOf(data.roomCode);
      if (!room.game) throw new Error('Game not found');
      room.game = applyAction(room.game, player.id, data.action as StaccsAction);
      reply({ ok: true });
      broadcastGame(room);
    });

    on('game:rematch', (data, reply) => {
      const { room, player } = seatOf(data.roomCode);
      const { ready } = rooms.voteRematch(room.code, player.id);
      reply({ ok: true });
      if (ready) deal(room);
      else broadcastRoom(room);
    });

    socket.on('disconnect', () => {
      const room = rooms.getRoomBySocketId(socket.id);
      if (!room) return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) player.connected = false;
      rooms.scheduleCleanupIfAbandoned(room.code);
      broadcastRoom(room);
    });
  });
}
