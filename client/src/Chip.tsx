import type { CSSProperties } from 'react';
import type { PlayerColor } from '@sequence/shared';

/**
 * A moulded plastic playing chip, seen from directly above, the way the printed set's are: a flat
 * disc with a milled band round the rim and a recessed face carrying the four suits in shallow
 * pockets around a centre boss.
 *
 * Suits run clockwise from the top the way they do on the real chip. Same markup everywhere so
 * board, HUD and lobby stay in step.
 */
export function Chip({
  color,
  className = '',
  style,
}: {
  color: PlayerColor;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`chip chip--${color.toLowerCase()} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      <span className="chip__face">
        <span className="chip__pocket chip__pocket--n">♣</span>
        <span className="chip__pocket chip__pocket--e">♦</span>
        <span className="chip__pocket chip__pocket--s">♥</span>
        <span className="chip__pocket chip__pocket--w">♠</span>
        <span className="chip__hub" />
      </span>
    </span>
  );
}
