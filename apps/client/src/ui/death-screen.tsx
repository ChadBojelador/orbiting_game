import { WEAPONS,type LobbyView,type PlayerView } from '@ice-water/shared';
export function DeathScreen({view,player,now}:{view:LobbyView;player:PlayerView;now:number}){
  const killer=view.players.find(p=>p.playerId===player.lastKillerId)?.displayName??'Opponent';
  return <div className="death-screen" role="status"><h2>Eliminated by {killer}</h2><p>{WEAPONS[player.lastDeathWeapon].name}</p>
    <strong>Respawn in {Math.max(0,Math.ceil((player.respawnAt-now)/1000))}</strong></div>;
}
