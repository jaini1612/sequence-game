/**
 * What the board says once somebody has won. The winner gets a swagger line, the loser gets a
 * ribbing - mostly Bollywood, mostly at their expense.
 *
 * Separate from the referee's lines: he heckles mid-game, these close it out.
 */

/**
 * Every line has to survive on a single line on a phone, so they are all kept short - a taunt that
 * wraps onto a second row stops reading as a one-liner and starts reading as a paragraph.
 */
const BOASTS = [
  'Line yahin se shuru hoti hai. 🕶️',
  'Paanch chips, zero rehem. 🔥',
  'Mogambo khush hua! 😎',
  'Jo jeeta wohi Sequence-dar. 🏆',
  'Rishtey mein hum senior lagte hain. 🃏',
  'Baazi apne naam. 🎺',
];

const TAUNTS = [
  'Tumse na ho payega. 🫠',
  'Kitne aadmi the? Chaar hi rahe. 🖐️',
  'Picture khatam. Tum bhi. 🎬',
  'Mogambo khush hua. 😈',
  'Bahut na-insaafi hai. ⚖️',
  'Don ko pakadna? Tumse naamumkin. 🚬',
  'Jo darr gaya, samjho chip gayi. 💀',
  'Aal izz well? Aal izz haar. 📉',
  'Line lag gayi tumhari. 🚶',
  'Ek chaal chali. Wahi galat. 🙃',
  'Tum "next time" ho gaye. ⏭️',
  'Paanch chahiye the. Bahane nahi. 🤷',
];

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export function pickBoast(): string {
  return pick(BOASTS);
}

export function pickTaunt(): string {
  return pick(TAUNTS);
}
