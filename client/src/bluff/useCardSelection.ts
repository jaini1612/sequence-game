import { useEffect, useRef, useState } from 'react';
import { RANKS, rankOf, type BluffView, type CardCode, type Rank } from '@bluff/shared';

/**
 * Which cards you have picked up ready to play, and what you intend to call them.
 *
 * It lives up here rather than inside the hand because two different parts of the screen need it now
 * - the hand you tap, and the play button down on the table - and a single owner is the only way
 * they can agree on what is selected.
 */
export interface CardSelection {
  /** Hand indices, not card codes: a scrambled deck deals duplicates, and tapping one of a pair
   *  must not select both. */
  selected: number[];
  /** The rank the claim will be made at: the round's, or the one you picked to open with. */
  rank: Rank;
  toggle: (index: number) => void;
  setOpeningRank: (rank: Rank) => void;
}

/** The rank you hold most of - the honest opening, and so the sensible default. */
function commonestRank(hand: CardCode[]): Rank {
  const counts = new Map<Rank, number>();
  for (const card of hand) {
    const rank = rankOf(card);
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  let best: Rank = RANKS[0];
  let bestCount = -1;
  for (const rank of RANKS) {
    const count = counts.get(rank) ?? 0;
    if (count > bestCount) {
      best = rank;
      bestCount = count;
    }
  }
  return best;
}

export function useCardSelection(view: BluffView | null, onOverdraw: () => void): CardSelection {
  const [selected, setSelected] = useState<number[]>([]);
  /**
   * The same list in a ref, so the claim cap is enforced against what is *actually* selected. Taps
   * arriving faster than React re-renders all close over the same stale `selected`, and a check
   * against the state variable lets a quick flurry sail straight past the limit.
   */
  const selectedRef = useRef<number[]>([]);
  const [openingRank, setOpeningRank] = useState<Rank>('A');

  const hand = view?.you.hand ?? [];
  const locked = view?.roundRank ?? null;
  const eventSeq = view?.eventSeq ?? 0;
  /** Read inside effects rather than listed as a dependency, so they fire on real updates only. */
  const handRef = useRef(hand);
  handRef.current = hand;

  function replace(next: number[]) {
    selectedRef.current = next;
    setSelected(next);
  }

  // A new hand, or cards taken from the pile, invalidates whatever was selected.
  useEffect(() => {
    replace([]);
  }, [hand.length, eventSeq]);

  /*
   * Opening a round starts on the rank you actually hold the most of, which is the honest play - and
   * therefore the most useful thing to lie about.
   *
   * Keyed on the update counter rather than the hand array: the hand is a fresh array on every
   * render when there is no view, and re-running this on ordinary renders would quietly overwrite a
   * rank the player had just chosen for themselves.
   */
  useEffect(() => {
    const current = handRef.current;
    if (!locked && current.length > 0) setOpeningRank(commonestRank(current));
  }, [locked, eventSeq]);

  function toggle(index: number) {
    if (!view?.isYourTurn) return;
    const current = selectedRef.current;
    if (current.includes(index)) {
      replace(current.filter((i) => i !== index));
      return;
    }
    if (current.length >= view.maxClaim) {
      // Silently swallowing the tap reads as a broken card. The Jack explains instead.
      onOverdraw();
      return;
    }
    replace([...current, index]);
  }

  return { selected, rank: locked ?? openingRank, toggle, setOpeningRank };
}
