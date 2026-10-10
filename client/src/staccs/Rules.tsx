import { MODE_NAME, type Mode } from '@staccs/shared';

/** The rulebook's cheat sheet for the mode being played, one tap away. */

const STACCING = [
  'TOP matches by SUIT, SIDE (right) by NUMBER 0-10, FACE (left) by LETTER J Q K A.',
  'Every surface a card lands on must match, and it must land on at least one.',
  "You can't stacc on a surface that's partly covered, or hang a card off the table's edge.",
  'WILDS go on any open TOP and must be rotated to a new direction. Everything before them locks.',
];

const BY_MODE: Record<Mode, string[]> = {
  uhoh: [
    'Goal: be the first to stacc all the cards in your hand.',
    'On your turn, stacc a matching card. If nothing matches, draw 1 and your turn ends.',
    'ZERO: the next player cannot use its TOP. With 3+ players it also reverses play.',
    'JACK: next player draws 1. QUEEN: give them a card. KING: they draw 2. ACE: go again.',
    'Counter a J, Q or K by staccing the same letter: the effect grows and passes on.',
    'Got a number that is already on the STACC? Play all your copies of it in one turn.',
    "WILD: call a suit for its TOP. You can't win with a Wild.",
    'Down to one card? Hit UH OH! or anyone can catch you for a 3-card penalty.',
    'Draw pile runs out? Fewest cards left wins.',
  ],
  party: [
    'UH OH! exactly, with two DECCS shuffled together. Seven cards each (five at 10 players).',
    'On your turn, stacc a matching card. If nothing matches, draw 1 and your turn ends.',
    'ZERO blocks its TOP for the next player and reverses play.',
    'JACK +1, QUEEN gives 1, KING +2, ACE goes again. Counter with the same letter.',
    'Down to one card? Hit UH OH! before someone catches you.',
  ],
  solo: [
    'Goal: stacc all 60 cards into a single STACC.',
    "Draw a card and stacc it. If it won't go anywhere it goes on the discard pile.",
    'Instead of drawing you can play the top card of the discard pile.',
    'Special cards have no effect, but Wilds still turn the STACC and lock what came before.',
  ],
  wildout: [
    'Co-op: grow four STACCS out of the Wilds in the middle.',
    'On your turn draw a card, then stacc as many cards as you can on any STACC.',
    "Hold on to cards that don't match yet. Special cards have no effect.",
    'The four STACCS never connect, but they can block each other.',
    'When no cards or matches are left, everybody wins.',
  ],
};

export function Rules({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  return (
    <div className="staccs-finish" role="dialog" aria-modal="true" aria-labelledby="staccs-rules-title" onClick={onClose}>
      <div className="staccs-finish__card staccs-rules" onClick={(e) => e.stopPropagation()}>
        <h2 id="staccs-rules-title" className="staccs-title staccs-title--small">
          {MODE_NAME[mode]}
        </h2>
        <h3>Staccing</h3>
        <ul>
          {STACCING.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <h3>This mode</h3>
        <ul>
          {BY_MODE[mode].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button type="button" className="staccs-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
