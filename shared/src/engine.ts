import { buildBoardLayout, CORNERS } from './board.js';
import { buildDrawPile, shuffle } from './deck.js';
import {
  BOARD_SIZE,
  HAND_SIZE,
  ONE_EYED_JACKS,
  SEQUENCES_TO_WIN,
  TWO_EYED_JACKS,
  WILD,
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

export function createGame(playerIds: [string, string]): GameState {
  const board = buildBoardLayout();
  const chips: (PlayerColor | null)[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(null),
  );
  const sequenceUse: number[][] = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));

  let drawPile = shuffle(buildDrawPile());

  const colors: PlayerColor[] = ['BLUE', 'RED'];
  const players = playerIds.map((id, i): Player => {
    const hand = drawPile.slice(0, HAND_SIZE);
    drawPile = drawPile.slice(HAND_SIZE);
    return { id, color: colors[i], hand };
  }) as [Player, Player];

  return {
    board,
    chips,
    sequenceUse,
    players,
    currentPlayerIndex: 0,
    drawPile,
    discardPile: [],
    sequences: [],
    winnerId: null,
    deadCardDiscardedThisTurn: false,
  };
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
  if (playerSequenceCount >= SEQUENCES_TO_WIN) {
    state.winnerId = player.id;
  }
}

function endTurn(state: GameState): void {
  state.currentPlayerIndex = state.currentPlayerIndex === 0 ? 1 : 0;
  state.deadCardDiscardedThisTurn = false;
}

export function discardDeadCard(state: GameState, playerId: string, card: CardCode): GameState {
  const player = requireTurn(state, playerId);
  if (state.winnerId) throw new Error('Game already over');
  if (state.deadCardDiscardedThisTurn) throw new Error('Already discarded a dead card this turn');
  if (!isDeadCard(state, card)) throw new Error('Card is not dead');

  state.deadCardDiscardedThisTurn = true;
  removeFromHand(player, card);
  state.discardPile.push(card);
  const drawn = drawOne(state);
  if (drawn) player.hand.push(drawn);

  return state;
}

export function playCard(
  state: GameState,
  playerId: string,
  card: CardCode,
  position: Position,
): GameState {
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
  } else {
    if (state.board[row][col] !== card) throw new Error('Card does not match that space');
    if (state.chips[row][col] !== null) throw new Error('Space already occupied');
    state.chips[row][col] = player.color;
  }

  removeFromHand(player, card);
  state.discardPile.push(card);

  if (isTwoEyedJack || !isOneEyedJack) {
    applySequences(state, position, player);
  }

  const drawn = drawOne(state);
  if (drawn) player.hand.push(drawn);

  if (!state.winnerId) endTurn(state);

  return state;
}

export interface PlayerView extends Omit<GameState, 'players' | 'drawPile' | 'currentPlayerIndex'> {
  you: Player;
  opponent: { id: string; color: PlayerColor; handSize: number };
  drawPileSize: number;
  isYourTurn: boolean;
}

export function toPlayerView(state: GameState, playerId: string): PlayerView {
  const you = state.players.find((p) => p.id === playerId);
  const opponentPlayer = state.players.find((p) => p.id !== playerId);
  if (!you || !opponentPlayer) throw new Error('Player not in this game');

  const { players: _players, drawPile: _drawPile, currentPlayerIndex: _currentPlayerIndex, ...rest } = state;
  return {
    ...rest,
    you,
    opponent: { id: opponentPlayer.id, color: opponentPlayer.color, handSize: opponentPlayer.hand.length },
    drawPileSize: state.drawPile.length,
    isYourTurn: currentPlayer(state).id === playerId,
  };
}
