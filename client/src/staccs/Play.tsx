import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MODE_NAME,
  SUIT_SYMBOL,
  SUITS,
  cardRestriction,
  isUhOh,
  kindOf,
  legalPlacements,
  type Card,
  type LegalPlacement,
  type StaccsAction,
  type StaccsView,
  type Suit,
} from '@staccs/shared';
import { CubeIcon } from './Cube';
import { suitColor } from './cubeGeometry';
import { eventLine, prompt } from './describe';
import { Finish } from './Finish';
import { Rules } from './Rules';
import { Seats } from './Seats';
import { Table, type Preview } from './Table';

interface Props {
  view: StaccsView;
  roomCode: string;
  busy: boolean;
  online: boolean;
  connected: Set<string>;
  rematchVotes: string[];
  onAction: (action: StaccsAction) => void;
  onRematch: () => void;
  onLeave: () => void;
}

/** What the player has picked up, valid only for the state it was picked against. */
interface Selection {
  seq: number;
  cardId: string | null;
  spot: string | null;
  turn: number;
  suit: Suit | null;
  giving: string[];
}

const NO_SELECTION: Omit<Selection, 'seq'> = { cardId: null, spot: null, turn: 0, suit: null, giving: [] };
const LOG_LINES = 4;

const spotKey = (s: LegalPlacement) => `${s.pos.a},${s.pos.b},${s.stack}`;

/** The cards the player can choose from: their hand, or in SoloStaccs the discard top when nothing is drawn. */
function choosable(view: StaccsView): Card[] {
  if (view.config.mode === 'solo' && view.you.hand.length === 0) return view.discardTop ? [view.discardTop] : [];
  return view.you.hand;
}

export function Play({ view, roomCode, busy, online, connected, rematchVotes, onAction, onRematch, onLeave }: Props) {
  const [picked, setPicked] = useState<Selection>({ seq: view.eventSeq, ...NO_SELECTION });
  const [log, setLog] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [admiring, setAdmiring] = useState(false);
  const seenSeq = useRef(0);

  // A selection made against an older state is stale the moment a new one arrives.
  const selection = picked.seq === view.eventSeq ? picked : { seq: view.eventSeq, ...NO_SELECTION };
  const select = (patch: Partial<Selection>) => setPicked({ ...selection, ...patch });

  useEffect(() => {
    // A fresh deal restarts the sequence numbers, so it resets the log rather than being skipped.
    const dealt = view.events.some((e) => e.type === 'deal');
    if (!dealt && view.eventSeq <= seenSeq.current) return;
    seenSeq.current = view.eventSeq;
    const lines = view.events.map((e) => eventLine(view, e)).filter((l): l is string => !!l);
    if (dealt) {
      setLog(lines);
      setAdmiring(false);
      setPicked({ seq: view.eventSeq, ...NO_SELECTION });
    } else if (lines.length > 0) {
      setLog((prev) => [...prev, ...lines].slice(-LOG_LINES));
    }
  }, [view]);

  const pool = useMemo(() => choosable(view), [view]);
  const placements = useMemo(() => {
    const byCard = new Map<string, LegalPlacement[]>();
    if (!view.isYourTurn || view.phase === 'give') return byCard;
    const ctx = {
      mode: view.config.mode,
      phase: view.phase,
      attacc: view.attacc,
      multiRank: view.multiRank,
      handSize: view.you.hand.length,
    };
    for (const card of pool) {
      if (cardRestriction(ctx, card)) continue;
      const spots = legalPlacements(view.board, card, view.blockedTops);
      if (spots.length > 0) byCard.set(card.id, spots);
    }
    return byCard;
  }, [view, pool]);

  const canPlay = placements.size > 0;
  const selectedCard = pool.find((c) => c.id === selection.cardId) ?? null;
  const spots = selectedCard ? (placements.get(selectedCard.id) ?? []) : [];
  const variants = spots.filter((s) => spotKey(s) === selection.spot);
  const chosen = variants.length > 0 ? variants[selection.turn % variants.length] : null;
  const needsSuit = !!selectedCard && kindOf(selectedCard) === 'wild' && view.config.mode !== 'wildout';
  const preview: Preview | null =
    selectedCard && chosen ? { card: selectedCard, placement: chosen, calledSuit: selection.suit } : null;
  const previewPrompt = needsSuit
    ? 'Rotate the Wild if you like, call a suit, then stacc it'
    : 'The glowing surfaces are what it lands on. Stacc it?';
  const fresh = view.events.flatMap((e) => (e.type === 'play' ? [e.seq] : []));
  const giving = view.youGive > 0;

  function tapCard(card: Card) {
    if (giving) {
      const has = selection.giving.includes(card.id);
      const next = has ? selection.giving.filter((id) => id !== card.id) : [...selection.giving, card.id];
      return select({ giving: next.slice(-view.youGive) });
    }
    if (!placements.has(card.id)) return;
    select(selection.cardId === card.id ? NO_SELECTION : { ...NO_SELECTION, cardId: card.id });
  }

  function confirm() {
    if (!selectedCard || !chosen) return;
    onAction({
      type: 'play',
      cardId: selectedCard.id,
      placement: { pos: chosen.pos, orient: chosen.orient, stack: chosen.stack },
      calledSuit: needsSuit ? selection.suit : null,
    });
  }

  const mode = view.config.mode;
  const uhOh = isUhOh(mode);
  const yours = view.isYourTurn;
  const exposedOthers = view.seats.filter((s) => s.exposed && s.id !== view.you.id);
  const canRecycle =
    mode === 'solo' &&
    view.config.secondChances &&
    !view.recycled &&
    view.drawCount === 0 &&
    view.you.hand.length === 0 &&
    view.discardCount > 0;

  return (
    <div className="staccs staccs--play">
      <header className="staccs-bar">
        <button type="button" className="portal-back" onClick={onLeave}>
          ← Leave
        </button>
        <span className="staccs-bar__mode">{MODE_NAME[mode]}</span>
        {view.config.playerCount > 1 && <span className="staccs-bar__code">{roomCode}</span>}
        {!online && <span className="staccs-bar__offline">Reconnecting…</span>}
        <button type="button" className="staccs-bar__help" onClick={() => setShowRules(true)} aria-label="How to play">
          ?
        </button>
      </header>

      <Seats view={view} connected={connected} />

      <Table
        board={view.board}
        blockedTops={view.blockedTops}
        spots={preview ? [preview.placement] : spots}
        preview={preview}
        fresh={fresh}
        onPickSpot={(spot) => select({ spot: spotKey(spot), turn: 0 })}
      />

      <section className="staccs-dock" aria-live="polite">
        <ul className="staccs-log">
          {log.map((line, i) => (
            <li key={`${view.eventSeq}-${i}`}>{line}</li>
          ))}
        </ul>
        <p className="staccs-prompt">{preview ? previewPrompt : prompt(view, canPlay)}</p>

        {preview && (
          <div className="staccs-confirm">
            {variants.length > 1 && (
              <button type="button" className="staccs-secondary" onClick={() => select({ turn: selection.turn + 1 })}>
                ↻ Rotate
              </button>
            )}
            {needsSuit && (
              <div className="staccs-suits" role="group" aria-label="Call a suit">
                {SUITS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`staccs-suit ${selection.suit === s ? 'staccs-suit--on' : ''}`}
                    style={{ color: suitColor(s) }}
                    aria-pressed={selection.suit === s}
                    onClick={() => select({ suit: s })}
                  >
                    {SUIT_SYMBOL[s]}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="staccs-primary" disabled={busy || (needsSuit && !selection.suit)} onClick={confirm}>
              {needsSuit && !selection.suit ? 'Call a suit' : 'Stacc it!'}
            </button>
            <button type="button" className="staccs-link" onClick={() => select({ spot: null })}>
              Back
            </button>
          </div>
        )}

        {!preview && (
          <div className="staccs-actions">
            {uhOh && yours && view.phase === 'turn' && !view.multiRank && (
              <button type="button" className="staccs-secondary" disabled={busy || canPlay} onClick={() => onAction({ type: 'draw' })}>
                Draw
              </button>
            )}
            {uhOh && yours && view.phase === 'respond' && (
              <button type="button" className="staccs-secondary" disabled={busy} onClick={() => onAction({ type: 'acceptAttacc' })}>
                Take it
              </button>
            )}
            {uhOh && yours && view.multiRank && (
              <button type="button" className="staccs-secondary" disabled={busy} onClick={() => onAction({ type: 'endTurn' })}>
                Finish turn
              </button>
            )}
            {uhOh && !view.finished && view.you.hand.length <= 2 && !view.you.saidUhOh && (
              <button type="button" className="staccs-uhoh" disabled={busy} onClick={() => onAction({ type: 'uhOh' })}>
                UH OH!
              </button>
            )}
            {uhOh &&
              exposedOthers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="staccs-catch"
                  disabled={busy}
                  onClick={() => onAction({ type: 'callOut', targetId: s.id })}
                >
                  Catch {s.name}!
                </button>
              ))}
            {giving && (
              <button
                type="button"
                className="staccs-primary"
                disabled={busy || selection.giving.length !== view.youGive}
                onClick={() => onAction({ type: 'give', cardIds: selection.giving })}
              >
                Give {selection.giving.length}/{view.youGive}
              </button>
            )}

            {mode === 'solo' && view.you.hand.length === 0 && view.drawCount > 0 && (
              <button type="button" className="staccs-primary" disabled={busy} onClick={() => onAction({ type: 'draw' })}>
                Draw ({view.drawCount})
              </button>
            )}
            {mode === 'solo' && view.you.hand.length > 0 && !canPlay && (
              <button type="button" className="staccs-secondary" disabled={busy} onClick={() => onAction({ type: 'discard' })}>
                Discard
              </button>
            )}
            {canRecycle && (
              <button type="button" className="staccs-secondary" disabled={busy} onClick={() => onAction({ type: 'recycle' })}>
                Flip the discard pile
              </button>
            )}

            {mode === 'wildout' && yours && view.phase === 'draw' && (
              <button type="button" className="staccs-primary" disabled={busy} onClick={() => onAction({ type: 'draw' })}>
                Draw
              </button>
            )}
            {mode === 'wildout' && yours && view.phase === 'turn' && (
              <button type="button" className="staccs-secondary" disabled={busy} onClick={() => onAction({ type: 'endTurn' })}>
                End turn
              </button>
            )}
          </div>
        )}

        <div className="staccs-hand" role="group" aria-label="Your cards">
          {mode === 'solo' && view.you.hand.length === 0 && view.discardTop && (
            <span className="staccs-hand__label">Discard top</span>
          )}
          {pool.map((card) => {
            const playable = placements.has(card.id);
            const chosenCard = selection.cardId === card.id || selection.giving.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                className={`staccs-card ${chosenCard ? 'staccs-card--on' : ''} ${playable || giving ? '' : 'staccs-card--idle'}`}
                aria-pressed={chosenCard}
                onClick={() => tapCard(card)}
              >
                <CubeIcon card={card} size={62} />
                <span className="staccs-card__tag" style={{ color: card.rank === 'W' ? '#1f5fe0' : suitColor(card.suit) }}>
                  {card.rank === 'W' ? 'WILD' : `${card.rank}${SUIT_SYMBOL[card.suit]}`}
                </span>
              </button>
            );
          })}
          {pool.length === 0 && <span className="staccs-hand__label">{mode === 'solo' ? 'Nothing drawn' : 'No cards'}</span>}
        </div>
      </section>

      {showRules && <Rules mode={mode} onClose={() => setShowRules(false)} />}
      {view.finished && !admiring && (
        <Finish
          view={view}
          votes={rematchVotes.length}
          needed={view.seats.length}
          youVoted={rematchVotes.includes(view.you.id)}
          onRematch={onRematch}
          onLeave={onLeave}
          onAdmire={() => setAdmiring(true)}
        />
      )}
      {view.finished && admiring && (
        <button type="button" className="staccs-primary staccs-float" onClick={() => setAdmiring(false)}>
          Back to the results
        </button>
      )}
    </div>
  );
}
