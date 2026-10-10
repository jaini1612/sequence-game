const PLAYER_ID_KEY = 'staccs:playerId';
const ROOM_CODE_KEY = 'staccs:roomCode';
const NAME_KEY = 'staccs:name';

/**
 * A stable identity for this tab that survives reconnects and reloads. sessionStorage, so two tabs
 * are two players; namespaced under `staccs:` so it never collides with the other games.
 */
export function getPlayerId(): string {
  let id = sessionStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getStoredRoomCode(): string {
  return sessionStorage.getItem(ROOM_CODE_KEY) ?? '';
}

export function storeRoomCode(code: string): void {
  sessionStorage.setItem(ROOM_CODE_KEY, code);
}

export function clearStoredRoomCode(): void {
  sessionStorage.removeItem(ROOM_CODE_KEY);
}

export function getStoredName(): string {
  return sessionStorage.getItem(NAME_KEY) ?? '';
}

export function storeName(name: string): void {
  sessionStorage.setItem(NAME_KEY, name);
}
