let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (!window.AudioContext) return null;
  context ??= new AudioContext();
  return context;
}

/** A single struck partial of the chime: a sine that fades out on its own curve. */
function strike(ctx: AudioContext, freq: number, peak: number, decay: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + decay + 0.02);
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
