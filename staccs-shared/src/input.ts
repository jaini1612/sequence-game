import { SUITS, type Card, type Placement, type StaccsPlayer, type StaccsState, type Suit } from './types.js';

// Input checks. Actions arrive over the network, so nothing about their shape is taken on trust.

export function readPlacement(raw: unknown): Placement {
  const p = raw as Placement | undefined;
  const ints = [p?.pos?.a, p?.pos?.b, p?.orient, p?.stack];
  if (!p || !ints.every((n) => Number.isInteger(n))) throw new Error('Pick a spot for the card');
  return { pos: { a: p.pos.a, b: p.pos.b }, orient: p.orient, stack: p.stack };
}

export function readSuit(raw: unknown): Suit {
  if (!SUITS.includes(raw as Suit)) throw new Error('Call a suit for the Wild');
  return raw as Suit;
}

export function requireCurrent(state: StaccsState, player: StaccsPlayer): void {
  if (state.players[state.currentSeat].id !== player.id) throw new Error("It's not your turn");
}

export function findInHand(player: StaccsPlayer, cardId: unknown): Card {
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) throw new Error("That card isn't in your hand");
  return card;
}

