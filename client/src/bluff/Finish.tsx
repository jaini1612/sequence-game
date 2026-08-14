import { useState } from 'react';
import type { BluffView } from '@bluff/shared';
import { Honours } from './Honours';

/** Deterministic scatter for the shower of gold - no randomness, so it never restyles on re-render. */
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 13) % 20) / 10,
  duration: 2.4 + ((i * 7) % 12) / 10,
  tilt: ((i * 53) % 90) - 45,
  gold: i % 3 !== 0,
}));

/**
 * How the game signs off, in two screens. First the result - who went home, the Jack's last word, and
 * a way into another game. Then, for anyone who wants to know how it was really won, the case file.
 *
 * They are kept apart on purpose: the podium is about the winner, and the honours are about everybody
 * else, which is a different conversation and does not belong under the confetti.
 */
export function Finish({
  view,
  line,
  caseCode,
  votes,
  needed,
  youVoted,
  onRematch,
  onLeave,
}: {
  view: BluffView;
  line: string;
  /** The room's code, doubling as the case number on the file. */
  caseCode: string;
  votes: number;
  needed: number;
  youVoted: boolean;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const [sheet, setSheet] = useState(false);
  const youWon = view.winners.includes(view.you.id);
  const names = new Map<string, string>([
    [view.you.id, view.you.name],
    ...view.opponents.map((o) => [o.id, o.name] as [string, string]),
  ]);

  const actions = (
    <>
      <button
        type="button"
        className="bluff-primary"
        onClick={onRematch}
        disabled={youVoted}
        // Everybody has to ask, so nobody is dragged out of the celebration by an itchy finger.
      >
        {youVoted ? `Waiting for the table… ${votes}/${needed}` : 'Deal again'}
        {!youVoted && votes > 0 ? ` (${votes}/${needed} in)` : ''}
      </button>
      <button type="button" className="bluff-secondary" onClick={onLeave}>
        Leave table
      </button>
    </>
  );

  if (sheet) {
    return (
      <div className="bluff-finish bluff-finish--sheet" role="status">
        <Honours
          awards={view.awards}
          names={names}
          youId={view.you.id}
          caseCode={caseCode}
          onBack={() => setSheet(false)}
          actions={actions}
        />
      </div>
    );
  }

  return (
    <div className={`bluff-finish ${youWon ? 'bluff-finish--won' : 'bluff-finish--lost'}`} role="status">
      {youWon && (
        <div className="bluff-finish__confetti" aria-hidden="true">
          {CONFETTI.map((bit, i) => (
            <span
              key={i}
              className={bit.gold ? 'bluff-confetti bluff-confetti--gold' : 'bluff-confetti'}
              style={{
                left: `${bit.left}%`,
                animationDelay: `${bit.delay}s`,
                animationDuration: `${bit.duration}s`,
                rotate: `${bit.tilt}deg`,
              }}
            />
          ))}
        </div>
      )}

      <div className="bluff-finish__card">
        <p className="bluff-finish__crown" aria-hidden="true">
          {youWon ? '👑' : '🃏'}
        </p>
        <h2 className="bluff-finish__headline">
          {youWon ? (view.you.place === 1 ? 'You won it' : 'You made it home') : 'Beaten'}
        </h2>

        <ol className="bluff-finish__podium">
          {view.winners.map((id, i) => (
            <li key={id} className={id === view.you.id ? 'bluff-finish__me' : ''}>
              <span className="bluff-finish__place">{i === 0 ? '1st' : '2nd'}</span>
              <span>{names.get(id) ?? 'Someone'}</span>
            </li>
          ))}
        </ol>

        <p className="bluff-finish__line">{line}</p>

        {view.awards.length > 0 && (
          <button type="button" className="bluff-finish__sheet" onClick={() => setSheet(true)}>
            Read the rap sheet ›
          </button>
        )}

        <div className="bluff-finish__actions">{actions}</div>
      </div>
    </div>
  );
}
