import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isDeadCard, type CardCode, type PlayerView } from '@sequence/shared';
import { Card } from './Card';

/**
 * A card in hand needs an identity that survives being moved, because a hand can legitimately hold
 * two of the same card and its position is exactly what changes. Without one, React would key on
 * position, tear the node down on every reorder, and there would be nothing left to animate.
 */
interface HeldCard {
  uid: number;
  card: CardCode;
}

let nextUid = 0;
const hold = (card: CardCode): HeldCard => ({ uid: nextUid++, card });

/**
 * Keeps the player's own arrangement of their hand across server updates.
 *
 * The server sends the hand in its own order and has no idea the player has rearranged it, so the
 * ordering lives here: cards that are still in hand keep their slot, cards that left drop out, and
 * freshly drawn ones go on the end rather than shuffling everything along.
 */
function useOrderedHand(hand: CardCode[]): [HeldCard[], (from: number, to: number) => void] {
  const [order, setOrder] = useState<HeldCard[]>(() => hand.map(hold));
  const key = hand.join(',');
  const lastKey = useRef(key);

  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    setOrder((current) => {
      // Reconcile by card value and count, since duplicates are possible.
      const remaining = [...hand];
      const kept: HeldCard[] = [];
      for (const held of current) {
        const at = remaining.indexOf(held.card);
        if (at !== -1) {
          kept.push(held);
          remaining.splice(at, 1);
        }
      }
      return [...kept, ...remaining.map(hold)];
    });
  }, [key, hand]);

  // Stable, so the drag listeners below are not torn down and re-added on every pointermove.
  const move = useCallback((from: number, to: number) => {
    setOrder((current) => {
      if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) {
        return current;
      }
      const next = [...current];
      const [held] = next.splice(from, 1);
      next.splice(to, 0, held);
      return next;
    });
  }, []);

  return [order, move];
}

const SLIDE_MS = 220;

/**
 * Slides cards to their new places instead of letting them jump (the FLIP approach): each slot's
 * position is remembered, and after a reorder the node is offset back to where it was and then
 * released, so the browser animates the difference.
 */
function useSlideOnReorder(nodes: React.RefObject<Map<number, HTMLElement>>) {
  const previous = useRef(new Map<number, number>());

  useLayoutEffect(() => {
    const current = new Map<number, number>();

    for (const [uid, node] of nodes.current ?? []) {
      const left = node.getBoundingClientRect().left;
      current.set(uid, left);

      const before = previous.current.get(uid);
      if (before === undefined || Math.abs(before - left) < 0.5) continue;

      node.style.transition = 'none';
      node.style.transform = `translateX(${before - left}px)`;
      requestAnimationFrame(() => {
        node.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
        node.style.transform = '';
      });
    }

    previous.current = current;
  });
}

export function Hand({
  view,
  canPlay,
  selectedCard,
  onSelectCard,
  onDiscardDeadCard,
}: {
  view: PlayerView;
  /** Whether a selected card can actually be played right now. Selection itself is always allowed. */
  canPlay: boolean;
  selectedCard: CardCode | null;
  onSelectCard: (card: CardCode) => void;
  onDiscardDeadCard: (card: CardCode) => void;
}) {
  const [order, move] = useOrderedHand(view.you.hand);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const nodes = useRef(new Map<number, HTMLElement>());

  useSlideOnReorder(nodes);

  // Pointer events rather than HTML5 drag-and-drop, which does not fire on touch devices.
  function handlePointerDown(index: number) {
    return (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      setDragFrom(index);
      setDragOver(index);
    };
  }

  function slotIndexAt(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY)?.closest('.hand__slot');
    const raw = el?.getAttribute('data-index');
    return raw == null ? null : Number(raw);
  }

  useEffect(() => {
    if (dragFrom === null) return;

    function onMove(e: PointerEvent) {
      const over = slotIndexAt(e.clientX, e.clientY);
      if (over !== null) setDragOver(over);
    }
    function onUp(e: PointerEvent) {
      const over = slotIndexAt(e.clientX, e.clientY);
      if (over !== null && dragFrom !== null) move(dragFrom, over);
      setDragFrom(null);
      setDragOver(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragFrom, move]);

  return (
    <div className="hand" role="list">
      {order.map(({ uid, card }, idx) => {
        const dead = canPlay && !view.deadCardDiscardedThisTurn && isDeadCard(view, card);
        const dragging = dragFrom === idx;
        const isDropTarget = dragFrom !== null && dragOver === idx && !dragging;

        return (
          <div
            key={uid}
            ref={(el) => {
              if (el) nodes.current.set(uid, el);
              else nodes.current.delete(uid);
            }}
            role="listitem"
            data-index={idx}
            className={[
              'hand__slot',
              dragging ? 'hand__slot--dragging' : '',
              isDropTarget ? 'hand__slot--drop' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onPointerDown={handlePointerDown(idx)}
          >
            <Card
              code={card}
              selected={selectedCard === card}
              // Always selectable: picking a card off-turn lights up its squares on the board.
              onClick={() => onSelectCard(card)}
              dead={dead}
            />
            {dead && (
              <button
                type="button"
                className="hand__discard"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onDiscardDeadCard(card)}
              >
                Discard
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
