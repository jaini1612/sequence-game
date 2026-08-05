export function WaitingRoom({ roomCode, players }: { roomCode: string; players: { name: string }[] }) {
  return (
    <div className="waiting">
      <h2>Waiting for opponent…</h2>
      <p className="waiting__code">
        Room code: <strong>{roomCode}</strong>
      </p>
      <p>Share this code with the person you want to play against.</p>
      <ul className="waiting__players">
        {players.map((p, i) => (
          <li key={i}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}
