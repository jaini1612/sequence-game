const PLAYER_ID_KEY = 'bluff:playerId';
const ROOM_CODE_KEY = 'bluff:roomCode';
const NAME_KEY = 'bluff:name';

/**
 * A stable identity for this tab that survives socket reconnects and reloads.
 *
 * sessionStorage rather than localStorage: localStorage is shared by every tab in a browser, so two
 * tabs would claim the same seat and the table would be unable to tell them apart. Its keys are
 * namespaced under `bluff:` so they can never collide with Sequence's.
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

/** Remembered so a player who comes back for another game does not retype their name. */
export function getStoredName(): string {
  return sessionStorage.getItem(NAME_KEY) ?? '';
}

export function storeName(name: string): void {
  sessionStorage.setItem(NAME_KEY, name);
}
