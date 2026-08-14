import { computeAwards, type Award } from './awards.js';
import { buildDeck, dealAll, maxRankCount, type Rng } from './deck.js';
import {
  BLUFF_METER_GOAL,
  CLAIM_HEADROOM,
  MAX_CHALLENGES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TURN_SECONDS_MAX,
  TURN_SECONDS_MIN,
  winnersNeeded,
  type BluffConfig,
  type BluffEvent,
  type BluffPlayer,
  type BluffState,
  type CardCode,
  type PlayerStatus,
  type Rank,
} from './types.js';

export interface Seat {
  id: string;
  name: string;
}

function validateConfig(config: BluffConfig): void {
  if (config.playerCount < MIN_PLAYERS || config.playerCount > MAX_PLAYERS) {
    throw new Error(`Bluff seats ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  }
  if (config.deckCount !== 1 && config.deckCount !== 2) throw new Error('Play with one or two decks');
  if (config.turnSeconds < TURN_SECONDS_MIN || config.turnSeconds > TURN_SECONDS_MAX) {
    throw new Error(`The clock runs between ${TURN_SECONDS_MIN} and ${TURN_SECONDS_MAX} seconds`);
  }
}

export function createGame(
  seats: Seat[],
  config: BluffConfig,
  now: number,
  rng: Rng = Math.random,
): BluffState {
  validateConfig(config);
  if (seats.length !== config.playerCount) throw new Error('Seat count does not match the game size');

  const deck = buildDeck(config.deckCount, config.composition, rng);
  const hands = dealAll(deck, seats.length);
  const players: BluffPlayer[] = seats.map((seat, i) => ({
    id: seat.id,
    name: seat.name,
    seat: i,
    // Sorting hands makes them readable; nobody else ever sees them, so nothing leaks.
    hand: sortHand(hands[i]),
    status: 'active',
    place: null,
    challenges: MAX_CHALLENGES,
    bluffMeter: 0,
    passedRound: false,
    letGo: false,
    stats: { turns: 0, bluffTurns: 0, bluffsCaught: 0, challengesMade: 0, challengesCorrect: 0 },
  }));

  return {
    config,
    players,
    // A random opener, so the host seat isn't permanently first to have to invent a claim.
    currentSeat: Math.floor(rng() * players.length),
    roundRank: null,
    pile: [],
    lastClaim: null,
    // Measured from the deck that was actually built, so a scrambled deal holding fifteen Queens
    // allows a claim of thirty.
    maxClaim: maxRankCount(deck) * CLAIM_HEADROOM,
    burned: 0,
    finalClaimBy: null,
    turnEndsAt: now + config.turnSeconds * 1000,
    winners: [],
    finished: false,
    events: [{ type: 'deal' }],
    eventSeq: 1,
  };
}

/** Groups a hand by rank so a player can see at a glance what they can honestly claim. */
function sortHand(hand: CardCode[]): CardCode[] {
  const order = new Map(RANK_ORDER.map((r, i) => [r, i]));
  return [...hand].sort((a, b) => {
    const byRank = (order.get(rankOf(a)) ?? 0) - (order.get(rankOf(b)) ?? 0);
    return byRank !== 0 ? byRank : a.localeCompare(b);
  });
}

const RANK_ORDER: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function rankOf(card: CardCode): Rank {
  return card.slice(0, -1) as Rank;
}

function playerById(state: BluffState, id: string): BluffPlayer {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error('You are not at this table');
  return player;
}

function countWith(state: BluffState, status: PlayerStatus): number {
  return state.players.filter((p) => p.status === status).length;
}

function currentPlayer(state: BluffState): BluffPlayer {
  return state.players[state.currentSeat];
}

/** Everyone still entitled to put cards down this round: holding cards, and not yet passed. */
function playersInRound(state: BluffState): BluffPlayer[] {
  return state.players.filter((p) => p.status === 'active' && !p.passedRound);
}

/**
 * The first seat after `from` that can still play. Both the players on their way out of the game and
 * the ones who have passed out of this round are stepped over - a pass is a decision for the whole
 * round, not just for one turn.
 */
function nextSeatInRound(state: BluffState, from: number): number {
  const total = state.players.length;
  for (let step = 1; step <= total; step++) {
    const seat = (from + step) % total;
    const player = state.players[seat];
    if (player.status === 'active' && !player.passedRound) return seat;
  }
  // Nobody left to play - the caller closes the round instead.
  return from;
}

/** The first seat after `from` still in the game at all, ignoring who has passed this round. */
function nextActiveSeatAfter(state: BluffState, from: number): number {
  const total = state.players.length;
  for (let step = 1; step <= total; step++) {
    const seat = (from + step) % total;
    if (state.players[seat].status === 'active') return seat;
  }
  // Nobody left to play - only reachable once the game is over, which checkFinished has already set.
  return from;
}

/** Wipes the round's bookkeeping. The pile is left alone - who gets it differs by how it ended. */
function clearRound(state: BluffState): void {
  state.lastClaim = null;
  state.roundRank = null;
  state.finalClaimBy = null;
  for (const player of state.players) {
    player.passedRound = false;
    player.letGo = false;
  }
}

/**
 * Ends a round nobody was willing to fight over: the pile goes out of the game entirely, and the
 * named seat opens the next one.
 */
function burnAndOpen(state: BluffState, openerSeat: number, now: number): void {
  if (state.pile.length > 0) record(state, { type: 'burn', count: state.pile.length });
  state.burned += state.pile.length;
  state.pile = [];
  clearRound(state);

  const opener =
    state.players[openerSeat].status === 'active'
      ? openerSeat
      : nextActiveSeatAfter(state, openerSeat);
  setTurn(state, opener, now);
}

function setTurn(state: BluffState, seat: number, now: number): void {
  state.currentSeat = seat;
  state.turnEndsAt = now + state.config.turnSeconds * 1000;
}

function advanceTurn(state: BluffState, now: number): void {
  setTurn(state, nextSeatInRound(state, state.currentSeat), now);
}

function record(state: BluffState, event: BluffEvent): void {
  state.events.push(event);
}

/** Opens a fresh update: everything that happens from here is one batch for the client to animate. */
function beginUpdate(state: BluffState): void {
  state.events = [];
  state.eventSeq++;
}

/**
 * Closes the challenge window on the previous claim. Anyone who emptied their hand and survived
 * unchallenged is now safely home; if that fills the last winning place, the game is over.
 */
function settlePendingOut(state: BluffState): void {
  for (const player of state.players) {
    if (player.status !== 'pendingOut') continue;
    player.status = 'out';
    player.place = state.winners.length + 1;
    state.winners.push(player.id);
    record(state, { type: 'out', playerId: player.id, place: player.place });
  }
  checkFinished(state);
}

function checkFinished(state: BluffState): void {
  if (state.finished) return;
  const needed = winnersNeeded(state.players.length);
  if (state.winners.length >= needed || countWith(state, 'active') <= 1) {
    state.finished = true;
    record(state, { type: 'finished', winnerIds: [...state.winners] });
  }
}

/** Removes one instance per requested code, so duplicate cards in a scrambled deck behave sanely. */
function takeFromHand(hand: CardCode[], cards: CardCode[]): CardCode[] {
  const remaining = [...hand];
  for (const card of cards) {
    const at = remaining.indexOf(card);
    if (at === -1) throw new Error('You do not hold those cards');
    remaining.splice(at, 1);
  }
  return remaining;
}

export function playCards(
  state: BluffState,
  playerId: string,
  cards: CardCode[],
  rank: Rank,
  now: number,
): BluffState {
  if (state.finished) throw new Error('The game is over');
  const player = playerById(state, playerId);
  if (player.status !== 'active') throw new Error('You are out of this hand');
  if (state.finalClaimBy) throw new Error('This round is closing - check that claim or let it go');
  if (player.passedRound) throw new Error('You passed this round - you can only check now');
  if (currentPlayer(state).id !== playerId) throw new Error('Not your turn');
  if (cards.length < 1) throw new Error('Put at least one card down');
  if (cards.length > state.maxClaim) {
    throw new Error(`No more than ${state.maxClaim} cards at a time`);
  }
  if (state.roundRank && rank !== state.roundRank) {
    throw new Error(`This round is ${state.roundRank}s - claim that or pass`);
  }
  const remaining = takeFromHand(player.hand, cards);

  beginUpdate(state);
  settlePendingOut(state);
  if (state.finished) return state;

  // Whether this player is the last one still in the round, decided before the play changes
  // anything: emptying a hand moves them out of `active` and would hide the fact.
  const closesTheRound = playersInRound(state).length === 1;

  player.hand = remaining;
  state.pile.push(...cards);
  state.lastClaim = { playerId, rank, count: cards.length, cards: [...cards] };
  state.roundRank = rank;
  record(state, { type: 'play', playerId, rank, count: cards.length });

  const lies = cards.filter((card) => rankOf(card) !== rank).length;
  player.stats.turns++;
  // One lie per turn, however many cards it hid behind: the bluff was the decision, not the cards.
  if (lies > 0) player.stats.bluffTurns++;

  // Every card that is not what it was called fills the meter - but only for a player who has run
  // out of challenges, since it exists to buy one back rather than to keep score.
  if (player.challenges === 0) {
    player.bluffMeter += lies;
    if (player.bluffMeter >= BLUFF_METER_GOAL) {
      player.bluffMeter = 0;
      player.challenges = 1;
      record(state, { type: 'challengeEarned', playerId });
    }
  }

  // An empty hand is not a win yet - the claim that emptied it is still open to challenge.
  if (player.hand.length === 0) player.status = 'pendingOut';

  /*
   * With everyone else passed out of the round, this was the last player's one closing claim. The
   * round stops here rather than letting them play on unopposed - which is what used to happen, and
   * meant a single round could swallow the entire game while the others passed round and round.
   *
   * The clock keeps running, now against the others' decision to check it or let it go.
   */
  if (closesTheRound) {
    state.finalClaimBy = playerId;
    record(state, { type: 'roundClosing', playerId });
    setTurn(state, player.seat, now);
    return state;
  }

  advanceTurn(state, now);
  return state;
}

/**
 * Standing down - for the whole round, not just this turn.
 *
 * Passing used to cost only the current turn, so a player could pass and then play again a moment
 * later. That let one player keep laying cards while everybody else passed in circles, and the round
 * never ended. Sitting out is now a commitment: no more cards this round, though the right to call
 * somebody a liar survives it.
 */
export function pass(state: BluffState, playerId: string, now: number, timedOut = false): BluffState {
  if (state.finished) throw new Error('The game is over');
  const player = playerById(state, playerId);
  if (player.status !== 'active') throw new Error('You are out of this hand');
  if (state.finalClaimBy) throw new Error('This round is closing - check that claim or let it go');
  if (player.passedRound) throw new Error('You have already passed this round');
  if (currentPlayer(state).id !== playerId) throw new Error('Not your turn');

  beginUpdate(state);
  settlePendingOut(state);
  if (state.finished) return state;

  player.passedRound = true;
  record(state, { type: 'pass', playerId, timedOut });

  const left = playersInRound(state);

  // Nobody at all is willing to touch it, so the pile leaves the game and the last to stand down
  // opens the next round.
  if (left.length === 0) {
    burnAndOpen(state, player.seat, now);
    return state;
  }

  // One player left in: the turn is theirs, and whatever they put down closes the round.
  setTurn(state, left.length === 1 ? left[0].seat : nextSeatInRound(state, state.currentSeat), now);
  return state;
}

/** Whether this player still has to decide about the claim closing the round. */
export function canLetGo(state: BluffState, playerId: string): boolean {
  if (state.finished || !state.finalClaimBy || state.finalClaimBy === playerId) return false;
  const player = state.players.find((p) => p.id === playerId);
  return player?.status === 'active' && !player.letGo;
}

/**
 * Waving the closing claim through. Once everyone has, the round is over and its pile is burnt -
 * nobody was prepared to challenge it, so nobody has earned it either.
 */
export function letGo(state: BluffState, playerId: string, now: number): BluffState {
  if (state.finished) throw new Error('The game is over');
  if (!state.finalClaimBy) throw new Error('No claim is waiting on you');
  if (state.finalClaimBy === playerId) throw new Error('That claim is yours');
  const player = playerById(state, playerId);
  if (player.status !== 'active') throw new Error('You are out of this hand');
  if (player.letGo) throw new Error('You have already let that go');

  beginUpdate(state);
  applyLetGo(state, player, now);
  return state;
}

/**
 * The act itself, without opening a fresh batch of events - so the turn clock can wave several
 * players through at once and have all of it land in a single update.
 */
function applyLetGo(state: BluffState, player: BluffPlayer, now: number): void {
  const closerId = state.finalClaimBy;
  if (!closerId) return;

  player.letGo = true;
  record(state, { type: 'letGo', playerId: player.id });

  const closer = playerById(state, closerId);
  const stillDeciding = state.players.filter(
    (p) => p.status === 'active' && p.id !== closer.id && !p.letGo,
  );
  // The last word belongs to whoever survived the round unchallenged.
  if (stillDeciding.length === 0) burnAndOpen(state, closer.seat, now);
}

/** Whether this player is allowed to call the last claim a lie right now. */
export function canChallenge(state: BluffState, playerId: string): boolean {
  if (state.finished || !state.lastClaim) return false;
  if (state.lastClaim.playerId === playerId) return false;
  const player = state.players.find((p) => p.id === playerId);
  return player?.status === 'active' && player.challenges > 0;
}

export function challenge(state: BluffState, challengerId: string, now: number): BluffState {
  if (state.finished) throw new Error('The game is over');
  const claim = state.lastClaim;
  if (!claim) throw new Error('There is nothing to challenge');
  if (claim.playerId === challengerId) throw new Error('You cannot challenge yourself');
  const challenger = playerById(state, challengerId);
  if (challenger.status !== 'active') throw new Error('You are out of this hand');
  if (challenger.challenges <= 0) {
    throw new Error('You are out of challenges - fill your bluff meter to earn one back');
  }

  const claimer = playerById(state, claim.playerId);
  const bluffed = claim.cards.some((card) => rankOf(card) !== claim.rank);
  const loser = bluffed ? claimer : challenger;
  const winner = bluffed ? challenger : claimer;

  beginUpdate(state);
  record(state, {
    type: 'challenge',
    challengerId,
    claimerId: claimer.id,
    rank: claim.rank,
    cards: [...claim.cards],
    bluffed,
    loserId: loser.id,
    pileSize: state.pile.length,
  });

  // Reading a liar correctly costs nothing and earns one back; crying wolf is what actually spends
  // a challenge. Being right is therefore always safe, which is the point - the risk is in guessing.
  if (bluffed) challenger.challenges = Math.min(MAX_CHALLENGES, challenger.challenges + 1);
  else challenger.challenges -= 1;

  challenger.stats.challengesMade++;
  if (bluffed) {
    challenger.stats.challengesCorrect++;
    claimer.stats.bluffsCaught++;
  }

  // The whole pile - not just the disputed cards - goes to whoever got it wrong.
  loser.hand = sortHand([...loser.hand, ...state.pile]);
  // A caught liar is dragged back from the brink; an honest claim confirms them home.
  if (loser.status === 'pendingOut') loser.status = 'active';

  state.pile = [];
  // A challenge ends the round outright, so everyone is back in for the next one.
  clearRound(state);

  settlePendingOut(state);
  if (state.finished) return state;

  // The winner of the challenge opens the next round. If being proved honest is also what sent them
  // home - an unchallenged-in-time last claim, vindicated - the seat after them opens instead.
  setTurn(
    state,
    winner.status === 'active' ? winner.seat : nextActiveSeatAfter(state, winner.seat),
    now,
  );
  return state;
}

/**
 * Called by the server on the turn clock. A player who runs out of time simply loses their turn -
 * the table should never stall on somebody who has wandered off.
 */
export function applyTimeout(state: BluffState, now: number): BluffState | null {
  if (state.finished || now < state.turnEndsAt) return null;

  // A closing round is waiting on everyone else at once, not on one player, so the clock running out
  // lets the claim through on behalf of whoever has not spoken.
  if (state.finalClaimBy) {
    const undecided = state.players.filter(
      (p) => p.status === 'active' && p.id !== state.finalClaimBy && !p.letGo,
    );
    if (undecided.length === 0) return null;
    beginUpdate(state);
    for (const player of undecided) applyLetGo(state, player, now);
    return state;
  }

  return pass(state, currentPlayer(state).id, now, true);
}

export interface BluffOpponentView {
  id: string;
  name: string;
  seat: number;
  handCount: number;
  status: PlayerStatus;
  place: number | null;
  /** Public: everyone can see how much scepticism a player has left to spend. */
  challenges: number;
  /** Sitting this round out. Public - the table can see who has stood down. */
  passedRound: boolean;
  /** Has already waved the closing claim through. */
  letGo: boolean;
}

export interface BluffView {
  config: BluffConfig;
  you: {
    id: string;
    name: string;
    seat: number;
    hand: CardCode[];
    status: PlayerStatus;
    place: number | null;
    challenges: number;
    /** Yours alone - it is a count of your own lies, and no opponent's view ever carries it. */
    bluffMeter: number;
    passedRound: boolean;
    letGo: boolean;
  };
  /** Everyone else, in seating order starting from the seat after yours. */
  opponents: BluffOpponentView[];
  currentSeat: number;
  currentPlayerId: string;
  isYourTurn: boolean;
  roundRank: Rank | null;
  pileCount: number;
  /** The most cards this deal allows in one claim - always more than could honestly exist. */
  maxClaim: number;
  burned: number;
  lastClaim: { playerId: string; rank: Rank; count: number } | null;
  canChallenge: boolean;
  /** Whoever made the round's closing claim; null while the round is still running normally. */
  finalClaimBy: string | null;
  /** Whether this round's closing claim is still waiting on you to check it or wave it through. */
  canLetGo: boolean;
  turnEndsAt: number;
  winners: string[];
  finished: boolean;
  /** End-of-game honours. Empty until the game is over - see computeAwards. */
  awards: Award[];
  events: BluffEvent[];
  eventSeq: number;
}

/**
 * The game as one player is allowed to see it: your own cards in full, everyone else's as a count,
 * and the pile as a number. Face-down cards only ever become visible through a challenge, which
 * reveals them in the event itself.
 */
export function toBluffView(state: BluffState, playerId: string): BluffView {
  const you = playerById(state, playerId);
  const total = state.players.length;
  const opponents: BluffOpponentView[] = [];
  for (let step = 1; step < total; step++) {
    const p = state.players[(you.seat + step) % total];
    opponents.push({
      id: p.id,
      name: p.name,
      seat: p.seat,
      handCount: p.hand.length,
      status: p.status,
      place: p.place,
      challenges: p.challenges,
      passedRound: p.passedRound,
      letGo: p.letGo,
    });
  }

  return {
    config: state.config,
    you: {
      id: you.id,
      name: you.name,
      seat: you.seat,
      hand: [...you.hand],
      status: you.status,
      place: you.place,
      challenges: you.challenges,
      bluffMeter: you.bluffMeter,
      passedRound: you.passedRound,
      letGo: you.letGo,
    },
    opponents,
    currentSeat: state.currentSeat,
    currentPlayerId: state.players[state.currentSeat].id,
    // A closing round belongs to nobody: the claim is down and the only moves left are check or
    // let go, so no seat is "on turn" even though the clock is still running.
    isYourTurn:
      state.players[state.currentSeat].id === playerId && !state.finished && !state.finalClaimBy,
    roundRank: state.roundRank,
    pileCount: state.pile.length,
    maxClaim: state.maxClaim,
    burned: state.burned,
    lastClaim: state.lastClaim
      ? { playerId: state.lastClaim.playerId, rank: state.lastClaim.rank, count: state.lastClaim.count }
      : null,
    canChallenge: canChallenge(state, playerId),
    finalClaimBy: state.finalClaimBy,
    canLetGo: canLetGo(state, playerId),
    turnEndsAt: state.turnEndsAt,
    winners: [...state.winners],
    finished: state.finished,
    // Withheld until the last card is down: a live bluff count would name every liar at the table.
    awards: state.finished ? computeAwards(state.players) : [],
    events: state.events,
    eventSeq: state.eventSeq,
  };
}
