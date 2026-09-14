import { GAMEPLAY, WEAPONS, bodyHeight, eyeHeight, lookDirection, rayBox, worldRayDistance, type GameplayEvent, type ShootIntent, type SpatialPosition } from '@ice-water/shared';
import type { LobbyState, PlayerState } from '../rooms/lobby-state.js';

export function fireHitscan(state:LobbyState,attacker:PlayerState,intent:ShootIntent,now:number,emit:(event:GameplayEvent)=>void,random:()=>number=Math.random):void {
  const stats=WEAPONS[attacker.weaponId];
  const origin={x:attacker.x,y:attacker.y+eyeHeight(attacker),z:attacker.z};
  let end:SpatialPosition=origin;
  for(let pellet=0;pellet<stats.pelletsPerShot;pellet++){
    const spread=intent.isAds?stats.adsSpread:stats.spread;
    const direction=lookDirection(intent.yaw+(random()*2-1)*spread,intent.pitch+(random()*2-1)*spread);
    let distance=worldRayDistance(origin,direction,stats.range);
    let victim:PlayerState|undefined;
    for(const player of state.players.values()){
      if(player.playerId===attacker.playerId || player.status!=='alive')continue;
      const hit=rayBox(origin,direction,
        {x:player.x-GAMEPLAY.playerRadius,y:player.y,z:player.z-GAMEPLAY.playerRadius},
        {x:player.x+GAMEPLAY.playerRadius,y:player.y+bodyHeight(player),z:player.z+GAMEPLAY.playerRadius},distance);
      if(hit!==null && hit<distance){victim=player;distance=hit;}
    }
    end={x:origin.x+direction.x*distance,y:origin.y+direction.y*distance,z:origin.z+direction.z*distance};
    // Teammates and protected bodies block the shot without receiving damage.
    if(!victim || victim.protectedUntil>now || (state.gameMode==='tdm' && victim.team===attacker.team))continue;
    const isHeadshot=end.y>=victim.y+bodyHeight(victim)*(1-GAMEPLAY.headHitboxRatio);
    const falloff=stats.falloffEnd>stats.falloffStart?Math.max(0,Math.min(1,(distance-stats.falloffStart)/(stats.falloffEnd-stats.falloffStart))):0;
    const damage=Math.min(victim.hp,Math.round(stats.damage*(1-falloff*(1-stats.falloffMinDamage))*(isHeadshot?stats.headshotMultiplier:1)));
    victim.hp-=damage;victim.velocityX+=direction.x*1.2;victim.velocityZ+=direction.z*1.2;
    emit({type:'player/hit',payload:{attackerId:attacker.playerId,victimId:victim.playerId,damage,isHeadshot,weaponId:attacker.weaponId,serverTime:now}});
    if(victim.hp>0)continue;
    victim.status='dead';victim.deaths++;victim.respawnAt=now+GAMEPLAY.respawnDelayMs;
    victim.lastKillerId=attacker.playerId;victim.lastDeathWeapon=attacker.weaponId;
    victim.isSliding=false;victim.reloadUntil=0;victim.velocityX=0;victim.velocityZ=0;
    attacker.kills++;
    if(state.gameMode==='tdm'){if(attacker.team==='ice')state.iceScore++;else state.waterScore++;}
    emit({type:'player/killed',payload:{killerId:attacker.playerId,victimId:victim.playerId,weaponId:attacker.weaponId,isHeadshot,serverTime:now}});
  }
  emit({type:'weapon/fired',payload:{playerId:attacker.playerId,weaponId:attacker.weaponId,origin,end,serverTime:now}});
}
