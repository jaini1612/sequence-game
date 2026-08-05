import { GameState } from '@sequence/shared';
import { generateRoomCode } from './roomCode.js';

export interface RoomPlayer {
  id: string;
  name: string;
  socketId: string;
  connected: boolean;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  code: string;
  status: RoomStatus;
  players: RoomPlayer[];
  game: GameState | null;
}

const MAX_PLAYERS = 2;

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(hostName: string, playerId: string, socketId: string): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();

    const room: Room = {
      code,
      status: 'waiting',
      players: [{ id: playerId, name: hostName, socketId, connected: true }],
      game: null,
    };
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, name: string, playerId: string, socketId: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('Room not found');
    if (room.status !== 'waiting') throw new Error('Room is not accepting new players');
    if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full');

    room.players.push({ id: playerId, name, socketId, connected: true });
    return room;
  }

  /**
   * Re-attaches a reconnected socket (which gets a new socket.id every time it reconnects) to
   * its existing player record, identified by the persistent playerId instead of the socket.id.
   */
  rejoinRoom(code: string, playerId: string, socketId: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('Room not found');
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error('Player not in this room');

    player.socketId = socketId;
    player.connected = true;
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomBySocketId(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId)) return room;
    }
    return undefined;
  }

  removeRoom(code: string): void {
    this.rooms.delete(code);
  }
}
