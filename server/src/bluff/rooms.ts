import {
  DECK_COUNTS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TURN_SECONDS_OPTIONS,
  type BluffConfig,
  type BluffState,
} from '@bluff/shared';
import { generateRoomCode } from '../roomCode.js';

/**
 * Bluff keeps its own room book, entirely separate from Sequence's. The two games share nothing but
 * the room-code alphabet, so a change to one table can never disturb the other.
 */

export interface BluffRoomPlayer {
  id: string;
  name: string;
  socketId: string;
  connected: boolean;
}

export type BluffRoomStatus = 'waiting' | 'playing' | 'finished';

export interface BluffRoom {
  code: string;
  status: BluffRoomStatus;
  config: BluffConfig;
  players: BluffRoomPlayer[];
  game: BluffState | null;
  /** Who has asked for another deal since this game finished. Everyone has to agree. */
  rematchVotes: string[];
}

/** How long a fully-abandoned room is held open so a refresh or network blip can reclaim it. */
const ABANDONED_ROOM_GRACE_MS = 120_000;

const NAME_MAX = 16;

/** Names are compulsory here - a table of "Player 3"s makes calling somebody a liar meaningless. */
export function cleanName(raw: unknown): string {
  const name = String(raw ?? '').trim().slice(0, NAME_MAX);
  if (!name) throw new Error('Enter your name first');
  return name;
}

export function validateConfig(raw: any): BluffConfig {
  const playerCount = Number(raw?.playerCount);
  const deckCount = Number(raw?.deckCount);
  const turnSeconds = Number(raw?.turnSeconds);
  const composition = raw?.composition;

  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`Bluff seats ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  }
  if (!DECK_COUNTS.includes(deckCount as 1 | 2)) throw new Error('Play with one or two decks');
  if (composition !== 'standard' && composition !== 'scrambled') {
    throw new Error('Pick a proper deck or a scrambled one');
  }
  if (!TURN_SECONDS_OPTIONS.includes(turnSeconds)) throw new Error('That turn clock is not on offer');

  return { playerCount, deckCount: deckCount as 1 | 2, composition, turnSeconds };
}

export class BluffRoomManager {
  private rooms = new Map<string, BluffRoom>();
  private cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  createRoom(name: string, playerId: string, socketId: string, config: BluffConfig): BluffRoom {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();

    const room: BluffRoom = {
      code,
      status: 'waiting',
      config,
      players: [{ id: playerId, name, socketId, connected: true }],
      game: null,
      rematchVotes: [],
    };
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, name: string, playerId: string, socketId: string): BluffRoom {
    const room = this.requireRoom(code);
    if (room.status !== 'waiting') throw new Error('That game has already started');
    if (room.players.length >= room.config.playerCount) throw new Error('That table is full');
    // Two seats sharing an identity would leave the engine unable to tell them apart.
    if (room.players.some((p) => p.id === playerId)) {
      throw new Error('You are already at this table in another tab');
    }
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Somebody at this table is already using that name');
    }

    room.players.push({ id: playerId, name, socketId, connected: true });
    return room;
  }

  /** Re-attaches a reconnected socket (new socket.id every time) to its existing seat. */
  rejoinRoom(code: string, playerId: string, socketId: string): BluffRoom {
    const room = this.requireRoom(code);
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error('You are not at this table');

    player.socketId = socketId;
    player.connected = true;
    this.cancelCleanup(room.code);
    return room;
  }

  /** Records a vote for another deal. Nobody is dragged out of the celebration by an itchy finger. */
  voteRematch(code: string, playerId: string): { room: BluffRoom; ready: boolean } {
    const room = this.requireRoom(code);
    if (room.status !== 'finished') throw new Error('That game is not over yet');
    if (!room.players.some((p) => p.id === playerId)) throw new Error('You are not at this table');

    if (!room.rematchVotes.includes(playerId)) room.rematchVotes.push(playerId);
    return { room, ready: room.rematchVotes.length === room.players.length };
  }

  /**
   * Deletes a room only if it is *still* completely abandoned once the grace period elapses. A
   * refresh momentarily disconnects everybody in a one-player room, which must not destroy it.
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

  private requireRoom(code: string): BluffRoom {
    const room = this.rooms.get(String(code ?? '').toUpperCase());
    if (!room) throw new Error('Room not found');
    return room;
  }

  getRoom(code: string): BluffRoom | undefined {
    return this.rooms.get(String(code ?? '').toUpperCase());
  }

  getRoomBySocketId(socketId: string): BluffRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId)) return room;
    }
    return undefined;
  }
}
