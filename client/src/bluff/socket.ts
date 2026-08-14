import { io } from 'socket.io-client';

/**
 * Trailing slashes are stripped before anything is appended.
 *
 * This matters far more than it looks. Sequence connects to the origin itself, where a trailing
 * slash is harmless, so an environment variable written `https://host/` works there and nobody ever
 * notices. Bluff appends a namespace, and `https://host/` + `/bluff` is `https://host//bluff` - a
 * namespace of `//bluff`, which the server has never heard of and rejects outright. The result is a
 * deployment where Sequence works perfectly and Bluff cannot connect at all.
 */
const SERVER_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:3001').replace(/\/+$/, '');

/**
 * Where this build was pointed at, for error messages. It is baked in at build time, so a deployed
 * client that was built without VITE_SERVER_URL set will be quietly asking localhost for a game -
 * which is worth being able to see rather than guess at.
 */
export const SERVER_ORIGIN = SERVER_URL;

/**
 * Bluff talks on its own namespace. Sequence's socket is a separate connection with separate event
 * names, so neither game can ever hear the other's traffic.
 *
 * The namespace is a real dependency on the server, not just a label: a server without
 * `io.of('/bluff')` registered refuses the connection outright, and every emit then sits in the
 * queue unanswered. It connects on import, which only happens once Bluff has actually been chosen.
 */
export const bluffSocket = io(`${SERVER_URL}/bluff`, { autoConnect: true });

/**
 * The last reason the connection was refused, recorded from the moment the socket is created.
 *
 * This listener has to live at module scope rather than in the app's effect: connection starts on
 * import and a rejected namespace fails once, well before React has mounted anything, so a component
 * listener registers too late to ever hear it. Without this the screen just says "connecting"
 * forever, which is the least useful thing it could say.
 */
let lastConnectError: string | null = null;

export function getConnectError(): string | null {
  return lastConnectError;
}

/**
 * Keeps trying after a refusal socket.io has given up on.
 *
 * socket.io retries transport failures by itself, but treats being turned away by the server - a
 * rejected namespace, a refused handshake - as final, and stops for good. That is the wrong call
 * here: the commonest cause is the server restarting into a new build, which is temporary and
 * usually over in under a minute. Left alone, a player who opened the game during a deploy stays
 * broken until they think to reload, and nothing on screen suggests they should.
 *
 * `socket.active` is the discriminator: true while socket.io still intends to retry, false once it
 * has washed its hands. We only drive the retry ourselves in the second case.
 */
const RETRY_CEILING_MS = 20_000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;

function scheduleRetry(): void {
  if (retryTimer) return;
  const delay = Math.min(RETRY_CEILING_MS, 1000 * 2 ** attempt++);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    bluffSocket.connect();
  }, delay);
}

/** Try again now, for a player who would rather not wait out the backoff. */
export function retryConnection(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  attempt = 0;
  bluffSocket.connect();
}

bluffSocket.on('connect_error', (err: Error) => {
  lastConnectError = err.message;
  if (!bluffSocket.active) scheduleRetry();
});

bluffSocket.on('connect', () => {
  lastConnectError = null;
  attempt = 0;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
});
