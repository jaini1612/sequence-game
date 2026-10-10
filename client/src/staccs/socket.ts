import { io } from 'socket.io-client';

/**
 * Staccs talks on its own namespace, like Bluff. Trailing slashes are stripped first: a server URL of
 * `https://host/` plus `/staccs` would otherwise name a namespace of `//staccs` that does not exist.
 */
const SERVER_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:3001').replace(/\/+$/, '');

export const SERVER_ORIGIN = SERVER_URL;

/** Connects on import, which only happens once Staccs has been chosen in the portal. */
export const staccsSocket = io(`${SERVER_URL}/staccs`, { autoConnect: true });

/**
 * Recorded from the moment the socket exists: a refused namespace fails once, before React has
 * mounted anything to hear it.
 */
let lastConnectError: string | null = null;

export function getConnectError(): string | null {
  return lastConnectError;
}

/**
 * socket.io gives up for good when the server turns it away (usually a restart into a new build), so
 * that case is retried here with a backoff.
 */
const RETRY_CEILING_MS = 20_000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;

function scheduleRetry(): void {
  if (retryTimer) return;
  const delay = Math.min(RETRY_CEILING_MS, 1000 * 2 ** attempt++);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    staccsSocket.connect();
  }, delay);
}

export function retryConnection(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  attempt = 0;
  staccsSocket.connect();
}

staccsSocket.on('connect_error', (err: Error) => {
  lastConnectError = err.message;
  if (!staccsSocket.active) scheduleRetry();
});

staccsSocket.on('connect', () => {
  lastConnectError = null;
  attempt = 0;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
});
