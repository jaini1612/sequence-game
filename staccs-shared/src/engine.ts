import { kindOf } from './geometry.js';
import { canPlace, evaluatePlacement, placeOnBoard } from './placement.js';
import { cardRestriction, isUhOh, type TurnContext } from './rules.js';
import { findInHand, readPlacement, readSuit, requireCurrent } from './input.js';
import { applySolo } from './solo.js';
import {
  cloneState,
  drawInto,
  finish,
  nextSeat,
  playerById,
  pushEvent,
  ranksOnBoard,
  takeFromHand,
} from './state.js';
import {
  ATTACC_STEP,
  type AttaccRank,
  type Card,
  type StaccsAction,
  type StaccsPlayer,
  type StaccsState,
} from './types.js';
import { applyWildOut } from './wildout.js';

/**
 * The rules engine. `applyAction` never touches the state it is given: it works on a copy and hands
 * back the next state, or throws an Error whose message is fit to show the player.
 *
 * This file holds UH OH! (and UH OH! PARTY, which is the same game with two decks). SoloStaccs and
 * Wild Out live in their own files.
 */

const UH_OH_PENALTY = 3;

export function applyAction(state: StaccsState, playerId: string, action: StaccsAction): StaccsState {
  if (state.finished) throw new Error('The game is over');
  if (!action || typeof action !== 'object') throw new Error('Unknown action');

  const draft = cloneState(state);
  draft.events = [];
  const player = playerById(draft, playerId);
  const handsBefore = new Map(draft.players.map((p) => [p.id, p.hand.length]));

  if (isUhOh(draft.config.mode)) {
    applyUhOh(draft, player, action);
    trackUhOh(draft, handsBefore);
  } else if (draft.config.mode === 'solo') {
    applySolo(draft, player, action);
  } else {
    applyWildOut(draft, player, action);
  }

  draft.eventSeq = state.eventSeq + 1;
  return draft;
}

export function turnContext(state: StaccsState, player: StaccsPlayer): TurnContext {
  return {
    mode: state.config.mode,
    phase: state.phase,
    attacc: state.attacc,
    multiRank: state.multiRank,
    handSize: player.hand.length,
  };
}

/** Whether a player could stacc anything at all right now. */
export function hasPlayableCard(state: StaccsState, player: StaccsPlayer): boolean {
  const ctx = turnContext(state, player);
  return player.hand.some((c) => !cardRestriction(ctx, c) && canPlace(state.board, c, state.blockedTops));
}

// ---------------------------------------------------------------------------------------------------
// UH OH!

function applyUhOh(state: StaccsState, player: StaccsPlayer, action: StaccsAction): void {
  switch (action.type) {
    case 'uhOh':
      return declareUhOh(state, player);
    case 'callOut':
      return callOut(state, player, action.targetId);
    case 'give':
      return giveCards(state, player, action.cardIds);
  }

  requireCurrent(state, player);
  switch (action.type) {
    case 'play':
      return playUhOh(state, player, action);
    case 'draw':
      return drawWhenStuck(state, player);
    case 'endTurn':
      if (state.phase !== 'turn' || !state.multiRank) throw new Error('Play a card or draw one');
      return advance(state);
    case 'acceptAttacc':
      if (state.phase !== 'respond') throw new Error('There is nothing to take');
      return acceptAttacc(state, state.players[state.currentSeat]);
    default:
      throw new Error('That is not part of UH OH!');
  }
}

/** Starts a seat's turn. An ATTACC aimed at them comes first; with no way to counter it, it lands. */
function beginTurn(state: StaccsState, seat: number): void {
  const player = state.players[seat];
  state.currentSeat = seat;
  state.blockedTops = state.blocksForNext;
  state.blocksForNext = [];
  state.multiRank = null;
  state.ranksAtTurnStart = ranksOnBoard(state.board);
  // Their turn has come round, so the window to call them out for a missed "UH OH!" has closed.
  player.exposed = false;

  if (state.attacc && state.attacc.targetId === player.id) {
    state.phase = 'respond';
    if (!hasPlayableCard(state, player)) acceptAttacc(state, player);
  } else {
    state.phase = 'turn';
  }
}

function advance(state: StaccsState): void {
  beginTurn(state, nextSeat(state));
}

/** The draw pile ran dry before anyone went out: whoever holds the fewest cards wins. */
function endByEmptyPile(state: StaccsState): void {
  pushEvent(state, { type: 'pileEmpty' });
  const fewest = Math.min(...state.players.map((p) => p.hand.length));
  finish(
    state,
    state.players.filter((p) => p.hand.length === fewest).map((p) => p.id),
    'fewestCards',
  );
}

function playUhOh(state: StaccsState, player: StaccsPlayer, action: Extract<StaccsAction, { type: 'play' }>): void {
  const card = findInHand(player, action.cardId);
  const restriction = cardRestriction(turnContext(state, player), card);
  if (restriction) throw new Error(restriction);

  const placement = readPlacement(action.placement);
  const wild = kindOf(card) === 'wild';
  const calledSuit = wild ? readSuit(action.calledSuit) : null;
  const result = evaluatePlacement(state.board, card, placement, state.blockedTops);
  if (!result.ok) throw new Error(result.reason);

  takeFromHand(player, card.id);
  state.board = placeOnBoard(state.board, card, placement, calledSuit);
  const seq = state.board.placed.length - 1;
  pushEvent(state, { type: 'play', playerId: player.id, cardId: card.id, seq });
  if (wild) pushEvent(state, { type: 'wild', playerId: player.id, suit: calledSuit });

  // First to empty their hand wins on the spot - even off a Queen or a counter.
  if (player.hand.length === 0) return finish(state, [player.id], 'emptyHand');

  if (state.phase === 'respond') return counterAttacc(state, player);
  applyCardPower(state, player, card, seq);
}

/** What each special card does once it lands, then whether the turn carries on. */
function applyCardPower(state: StaccsState, player: StaccsPlayer, card: Card, seq: number): void {
  switch (card.rank) {
    case 'J':
    case 'Q':
    case 'K': {
      const rank = card.rank as AttaccRank;
      const target = state.players[nextSeat(state)];
      state.attacc = { rank, count: ATTACC_STEP[rank], fromId: player.id, targetId: target.id };
      pushEvent(state, { type: 'attacc', rank, count: ATTACC_STEP[rank], targetId: target.id });
      return advance(state);
    }
    case 'A':
      pushEvent(state, { type: 'extraTurn', playerId: player.id });
      return beginTurn(state, state.currentSeat);
    case 'W':
      return advance(state);
    case '0':
      state.blocksForNext.push(seq);
      if (state.players.length >= 3) {
        state.direction = state.direction === 1 ? -1 : 1;
        pushEvent(state, { type: 'reverse' });
      }
      break;
  }

  // A number already on the STACC can be played in multiples, all in the same turn.
  const multiples = state.multiRank !== null || state.ranksAtTurnStart.includes(card.rank);
  if (multiples && player.hand.some((c) => c.rank === card.rank)) {
    state.multiRank = card.rank;
    return;
  }
  advance(state);
}

/** Staccing the same ATTACC card passes the whole effect on, one bigger. */
function counterAttacc(state: StaccsState, player: StaccsPlayer): void {
  const attacc = state.attacc!;
  const count = attacc.count + ATTACC_STEP[attacc.rank];
  const target = state.players[nextSeat(state)];
  state.attacc = { rank: attacc.rank, count, fromId: player.id, targetId: target.id };
  pushEvent(state, { type: 'countered', playerId: player.id, rank: attacc.rank, count });
  advance(state);
}

/**
 * Taking an ATTACC: draw for a Jack or King, or wait to be handed cards for a Queen. Either way the
 * player still gets their turn afterwards.
 */
function acceptAttacc(state: StaccsState, player: StaccsPlayer): void {
  const attacc = state.attacc!;
  if (attacc.rank === 'Q') {
    state.phase = 'give';
    return;
  }

  const drawn = drawInto(state, player, attacc.count);
  pushEvent(state, { type: 'draw', playerId: player.id, count: drawn, reason: 'attacc' });
  state.attacc = null;
  state.phase = 'turn';
  if (drawn < attacc.count) endByEmptyPile(state);
}

function giveCards(state: StaccsState, giver: StaccsPlayer, rawIds: unknown): void {
  const attacc = state.attacc;
  if (state.phase !== 'give' || !attacc || attacc.fromId !== giver.id) throw new Error('You have nothing to give');

  const owed = Math.min(attacc.count, giver.hand.length);
  const ids = Array.isArray(rawIds) ? [...new Set(rawIds.map(String))] : [];
  if (ids.length !== owed) throw new Error(`Pick ${owed} card${owed === 1 ? '' : 's'} to give`);
  ids.forEach((id) => findInHand(giver, id));

  const target = playerById(state, attacc.targetId);
  for (const id of ids) target.hand.push(takeFromHand(giver, id));
  pushEvent(state, { type: 'give', fromId: giver.id, toId: target.id, count: owed });
  state.attacc = null;

  // The "Queen sweep": handing over your last card wins the game.
  if (giver.hand.length === 0) return finish(state, [giver.id], 'emptyHand');
  state.phase = 'turn';
}

function drawWhenStuck(state: StaccsState, player: StaccsPlayer): void {
  if (state.phase !== 'turn' || state.multiRank) throw new Error("You can't draw now");
  if (hasPlayableCard(state, player)) throw new Error('One of your cards staccs - play it');

  const drawn = drawInto(state, player, 1);
  if (drawn === 0) return endByEmptyPile(state);
  pushEvent(state, { type: 'draw', playerId: player.id, count: 1, reason: 'stuck' });
  advance(state);
}

function declareUhOh(state: StaccsState, player: StaccsPlayer): void {
  if (player.hand.length > 2) throw new Error('Save it for your last card');
  if (player.saidUhOh) return;
  player.saidUhOh = true;
  player.exposed = false;
  pushEvent(state, { type: 'uhOh', playerId: player.id });
}

function callOut(state: StaccsState, caller: StaccsPlayer, targetId: unknown): void {
  const target = state.players.find((p) => p.id === targetId);
  if (!target) throw new Error('No such player');
  if (target.id === caller.id) throw new Error("You can't call yourself out");
  if (!target.exposed) throw new Error(`${target.name} is safe`);

  target.exposed = false;
  const drawn = drawInto(state, target, UH_OH_PENALTY);
  pushEvent(state, { type: 'calledOut', callerId: caller.id, targetId: target.id });
  pushEvent(state, { type: 'draw', playerId: target.id, count: drawn, reason: 'penalty' });
  if (drawn < UH_OH_PENALTY) endByEmptyPile(state);
}

/**
 * Keeps the "UH OH!" bookkeeping straight after every action: a declaration lapses once your hand
 * grows again, and dropping to one card without having said it leaves you open to being called out.
 */
function trackUhOh(state: StaccsState, handsBefore: Map<string, number>): void {
  for (const player of state.players) {
    const before = handsBefore.get(player.id) ?? 0;
    const now = player.hand.length;
    if (now > before) player.saidUhOh = false;
    if (now !== 1) player.exposed = false;
    else if (before !== 1 && !player.saidUhOh && !state.finished) player.exposed = true;
  }
}
