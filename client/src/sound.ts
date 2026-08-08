let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (!window.AudioContext) return null;
  context ??= new AudioContext();
  return context;
}

/**
 * A single struck partial: an oscillator that fades out on its own curve. `at` is an absolute
 * context time, so a fanfare can lay its notes out ahead of itself rather than firing timers.
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

/** Shared by every cue: browsers keep the context suspended until the page has been interacted with. */
function resume(ctx: AudioContext): void {
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

/**
 * The rasp of a card coming off the pile: a short burst of noise shaped by a bandpass that sweeps
 * downwards, which is what gives it the sense of a card sliding rather than a click.
 */
export function playCardDraw(): void {
  const ctx = getContext();
  if (!ctx) return;
  resume(ctx);

  const now = ctx.currentTime;
  const duration = 0.17;

  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) samples[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.1;
  band.frequency.setValueAtTime(2600, now);
  band.frequency.exponentialRampToValueAtTime(900, now + duration);

  const gain = ctx.createGain();
  // Quick swell then a fast tail, so it reads as one stroke rather than a hiss.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(band).connect(gain).connect(ctx.destination);
  source.start(now);
  source.stop(now + duration);
}

/**
 * A soft bell "ting" for when the turn comes back round. Synthesised rather than loaded from a
 * file so there is no asset to ship, and deliberately quiet - it fires on every turn.
 */
export function playTurnChime(): void {
  const ctx = getContext();
  if (!ctx) return;
  // Browsers start the context suspended until a user gesture; by the time a turn comes back
  // the player has already clicked, so this resolves. Ignore the failure if it does not.
  resume(ctx);
  // Fundamental plus a quieter octave and twelfth, which is what makes it read as a bell
  // rather than a beep. Higher partials decay faster, as they do on a real one.
  strike(ctx, 880, 0.16, 0.9);
  strike(ctx, 1760, 0.05, 0.55);
  strike(ctx, 2640, 0.025, 0.3);
}

/** A coin hitting the tray: a very short, very bright ping with a metallic upper partial. */
function coin(ctx: AudioContext, at: number, freq: number): void {
  strike(ctx, freq, 0.05, 0.11, at, 'square');
  strike(ctx, freq * 2.6, 0.018, 0.07, at, 'square');
}

/**
 * The slot-machine payout, for the moment somebody wins: three runs up a major arpeggio, each one an
 * octave brighter and faster than the last, over a cascade of coins dropping into the tray.
 *
 * Synthesised like every other cue here, so there is still no audio asset to ship.
 */
export function playJackpot(): void {
  const ctx = getContext();
  if (!ctx) return;
  resume(ctx);

  const now = ctx.currentTime;
  // C major, which is what a payout jingle almost always is - it has to read as good news instantly.
  const arpeggio = [523.25, 659.25, 783.99, 1046.5];
  for (let run = 0; run < 3; run++) {
    const step = 0.075 - run * 0.012;
    const octave = 1 + run * 0.5;
    arpeggio.forEach((freq, i) => {
      strike(ctx, freq * octave, 0.11, 0.42, now + run * 0.36 + i * step, 'triangle');
    });
  }
  // A final held chord, so the fanfare lands rather than just stopping.
  const finish = now + 3 * 0.36;
  for (const freq of [523.25, 659.25, 783.99, 1046.5, 1567.98]) {
    strike(ctx, freq, 0.09, 1.5, finish, 'triangle');
  }

  // Coins, thinning out as the payout finishes. Pitch jitter is what stops 30 identical pings
  // reading as one machine noise instead of many separate coins.
  for (let i = 0; i < 30; i++) {
    coin(ctx, now + 0.12 + i * 0.048 + Math.random() * 0.02, 1500 + Math.random() * 900);
  }
}

/**
 * The other side of the same moment: a detuned pair sliding down four steps, which is as close to a
 * sad trombone as two oscillators get.
 */
export function playLoserSting(): void {
  const ctx = getContext();
  if (!ctx) return;
  resume(ctx);

  const now = ctx.currentTime;
  const steps = [392, 370, 349, 311];
  const hold = 0.22;

  // Two oscillators a few cents apart, so the note wobbles the way a slide brass note does.
  for (const detune of [1, 1.006]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    // Tamed to something brass-like rather than the buzz a raw sawtooth gives.
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1200;

    steps.forEach((freq, i) => {
      osc.frequency.setValueAtTime(freq * detune, now + i * hold);
    });
    // The last step keeps sagging, which is the part that makes it sound resigned.
    osc.frequency.exponentialRampToValueAtTime(
      steps[steps.length - 1] * detune * 0.75,
      now + steps.length * hold + 0.35,
    );

    const end = now + steps.length * hold + 0.4;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.05);
    gain.gain.setValueAtTime(0.07, now + steps.length * hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(tone).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(end + 0.02);
  }
}
