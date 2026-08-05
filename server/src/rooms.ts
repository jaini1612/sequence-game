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
/** How long a fully-abandoned room is held open so a refresh or network blip can reclaim it. */
const ABANDONED_ROOM_GRACE_MS = 120_000;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
    // Seating the same identity twice would leave the game unable to resolve an opponent, so
    // reject it loudly rather than creating a room that can never start.
    if (room.players.some((p) => p.id === playerId)) {
      throw new Error('You are already in this room in another tab');
    }

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
    this.cancelCleanup(room.code);
    return room;
  }

  /**
   * Marks a room for deletion only if it is *still* completely abandoned once a grace period
   * elapses. A refresh momentarily disconnects every player in a one-player room, and that must
   * not destroy the room before the player's socket comes back.
   */
  scheduleCleanupIfAbandoned(code: string): void {
    const key = code.toUpperCase();
    const room = this.rooms.get(key);
    if (!room || room.players.some((p) => p.connected)) return;

    this.cancelCleanup(key);
    const timer = setTimeout(() => {
      this.cleanupTimers.delete(key);
      const current = this.rooms.get(key);
      if (current && current.players.every((p) => !p.connected)) this.rooms.delete(key);
    }, ABANDONED_ROOM_GRACE_MS);
    timer.unref?.();
    this.cleanupTimers.set(key, timer);
  }

  private cancelCleanup(code: string): void {
    const key = code.toUpperCase();
    const timer = this.cleanupTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(key);
    }
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

}
