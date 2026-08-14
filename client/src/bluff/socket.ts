import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

/**
 * Bluff talks on its own namespace. Sequence's socket is a separate connection with separate event
 * names, so neither game can ever hear the other's traffic.
 *
 * autoConnect is off because this module is only imported once the player has actually chosen Bluff
 * - and the portal should not open a socket for a game nobody is playing.
 */
export const bluffSocket = io(`${SERVER_URL}/bluff`, { autoConnect: true });
