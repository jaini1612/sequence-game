import type { Board, Card, Rank, StaccsEvent, StaccsPlayer, StaccsState } from './types.js';

/**
 * Small helpers shared by every mode. Actions work on a private copy of the state (see cloneState),
 * so the mutation in here never leaks to the caller's object.
 */

/** The state is plain data, so a JSON round trip is a complete, independent copy. */
export function cloneState(state: StaccsState): StaccsState {
  return JSON.parse(JSON.stringify(state)) as StaccsState;
}

export function pushEvent(state: StaccsState, event: StaccsEvent): void {
  state.events.push(event);
}

export function playerById(state: StaccsState, id: string): StaccsPlayer {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error('You are not at this table');
  return player;
}

export function currentPlayer(state: StaccsState): StaccsPlayer {
  return state.players[state.currentSeat];
}

/** The seat after `from`, following the direction of play. */
export function nextSeat(state: StaccsState, from: number = state.currentSeat): number {
  const n = state.players.length;
  return (((from + state.direction) % n) + n) % n;
}

export function takeFromHand(player: StaccsPlayer, cardId: string): Card {
  const index = player.hand.findIndex((c) => c.id === cardId);
  if (index < 0) throw new Error("That card isn't in your hand");
  const [card] = player.hand.splice(index, 1);
  return card;
}

/** Draws up to `count` cards off the top of the pile. Returns how many there actually were. */
export function drawInto(state: StaccsState, player: StaccsPlayer, count: number): number {
  let drawn = 0;
  while (drawn < count && state.drawPile.length > 0) {
    player.hand.push(state.drawPile.pop()!);
    drawn++;
  }
  return drawn;
}

export function finish(
  state: StaccsState,
  winnerIds: string[],
  reason: Extract<StaccsEvent, { type: 'finished' }>['reason'],
): void {
  state.finished = true;
  state.phase = 'finished';
  state.winners = winnerIds;
  state.attacc = null;
  state.multiRank = null;
  pushEvent(state, { type: 'finished', winnerIds, reason });
}

export function ranksOnBoard(board: Board): Rank[] {
  return [...new Set(board.placed.map((p) => p.card.rank))];
}
