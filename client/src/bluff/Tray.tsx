import { useMemo } from 'react';
import { describeClaim, RANK_LABEL, RANKS, type BluffView } from '@bluff/shared';
import { Card } from '../cards';
import { Challenges } from './Challenges';
import { useCountdown } from './useCountdown';
import type { CardSelection } from './useCardSelection';

/**
 * Your side of the table: your hand and the strip of controls above it. Playing lives on the table
 * itself, since that is where the cards are going.
 */
export function Tray({
  view,
  selection,
  onPass,
  onChallenge,
  onMeterInfo,
  busy,
}: {
  view: BluffView;
  selection: CardSelection;
  onPass: () => void;
  onChallenge: () => void;
  /** Asking what the bluff meter is, by prodding the empty Check button. */
  onMeterInfo: () => void;
  busy: boolean;
}) {
  const { selected, rank, toggle, setOpeningRank } = selection;
  const hand = view.you.hand;
  const yourTurn = view.isYourTurn;
  const locked = view.roundRank;
  const { seconds } = useCountdown(view.turnEndsAt, view.config.turnSeconds);

  const claimText = useMemo(
    () => (view.lastClaim ? describeClaim(view.lastClaim.rank, view.lastClaim.count) : null),
    [view.lastClaim],
  );

  const lastClaimer =
    view.lastClaim &&
    (view.lastClaim.playerId === view.you.id
      ? 'you'
      : view.opponents.find((o) => o.id === view.lastClaim!.playerId)?.name);

  const home = view.you.status !== 'active';

  return (
    <div className="bluff-tray">
      {home ? (
        <p className="bluff-tray__home">
          {view.you.status === 'pendingOut'
            ? 'Hands empty — you are safe unless somebody catches that last claim.'
            : `You finished ${view.you.place === 1 ? 'first' : 'second'}. Sit back and enjoy it.`}
        </p>
      ) : (
        <>
          <div className="bluff-tray__head">
            <span className="bluff-tray__name">{view.you.name}</span>
            <span className="bluff-tray__count">{hand.length} cards</span>
            {yourTurn && <span className="bluff-tray__clock">{seconds}s</span>}
          </div>

          {/* Check on the left with the counter it spends, pass on the right. Playing is not here -
              it sits on the table, where the cards are going. */}
          <Challenges
            left={view.you.challenges}
            meter={view.you.bluffMeter}
            canCheck={view.canChallenge && !busy}
            onCheck={onChallenge}
            checkHint={claimText ? `${lastClaimer} claimed ${claimText}` : null}
            onMeterInfo={onMeterInfo}
            pass={yourTurn ? { onPass, disabled: busy } : null}
          />

          {/*
            The rank you are claiming, always on screen and always one line, so its place never
            moves. Once a round has a rank there is nothing to choose - the row goes inert with that
            rank lit, which says "this round is Nines" without a sentence saying it.
          */}
          <div className={`bluff-ranks ${yourTurn && !locked ? 'bluff-ranks--live' : ''}`}>
            {RANKS.map((r) => {
              const lit = r === (yourTurn ? rank : locked);
              return (
                <button
                  key={r}
                  type="button"
                  className={`bluff-ranks__rank ${lit ? 'bluff-ranks__rank--on' : ''}`}
                  onClick={() => setOpeningRank(r)}
                  disabled={!yourTurn || locked !== null}
                  aria-pressed={lit}
                  aria-label={RANK_LABEL[r]}
                >
                  {r}
                </button>
              );
            })}
          </div>

          <div className={`bluff-hand ${yourTurn ? 'bluff-hand--live' : ''}`}>
            {hand.map((code, index) => (
              <button
                key={index}
                type="button"
                className={`bluff-hand__slot ${selected.includes(index) ? 'bluff-hand__slot--picked' : ''}`}
                onClick={() => toggle(index)}
                disabled={!yourTurn}
                aria-pressed={selected.includes(index)}
                aria-label={code}
              >
                <Card code={code} />
              </button>
            ))}
          </div>

          {!yourTurn && (
            <p className="bluff-tray__waiting">
              {view.finished
                ? 'The game is over.'
                : `Waiting for ${view.opponents.find((o) => o.id === view.currentPlayerId)?.name ?? 'the table'}…`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
