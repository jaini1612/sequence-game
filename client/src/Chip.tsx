import type { PlayerColor } from '@sequence/shared';

/** A moulded plastic playing chip. Same markup everywhere so board, HUD and lobby stay in step. */
export function Chip({ color, className = '' }: { color: PlayerColor; className?: string }) {
  return (
    <span className={`chip chip--${color.toLowerCase()} ${className}`.trim()} aria-hidden="true">
      <span className="chip__emblem">
        <span>♥</span>
        <span>♠</span>
        <span>♦</span>
        <span>♣</span>
      </span>
    </span>
  );
}
