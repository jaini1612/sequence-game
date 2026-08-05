import type { CardCode } from '@sequence/shared';

const SUIT_SYMBOL: Record<string, string> = { D: '♦', H: '♥', C: '♣', S: '♠' };
const RED_SUITS = new Set(['D', 'H']);

function parseCard(code: CardCode): { rank: string; suit: string } {
  const suit = code.slice(-1);
  const rank = code.slice(0, -1);
  return { rank, suit };
}

export function Card({
  code,
  selected,
  playable,
  dead,
  onClick,
}: {
  code: CardCode;
  selected?: boolean;
  playable?: boolean;
  dead?: boolean;
  onClick?: () => void;
}) {
  const { rank, suit } = parseCard(code);
  const isRed = RED_SUITS.has(suit);
  const className = [
    'card',
    isRed ? 'card--red' : 'card--black',
    selected ? 'card--selected' : '',
    playable ? 'card--playable' : '',
    dead ? 'card--dead' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const face = (
    <>
      <span className="card__rank">{rank}</span>
      <span className="card__suit">{SUIT_SYMBOL[suit]}</span>
    </>
  );

  // Render as a plain div (not a disabled button) when non-interactive: a disabled <button>
  // swallows the click instead of letting it bubble to the containing board cell's handler.
  if (!onClick) {
    return <div className={className}>{face}</div>;
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {face}
    </button>
  );
}
