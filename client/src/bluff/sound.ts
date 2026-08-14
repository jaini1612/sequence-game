/**
 * Sound effects for the table - no music, just the noises the game makes. Everything is synthesised
 * on the fly, so there is not a single audio file to ship or wait for.
 *
 * Bluff keeps its own copy of these primitives rather than borrowing Sequence's: the two games want
 * different voices, and neither should be able to change the other's by accident.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  context ??= new AudioContext();
  return context;
}

/** Browsers hold the context suspended until the page has been interacted with. */
function resume(ctx: AudioContext): void {
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

/**
 * One struck partial that fades on its own curve. `at` is an absolute context time, so a flourish
 * can lay its notes out ahead of itself instead of firing a chain of timers.
 */
function strike(
  ctx: AudioContext,
  freq: number,
  peak: number,
  decay: number,
  at = ctx.currentTime,
  type: OscillatorType = 'sine',
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);

  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + decay + 0.02);
}

/**
 * A shaped burst of noise. Card sounds are all air and friction rather than pitch, so they are built
 * from noise through a sweeping bandpass instead of from oscillators.
 */
function noise(
  ctx: AudioContext,
  at: number,
  duration: number,
  peak: number,
  fromHz: number,
  toHz: number,
  q = 1.1,
): void {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) samples[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = q;
  band.frequency.setValueAtTime(fromHz, at);
  band.frequency.exponentialRampToValueAtTime(toHz, at + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.03, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  source.connect(band).connect(gain).connect(ctx.destination);
  source.start(at);
  source.stop(at + duration);
}

/** Runs `play` against a live, resumed context, or does nothing if there is no audio at all. */
function cue(play: (ctx: AudioContext, now: number) => void): void {
  const ctx = getContext();
  if (!ctx) return;
  resume(ctx);
  play(ctx, ctx.currentTime);
}

/** The riffle at the start of a deal: a run of card edges, accelerating then thinning out. */
export function playDeal(): void {
  cue((ctx, now) => {
    for (let i = 0; i < 16; i++) {
      noise(ctx, now + i * 0.035 + Math.random() * 0.008, 0.05, 0.05, 3200, 1400);
    }
  });
}

/** Cards going down onto the pile - one soft slap each, so a big claim sounds like a big claim. */
export function playPlay(count: number): void {
  cue((ctx, now) => {
    const cards = Math.min(count, 8);
    for (let i = 0; i < cards; i++) {
      noise(ctx, now + i * 0.055, 0.11, 0.09, 2200, 700);
    }
    // A low body under the first card, which is what makes it land on a table rather than in air.
    strike(ctx, 140, 0.05, 0.12, now, 'sine');
  });
}

/** A pass: a short exhale, no impact - nothing actually happened. */
export function playPass(): void {
  cue((ctx, now) => noise(ctx, now, 0.16, 0.045, 900, 320, 0.7));
}

/** Your turn. Deliberately quiet - it fires every single round. */
export function playTurn(): void {
  cue((ctx, now) => {
    strike(ctx, 880, 0.11, 0.7, now);
    strike(ctx, 1760, 0.035, 0.4, now);
  });
}

/** Somebody has called a liar: a rapier drawn, sharp and immediate. */
export function playChallengeCalled(): void {
  cue((ctx, now) => {
    noise(ctx, now, 0.22, 0.1, 900, 5200, 3.4);
    strike(ctx, 1320, 0.05, 0.3, now + 0.04, 'triangle');
  });
}

/**
 * The bluff is caught. The elegant half is a rapier ring and a bright shiver of glass; the fun half
 * is the pratfall underneath it - a tumbling minor arpeggio landing on a fat low thud as the whole
 * pile drops into the liar's lap.
 */
export function playCaught(): void {
  cue((ctx, now) => {
    // The strike itself.
    noise(ctx, now, 0.26, 0.13, 1200, 6000, 3.8);
    strike(ctx, 1568, 0.07, 0.5, now + 0.02, 'triangle');
    strike(ctx, 2093, 0.05, 0.4, now + 0.02, 'triangle');

    // Glass shivering - a scatter of bright partials with no pattern to them.
    for (let i = 0; i < 14; i++) {
      strike(ctx, 2400 + Math.random() * 2600, 0.02, 0.16 + Math.random() * 0.2, now + 0.06 + Math.random() * 0.3, 'sine');
    }

    // The tumble: a minor arpeggio falling away, each step a little slower.
    const fall = [880, 739.99, 622.25, 523.25, 415.3];
    fall.forEach((freq, i) => strike(ctx, freq, 0.09, 0.3, now + 0.16 + i * 0.075, 'triangle'));

    // And the pile landing on them.
    strike(ctx, 98, 0.16, 0.5, now + 0.52, 'sine');
    strike(ctx, 65, 0.12, 0.7, now + 0.52, 'sine');
    noise(ctx, now + 0.52, 0.3, 0.07, 800, 160, 0.6);
  });
}

/** The claim was honest after all: a warm major triad settling, smug about it. */
export function playVindicated(): void {
  cue((ctx, now) => {
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      strike(ctx, freq, 0.08, 0.85, now + i * 0.055, 'triangle');
    });
    strike(ctx, 1046.5, 0.04, 1, now + 0.16, 'sine');
  });
}

/** A bluff meter filling up and buying a challenge back: a small rising sparkle. */
export function playChallengeEarned(): void {
  cue((ctx, now) => {
    [659.25, 880, 1174.66, 1567.98].forEach((freq, i) => {
      strike(ctx, freq, 0.07, 0.35, now + i * 0.06, 'triangle');
    });
    for (let i = 0; i < 8; i++) {
      strike(ctx, 2600 + Math.random() * 1800, 0.016, 0.18, now + 0.1 + i * 0.03, 'sine');
    }
  });
}

/** A pile nobody would touch, going out of the game. A dry, final swipe. */
export function playBurn(): void {
  cue((ctx, now) => {
    noise(ctx, now, 0.42, 0.075, 1800, 240, 0.8);
    strike(ctx, 110, 0.07, 0.35, now + 0.1, 'sine');
  });
}

/** Somebody is home and safe. */
export function playOut(): void {
  cue((ctx, now) => {
    [659.25, 830.61, 987.77].forEach((freq, i) => strike(ctx, freq, 0.07, 0.5, now + i * 0.07, 'triangle'));
  });
}

/** You won it: a short regal fanfare rather than a slot-machine payout - this is a royal table. */
export function playWin(): void {
  cue((ctx, now) => {
    const fanfare: [number, number][] = [
      [523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36], [783.99, 0.52], [1046.5, 0.64],
    ];
    for (const [freq, at] of fanfare) {
      strike(ctx, freq, 0.1, 0.45, now + at, 'triangle');
      strike(ctx, freq * 2, 0.03, 0.3, now + at, 'sine');
    }
    // The held chord it lands on.
    for (const freq of [523.25, 659.25, 783.99, 1046.5]) {
      strike(ctx, freq, 0.07, 1.7, now + 0.82, 'triangle');
    }
  });
}

/** And the other side of it: a pair of detuned notes sagging away. */
export function playLose(): void {
  cue((ctx, now) => {
    for (const detune of [1, 1.007]) {
      [392, 349.23, 311.13, 261.63].forEach((freq, i) => {
        strike(ctx, freq * detune, 0.055, 0.5, now + i * 0.16, 'sawtooth');
      });
    }
  });
}
