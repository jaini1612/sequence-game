import { WILD, type PlayerView, type Position } from '@sequence/shared';
import { Card } from './Card';

function isPlayable(playable: Position[], row: number, col: number): boolean {
  return playable.some((p) => p.row === row && p.col === col);
}

function isInSequence(view: PlayerView, row: number, col: number): boolean {
  return view.sequences.some((seq) => seq.cells.some((c) => c.row === row && c.col === col));
}

export function Board({
  view,
  playableCells,
  onCellClick,
}: {
  view: PlayerView;
  playableCells: Position[];
  onCellClick: (pos: Position) => void;
}) {
  return (
    <div className="board">
      {view.board.map((row, rowIdx) =>
        row.map((cell, colIdx) => {
          const chip = view.chips[rowIdx][colIdx];
          const clickable = isPlayable(playableCells, rowIdx, colIdx);
          const sequenced = isInSequence(view, rowIdx, colIdx);

          return (
            <div
              key={`${rowIdx}-${colIdx}`}
              className={['board__cell', clickable ? 'board__cell--playable' : ''].join(' ')}
              onClick={clickable ? () => onCellClick({ row: rowIdx, col: colIdx }) : undefined}
            >
              {cell === WILD ? (
                <div className="board__wild">★</div>
              ) : (
                <Card code={cell} />
              )}
              {chip && <div className={`chip chip--${chip.toLowerCase()} ${sequenced ? 'chip--sequenced' : ''}`} />}
            </div>
          );
        }),
      )}
    </div>
  );
}
