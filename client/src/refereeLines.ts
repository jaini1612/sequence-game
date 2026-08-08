/**
 * What the Jack in the corner says. He is a heckler, not a help system - the game already shows what
 * is legal, so his job is to be smug about what just happened.
 *
 * Several lines per event so he does not repeat himself in a single game.
 */
/** The events he actually has something to say about. */
export type SpokenEvent =
  | 'missedDraw'
  | 'outOfTurn'
  | 'yourSequence'
  | 'theirSequence'
  | 'chipStolen'
  | 'chipRemoved';

/**
 * Winning and losing are in here so they can outrank everything else, but he keeps quiet about them:
 * the end of the game gets the whole board celebrating and a taunt above it, and a bubble on top of
 * that is just noise.
 */
export type RefereeEvent = SpokenEvent | 'youWon' | 'youLost';

const LINES: Record<SpokenEvent, string[]> = {
  missedDraw: [
    '😴 Are you sleeping? You forgot to draw a card.',
    '🥱 No card for you. The pile was right there, mate.',
    '🤦 You played, you froze, you lost a card. Bold strategy.',
  ],
  outOfTurn: [
    '😠 Can’t you wait? It isn’t your turn.',
    '✋ Patience. The board isn’t going anywhere.',
    '🙄 Tapping harder won’t make it your turn.',
  ],
  yourSequence: [
    '😲 A sequence? From you? Extraordinary.',
    '🔥 Five in a row. Try it again before I get bored.',
    '📈 Look at that. Almost like you meant it.',
  ],
  theirSequence: [
    '😏 They just made a sequence. Were you watching?',
    '👀 That’s one for them. Perhaps join in?',
    '🚨 A sequence against you. This is your wake-up call.',
  ],
  chipStolen: [
    '😱 One-eyed jack. Your chip is history.',
    '🫠 That chip was lovely while it lasted.',
    '🔪 They took your chip. I’d take that personally.',
  ],
  chipRemoved: [
    '😈 Ruthless. Straight off the board with it.',
    '🎯 One chip down. They will remember that.',
    '🃏 A one-eyed jack, used properly. I approve.',
  ],
};

/** Which message wins when more than one thing happened in a single update. */
const PRIORITY: RefereeEvent[] = [
  'youWon',
  'youLost',
  'yourSequence',
  'theirSequence',
  'chipStolen',
  'chipRemoved',
  'missedDraw',
  'outOfTurn',
];

export function pickRefereeLine(event: SpokenEvent): string {
  const lines = LINES[event];
  return lines[Math.floor(Math.random() * lines.length)];
}

/** Given everything that happened at once, the one thing worth heckling about. */
export function mostNotable(events: RefereeEvent[]): RefereeEvent | null {
  for (const candidate of PRIORITY) {
    if (events.includes(candidate)) return candidate;
  }
  return null;
}
