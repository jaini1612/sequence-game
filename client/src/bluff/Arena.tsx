import { useEffect, useRef, useState } from 'react';
import {
  describeClaim,
  MAX_CHALLENGES,
  rankOf,
  type BluffView,
  type CardCode,
  type Rank,
} from '@bluff/shared';
import { Card, CardBack, Fleur, useCardSprite } from '../cards';
import { PlayIcon } from './Challenges';
import { opponentSpots, YOUR_SPOT, type Spot } from './seats';
import { useCountdown } from './useCountdown';

/** A handful of cards travelling from a chair to the middle. */
export interface Flight {
  key: number;
  from: Spot;
  count: number;
}

/** A challenge being played out in the middle of the table, before the pile goes to the loser. */
export interface Reveal {
  key: number;
  cards: CardCode[];
  rank: Rank;
  bluffed: boolean;
  claimerName: string;
  challengerName: string;
  loserName: string;
  /** So the chair about to be buried in cards can flinch. */
  loserId: string;
  to: Spot;
}

/** How many backs are worth drawing in a fan before it is just a smear of red. */
const MAX_FANNED = 5;

/** The house pattern repeating round the rail, in deck order. */
const SUIT_CYCLE = ['S', 'H', 'C', 'D'];

/** How many marks go round. A multiple of four, so the cycle closes cleanly at the top. */
const RAIL_MARK_COUNT = 28;

/**
 * Walks the outline of a racetrack - two straights joined by semicircular ends - and returns `count`
 * points spaced evenly along it, as percentages of the box.
 *
 * The marks belong on the rail, which is a stadium and not an ellipse, so an ellipse's trigonometry
 * would bow them off the straight sides and bunch them at the ends. This measures real arc length
 * instead, which is what keeps the spacing even the whole way round.
 */
function stadiumPoints(w: number, h: number, count: number): Spot[] {
  const r = Math.min(w, h) / 2;
  const straight = Math.max(0, h - 2 * r);
  const arc = Math.PI * r;
  const perimeter = 2 * straight + 2 * arc;
  if (perimeter <= 0) return [];

  const points: Spot[] = [];
  for (let i = 0; i < count; i++) {
    // Starting at top centre and travelling clockwise.
    let s = (i / count) * perimeter;
    let x: number;
    let y: number;

    if (s < arc / 2) {
      const a = -Math.PI / 2 + s / r;
      x = w / 2 + r * Math.cos(a);
      y = r + r * Math.sin(a);
    } else if ((s -= arc / 2) < straight) {
      x = w;
      y = r + s;
    } else if ((s -= straight) < arc) {
      const a = s / r;
      x = w / 2 + r * Math.cos(a);
      y = h - r + r * Math.sin(a);
    } else if ((s -= arc) < straight) {
      x = 0;
      y = h - r - s;
    } else {
      const a = Math.PI + (s - straight) / r;
      x = w / 2 + r * Math.cos(a);
      y = r + r * Math.sin(a);
    }

    points.push({ left: (x / w) * 100, top: (y / h) * 100 });
  }
  return points;
}

/**
 * Measures the strip the marks sit on and lays them out along it. Measured rather than derived from
 * the stylesheet's numbers, so the pattern follows the rail wherever CSS puts it.
 */
function useRailMarks(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<Spot[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setMarks(stadiumPoints(width, height, count));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);

  return [ref, marks] as const;
}

function initial(name: string): string {
  return name.slice(0, 1).toUpperCase();
}

function Seat({
  name,
  handCount,
  spot,
  isCurrent,
  isYou,
  connected,
  place,
  seconds,
  fraction,
  caught,
  challenges,
}: {
  name: string;
  handCount: number;
  challenges: number;
  spot: Spot;
  isCurrent: boolean;
  isYou: boolean;
  connected: boolean;
  place: number | null;
  seconds: number;
  fraction: number;
  /** True for the moment a challenge has just proved this player was lying. */
  caught: boolean;
}) {
  const fanned = Math.min(handCount, MAX_FANNED);
  const className = [
    'bluff-seat',
    isCurrent ? 'bluff-seat--turn' : '',
    isYou ? 'bluff-seat--you' : '',
    place !== null ? 'bluff-seat--home' : '',
    connected ? '' : 'bluff-seat--away',
    caught ? 'bluff-seat--caught' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} style={{ left: `${spot.left}%`, top: `${spot.top}%` }}>
      <div className="bluff-seat__fan" aria-hidden="true">
        {Array.from({ length: fanned }, (_, i) => (
          <CardBack
            key={i}
            className="bluff-seat__card"
            style={{ transform: `rotate(${(i - (fanned - 1) / 2) * 7}deg) translateY(${Math.abs(i - (fanned - 1) / 2) * 1.5}px)` }}
          />
        ))}
      </div>

      <div className="bluff-seat__badge">
        {/* The clock only runs on the chair that is actually on the spot. */}
        {isCurrent && (
          <svg className="bluff-seat__ring" viewBox="0 0 40 40" aria-hidden="true">
            <circle className="bluff-seat__ring-track" cx="20" cy="20" r="18" />
            <circle
              className="bluff-seat__ring-run"
              cx="20"
              cy="20"
              r="18"
              style={{ strokeDashoffset: 113.1 * (1 - fraction) }}
            />
          </svg>
        )}
        <span className="bluff-seat__avatar">{place !== null ? '★' : initial(name)}</span>
        <span className="bluff-seat__count">{handCount}</span>
      </div>

      {/* A plaque, so the name stays legible wherever the chair lands on the cloth. */}
      <div className="bluff-seat__plate">
        <p className="bluff-seat__name">
          {name}
          {isYou ? ' (you)' : ''}
        </p>
        {/*
          How much scepticism this chair has left to spend on you. Public knowledge, and worth
          knowing - a player down to nothing cannot call your bluff however obvious it is. Four
          tick marks rather than four icons, so it stays a detail and not a second control panel.
        */}
        {place === null && (
          <span
            className="bluff-seat__chal"
            role="img"
            aria-label={`${challenges} of ${MAX_CHALLENGES} challenges left`}
          >
            {Array.from({ length: MAX_CHALLENGES }, (_, i) => (
              <i key={i} className={i < challenges ? 'bluff-seat__chal--on' : ''} />
            ))}
          </span>
        )}
        {place !== null ? (
          <p className="bluff-seat__note bluff-seat__note--home">{place === 1 ? '1st — home' : '2nd — home'}</p>
        ) : isCurrent ? (
          <p className="bluff-seat__note">{seconds}s</p>
        ) : !connected ? (
          <p className="bluff-seat__note">away</p>
        ) : null}
      </div>
    </div>
  );
}

function Pile({ count, claim }: { count: number; claim: string | null }) {
  const stacked = Math.min(count, 6);
  return (
    <div className="bluff-pile">
      {/* Empty draws nothing at all - the crest printed on the cloth already marks the spot, and a
          placeholder box on top of it only crowds the middle of the table. */}
      <div className="bluff-pile__stack" aria-hidden="true">
        {stacked > 0 &&
          Array.from({ length: stacked }, (_, i) => (
            <CardBack
              key={i}
              className="bluff-pile__card card-back--flat"
              style={{ transform: `rotate(${(i % 3) * 6 - 6}deg) translate(${i * 0.6}px, ${-i * 1.2}px)` }}
            />
          ))}
      </div>
      <p className="bluff-pile__count">
        {count} card{count === 1 ? '' : 's'}
      </p>
      {claim && <p className="bluff-pile__claim">{claim}</p>}
    </div>
  );
}

/** The cards in mid-air. They start at the chair that played them and settle onto the pile. */
function FlyingCards({ flight }: { flight: Flight }) {
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    setLanded(false);
    // Two frames: one to paint them at the chair, the next to start the journey. A single frame is
    // sometimes coalesced with the initial paint, and the cards simply appear on the pile.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setLanded(true)));
    return () => cancelAnimationFrame(raf);
  }, [flight.key]);

  const spot = landed ? { left: 50, top: 50 } : flight.from;

  return (
    <div className="bluff-flight" aria-hidden="true">
      {Array.from({ length: Math.min(flight.count, 4) }, (_, i) => (
        <div
          key={i}
          className={`bluff-flight__card ${landed ? 'bluff-flight__card--landed' : ''}`}
          style={{
            left: `${spot.left}%`,
            top: `${spot.top}%`,
            transitionDelay: `${i * 60}ms`,
            zIndex: 10 + i,
          }}
        >
          <CardBack />
        </div>
      ))}
    </div>
  );
}

/** The moment of truth: the disputed cards turn over, then the whole pile slides to the loser. */
function RevealOverlay({ reveal }: { reveal: Reveal }) {
  const [phase, setPhase] = useState<'flip' | 'away'>('flip');

  useEffect(() => {
    setPhase('flip');
    const timer = setTimeout(() => setPhase('away'), 1800);
    return () => clearTimeout(timer);
  }, [reveal.key]);

  const spot = phase === 'away' ? reveal.to : { left: 50, top: 50 };

  return (
    <div
      className={`bluff-reveal ${phase === 'away' ? 'bluff-reveal--away' : ''}`}
      style={{ left: `${spot.left}%`, top: `${spot.top}%` }}
      role="status"
    >
      {/* Two rings thrown out from the moment of the catch, the second chasing the first. */}
      {reveal.bluffed && phase === 'flip' && (
        <>
          <span className="bluff-reveal__shock" />
          <span className="bluff-reveal__shock bluff-reveal__shock--late" />
        </>
      )}
      {/* "Gotcha" for a liar caught; "Trapped" for a challenger who walked into an honest claim. */}
      <p className={`bluff-reveal__verdict ${reveal.bluffed ? 'bluff-reveal__verdict--lie' : 'bluff-reveal__verdict--true'}`}>
        {reveal.bluffed ? 'GOTCHA!' : 'TRAPPED!'}
      </p>
      <div className={`bluff-reveal__cards ${reveal.cards.length > 8 ? 'bluff-reveal__cards--many' : ''}`}>
        {reveal.cards.map((code, i) => {
          // The cards that were not what they were called get picked out - the whole table should be
          // able to see exactly which ones the liar was hoping nobody would look at.
          const lie = rankOf(code) !== reveal.rank;
          return (
            <div
              key={i}
              className={`bluff-reveal__card ${lie ? 'bluff-reveal__card--lie' : ''}`}
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <Card code={code} />
              {lie && <span className="bluff-reveal__x">✕</span>}
            </div>
          );
        })}
      </div>
      <p className="bluff-reveal__line">
        {reveal.bluffed
          ? `${reveal.claimerName} was lying — the whole pile is theirs`
          : `${reveal.claimerName} was telling the truth — ${reveal.challengerName} takes the pile`}
      </p>
    </div>
  );
}

export function Arena({
  view,
  connected,
  flight,
  reveal,
  play,
}: {
  view: BluffView;
  /** Player ids currently holding a live socket, so an away seat can be marked as such. */
  connected: Set<string>;
  flight: Flight | null;
  reveal: Reveal | null;
  /** Absent when it is not your turn. Cards are played onto the table, so the button lives on it. */
  play: { count: number; label: string; onPlay: () => void; disabled: boolean } | null;
}) {
  const { seconds, fraction } = useCountdown(view.turnEndsAt, view.config.turnSeconds);
  const spriteReady = useCardSprite();
  const [railRef, railMarks] = useRailMarks(RAIL_MARK_COUNT);
  const spots = opponentSpots(view.config.playerCount);
  const claim = view.lastClaim ? describeClaim(view.lastClaim.rank, view.lastClaim.count) : null;

  return (
    <div className="bluff-arena">
      <div className="bluff-table" aria-hidden="true">
        <div className="bluff-table__rim" />
        {/*
          The pattern sits in the rail itself - between the outer edge and the cloth - where gold
          behind it lets the red and black suits read as their own colours. This strip runs down the
          middle of the rail, and the marks are spaced along its outline.
        */}
        <div className="bluff-table__rail" ref={railRef}>
          {spriteReady &&
            railMarks.map((mark, i) => {
              const suit = SUIT_CYCLE[i % SUIT_CYCLE.length];
              const red = suit === 'H' || suit === 'D';
              return (
                <svg
                  key={i}
                  className={`bluff-table__suit ${red ? 'bluff-table__suit--red' : 'bluff-table__suit--black'}`}
                  viewBox="0 0 60 76.5"
                  style={{ left: `${mark.left}%`, top: `${mark.top}%` }}
                >
                  <use href={`#pip-${suit}`} />
                </svg>
              );
            })}
        </div>
        <div className="bluff-table__felt" />
        <div className="bluff-table__crest">
          <Fleur />
        </div>
      </div>

      <Pile count={view.pileCount} claim={claim} />

      {view.opponents.map((opponent, i) => (
        <Seat
          key={opponent.id}
          name={opponent.name}
          handCount={opponent.handCount}
          spot={spots[i] ?? YOUR_SPOT}
          isCurrent={!view.finished && view.currentPlayerId === opponent.id}
          isYou={false}
          connected={connected.has(opponent.id)}
          place={opponent.place}
          seconds={seconds}
          fraction={fraction}
          caught={!!reveal?.bluffed && reveal.loserId === opponent.id}
          challenges={opponent.challenges}
        />
      ))}

      {/* On the near rail, where your cards enter the table - the spot they are actually going. */}
      {play && (
        <button
          type="button"
          className="bluff-btn bluff-play"
          onClick={play.onPlay}
          disabled={play.disabled}
          title={play.label}
          aria-label={play.label}
        >
          <PlayIcon />
          <span className="bluff-btn__word">Play</span>
          {play.count > 0 && <span className="bluff-btn__count">{play.count}</span>}
        </button>
      )}

      {flight && <FlyingCards flight={flight} />}
      {reveal && <RevealOverlay reveal={reveal} />}
    </div>
  );
}
