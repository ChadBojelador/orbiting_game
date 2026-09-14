import type { LobbyView } from '@ice-water/shared';
export function Scoreboard({view,localPlayerId,ping=0}:{view:LobbyView;localPlayerId:string;ping?:number}){
  const rows=[...view.players].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths);
  return <section className="scoreboard" aria-label="Scoreboard">
    <h2>{view.gameMode==='tdm'?'Ice vs Water':view.gameMode==='duel'?'Duel':'Free-for-all'}</h2>
    <table><thead><tr><th>Player</th><th>Kills</th><th>Deaths</th><th>K/D</th><th>Ping</th></tr></thead>
      <tbody>{rows.map(p=><tr key={p.playerId} className={p.playerId===localPlayerId?'is-local':''}>
        <td>{p.displayName}{p.playerId===localPlayerId?' (you)':''}{view.gameMode==='tdm'? ` · ${p.team}`:''}{!p.isConnected?' · Away':''}</td>
        <td>{p.kills}</td><td>{p.deaths}</td><td>{(p.kills/Math.max(1,p.deaths)).toFixed(1)}</td><td>{p.isBot?'Bot':p.playerId===localPlayerId&&ping>0?`${ping} ms`:'—'}</td>
      </tr>)}</tbody></table>
  </section>;
}
