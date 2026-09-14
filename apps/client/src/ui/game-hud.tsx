import { GAMEPLAY,WEAPONS,type LobbyView,type GameplayEvents } from '@ice-water/shared';
export interface KillEntry extends GameplayEvents['player/killed'] { key:number }
export function GameHud({view,localPlayerId,serverNow,feed,hitUntil,damageUntil,damageAngle,headshot,crosshair}:{view:LobbyView;localPlayerId:string;serverNow:number;feed:KillEntry[];hitUntil:number;damageUntil:number;damageAngle:number;headshot:boolean;crosshair:string}){
  const p=view.players.find(p=>p.playerId===localPlayerId);if(!p)return null;
  const time=Math.max(0,Math.ceil((view.phaseDeadline-serverNow)/1000)),weapon=WEAPONS[p.weaponId];
  const limit=view.gameMode==='tdm'?GAMEPLAY.tdmScoreLimit:view.gameMode==='duel'?GAMEPLAY.duelScoreLimit:GAMEPLAY.ffaScoreLimit;
  const name=(id:string)=>view.players.find(p=>p.playerId===id)?.displayName??'Player';
  return <div className="game-hud">
    <div className="match-clock"><span>{view.gameMode==='ffa'?'Free-for-all':view.gameMode==='tdm'?'Team deathmatch':'Duel'}</span>
      <strong>{Math.floor(time/60)}:{String(time%60).padStart(2,'0')}</strong>
      <span>{view.gameMode==='tdm'?`Ice ${view.iceScore} : ${view.waterScore} Water`:`${p.kills} / ${limit} kills`}</span></div>
    <div className="kill-feed" aria-label="Kill feed">{feed.filter(k=>serverNow-k.serverTime<6500).map(k=><p key={k.key}><b>{name(k.killerId)}</b> <span>{WEAPONS[k.weaponId].name}{k.isHeadshot?' ◆':''}</span> {name(k.victimId)}</p>)}</div>
    {p.status==='alive'&&<div className="crosshair" style={{color:crosshair}} aria-label="Crosshair">+</div>}
    {hitUntil>serverNow&&<div className={headshot?'hit-marker is-headshot':'hit-marker'} aria-label={headshot?'Headshot':'Hit'}>×</div>}
    {damageUntil>serverNow&&<div className="damage-direction" style={{transform:`translate(-50%,-50%) rotate(${damageAngle}rad)`}} aria-label="Incoming damage">▲</div>}
    <div className="health-display"><span>Health</span><strong>{Math.ceil(p.hp)}<small> / 100</small></strong><meter aria-label="Health" min={0} max={100} value={p.hp}/>{p.protectedUntil>serverNow&&<small>Spawn protection</small>}</div>
    <div className="ammo-display"><span>{weapon.name}</span><strong>{weapon.slot==='melee'?'∞':p.ammo}<small>{weapon.slot==='melee'?'':` / ${p.reserveAmmo}`}</small></strong><span>{p.reloadUntil>serverNow?'Reloading…':`Slot ${p.currentWeaponSlot+1}`}</span></div>
    <div className="desktop-controls">WASD move · Mouse aim · Space jump · Shift slide · C crouch · Ctrl sprint<br/>Click fire · Right-click aim · R reload · 1/2/3 weapons · Tab scores · Esc pause</div>
  </div>;
}
