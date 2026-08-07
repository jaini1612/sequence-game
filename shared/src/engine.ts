import { buildBoardLayout, CORNERS } from './board.js';
import { buildDrawPile, shuffle } from './deck.js';
import {
  BOARD_SIZE,
  DRAW_GRACE_MS,
  ONE_EYED_JACKS,
  TWO_EYED_JACKS,
  WILD,
  colorsForPlayerCount,
  handSizeFor,
  sequencesToWin,
  type CardCode,
  type GameState,
  type Player,
  type PlayerColor,
  type Position,
  type SequenceRecord,
} from './types.js';

const DIRECTIONS: Position[] = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: -1 },
];

function isCorner(row: number, col: number): boolean {
  return CORNERS.some((c) => c.row === row && c.col === col);
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/**
 * Deals a new game. `seats` fixes both the turn order and each player's colour, so the caller (the
 * room) owns those decisions - colours are claimed in the lobby, not assigned here.
 */
export function createGame(seats: { id: string; color: PlayerColor }[]): GameState {
  if (seats.length < 2) throw new Error('A game needs at least two players');
  const colors = new Set(seats.map((s) => s.color));
  if (colors.size !== seats.length) throw new Error('Every player needs a distinct colour');

  const board = buildBoardLayout();
  const chips: (PlayerColor | null)[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(null),
  );
  const sequenceUse: number[][] = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));

  let drawPile = shuffle(buildDrawPile());
  const handSize = handSizeFor(seats.length);

  const players = seats.map(({ id, color }): Player => {
    const hand = drawPile.slice(0, handSize);
    drawPile = drawPile.slice(handSize);
    return { id, color, hand };
  });

  return {
    board,
    chips,
    sequenceUse,
    players,
    currentPlayerIndex: 0,
    // One player per side for now, so sides == players. Team play will pass the team count here.
    sequencesToWin: sequencesToWin(seats.length),
    drawPile,
    discardPile: [],
    sequences: [],
    lastPlacement: null,
    drawQueue: [],
    lastPlayerId: null,
    missedDraws: {},
    winnerId: null,
    deadCardDiscardedThisTurn: false,
  };
}

/** The default colour line-up for a game of this size, used when the lobby has no preference. */
export function defaultSeatColors(playerCount: number): PlayerColor[] {
  return colorsForPlayerCount(playerCount);
}

export function getCardPositions(state: Pick<GameState, 'board'>, card: CardCode): Position[] {
  const positions: Position[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (state.board[row][col] === card) positions.push({ row, col });
    }
  }
  return positions;
}

export function isDeadCard(state: Pick<GameState, 'board' | 'chips'>, card: CardCode): boolean {
  if (TWO_EYED_JACKS.includes(card) || ONE_EYED_JACKS.includes(card)) return false;
  const positions = getCardPositions(state, card);
  if (positions.length === 0) return false;
  return positions.every((p) => state.chips[p.row][p.col] !== null);
}

function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function requireTurn(state: GameState, playerId: string): Player {
  const player = currentPlayer(state);
  if (player.id !== playerId) throw new Error('Not your turn');
  return player;
}

function drawOne(state: GameState): CardCode | undefined {
  if (state.drawPile.length === 0) {
    if (state.discardPile.length === 0) return undefined;
    state.drawPile = shuffle(state.discardPile);
    state.discardPile = [];
  }
  return state.drawPile.shift();
}

function removeFromHand(player: Player, card: CardCode): void {
  const idx = player.hand.indexOf(card);
  if (idx === -1) throw new Error('Card not in hand');
  player.hand.splice(idx, 1);
}

/**
 * Detects newly-completed 5-in-a-row sequences that pass through `pos`, honoring the "a chip
 * may belong to at most two sequences, and two sequences may not overlap by more than one
 * shared chip" rule. Wild corners never count against these limits.
 */
function findNewSequences(state: GameState, pos: Position, color: PlayerColor): SequenceRecord[] {
  const found: SequenceRecord[] = [];
  const existing = [...state.sequences];

  const isPlayerCell = (r: number, c: number): boolean =>
    inBounds(r, c) && (state.board[r][c] === WILD || state.chips[r][c] === color);

  for (const dir of DIRECTIONS) {
    for (let startOffset = -4; startOffset <= 0; startOffset++) {
      const cells: Position[] = [];
      let touchesPos = false;
      let valid = true;
      for (let k = 0; k < 5; k++) {
        const r = pos.row + (startOffset + k) * dir.row;
        const c = pos.col + (startOffset + k) * dir.col;
        if (!isPlayerCell(r, c)) {
          valid = false;
          break;
        }
        if (r === pos.row && c === pos.col) touchesPos = true;
        cells.push({ row: r, col: c });
      }
      if (!valid || !touchesPos) continue;

      const nonCorner = cells.filter((cell) => !isCorner(cell.row, cell.col));

      const overlapsTooMuch = existing.some((seq) => {
        const overlap = nonCorner.filter((cell) =>
          seq.cells.some((sc) => sc.row === cell.row && sc.col === cell.col),
        );
        return overlap.length > 1;
      });
      if (overlapsTooMuch) continue;

      const overCap = nonCorner.some((cell) => state.sequenceUse[cell.row][cell.col] >= 2);
      if (overCap) continue;

      const key = cells
        .map((c) => `${c.row},${c.col}`)
        .sort()
        .join('|');
      const alreadyFound = found.some(
        (f) =>
          f.cells
            .map((c) => `${c.row},${c.col}`)
            .sort()
            .join('|') === key,
      );
      if (alreadyFound) continue;

      const record: SequenceRecord = { playerId: '', cells };
      found.push(record);
      existing.push(record);
    }
  }

  return found;
}

function applySequences(state: GameState, pos: Position, player: Player): void {
  const newSequences = findNewSequences(state, pos, player.color);
  for (const seq of newSequences) {
    seq.playerId = player.id;
    state.sequences.push(seq);
    for (const cell of seq.cells) {
      if (!isCorner(cell.row, cell.col)) {
        state.sequenceUse[cell.row][cell.col] += 1;
      }
    }
  }
  const playerSequenceCount = state.sequences.filter((s) => s.playerId === player.id).length;
  if (playerSequenceCount >= state.sequencesToWin) {
    state.winnerId = player.id;
  }
}

function endTurn(state: GameState): void {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.deadCardDiscardedThisTurn = false;
}

/**
 * Starts the clock on whoever is now owed the oldest card, unless that is the player who just
 * played - they are entitled to draw at leisure until somebody else moves.
 *
 * Called every time the head of the queue changes, so a debtor who was locked out behind someone
 * else still gets a full grace period of their own once the pile reaches them.
 */
function pressureHeadOfQueue(state: GameState, now: number): void {
  const head = state.drawQueue[0];
  if (!head || head.deadlineAt !== null) return;
  if (head.playerId === state.lastPlayerId) return;
  head.deadlineAt = now + DRAW_GRACE_MS;
}

/**
 * Writes off any draw whose grace period has run out. Returns the players who lost a card, so the
 * caller can tell them. The clock is passed in rather than read, which keeps this pure and lets the
 * tests step through the timing exactly.
 */
export function resolveExpiredDraws(state: GameState, now: number): string[] {
  const forfeited: string[] = [];

  // A loop, not a single check: several debts can lapse in one go if nothing has been polled for a
  // while, and each one that clears may put the next debtor under pressure.
  for (;;) {
    const head = state.drawQueue[0];
    // Generous at the boundary: the card is lost only once the deadline has actually passed.
    if (!head || head.deadlineAt === null || head.deadlineAt >= now) break;

    const freedAt = head.deadlineAt;
    state.drawQueue.shift();
    state.missedDraws[head.playerId] = (state.missedDraws[head.playerId] ?? 0) + 1;
    forfeited.push(head.playerId);
    // The next debtor's window opens when this one actually lapsed, not whenever we got round to
    // checking - otherwise a late poll would silently hand them extra time.
    pressureHeadOfQueue(state, freedAt);
  }

  return forfeited;
}

/** Whether this player may take a card right now: they hold the oldest unsettled debt. */
export function canDraw(state: GameState, playerId: string): boolean {
  return state.drawQueue[0]?.playerId === playerId;
}

/**
 * Takes the card a player is owed. Deliberately manual: the turn has already moved on, and missing
 * this is what costs you a card for the rest of the game.
 */
export function drawCard(state: GameState, playerId: string, now: number): GameState {
  resolveExpiredDraws(state, now);

  const head = state.drawQueue[0];
  const owed = state.drawQueue.some((d) => d.playerId === playerId);
  if (!owed) throw new Error('You are not owed a card');
  if (head.playerId !== playerId) {
    throw new Error('Another player is still owed the top card');
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not in this game');

  state.drawQueue.shift();
  const drawn = drawOne(state);
  if (drawn) player.hand.push(drawn);
  pressureHeadOfQueue(state, now);

  return state;
}

export function discardDeadCard(state: GameState, playerId: string, card: CardCode): GameState {
  const player = requireTurn(state, playerId);
  if (state.winnerId) throw new Error('Game already over');
  if (state.deadCardDiscardedThisTurn) throw new Error('Already discarded a dead card this turn');
  if (!isDeadCard(state, card)) throw new Error('Card is not dead');

  state.deadCardDiscardedThisTurn = true;
  removeFromHand(player, card);
  state.discardPile.push(card);
  // Dealt straight away rather than queued: this happens in the middle of your own turn, before you
  // play, so there is no other player to race and nothing to miss.
  const drawn = drawOne(state);
  if (drawn) player.hand.push(drawn);

  return state;
}

export function playCard(
  state: GameState,
  playerId: string,
  card: CardCode,
  position: Position,
  now: number = Date.now(),
): GameState {
  // Settle anything that has already lapsed, so this play cannot revive an expired debt.
  resolveExpiredDraws(state, now);
  const player = requireTurn(state, playerId);
  if (state.winnerId) throw new Error('Game already over');
  if (!player.hand.includes(card)) throw new Error('Card not in hand');
  if (!inBounds(position.row, position.col)) throw new Error('Position out of bounds');

  const { row, col } = position;
  const isTwoEyedJack = TWO_EYED_JACKS.includes(card);
  const isOneEyedJack = ONE_EYED_JACKS.includes(card);

  if (isCorner(row, col)) throw new Error('Corner spaces are already wild');

  if (isTwoEyedJack) {
    if (state.chips[row][col] !== null) throw new Error('Space already occupied');
    state.chips[row][col] = player.color;
  } else if (isOneEyedJack) {
    const occupant = state.chips[row][col];
    if (occupant === null) throw new Error('No chip to remove there');
    if (occupant === player.color) throw new Error('Cannot remove your own chip');
    if (state.sequenceUse[row][col] > 0) throw new Error('Cannot remove a chip that is part of a sequence');
    state.chips[row][col] = null;
    // Upholds the invariant that lastPlacement, when set, names a cell that still holds a chip.
    if (state.lastPlacement?.row === row && state.lastPlacement?.col === col) {
      state.lastPlacement = null;
    }
  } else {
    if (state.board[row][col] !== card) throw new Error('Card does not match that space');
    if (state.chips[row][col] !== null) throw new Error('Space already occupied');
    state.chips[row][col] = player.color;
  }

  removeFromHand(player, card);
  state.discardPile.push(card);

  if (isTwoEyedJack || !isOneEyedJack) {
    state.lastPlacement = { row, col };
    applySequences(state, position, player);
  }

  // The replacement is owed, not dealt: the player has to come back and tap the pile for it.
  state.drawQueue.push({ playerId, deadlineAt: null });
  state.lastPlayerId = playerId;
  // This play is what puts any earlier debtor on the clock.
  pressureHeadOfQueue(state, now);

  if (!state.winnerId) endTurn(state);

  return state;
}

export interface OpponentView {
  id: string;
  color: PlayerColor;
  handSize: number;
}

export interface PlayerView
  extends Omit<GameState, 'players' | 'drawPile' | 'currentPlayerIndex' | 'drawQueue'> {
  you: Player;
  /** In seating order, starting with the player to your left, so turn order stays readable. */
  opponents: OpponentView[];
  /** Whose turn it is, so a three-way game can say who everyone is waiting on. */
  currentPlayerId: string;
  drawPileSize: number;
  isYourTurn: boolean;
  /** You hold the oldest unsettled debt, so the pile is yours to tap. */
  canDraw: boolean;
  /** You are owed a card, whether or not you may take it yet. */
  owedDraw: boolean;
}

export function toPlayerView(state: GameState, playerId: string): PlayerView {
  const seat = state.players.findIndex((p) => p.id === playerId);
  if (seat === -1) throw new Error('Player not in this game');
  const you = state.players[seat];

  // Rotate the seating so the player after you comes first - that is the order play reaches them in.
  const opponents = state.players
    .slice(seat + 1)
    .concat(state.players.slice(0, seat))
    .map((p): OpponentView => ({ id: p.id, color: p.color, handSize: p.hand.length }));

  const {
    players: _players,
    drawPile: _drawPile,
    currentPlayerIndex: _currentPlayerIndex,
    drawQueue: _drawQueue,
    ...rest
  } = state;

  return {
    ...rest,
    you,
    opponents,
    currentPlayerId: currentPlayer(state).id,
    drawPileSize: state.drawPile.length,
    isYourTurn: currentPlayer(state).id === playerId,
    canDraw: state.drawQueue[0]?.playerId === playerId,
    owedDraw: state.drawQueue.some((d) => d.playerId === playerId),
  };
}
