import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

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
 * listener registers too late to ever hear it. Worse, socket.io does not retry that particular
 * failure - there is no second chance to catch. Without this the screen just says "connecting"
 * forever, which is the least useful thing it could say.
 */
let lastConnectError: string | null = null;
bluffSocket.on('connect_error', (err: Error) => {
  lastConnectError = err.message;
});
bluffSocket.on('connect', () => {
  lastConnectError = null;
});

export function getConnectError(): string | null {
  return lastConnectError;
}
