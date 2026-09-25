import type { LobbyView, MatchResult } from '@ice-water/shared';
import { Scoreboard } from './scoreboard.js';
export function ResultsScreen({
  view,
  localPlayerId,
  result,
  onLeave,
}: {
  view: LobbyView;
  localPlayerId: string;
  result: MatchResult;
  onLeave: () => void;
}) {
  const winner =
    result.winner === 'draw'
      ? 'Draw'
      : (view.players.find((p) => p.playerId === result.winner)?.displayName ??
        (result.winner === 'ice' ? 'Ice' : 'Water'));
  return (
    <div className="results-screen">
      <h1>
        {winner}
        {result.winner === 'draw' ? '' : ' wins'}
      </h1>
      <p>
        {result.reason === 'all-frozen'
          ? 'All Water frozen'
          : result.reason === 'water-survived'
            ? '60% of Water survived'
            : 'Fewer than 60% of Water remained unfrozen'}
      </p>
      <Scoreboard view={view} localPlayerId={localPlayerId} />
      <button className="primary" onClick={onLeave}>
        Back to lobby
      </button>
      <small>This room closes after the results.</small>
    </div>
  );
}
