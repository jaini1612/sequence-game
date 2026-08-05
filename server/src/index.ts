import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { createGame, discardDeadCard, playCard, toPlayerView } from '@sequence/shared';
import { Room, RoomManager } from './rooms.js';

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });

const rooms = new RoomManager();

function broadcastRoom(room: Room): void {
  const payload = {
    code: room.code,
    status: room.status,
    players: room.players.map((p) => ({ name: p.name, connected: p.connected })),
  };
  for (const player of room.players) {
    io.to(player.socketId).emit('room:update', payload);
  }
}

function broadcastGame(room: Room): void {
  if (!room.game) return;
  for (const player of room.players) {
    io.to(player.socketId).emit('game:update', toPlayerView(room.game, player.id));
  }
}

function startGameIfReady(room: Room): void {
  if (room.players.length === 2 && room.status === 'waiting') {
    room.status = 'playing';
    room.game = createGame([room.players[0].id, room.players[1].id]);
    broadcastRoom(room);
    broadcastGame(room);
  }
}

io.on('connection', (socket: Socket) => {
  socket.on('room:create', (data: { name: string; playerId?: string }, ack: (res: any) => void) => {
    try {
      const name = (data?.name || 'Player 1').slice(0, 20);
      const playerId = data?.playerId || socket.id;
      const room = rooms.createRoom(name, playerId, socket.id);
      socket.join(room.code);
      ack({ ok: true, roomCode: room.code, playerId });
      broadcastRoom(room);
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
    }
  });

  socket.on(
    'room:join',
    (data: { roomCode: string; name: string; playerId?: string }, ack: (res: any) => void) => {
      try {
        const name = (data?.name || 'Player 2').slice(0, 20);
        const playerId = data?.playerId || socket.id;
        const room = rooms.joinRoom(data.roomCode, name, playerId, socket.id);
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

  socket.on('disconnect', () => {
    const room = rooms.getRoomBySocketId(socket.id);
    if (!room) return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (player) player.connected = false;
    if (room.status === 'waiting') {
      rooms.removeRoom(room.code);
      return;
    }
    broadcastRoom(room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Sequence server listening on http://localhost:${PORT}`);
});
