import { useMemo } from 'react';
import { pickBoast, pickTaunt } from './taunts';

/**
 * How a finished game is announced, above the board: a payout marquee for whoever won, and a taunt
 * for everyone who didn't. The board itself does the celebrating - this is the words and the way out
 * of it.
 */
export function Outcome({
  youWon,
  winnerLabel,
  votes,
  needed,
  youVoted,
  onRematch,
  onLeave,
}: {
  youWon: boolean;
  /** Named by colour, since "opponent" is ambiguous once a third player is at the table. */
  winnerLabel: string;
  votes: number;
  needed: number;
  youVoted: boolean;
  onRematch: () => void;
  /** Out of this room and back to the lobby, without waiting on anybody else. */
  onLeave: () => void;
}) {
  // Picked once, when the game ends. Re-rolling it on every re-render would reshuffle the line
  // under the player as chips land and votes come in.
  const line = useMemo(() => (youWon ? pickBoast() : pickTaunt()), [youWon]);

  return (
    <div className={`outcome ${youWon ? 'outcome--won' : 'outcome--lost'}`} role="status">
      <p className="outcome__headline">
        {youWon ? (
          <>
            {/* The chasing lights are a clipped gradient, which would drain the colour out of an
                emoji sitting inside it - so the slots stay outside the lit word. */}
            <span aria-hidden="true">🎰</span>
            <span className="outcome__word">JACKPOT</span>
            <span aria-hidden="true">🎰</span>
          </>
        ) : (
          `${winnerLabel} takes it`
        )}
      </p>
      <p className="outcome__line">{line}</p>
      <div className="outcome__actions">
        <button
          type="button"
          className="outcome__rematch"
          onClick={onRematch}
          disabled={youVoted}
          // Everyone has to ask, so a player still reading the taunt is never dragged into a new deal.
        >
          {youVoted ? `Waiting for the table… ${votes}/${needed}` : 'Rematch'}
          {!youVoted && votes > 0 && ` (${votes}/${needed} in)`}
        </button>
        {/* A rematch needs the whole table to agree, so there has to be a way out that does not. */}
        <button type="button" className="outcome__leave" onClick={onLeave}>
          Back to lobby
        </button>
      </div>
    </div>
  );
}
