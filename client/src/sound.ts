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

/**
 * A soft bell "ting" for when the turn comes back round. Synthesised rather than loaded from a
 * file so there is no asset to ship, and deliberately quiet - it fires on every turn.
 */
export function playTurnChime(): void {
  const ctx = getContext();
  if (!ctx) return;
  // Browsers start the context suspended until a user gesture; by the time a turn comes back
  // the player has already clicked, so this resolves. Ignore the failure if it does not.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  // Fundamental plus a quieter octave and twelfth, which is what makes it read as a bell
  // rather than a beep. Higher partials decay faster, as they do on a real one.
  strike(ctx, 880, 0.16, 0.9);
  strike(ctx, 1760, 0.05, 0.55);
  strike(ctx, 2640, 0.025, 0.3);
}
