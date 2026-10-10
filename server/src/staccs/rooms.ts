import { randomUUID } from 'node:crypto';
import { MODE_NAME, MODE_PLAYERS, MODES, type Mode, type StaccsConfig, type StaccsState } from '@staccs/shared';
import { generateRoomCode } from '../roomCode.js';

/**
 * Staccs keeps its own room book, separate from Sequence's and Bluff's, so a change to one table can
 * never disturb another.
 */

/**
 * Each seat has two identities. `id` is public: the engine, the other players' views and call-outs
 * all use it. `secret` is the browser's own id, known only to that tab, and it is the one thing that
 * can reclaim the seat - otherwise anyone who saw your public id could rejoin as you and read your hand.
 */
export interface StaccsRoomPlayer {
  id: string;
  secret: string;
  name: string;
  socketId: string;
  connected: boolean;
}

export type StaccsRoomStatus = 'waiting' | 'playing' | 'finished';

export interface StaccsRoom {
  code: string;
  status: StaccsRoomStatus;
  config: StaccsConfig;
  players: StaccsRoomPlayer[];
  game: StaccsState | null;
  /** Who has asked for another deal since this game finished. Everyone has to agree. */
  rematchVotes: string[];
  /** Games dealt so far, so each rematch starts with the next player along. */
  gamesPlayed: number;
}

/** How long a fully-abandoned room is held open so a refresh or network blip can reclaim it. */
const ABANDONED_ROOM_GRACE_MS = 120_000;

const NAME_MAX = 16;

export function cleanName(raw: unknown): string {
  const name = String(raw ?? '').trim().slice(0, NAME_MAX);
  if (!name) throw new Error('Enter your name first');
  return name;
}

export function validateConfig(raw: unknown): StaccsConfig {
  const input = (raw ?? {}) as Partial<StaccsConfig>;
  const mode = input.mode as Mode;
  if (!MODES.includes(mode)) throw new Error('Pick a play mode');

  const playerCount = Number(input.playerCount);
  const { min, max } = MODE_PLAYERS[mode];
  if (!Number.isInteger(playerCount) || playerCount < min || playerCount > max) {
    throw new Error(`${MODE_NAME[mode]} is for ${min === max ? min : `${min}-${max}`} player${max === 1 ? '' : 's'}`);
  }

  // The variations belong to SoloStaccs alone.
  const solo = mode === 'solo';
  return { mode, playerCount, noWilds: solo && input.noWilds === true, secondChances: solo && input.secondChances === true };
}

export class StaccsRoomManager {
  private rooms = new Map<string, StaccsRoom>();
  private cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  createRoom(name: string, secret: string, socketId: string, config: StaccsConfig): StaccsRoom {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();

    const room: StaccsRoom = {
      code,
      status: 'waiting',
      config,
      players: [{ id: randomUUID(), secret, name, socketId, connected: true }],
      game: null,
      rematchVotes: [],
      gamesPlayed: 0,
    };
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, name: string, secret: string, socketId: string): StaccsRoom {
    const room = this.requireRoom(code);
    if (room.status !== 'waiting') throw new Error('That game has already started');
    if (room.players.length >= room.config.playerCount) throw new Error('That table is full');
    if (room.players.some((p) => p.secret === secret)) throw new Error('You are already at this table in another tab');
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Somebody at this table is already using that name');
    }

    room.players.push({ id: randomUUID(), secret, name, socketId, connected: true });
    return room;
  }

  /** Re-attaches a reconnected socket (new socket.id every time) to its existing seat. */
  rejoinRoom(code: string, secret: string, socketId: string): { room: StaccsRoom; player: StaccsRoomPlayer } {
    const room = this.requireRoom(code);
    const player = secret ? room.players.find((p) => p.secret === secret) : undefined;
    if (!player) throw new Error('You are not at this table');

    player.socketId = socketId;
    player.connected = true;
    this.cancelCleanup(room.code);
    return { room, player };
  }

  voteRematch(code: string, playerId: string): { room: StaccsRoom; ready: boolean } {
    const room = this.requireRoom(code);
    if (room.status !== 'finished') throw new Error('That game is not over yet');
    if (!room.players.some((p) => p.id === playerId)) throw new Error('You are not at this table');

    if (!room.rematchVotes.includes(playerId)) room.rematchVotes.push(playerId);
    return { room, ready: room.rematchVotes.length === room.players.length };
  }

  /** Deletes a room only if it is *still* completely abandoned once the grace period elapses. */
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

  private requireRoom(code: string): StaccsRoom {
    const room = this.rooms.get(String(code ?? '').toUpperCase());
    if (!room) throw new Error('Room not found');
    return room;
  }

  getRoom(code: string): StaccsRoom | undefined {
    return this.rooms.get(String(code ?? '').toUpperCase());
  }

  getRoomBySocketId(socketId: string): StaccsRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId)) return room;
    }
    return undefined;
  }
}
