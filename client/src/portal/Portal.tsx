import { Card, CardBack } from '../cards';
import { CubeIcon } from '../staccs/Cube';
import './portal.css';

export type GameKey = 'sequence' | 'bluff' | 'staccs';

/**
 * The front door. Three games live behind it, and nothing else here knows how either one works - it
 * hands a key back and gets out of the way.
 */
export function Portal({ onPick }: { onPick: (game: GameKey) => void }) {
  return (
    <div className="portal">
      <header className="portal__head">
        <p className="portal__eyebrow">The card room</p>
        <h1 className="portal__title">Pick your table</h1>
      </header>

      <div className="portal__games">
        <button type="button" className="portal__game portal__game--sequence" onClick={() => onPick('sequence')}>
          <div className="portal__art" aria-hidden="true">
            <div className="portal__grid">
              {['9H', '10S', 'QD', '5C', 'AS', '7H', '3D', 'KC', '8S'].map((code, i) => (
                <div key={code} className="portal__tile">
                  <Card code={code} />
                  {i === 4 && <span className="portal__chip portal__chip--blue" />}
                  {i === 1 && <span className="portal__chip portal__chip--red" />}
                  {i === 7 && <span className="portal__chip portal__chip--blue" />}
                </div>
              ))}
            </div>
          </div>
          <div className="portal__label">
            <h2>Sequence</h2>
            <p>Five in a row on the board. Two or three players.</p>
          </div>
        </button>

        <button type="button" className="portal__game portal__game--bluff" onClick={() => onPick('bluff')}>
          <div className="portal__art" aria-hidden="true">
            <div className="portal__fan">
              <div className="portal__fan-card">
                <Card code="QH" />
              </div>
              <div className="portal__fan-card">
                <CardBack />
              </div>
              <div className="portal__fan-card">
                <Card code="KS" />
              </div>
            </div>
          </div>
          <div className="portal__label">
            <h2>SparrowBluff</h2>
            <p>Lie through your teeth. Up to five players.</p>
          </div>
        </button>

        <button type="button" className="portal__game portal__game--staccs" onClick={() => onPick('staccs')}>
          <div className="portal__art" aria-hidden="true">
            <div className="portal__cubes">
              <CubeIcon card={{ id: 'p1', suit: 'C', rank: '5' }} size={46} />
              <CubeIcon card={{ id: 'p2', suit: 'H', rank: 'W' }} size={56} />
              <CubeIcon card={{ id: 'p3', suit: 'H', rank: 'J' }} size={46} />
            </div>
          </div>
          <div className="portal__label">
            <h2>STACCS</h2>
            <p>Hexagonal cards that stacc in 3D. Solo, co-op, or up to ten players.</p>
          </div>
        </button>
      </div>

      <p className="portal__foot">Play with friends on any device — no sign-up, just a room code.</p>
    </div>
  );
}
