const PLAYER_ID_KEY = 'sequence:playerId';
const ROOM_CODE_KEY = 'sequence:roomCode';

/**
 * A stable identity for this tab that survives socket reconnects and page reloads.
 *
 * Deliberately sessionStorage, not localStorage: localStorage is shared across every tab in a
 * browser, so two tabs would claim the same identity and the server would seat one player twice
 * (leaving the game unable to resolve an opponent). sessionStorage is per-tab and survives
 * refreshes, which is exactly the scope a player seat needs.
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
