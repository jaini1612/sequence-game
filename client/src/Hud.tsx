import { SEQUENCES_TO_WIN, type PlayerView } from '@sequence/shared';

export function Hud({ view, isMyTurn }: { view: PlayerView; isMyTurn: boolean }) {
  const mySequences = view.sequences.filter((s) => s.playerId === view.you.id).length;
  const opponentSequences = view.sequences.filter((s) => s.playerId === view.opponent.id).length;

  return (
    <div className="hud">
      <div className={`hud__player hud__player--${view.you.color.toLowerCase()}`}>
        <span className="hud__label">You</span>
        <span>{mySequences} / {SEQUENCES_TO_WIN} sequences</span>
      </div>
      <div className="hud__turn">{isMyTurn ? 'Your turn' : "Opponent's turn"}</div>
      <div className={`hud__player hud__player--${view.opponent.color.toLowerCase()}`}>
        <span className="hud__label">Opponent</span>
        <span>{opponentSequences} / {SEQUENCES_TO_WIN} sequences</span>
      </div>
    </div>
  );
}
