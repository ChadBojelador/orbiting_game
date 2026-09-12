import type { LobbyView, MatchResult } from '@ice-water/shared';

interface ResultsScreenProps {
  view: LobbyView;
  localPlayerId: string;
  result: MatchResult;
  onLeave: () => void;
}

export function ResultsScreen({ view, localPlayerId, result, onLeave }: ResultsScreenProps) {
  const localPlayer = view.players.find((p) => p.playerId === localPlayerId);
  const localTeam = localPlayer?.team ?? 'water';
  const didWin = localTeam === result.winner;

  // Sort players: Ice first, then Water; within team by freezes/rescues descending.
  const sorted = [...view.players].sort((a, b) => {
    if (a.team !== b.team) return a.team === 'ice' ? -1 : 1;
    const scoreA = a.team === 'ice' ? a.tags : a.rescues;
    const scoreB = b.team === 'ice' ? b.tags : b.rescues;
    return scoreB - scoreA;
  });

  return (
    <div className="results-screen" role="dialog" aria-labelledby="results-title">
      <div className="results-panel">
        <div className={`results-winner results-winner--${result.winner}`}>
          {result.winner === 'ice' ? '❄' : '◉'}
        </div>
        <h2 id="results-title">{result.winner === 'ice' ? 'Ice Wins!' : 'Water Wins!'}</h2>
        <p className="results-subtitle">
          {result.reason === 'all-frozen'
            ? 'Ice froze the entire Water team!'
            : 'Water survived all five rounds!'}
        </p>
        <p
          className={`results-personal ${didWin ? 'results-personal--win' : 'results-personal--lose'}`}
        >
          {didWin ? '🎉 You won!' : '💧 Better luck next time!'}
        </p>

        <table className="results-table" aria-label="Match contributions">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Team</th>
              <th scope="col">Freezes</th>
              <th scope="col">Rescues</th>
              <th scope="col">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player) => (
              <tr
                key={player.playerId}
                className={`results-row results-row--${player.team} ${player.playerId === localPlayerId ? 'results-row--local' : ''}`}
              >
                <td>
                  {player.displayName}
                  {player.playerId === localPlayerId && <small> (you)</small>}
                </td>
                <td>
                  <span className={`avatar ${player.team}`} aria-hidden="true">
                    {player.team === 'ice' ? '❄' : '◉'}
                  </span>
                  {player.team === 'ice' ? 'Ice' : 'Water'}
                </td>
                <td>{player.tags}</td>
                <td>{player.rescues}</td>
                <td>
                  {player.status === 'eliminated'
                    ? '🧊 Frozen out'
                    : player.status === 'active'
                      ? '✅ Survived'
                      : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button className="primary results-leave-btn" onClick={onLeave} id="results-leave-btn">
          Back to lobby
        </button>
      </div>
    </div>
  );
}
