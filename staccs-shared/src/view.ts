import type {
  Attacc,
  Board,
  Card,
  Phase,
  Rank,
  StaccsConfig,
  StaccsEvent,
  StaccsPlayer,
  StaccsState,
} from './types.js';

/** Everything public about a seat. Hands are counted, never shown. */
export interface StaccsSeat {
  id: string;
  name: string;
  seat: number;
  handCount: number;
  saidUhOh: boolean;
  exposed: boolean;
}

/** What one player is allowed to see: the whole table, their own hand, and nobody else's. */
export interface StaccsView {
  config: StaccsConfig;
  you: StaccsPlayer;
  /** Every seat in seat order, you included. */
  seats: StaccsSeat[];
  drawCount: number;
  discardTop: Card | null;
  discardCount: number;
  board: Board;
  totalCards: number;
  currentSeat: number;
  direction: 1 | -1;
  phase: Phase;
  attacc: Attacc | null;
  blockedTops: number[];
  multiRank: Rank | null;
  recycled: boolean;
  isYourTurn: boolean;
  /** How many cards you owe the player you hit with a Queen, when it is time to hand them over. */
  youGive: number;
  winners: string[];
  finished: boolean;
  events: StaccsEvent[];
  eventSeq: number;
}

export function toStaccsView(state: StaccsState, playerId: string): StaccsView {
  const you = state.players.find((p) => p.id === playerId);
  if (!you) throw new Error('You are not at this table');

  const giving = state.phase === 'give' && state.attacc?.fromId === you.id;
  return {
    config: state.config,
    you,
    seats: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      handCount: p.hand.length,
      saidUhOh: p.saidUhOh,
      exposed: p.exposed,
    })),
    drawCount: state.drawPile.length,
    discardTop: state.discard[state.discard.length - 1] ?? null,
    discardCount: state.discard.length,
    board: state.board,
    totalCards: state.totalCards,
    currentSeat: state.currentSeat,
    direction: state.direction,
    phase: state.phase,
    attacc: state.attacc,
    blockedTops: state.blockedTops,
    multiRank: state.multiRank,
    recycled: state.recycled,
    isYourTurn: !state.finished && state.players[state.currentSeat].id === you.id,
    youGive: giving ? Math.min(state.attacc!.count, you.hand.length) : 0,
    winners: state.winners,
    finished: state.finished,
    events: state.events,
    eventSeq: state.eventSeq,
  };
}
