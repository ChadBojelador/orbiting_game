import type { LobbyView,MatchResult } from '@ice-water/shared';
import { Scoreboard } from './scoreboard.js';
export function ResultsScreen({view,localPlayerId,result,onLeave}:{view:LobbyView;localPlayerId:string;result:MatchResult;onLeave:()=>void}){
  const winner=result.winner==='draw'?'Draw':view.players.find(p=>p.playerId===result.winner)?.displayName??(result.winner==='ice'?'Ice':'Water');
  return <div className="results-screen"><h1>{winner}{result.winner==='draw'?'':' wins'}</h1><p>{result.reason==='score-limit'?'Score limit reached':'Time is up'}</p>
    <Scoreboard view={view} localPlayerId={localPlayerId}/><button className="primary" onClick={onLeave}>Back to lobby</button><small>This room closes after the results.</small></div>;
}
