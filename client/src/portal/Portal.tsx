import type { CSSProperties } from 'react';
import '@fontsource/luckiest-guy/latin-400.css';
import '@fontsource/rye/latin-400.css';
import '@fontsource/bungee/latin-400.css';
import type { PlayerColor } from '@sequence/shared';
import { Card, CardBack } from '../cards';
import { Chip } from '../Chip';
import { CubeIcon } from '../staccs/Cube';
import { Backdrop } from './Backdrop';
import './portal.css';

export type GameKey = 'sequence' | 'bluff' | 'staccs';

/** A corner of a Sequence board, wide enough to run off both edges of the thumbnail. */
const BOARD = ['9H', '10S', 'QD', '5C', 'AS', '7H', '3D', 'KC', '8S', '2D', '6C', 'JH', '4S', 'QC', '10H', '5D', 'AH', '9C', '7S', 'KD', '3C'];
/** Board index -> chip colour. The blue ones are one chip short of a sequence. */
const CHIPS: Record<number, PlayerColor> = { 1: 'RED', 8: 'BLUE', 9: 'BLUE', 10: 'BLUE', 11: 'BLUE', 16: 'RED', 19: 'GREEN' };

/** Five cards held in a hand, the middle one face down - which is the whole game. */
const FAN: (string | null)[] = ['JD', 'QH', null, 'KS', 'AC'];

/**
 * A game's name, one span per letter so each can lean and bounce on its own. Screen readers get
 * the plain word from the aria-label rather than a letter-by-letter spelling.
 */
function Wordmark({ text, className }: { text: string; className: string }) {
  return (
    <h2 className={`wordmark ${className}`} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} className="wordmark__ch" style={{ '--i': i } as CSSProperties} aria-hidden="true">
          {ch}
        </span>
      ))}
    </h2>
  );
}

/**
 * The front door. Three games live behind it, and nothing else here knows how either one works - it
 * hands a key back and gets out of the way.
 */
export function Portal({ onPick }: { onPick: (game: GameKey) => void }) {
  return (
    <div className="portal">
      <Backdrop />

      <header className="portal__head">
        <p className="portal__eyebrow">The card room</p>
        <h1 className="portal__title">Pick your table</h1>
      </header>

      <div className="portal__games">
        <button type="button" className="portal__game portal__game--sequence" onClick={() => onPick('sequence')}>
          <div className="portal__art" aria-hidden="true">
            <div className="portal__grid">
              {BOARD.map((code, i) => (
                <div key={code} className="portal__tile">
                  <Card code={code} />
                  {CHIPS[i] && <Chip color={CHIPS[i]} />}
                </div>
              ))}
            </div>
          </div>
          <div className="portal__label">
            <Wordmark text="Sequence" className="wordmark--sequence" />
            <p>Five in a row on the board. Two or three players.</p>
          </div>
        </button>

        <button type="button" className="portal__game portal__game--bluff" onClick={() => onPick('bluff')}>
          <div className="portal__art" aria-hidden="true">
            <div className="portal__fan">
              {FAN.map((code, i) => (
                <div key={i} className="portal__fan-card" style={{ '--i': i - 2, '--lift': Math.abs(i - 2) } as CSSProperties}>
                  {code ? <Card code={code} /> : <CardBack />}
                </div>
              ))}
            </div>
          </div>
          <div className="portal__label">
            <Wordmark text="SparrowBluff" className="wordmark--bluff" />
            <p>Lie through your teeth. Up to five players.</p>
          </div>
        </button>

        <button type="button" className="portal__game portal__game--staccs" onClick={() => onPick('staccs')}>
          <div className="portal__art" aria-hidden="true">
            <div className="portal__cubes">
              <CubeIcon card={{ id: 'p1', suit: 'S', rank: 'A' }} size={44} />
              <CubeIcon card={{ id: 'p2', suit: 'C', rank: '5' }} size={54} />
              <CubeIcon card={{ id: 'p3', suit: 'H', rank: 'W' }} size={68} />
              <CubeIcon card={{ id: 'p4', suit: 'H', rank: 'J' }} size={54} />
              <CubeIcon card={{ id: 'p5', suit: 'D', rank: '9' }} size={44} />
            </div>
          </div>
          <div className="portal__label">
            <Wordmark text="STACCS" className="wordmark--staccs" />
            <p>Hexagonal cards that stacc in 3D. Solo, co-op, or up to ten players.</p>
          </div>
        </button>
      </div>

      <p className="portal__foot">Play with friends on any device — no sign-up, just a room code.</p>
    </div>
  );
}
