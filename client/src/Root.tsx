import { lazy, Suspense, useState } from 'react';
import { Portal, type GameKey } from './portal/Portal';

/**
 * Which game is on screen. Each one is loaded only once it has been chosen, so opening the portal
 * does not drag in the other game's code - or open its socket.
 */
const SequenceApp = lazy(() => import('./App'));
const BluffApp = lazy(() => import('./bluff/BluffApp'));

const GAME_KEY = 'portal:game';

/** Per-tab, like the seats themselves, so a reload drops you back into the game you were playing. */
function storedGame(): GameKey | null {
  const stored = sessionStorage.getItem(GAME_KEY);
  return stored === 'sequence' || stored === 'bluff' ? stored : null;
}

export function Root() {
  const [game, setGame] = useState<GameKey | null>(storedGame);

  function pick(next: GameKey) {
    sessionStorage.setItem(GAME_KEY, next);
    setGame(next);
  }

  function exit() {
    sessionStorage.removeItem(GAME_KEY);
    setGame(null);
  }

  if (!game) return <Portal onPick={pick} />;

  return (
    <Suspense fallback={<p className="portal__foot">Shuffling…</p>}>
      {game === 'sequence' ? <SequenceApp onExit={exit} /> : <BluffApp onExit={exit} />}
    </Suspense>
  );
}
