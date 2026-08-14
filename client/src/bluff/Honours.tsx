import type { ReactElement, ReactNode } from 'react';
import type { Award, AwardId, AwardPips } from '@bluff/shared';
import { BluffFace } from './BluffFace';

/*
 * The blotter. Four glyphs drawn the way the accusing hand is - silhouette first, detail never - and
 * one drawn face for the wanted notice, which is the only thing here allowed to have a personality.
 *
 * One rule governs every colour on this screen: gold is what you got away with, oxblood is what you
 * were caught at. Nothing is tinted for decoration.
 */

/** A magnifier: a ring and a handle, because a lens with a glint in it turns to mush at this size. */
function Glass() {
  return (
    <>
      <path
        fillRule="evenodd"
        d="M10 2.4a7.6 7.6 0 1 0 0 15.2 7.6 7.6 0 1 0 0-15.2Z M10 4.7a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 1 1 0-10.6Z"
      />
      <rect x="16.7" y="14.4" width="3" height="7.6" rx="1.5" transform="rotate(-45 18.2 18.2)" />
    </>
  );
}

/** A halo over a head. The halo is doing all the work - the head is only there to hold it up. */
function Halo() {
  return (
    <>
      <ellipse cx="12" cy="4.4" rx="5" ry="1.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="11" r="3.6" />
      <path d="M4.6 21.4a7.4 7.4 0 0 1 14.8 0Z" />
    </>
  );
}

/** A padlock with the shackle sprung: caught in the act, gone before the cuffs closed. */
function OpenLock() {
  return (
    <>
      <path
        d="M7 11.6V8.4a4.4 4.4 0 0 1 8.8 0v2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="3" y="11.6" width="12" height="9.6" rx="2.2" />
    </>
  );
}

/** A thumbprint - the thing left behind at every single scene. */
function Print() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M4 17.4v-2.8a8 8 0 0 1 16 0v2.8" />
      <path d="M7.4 19.4v-4.8a4.6 4.6 0 0 1 9.2 0v4.8" />
      <path d="M10.9 21v-6.4a1.1 1.1 0 0 1 2.2 0V21" />
    </g>
  );
}

/** The Bluffmaster's own mask, kept for the case where they are filed as a row rather than the notice. */
function Mask() {
  return (
    <path
      fillRule="evenodd"
      d="M1.8 8.4C3 5.9 8.2 4.6 12 7.4c3.8-2.8 9-1.5 10.2 1 0 4.8-3.2 9.4-6.4 9.4-1.9 0-3-1.4-3.8-2.6-.8 1.2-1.9 2.6-3.8 2.6-3.2 0-6.4-4.6-6.4-9.4Z M5.6 11a2.5 1.9 0 1 0 5 0 2.5 1.9 0 1 0-5 0Z M13.4 11a2.5 1.9 0 1 0 5 0 2.5 1.9 0 1 0-5 0Z"
    />
  );
}

const GLYPH: Record<AwardId, () => ReactElement> = {
  bluffmaster: Mask,
  inspector: Glass,
  samaritan: Halo,
  escapist: OpenLock,
  suspect: Print,
};

const TICK_GAP = 10.5;
/** The breather between groups of five, which is the only thing that makes a tally countable. */
const GROUP_GAP = 6;

/**
 * Scratches on the wall: one per bluff, crossed out for the ones the table caught. It is the same
 * number as the charge above it, but a number you can see the size of without reading it.
 */
function Tally({ total, flagged }: { total: number; flagged: number }) {
  const x = (i: number) => 4 + i * TICK_GAP + Math.floor(i / 5) * GROUP_GAP;
  const marks = Array.from({ length: total }, (_, i) => x(i));

  return (
    <svg
      className="bluff-tally"
      viewBox={`0 0 ${x(total - 1) + 5} 26`}
      preserveAspectRatio="xMinYMid meet"
      aria-hidden="true"
    >
      <g className="bluff-tally__mark" strokeWidth="2.4" strokeLinecap="round">
        {marks.map((at, i) => (
          <path key={i} d={`M${at} 4v18`} />
        ))}
      </g>
      <g className="bluff-tally__out" strokeWidth="2.6" strokeLinecap="round">
        {marks.slice(0, flagged).map((at, i) => (
          <g key={i}>
            <path d={`M${at - 3.4} 6 ${at + 3.4} 20`} />
            <path d={`M${at + 3.4} 6 ${at - 3.4} 20`} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** The same count in miniature, for a file that does not get the whole notice. */
function Pips({ pips }: { pips: AwardPips }) {
  if (pips.total === 0) return null;
  return (
    <span className="bluff-pips" aria-hidden="true">
      {Array.from({ length: pips.total }, (_, i) => (
        <i key={i} className={i < pips.flagged ? `bluff-pips__${pips.tone}` : 'bluff-pips__clean'} />
      ))}
    </span>
  );
}

function who(award: Award, names: Map<string, string>): string {
  return award.playerIds.map((id) => names.get(id) ?? 'Someone').join(' & ');
}

/** Oxblood is for a file where the crimes outnumber the escapes. Everything else stays gold. */
function charged({ pips }: Award): boolean {
  return pips.tone === 'caught' && pips.flagged > pips.total - pips.flagged;
}

/** The wanted notice: mugshot, charge, tally, and the stamp that says how the night went. */
function Wanted({
  award,
  names,
  caseCode,
  mine,
}: {
  award: Award;
  names: Map<string, string>;
  caseCode: string;
  mine: boolean;
}) {
  return (
    <div className={`bluff-wanted ${mine ? 'bluff-wanted--me' : ''}`}>
      <div>
        <div className="bluff-mug">
          <BluffFace />
        </div>
        <p className="bluff-mug__no">{caseCode}·01</p>
      </div>

      <div className="bluff-wanted__body">
        <p className="bluff-wanted__label">{award.title}</p>
        <p className="bluff-wanted__name">{who(award, names)}</p>
        <p className="bluff-wanted__charge">{award.headline}</p>
        <div className="bluff-wanted__tally">
          <Tally total={award.pips.total} flagged={award.pips.flagged} />
          <p>{award.detail}</p>
        </div>
      </div>

      <span className="bluff-stamp">{award.verdict}</span>
    </div>
  );
}

/**
 * The honours as a closed case file: the Bluffmaster on the notice, everybody else in the folder
 * underneath. Only ever rendered once the game is over - the counts behind it are private until then.
 */
export function Honours({
  awards,
  names,
  youId,
  caseCode,
  onBack,
  actions,
}: {
  awards: Award[];
  names: Map<string, string>;
  youId: string;
  caseCode: string;
  onBack: () => void;
  actions: ReactNode;
}) {
  const hero = awards[0]?.id === 'bluffmaster' ? awards[0] : null;
  const files = hero ? awards.slice(1) : awards;
  const mine = (award: Award) => award.playerIds.includes(youId);

  return (
    <div className="bluff-honours">
      <div className="bluff-honours__top">
        <button type="button" className="bluff-honours__back" onClick={onBack}>
          ‹ Result
        </button>
        <span className="bluff-honours__case">
          Case {caseCode} · closed
        </span>
      </div>

      {hero && <Wanted award={hero} names={names} caseCode={caseCode} mine={mine(hero)} />}

      {files.length > 0 && (
        <ul className="bluff-files">
          {files.map((award) => {
            const Glyph = GLYPH[award.id];
            return (
              <li
                key={award.id}
                className={`bluff-file ${charged(award) ? 'bluff-file--charged' : ''} ${mine(award) ? 'bluff-file--me' : ''}`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <Glyph />
                </svg>
                <div className="bluff-file__text">
                  <p className="bluff-file__label">{award.title}</p>
                  <p className="bluff-file__name">{who(award, names)}</p>
                  <p className="bluff-file__line">{award.headline}</p>
                </div>
                <div className="bluff-file__right">
                  <span className="bluff-chip">{award.verdict}</span>
                  <Pips pips={award.pips} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {awards.length === 0 && (
        <p className="bluff-honours__nothing">
          Not a single charge sticks. Either everybody lied exactly as much as everybody else, or
          nobody did anything worth writing down.
        </p>
      )}

      <div className="bluff-honours__actions">{actions}</div>
    </div>
  );
}
