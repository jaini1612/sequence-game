import { kindOf } from './geometry.js';
import { findInHand, readPlacement, readSuit } from './input.js';
import { canPlace, evaluatePlacement, placeOnBoard } from './placement.js';
import { drawInto, finish, pushEvent } from './state.js';
import type { Card, StaccsAction, StaccsPlayer, StaccsState } from './types.js';

/**
 * SOLOSTACCS: one player, one STACC, the whole DECC.
 *
 * Draw a card and stacc it. If it won't go anywhere it goes face up on the DISCARD PILE, whose top
 * card can be played at any point instead of drawing. Special cards do nothing here, but Wilds still
 * turn the STACC and lock everything before them. Stacc all of the cards to win.
 */
export function applySolo(state: StaccsState, player: StaccsPlayer, action: StaccsAction): void {
  switch (action.type) {
    case 'draw':
      drawNext(state, player);
      break;
    case 'play':
      playSolo(state, player, action);
      break;
    case 'discard':
      discardDrawn(state, player);
      break;
    case 'recycle':
      recycleDiscards(state);
      break;
    default:
      throw new Error('That is not part of SoloStaccs');
  }
  checkSoloEnd(state, player);
}

function discardTop(state: StaccsState): Card | null {
  return state.discard[state.discard.length - 1] ?? null;
}

function drawNext(state: StaccsState, player: StaccsPlayer): void {
  if (player.hand.length > 0) throw new Error('Play or discard the card you drew first');
  if (drawInto(state, player, 1) === 0) throw new Error('The draw pile is empty');
  pushEvent(state, { type: 'draw', playerId: player.id, count: 1, reason: 'turn' });
}

/** The card in hand, or - only when nothing has been drawn - the top of the discard pile. */
function takeSoloCard(state: StaccsState, player: StaccsPlayer, cardId: unknown): Card {
  if (player.hand.length > 0) {
    const card = findInHand(player, cardId);
    player.hand = player.hand.filter((c) => c.id !== card.id);
    return card;
  }
  const top = discardTop(state);
  if (!top || top.id !== cardId) throw new Error('Draw a card, or play the top of the discard pile');
  state.discard.pop();
  return top;
}

function playSolo(state: StaccsState, player: StaccsPlayer, action: Extract<StaccsAction, { type: 'play' }>): void {
  const placement = readPlacement(action.placement);
  const pending = player.hand[0] ?? discardTop(state);
  if (!pending || pending.id !== action.cardId) throw new Error('That card is not in play');

  const wild = kindOf(pending) === 'wild';
  const calledSuit = wild ? readSuit(action.calledSuit) : null;
  const result = evaluatePlacement(state.board, pending, placement);
  if (!result.ok) throw new Error(result.reason);

  const card = takeSoloCard(state, player, action.cardId);
  state.board = placeOnBoard(state.board, card, placement, calledSuit);
  pushEvent(state, { type: 'play', playerId: player.id, cardId: card.id, seq: state.board.placed.length - 1 });
  if (wild) pushEvent(state, { type: 'wild', playerId: player.id, suit: calledSuit });
}

function discardDrawn(state: StaccsState, player: StaccsPlayer): void {
  const card = player.hand[0];
  if (!card) throw new Error('Draw a card first');
  if (canPlace(state.board, card)) throw new Error('That card staccs somewhere - play it');
  player.hand = [];
  state.discard.push(card);
  pushEvent(state, { type: 'discard', playerId: player.id, cardId: card.id });
}

function canRecycle(state: StaccsState): boolean {
  return (
    state.config.secondChances &&
    !state.recycled &&
    state.drawPile.length === 0 &&
    state.discard.length > 0 &&
    state.players[0].hand.length === 0
  );
}

/** SECOND CHANCES: flip the discard pile over and go through it again. Once. */
function recycleDiscards(state: StaccsState): void {
  if (!canRecycle(state)) throw new Error('You can only flip the discard pile once the draw pile is gone');
  // Turning the pile over puts its bottom card on top, so the order simply reverses.
  state.drawPile = [...state.discard].reverse();
  state.discard = [];
  state.recycled = true;
  pushEvent(state, { type: 'recycle', count: state.drawPile.length });
}

/** The game ends with every card stacced (a win) or with no cards or matches left to make. */
function checkSoloEnd(state: StaccsState, player: StaccsPlayer): void {
  if (state.board.placed.length === state.totalCards) return finish(state, [player.id], 'solo');

  const top = discardTop(state);
  const stuck =
    player.hand.length === 0 &&
    state.drawPile.length === 0 &&
    (!top || !canPlace(state.board, top)) &&
    !canRecycle(state);
  if (stuck) finish(state, [], 'solo');
}
