import { findInHand, readPlacement, requireCurrent } from './input.js';
import { canPlace, evaluatePlacement, placeOnBoard } from './placement.js';
import { drawInto, finish, nextSeat, pushEvent, takeFromHand } from './state.js';
import type { StaccsAction, StaccsPlayer, StaccsState } from './types.js';

/**
 * WILD OUT: everyone works together on four STACCS growing out of the Wilds in the middle.
 *
 * On your turn you draw a card, then stacc whatever you can on any playable surface of any STACC.
 * Cards that won't match yet stay in your hand until they do. Special cards do nothing. The game ends
 * when there are no cards or matches left - and everybody wins.
 */
export function applyWildOut(state: StaccsState, player: StaccsPlayer, action: StaccsAction): void {
  requireCurrent(state, player);
  switch (action.type) {
    case 'draw':
      drawForTurn(state, player);
      break;
    case 'play':
      playWildOut(state, player, action);
      break;
    case 'endTurn':
      if (state.phase !== 'turn') throw new Error('Draw a card first');
      beginWildOutTurn(state, nextSeat(state));
      break;
    default:
      throw new Error('That is not part of Wild Out');
  }
  checkWildOutEnd(state);
}

function beginWildOutTurn(state: StaccsState, seat: number): void {
  state.currentSeat = seat;
  state.phase = state.drawPile.length > 0 ? 'draw' : 'turn';
}

function drawForTurn(state: StaccsState, player: StaccsPlayer): void {
  if (state.phase !== 'draw') throw new Error('You have already drawn this turn');
  drawInto(state, player, 1);
  pushEvent(state, { type: 'draw', playerId: player.id, count: 1, reason: 'turn' });
  state.phase = 'turn';
}

function playWildOut(state: StaccsState, player: StaccsPlayer, action: Extract<StaccsAction, { type: 'play' }>): void {
  if (state.phase !== 'turn') throw new Error('Draw a card first');
  const card = findInHand(player, action.cardId);
  const placement = readPlacement(action.placement);
  const result = evaluatePlacement(state.board, card, placement);
  if (!result.ok) throw new Error(result.reason);

  takeFromHand(player, card.id);
  state.board = placeOnBoard(state.board, card, placement);
  pushEvent(state, { type: 'play', playerId: player.id, cardId: card.id, seq: state.board.placed.length - 1 });
}

function checkWildOutEnd(state: StaccsState): void {
  if (state.drawPile.length > 0) return;
  const anyMatch = state.players.some((p) => p.hand.some((c) => canPlace(state.board, c)));
  if (!anyMatch) {
    finish(
      state,
      state.players.map((p) => p.id),
      'wildout',
    );
  }
}
