import { SUIT_NAME, type Card, type StaccsEvent, type StaccsView } from '@staccs/shared';

/** Turning engine events and game phases into the plain-English lines shown at the table. */

const RANK_NAME: Record<string, string> = { '0': 'Zero', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace', W: 'Wild' };

export function cardName(card: Card): string {
  if (card.rank === 'W') return 'a Wild';
  return `the ${RANK_NAME[card.rank] ?? card.rank} of ${SUIT_NAME[card.suit]}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function nameOf(view: StaccsView, id: string): string {
  if (id === view.you.id) return 'You';
  return view.seats.find((s) => s.id === id)?.name ?? 'Someone';
}

export function eventLine(view: StaccsView, event: StaccsEvent): string | null {
  const who = (id: string) => nameOf(view, id);
  switch (event.type) {
    case 'play': {
      const placed = view.board.placed[event.seq];
      return placed && placed.card.rank !== 'W' ? `${who(event.playerId)} stacced ${cardName(placed.card)}` : null;
    }
    case 'wild':
      return event.suit
        ? `${who(event.playerId)} played a Wild and called ${SUIT_NAME[event.suit]}`
        : `${who(event.playerId)} played a Wild`;
    case 'draw':
      if (event.reason === 'stuck') return `${who(event.playerId)} couldn't stacc and drew a card`;
      if (event.reason === 'attacc') return `${who(event.playerId)} drew ${plural(event.count, 'card')}`;
      if (event.reason === 'penalty') return `${who(event.playerId)} drew ${plural(event.count, 'card')} as a penalty`;
      return view.config.mode === 'wildout' ? `${who(event.playerId)} drew a card` : null;
    case 'attacc': {
      const what = event.rank === 'Q' ? 'gets handed' : 'has to draw';
      return `${RANK_NAME[event.rank]} ATTACC! ${who(event.targetId)} ${what} ${plural(event.count, 'card')}`;
    }
    case 'countered':
      return `${who(event.playerId)} countered! It's ${plural(event.count, 'card')} now`;
    case 'give':
      return `${who(event.fromId)} gave ${who(event.toId)} ${plural(event.count, 'card')}`;
    case 'reverse':
      return 'Direction of play reversed';
    case 'extraTurn':
      return `${who(event.playerId)} ${event.playerId === view.you.id ? 'take' : 'takes'} another turn`;
    case 'uhOh':
      return `${who(event.playerId)}: “UH OH!”`;
    case 'calledOut':
      return `${who(event.callerId)} caught ${who(event.targetId)} without an UH OH!`;
    case 'pileEmpty':
      return 'The draw pile ran out';
    case 'discard':
      return 'No match, so it went on the discard pile';
    case 'recycle':
      return 'Flipped the discard pile over for a second chance';
    case 'deal':
    case 'finished':
      return null;
  }
}

/** What the player should be doing right now, in one line. */
export function prompt(view: StaccsView, canPlay: boolean): string {
  if (view.finished) return '';
  const current = view.seats[view.currentSeat];
  const mode = view.config.mode;

  if (view.phase === 'give') {
    const target = nameOf(view, view.attacc!.targetId);
    if (view.youGive > 0) return `Queen! Pick ${plural(view.youGive, 'card')} to give ${target}`;
    return `${nameOf(view, view.attacc!.fromId)} is choosing cards to give ${target}`;
  }
  if (!view.isYourTurn) return `${current.name}'s turn`;

  if (mode === 'solo') {
    if (view.you.hand.length === 0) {
      if (view.drawCount > 0) return canPlay ? 'Draw a card, or play the top of the discard pile' : 'Draw a card';
      return canPlay ? 'Play the top of the discard pile' : 'Flip the discard pile for a second chance';
    }
    return canPlay ? 'Pick a glowing spot to stacc it' : 'No match anywhere: discard it';
  }

  if (mode === 'wildout') {
    if (view.phase === 'draw') return 'Draw a card';
    return canPlay ? 'Stacc what you can, then end your turn' : 'Nothing matches yet: end your turn';
  }

  if (view.phase === 'respond') {
    const rank = view.attacc!.rank;
    return `${RANK_NAME[rank]} ATTACC! Stacc a ${RANK_NAME[rank]} to pass it on, or take it`;
  }
  if (view.multiRank) return `Playing ${view.multiRank}s: stacc another, or finish your turn`;
  return canPlay ? 'Your turn: pick a card, then a glowing spot' : 'Nothing staccs: draw a card';
}
