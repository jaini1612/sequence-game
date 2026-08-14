import { useState, type CSSProperties } from 'react';
import { WILD, type PlayerColor, type PlayerView, type Position } from '@sequence/shared';
import { Card } from './cards';
import { Chip } from './Chip';
import { CornerTile } from './CornerTile';

function contains(cells: Position[], row: number, col: number): boolean {
  return cells.some((p) => p.row === row && p.col === col);
}

function isInSequence(view: PlayerView, row: number, col: number): boolean {
  return view.sequences.some((seq) => seq.cells.some((c) => c.row === row && c.col === col));
}

/**
 * A chip mid-celebration: it turns slowly on the spot until it is showing the winner's colour, then
 * stays up there hovering and rotating. Two chips back to back with their backfaces hidden is what
 * makes the colour arrive with the turn rather than snapping over before it.
 *
 * The delay runs diagonally across the board, so the colour washes over from the top-left corner
 * instead of every chip turning at once.
 */
function SpinningChip({
  from,
  to,
  row,
  col,
  sequenced,
}: {
  from: PlayerColor;
  to: PlayerColor;
  row: number;
  col: number;
  sequenced: boolean;
}) {
  // Once the turn has landed both faces are the winner's colour, which is what lets the chip carry
  // on rotating without flashing the old colour back every half turn.
  const [turned, setTurned] = useState(false);
  const face = ['chip-flip__face', sequenced ? 'chip--sequenced' : ''].filter(Boolean).join(' ');

  return (
    <span
      className={['chip-flip', turned ? 'chip-flip--turned' : ''].filter(Boolean).join(' ')}
      style={{ '--flip-delay': `${(row + col) * 110}ms` } as CSSProperties}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setTurned(true);
      }}
    >
      <Chip color={turned ? to : from} className={face} />
      <Chip color={to} className={`${face} chip-flip__face--back`} />
    </span>
  );
}

export function Board({
  view,
  highlightedCells,
  canPlay,
  celebrateColor,
  onCellClick,
}: {
  view: PlayerView;
  /** Where the selected card could go. Shown off-turn too, as a planning aid. */
  highlightedCells: Position[];
  /** False off-turn or after the game ends: cells still light up, but clicking does nothing. */
  canPlay: boolean;
  /** The winner's colour once there is one, which every chip on the board turns to. */
  celebrateColor: PlayerColor | null;
  onCellClick: (pos: Position) => void;
}) {
  return (
    <div className={['board-frame', celebrateColor ? 'board-frame--jackpot' : ''].filter(Boolean).join(' ')}>
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
                {chip &&
                  (celebrateColor ? (
                    // No hover on the last chip played any more - the whole board is moving now.
                    <SpinningChip
                      from={chip}
                      to={celebrateColor}
                      row={rowIdx}
                      col={colIdx}
                      sequenced={sequenced}
                    />
                  ) : (
                    <Chip
                      color={chip}
                      className={[sequenced ? 'chip--sequenced' : '', latest ? 'chip--latest' : '']
                        .filter(Boolean)
                        .join(' ')}
                    />
                  ))}
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
