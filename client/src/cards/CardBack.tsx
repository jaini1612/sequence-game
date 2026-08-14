import { Fleur } from './Fleur';
import './card-back.css';

/**
 * The back of a card: oxblood field, gold lattice, and a fleur-de-lis crest in a rope frame.
 *
 * The field, the lattice and the frame are all CSS layers rather than SVG, because a table of Bluff
 * puts dozens of these on screen at once and repeating a gradient is far cheaper than repeating a
 * document. Only the crest is drawn, and it uses `currentColor` alone - no gradients, no ids - so a
 * hundred copies can never collide with each other.
 */
export function CardBack({
  className = '',
  /** Face-down cards are dealt in fans; a slight tilt per card sells the stack. */
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card-back ${className}`.trim()} style={style} aria-hidden="true">
      <div className="card-back__frame">
        <Fleur className="card-back__crest" />
      </div>
    </div>
  );
}
