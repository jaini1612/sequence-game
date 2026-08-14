import { useEffect, useState } from 'react';

/**
 * Seconds left on the turn clock, and how much of it has run as a 0-1 fraction for the ring.
 *
 * Ticks four times a second: fast enough that the ring sweeps rather than jerks, slow enough to be
 * nothing next to the rest of the table's animation.
 */
export function useCountdown(endsAt: number, totalSeconds: number): { seconds: number; fraction: number } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [endsAt]);

  const remaining = Math.max(0, endsAt - now);
  return {
    seconds: Math.ceil(remaining / 1000),
    fraction: totalSeconds > 0 ? Math.min(1, remaining / (totalSeconds * 1000)) : 0,
  };
}
