const STORAGE_KEY = 'sequence:playerId';

/** A stable identity for this browser that survives socket reconnects and page reloads. */
export function getPlayerId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
