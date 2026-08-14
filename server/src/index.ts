import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import {
  createGame,
  discardDeadCard,
  drawCard,
  playCard,
  resolveExpiredDraws,
  toPlayerView,
  type PlayerColor,
} from '@sequence/shared';
import { Room, RoomManager } from './rooms.js';
import { registerBluffGateway } from './bluff/gateway.js';

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });

const rooms = new RoomManager();

// Bluff lives on its own namespace with its own rooms, events and timers. Sequence below is
// untouched by it, and the two games can only ever talk past each other.
registerBluffGateway(io.of('/bluff'));

function roomPayload(room: Room) {
  return {
    code: room.code,
    status: room.status,
    teams: room.teams,
    size: room.size,
    players: room.players.map((p) => ({ name: p.name, color: p.color, connected: p.connected })),
    availableColors: rooms.availableColors(room),
    rematchVotes: room.rematchVotes,
  };
}

function broadcastRoom(room: Room): void {
  const payload = roomPayload(room);
  for (const player of room.players) {
    io.to(player.socketId).emit('room:update', payload);
  }
}

/**
 * Fires when the player at the head of the draw queue runs out of grace, so a missed card is lost
 * even though nobody did anything to trigger it. Without this the pile would stay locked behind a
 * debtor who has simply walked away.
 */
const drawTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleDrawDeadline(room: Room): void {
  const running = drawTimers.get(room.code);
  if (running) {
    clearTimeout(running);
    drawTimers.delete(room.code);
  }

  const head = room.game?.drawQueue[0];
  if (!head || head.deadlineAt === null) return;

  // A cushion past the deadline, because a card is only forfeit once the moment has actually
  // passed - firing exactly on it would find nothing to do and reschedule in a tight loop.
  const delay = Math.max(0, head.deadlineAt - Date.now()) + 25;
  const timer = setTimeout(() => {
    drawTimers.delete(room.code);
    if (!room.game) return;
    if (resolveExpiredDraws(room.game, Date.now()).length > 0) broadcastGame(room);
    else scheduleDrawDeadline(room);
  }, delay);
  timer.unref?.();
  drawTimers.set(room.code, timer);
}

function broadcastGame(room: Room): void {
  if (!room.game) return;
  // Settle lapsed debts first, so no client is ever shown a card it can no longer take.
  resolveExpiredDraws(room.game, Date.now());
  for (const player of room.players) {
    io.to(player.socketId).emit('game:update', toPlayerView(room.game, player.id));
  }
  scheduleDrawDeadline(room);
}

function startGameIfReady(room: Room): void {
  if (room.players.length === room.size && room.status === 'waiting') {
    room.status = 'playing';
    room.game = createGame(room.players.map((p) => ({ id: p.id, color: p.color })));
    broadcastRoom(room);
    broadcastGame(room);
  }
}

io.on('connection', (socket: Socket) => {
  socket.on(
    'room:create',
    (
      data: { name: string; playerId?: string; teams: number; size: number; color: PlayerColor },
      ack: (res: any) => void,
    ) => {
      try {
        const name = (data?.name || 'Player 1').slice(0, 20);
        const playerId = data?.playerId || socket.id;
        const room = rooms.createRoom(name, playerId, socket.id, {
          teams: data.teams,
          size: data.size,
          color: data.color,
        });
        socket.join(room.code);
        ack({ ok: true, roomCode: room.code, playerId });
        broadcastRoom(room);
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    },
  );

  // Lets someone with a room code see the game's size and which colours are still free, so they
  // can pick one before committing to a seat.
  socket.on('room:info', (data: { roomCode: string }, ack: (res: any) => void) => {
    const room = rooms.getRoom(data?.roomCode ?? '');
    if (!room) return ack({ ok: false, error: 'Room not found' });
    if (room.status !== 'waiting') return ack({ ok: false, error: 'That game has already started' });
    if (room.players.length >= room.size) return ack({ ok: false, error: 'Room is full' });
    ack({ ok: true, room: roomPayload(room) });
  });

  socket.on(
    'room:join',
    (
      data: { roomCode: string; name: string; playerId?: string; color: PlayerColor },
      ack: (res: any) => void,
    ) => {
      try {
        const name = (data?.name || 'Player 2').slice(0, 20);
        const playerId = data?.playerId || socket.id;
        const room = rooms.joinRoom(data.roomCode, name, playerId, socket.id, data.color);
        socket.join(room.code);
        ack({ ok: true, roomCode: room.code, playerId });
        broadcastRoom(room);
        startGameIfReady(room);
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    },
  );

  // Re-attaches a reconnected socket (new socket.id) to its existing player record, so a dropped
  // and restored connection (backgrounded phone, network switch, server restart) doesn't lock the
  // player out of their own turn with a spurious "Not your turn".
  socket.on(
    'room:rejoin',
    (data: { roomCode: string; playerId: string }, ack: (res: any) => void) => {
      try {
        const room = rooms.rejoinRoom(data.roomCode, data.playerId, socket.id);
        socket.join(room.code);
        ack({ ok: true, roomCode: room.code, playerId: data.playerId });
        broadcastRoom(room);
        if (room.game) broadcastGame(room);
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    },
  );

  socket.on(
    'game:playCard',
    (data: { roomCode: string; card: string; position: { row: number; col: number } }, ack: (res: any) => void) => {
      const room = rooms.getRoom(data?.roomCode ?? '');
      if (!room || !room.game) return ack({ ok: false, error: 'Game not found' });
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) return ack({ ok: false, error: 'Not part of this room' });
      try {
        playCard(room.game, player.id, data.card, data.position);
        ack({ ok: true });
        broadcastGame(room);
        if (room.game.winnerId) room.status = 'finished';
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    },
  );

  socket.on('game:draw', (data: { roomCode: string }, ack: (res: any) => void) => {
    const room = rooms.getRoom(data?.roomCode ?? '');
    if (!room || !room.game) return ack({ ok: false, error: 'Game not found' });
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return ack({ ok: false, error: 'Not part of this room' });
    try {
      drawCard(room.game, player.id, Date.now());
      ack({ ok: true });
      broadcastGame(room);
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
      // The attempt may have failed because a debt lapsed, which everyone needs to see.
      broadcastGame(room);
    }
  });

  socket.on(
    'game:discardDeadCard',
    (data: { roomCode: string; card: string }, ack: (res: any) => void) => {
      const room = rooms.getRoom(data?.roomCode ?? '');
      if (!room || !room.game) return ack({ ok: false, error: 'Game not found' });
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) return ack({ ok: false, error: 'Not part of this room' });
      try {
        discardDeadCard(room.game, player.id, data.card);
        ack({ ok: true });
        broadcastGame(room);
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    },
  );

  // Another deal with the same seats and colours. It takes every player asking, and the vote count
  // rides along in the room payload so everyone can see who is still admiring the board.
  socket.on('game:rematch', (data: { roomCode: string }, ack: (res: any) => void) => {
    const room = rooms.getRoom(data?.roomCode ?? '');
    if (!room) return ack({ ok: false, error: 'Game not found' });
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return ack({ ok: false, error: 'Not part of this room' });
    try {
      const { ready } = rooms.voteRematch(room.code, player.id);
      ack({ ok: true });
      if (!ready) return broadcastRoom(room);

      room.rematchVotes = [];
      room.status = 'playing';
      room.game = createGame(room.players.map((p) => ({ id: p.id, color: p.color })));
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
    // A refresh or a phone dropping its WebSocket leaves the player disconnected but still
    // seated, so never destroy the room (or the game) here - only mark a fully abandoned one
    // for delayed cleanup, which a reconnect cancels.
    rooms.scheduleCleanupIfAbandoned(room.code);
    broadcastRoom(room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Sequence server listening on http://localhost:${PORT}`);
});
