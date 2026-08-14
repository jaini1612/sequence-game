import { BLUFF_METER_GOAL, MAX_CHALLENGES } from '@bluff/shared';

/**
 * A manicule - the pointing hand old print used to jab at something important. It is the one gesture
 * that reads instantly as "that one, right there, is lying", and it survives being drawn at 14px,
 * which a sword or a gauntlet does not.
 */
export function AccusingHand({ className = '' }: { className?: string }) {
  return (
    <svg className={`bluff-hand-icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true">
      {/*
        Three shapes, not ten: one long finger, a fist, and a thumb. Anatomy loses to silhouette at
        13px - a properly drawn hand collapses into a mitten, while this still reads as pointing.
      */}
      <rect x="9.4" y="1" width="4.6" height="13" rx="2.3" />
      <rect x="4.6" y="10.4" width="14.8" height="12.6" rx="5.4" />
      <rect x="1.9" y="12.6" width="4.4" height="8.2" rx="2.2" transform="rotate(-18 4.1 16.7)" />
    </svg>
  );
}

/**
 * What an empty Check button says for itself, on hover and in its accessible name. The host says the
 * same thing in his own words when it is tapped.
 */
const METER_HINT = 'Bluff meter active — keep bluffing to regain the power';

/** Putting cards down: a pair of cards laid on the table, the front one over the back. */
export function PlayIcon() {
  return (
    <svg className="bluff-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.6" y="5.4" width="10.6" height="14.6" rx="2" opacity="0.5" transform="rotate(-15 7.9 12.7)" />
      <rect x="10.4" y="3.6" width="10.6" height="14.6" rx="2" transform="rotate(11 15.7 10.9)" />
    </svg>
  );
}

/** Standing aside: a hand held flat, palm out. */
function PassIcon() {
  return (
    <svg className="bluff-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="9.6" width="14.4" height="11.6" rx="5" />
      <rect x="7.4" y="2.4" width="3.1" height="10" rx="1.55" />
      <rect x="11.4" y="1.6" width="3.1" height="10.8" rx="1.55" />
      <rect x="15.4" y="3.2" width="3.1" height="9.2" rx="1.55" />
      <rect x="2.2" y="10.6" width="3" height="7.4" rx="1.5" transform="rotate(-20 3.7 14.3)" />
    </svg>
  );
}

/**
 * The strip above your hand: what you can do, and what you have left to do it with.
 *
 * Check sits on the left wearing the same pointing hand as the challenge pips beside it, because
 * pressing it is exactly what spends one - the button and the counter are one idea, so they share an
 * icon and a row. Playing sits at the far right, the only other thing this strip is for.
 */
export function Challenges({
  left,
  meter,
  canCheck,
  onCheck,
  checkHint,
  onMeterInfo,
  pass,
  letGo,
}: {
  left: number;
  meter: number;
  canCheck: boolean;
  onCheck: () => void;
  /** What the check would be disputing, for the tooltip and screen readers. */
  checkHint: string | null;
  /** Tapped while out of checks: the host explains what the meter is and how to refill it. */
  onMeterInfo: () => void;
  /** Absent when it is not your turn - there is nothing to stand aside from. */
  pass: { onPass: () => void; disabled: boolean } | null;
  /** Present only while a closing claim is waiting on you to wave it through. */
  letGo: { onLetGo: () => void; disabled: boolean } | null;
}) {
  const dry = left === 0;
  const filled = Math.min(1, meter / BLUFF_METER_GOAL);
  const hint = dry
    ? METER_HINT
    : checkHint
      ? `Check — ${checkHint}`
      : 'Check — call the last claim a lie';

  return (
    <div className="bluff-controls">
      <div className="bluff-bar">
        {/*
          When the checks run out this same button becomes the meter, filling left to right as you
          lie. Putting it here rather than in a gauge of its own says what the meter is *for* without
          a word of explanation: it is refilling the thing you just emptied.

          It stays tappable while empty rather than going properly disabled, because a dead button
          cannot tell you why it is dead - and on a touchscreen there is no hover to fall back on.
          Pressing it asks the host, who explains.
        */}
        <button
          type="button"
          className={`bluff-btn bluff-check ${canCheck ? 'bluff-check--live' : ''} ${dry ? 'bluff-check--filling' : ''}`}
          style={dry ? ({ '--meter': `${filled * 100}%` } as React.CSSProperties) : undefined}
          onClick={canCheck ? onCheck : onMeterInfo}
          disabled={!canCheck && !dry}
          aria-disabled={!canCheck}
          title={hint}
          aria-label={dry ? `Check unavailable. ${METER_HINT}` : checkHint ? `Check: ${checkHint}` : 'Check'}
        >
          {dry && <span className="bluff-check__fill" aria-hidden="true" />}
          <AccusingHand />
          <span className="bluff-btn__word">Check</span>
        </button>

        <div className="bluff-chal">
          <div className="bluff-chal__pips">
            {Array.from({ length: MAX_CHALLENGES }, (_, i) => (
              <span
                key={i}
                className={`bluff-chal__pip ${i < left ? 'bluff-chal__pip--on' : ''}`}
                aria-hidden="true"
              >
                <AccusingHand />
              </span>
            ))}
          </div>
          <span className="bluff-chal__count">
            {left} of {MAX_CHALLENGES} checks left
          </span>
        </div>

        {letGo && (
          <button
            type="button"
            className="bluff-btn bluff-pass"
            onClick={letGo.onLetGo}
            disabled={letGo.disabled}
            title="Let it go — accept the closing claim and end the round"
          >
            <PassIcon />
            <span className="bluff-btn__word">Let go</span>
          </button>
        )}

        {pass && (
          <button
            type="button"
            className="bluff-btn bluff-pass"
            onClick={pass.onPass}
            disabled={pass.disabled}
            title="Pass — sit out the rest of this round. You can still check."
          >
            <PassIcon />
            <span className="bluff-btn__word">Pass</span>
          </button>
        )}
      </div>

    </div>
  );
}
