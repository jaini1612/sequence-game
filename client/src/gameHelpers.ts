import {
  getCardPositions,
  ONE_EYED_JACKS,
  TWO_EYED_JACKS,
  WILD,
  type CardCode,
  type PlayerView,
  type Position,
} from '@sequence/shared';

export function computePlayableCells(view: PlayerView, card: CardCode): Position[] {
  if (TWO_EYED_JACKS.includes(card)) {
    const cells: Position[] = [];
    for (let row = 0; row < view.board.length; row++) {
      for (let col = 0; col < view.board[row].length; col++) {
        if (view.board[row][col] !== WILD && view.chips[row][col] === null) {
          cells.push({ row, col });
        }
      }
    }
    return cells;
  }

  if (ONE_EYED_JACKS.includes(card)) {
    const cells: Position[] = [];
    const opponentColor = view.opponent.color;
    for (let row = 0; row < view.chips.length; row++) {
      for (let col = 0; col < view.chips[row].length; col++) {
        if (view.chips[row][col] === opponentColor && view.sequenceUse[row][col] === 0) {
          cells.push({ row, col });
        }
      }
    }
    return cells;
  }

  return getCardPositions(view, card).filter((pos) => view.chips[pos.row][pos.col] === null);
}
