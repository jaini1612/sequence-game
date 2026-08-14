/**
 * The Jack who runs this table. He is not a help system - the game already shows what is legal - so
 * his job is to be insufferable about what just happened.
 *
 * Every line is in English, including the winning ones, and every line takes the table's names so he
 * can be personal about it. Several per event so he does not repeat himself inside one game.
 */

export type HostEvent =
  | 'dealt'
  | 'yourTurn'
  | 'played'
  | 'youPlayed'
  | 'passed'
  | 'youPassed'
  | 'timedOut'
  | 'youTimedOut'
  | 'caught'
  | 'youCaught'
  | 'youWereCaught'
  | 'wrongCall'
  | 'youCalledWrong'
  | 'vindicated'
  | 'burned'
  | 'challengeEarned'
  | 'someoneEarned'
  | 'tooManyCards'
  | 'meterActive'
  | 'roundClosing'
  | 'youClosedRound'
  | 'letGo'
  | 'someoneOut'
  | 'youAreOut'
  | 'youWon'
  | 'youLost';

/** `{name}` is whoever the line is about; `{n}` is a count where one is relevant. */
const LINES: Record<HostEvent, string[]> = {
  dealt: [
    'Cards are out. Try to lie better than last time.',
    'Fresh deal. Somebody at this table is already planning something stupid.',
    'Right then. Smile, and start lying.',
  ],
  yourTurn: [
    'Your turn. The table is waiting, and so am I.',
    'Go on. Say something confident and untrue.',
    'You are up. Do try to look innocent.',
  ],
  played: [
    '{name} says {claim}. Believable? Barely.',
    '{name} puts down {claim} without blinking. Suspicious.',
    '{name} claims {claim}. I have heard better acting.',
    '{name}: {claim}. Someone should probably check that.',
  ],
  youPlayed: [
    'Bold. Let us see who believes you.',
    'Confidently done. Now sit very still.',
    'A fine claim. Almost convincing.',
  ],
  passed: [
    '{name} passes. Cowardice, but efficient cowardice.',
    '{name} would rather not. Noted.',
    '{name} steps aside. Not a single card risked.',
  ],
  youPassed: [
    'You passed. Safe. Boring, but safe.',
    'Nothing from you, then. Riveting.',
    'A pass. The bravest move of your life.',
  ],
  timedOut: [
    '{name} ran out of time. Asleep, presumably.',
    'The clock beat {name}. Embarrassing for everyone.',
    '{name} did nothing at all, slowly.',
  ],
  youTimedOut: [
    'Time is up. You just stared at your cards, didn’t you?',
    'You let the clock win. That is a choice.',
    'Too slow. The table moved on without you.',
  ],
  caught: [
    'Caught! {name} was lying through their teeth. Enjoy the pile.',
    '{name} is a liar and now {name} is a liar holding {n} cards.',
    'Busted. {name} takes the lot, and the shame.',
  ],
  youCaught: [
    'You called it. They lied, and they pay for it.',
    'Beautiful. You smelled the lie and made them eat it.',
    'Correct call. Look at you, developing instincts.',
  ],
  youWereCaught: [
    'Caught red-handed. Take your {n} cards and think about what you did.',
    'You lied and you were terrible at it. The pile is yours.',
    'Exposed. That was the least convincing thing I have seen all week.',
  ],
  wrongCall: [
    '{name} cried liar and was wrong. {n} cards, well earned.',
    '{name} guessed, {name} lost. Delicious.',
    'Wrong call from {name}. The pile has found a new owner.',
  ],
  youCalledWrong: [
    'Wrong. They were honest, and now you are {n} cards heavier.',
    'You accused an honest player. Take the pile and the humiliation.',
    'Badly read. Perhaps look at the cards next time.',
  ],
  vindicated: [
    'Honest, as it happens. Rare, at this table.',
    'Telling the truth. What a strange strategy.',
    'All true. Somebody owes an apology.',
  ],
  /** Everyone else has stood down, so this claim is the round's last word. */
  roundClosing: [
    'Everyone else folded. {name} gets the last word — check it or let it stand.',
    '{name} is the only one left standing. That claim closes the round.',
    'The rest of you ran away. {name} has one last claim on the table.',
  ],
  youClosedRound: [
    'Last one standing. That claim closes the round — let us see if anybody dares.',
    'They all stood down. Your word is the last one, for better or worse.',
  ],
  letGo: [
    '{name} lets it stand. No stomach for a fight.',
    '{name} waves it through. Suspiciously trusting.',
  ],
  burned: [
    'Nobody dared touch it. {n} cards burned and forgotten.',
    'The whole table chickened out. That pile is gone.',
    'Everyone passed. Cowards, all of you. The pile is ash.',
  ],
  challengeEarned: [
    'You lied your way to a challenge. Poetic, really.',
    'All that dishonesty has bought you one accusation. Spend it well.',
    'Your bluff meter is full. Here — go and doubt somebody.',
  ],
  someoneEarned: [
    '{name} has lied enough to earn a challenge back. Watch yourselves.',
    '{name} just bluffed their way to another accusation. Charming.',
  ],
  /** Reaching for a check you cannot afford. What the meter is and how to refill it. */
  meterActive: [
    'Bluff meter active — keep bluffing to regain the power.',
    'No checks left. Lie a little harder and you will earn one back.',
    'Your meter is filling. Bluff your way back to a check.',
  ],
  /** Reaching for more cards than the deck could ever justify. He is not going to let that pass. */
  tooManyCards: [
    'Bluffing is fine, but this is preposterous.',
    'Now that is too much.',
    'Please control your bluffs.',
    'Even I have limits, and you have just found one.',
    'Nobody is going to believe {n} of anything.',
  ],
  someoneOut: [
    '{name} is out and safe. The rest of you are still here.',
    '{name} finishes. Try not to take it personally.',
    'That is {name} home. Someone has to be second.',
  ],
  youAreOut: [
    'You are out. Astonishing. Genuinely.',
    'Empty hands. You lied your way home.',
    'Done and dusted. I am almost impressed.',
  ],
  youWon: [
    'You won. I would say you earned it, but I watched the whole game.',
    'Winner. A triumph of dishonesty over judgement.',
    'You take it. The rest of the table is furious, which is the best part.',
  ],
  youLost: [
    'They finished. You did not. Do sit with that.',
    'Beaten by better liars. Happens to the honest.',
    'Not your night. Or your game. Or your table.',
  ],
};

export interface HostContext {
  name?: string;
  claim?: string;
  n?: number;
}

export function pickHostLine(event: HostEvent, context: HostContext = {}): string {
  const lines = LINES[event];
  const line = lines[Math.floor(Math.random() * lines.length)];
  return line
    .replace(/\{name\}/g, context.name ?? 'Somebody')
    .replace(/\{claim\}/g, context.claim ?? 'something')
    .replace(/\{n\}/g, String(context.n ?? 0));
}

/**
 * When one action causes several things at once, this decides what he actually comments on. Endings
 * beat challenges, challenges beat plays, and nothing beats being caught.
 */
export const HOST_PRIORITY: HostEvent[] = [
  'youWon',
  'youLost',
  'youAreOut',
  'someoneOut',
  'youWereCaught',
  'youCaught',
  'youCalledWrong',
  'wrongCall',
  'caught',
  'vindicated',
  'challengeEarned',
  'someoneEarned',
  'burned',
  'youClosedRound',
  'roundClosing',
  'letGo',
  'youTimedOut',
  'timedOut',
  'youPlayed',
  'played',
  'youPassed',
  'passed',
  'tooManyCards',
  'meterActive',
  'yourTurn',
  'dealt',
];
