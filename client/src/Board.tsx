import { WILD, type PlayerView, type Position } from '@sequence/shared';
import { Card } from './Card';
import { Chip } from './Chip';
import { CornerTile } from './CornerTile';

function contains(cells: Position[], row: number, col: number): boolean {
  return cells.some((p) => p.row === row && p.col === col);
}

function isInSequence(view: PlayerView, row: number, col: number): boolean {
  return view.sequences.some((seq) => seq.cells.some((c) => c.row === row && c.col === col));
}

export function Board({
  view,
  highlightedCells,
  canPlay,
  onCellClick,
}: {
  view: PlayerView;
  /** Where the selected card could go. Shown off-turn too, as a planning aid. */
  highlightedCells: Position[];
  /** False off-turn or after the game ends: cells still light up, but clicking does nothing. */
  canPlay: boolean;
  onCellClick: (pos: Position) => void;
}) {
  return (
    <div className="board-frame">
      <span className="board-frame__wordmark board-frame__wordmark--left" aria-hidden="true">
        Sequence
      </span>
      <div className="board">
        {view.board.map((row, rowIdx) =>
          row.map((cell, colIdx) => {
            const chip = view.chips[rowIdx][colIdx];
            const highlighted = contains(highlightedCells, rowIdx, colIdx);
            const sequenced = isInSequence(view, rowIdx, colIdx);
            const latest = view.lastPlacement?.row === rowIdx && view.lastPlacement?.col === colIdx;

            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={[
                  'board__cell',
                  highlighted ? 'board__cell--highlighted' : '',
                  highlighted && canPlay ? 'board__cell--playable' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={highlighted ? () => onCellClick({ row: rowIdx, col: colIdx }) : undefined}
              >
                {cell === WILD ? (
                  <div className="board__wild" aria-label="Free corner">
                    <CornerTile />
                  </div>
                ) : (
                  <Card code={cell} />
                )}
                {chip && (
                  <Chip
                    color={chip}
                    className={[sequenced ? 'chip--sequenced' : '', latest ? 'chip--latest' : '']
                      .filter(Boolean)
                      .join(' ')}
                  />
                )}
              </div>
            );
          }),
        )}
      </div>
      <span className="board-frame__wordmark board-frame__wordmark--right" aria-hidden="true">
        Sequence
      </span>
    </div>
  );
}
