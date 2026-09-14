import { GAMEPLAY,WEAPONS,type LobbyView,type PlayerView,type GameplayEvent,type GameplayEvents } from '@ice-water/shared';
import { GameInput } from '../input/game-input.js';
import { snapshot,type LobbyRoom } from './lobby-client.js';
import { LocalPrediction,RemoteInterpolation } from './player-motion.js';
import { ServerClock } from './server-clock.js';
export class GameSession {
  readonly input=new GameInput();readonly prediction=new LocalPrediction();readonly remotes=new Map<string,RemoteInterpolation>();
  readonly events:GameplayEvent[]=[];view:LobbyView;isConnected=true;ping=0;
  private clock=new ServerClock();private nextShotAt=0;private lastGeneration=-1;
  private cleanups:(()=>void)[]=[];
  constructor(private readonly room:LobbyRoom,readonly playerId:string){
    this.view=snapshot(room.state);
    const update=()=>{
      this.view=snapshot(room.state);this.prediction.mapId=this.view.mapId;this.clock.update(this.view.serverTime);
      for(const p of this.view.players){
        if(p.playerId===playerId){
          if(p.spawnGeneration!==this.lastGeneration){this.nextShotAt=0;this.lastGeneration=p.spawnGeneration;this.input.cameraYaw=p.yaw;this.input.cameraPitch=p.pitch;this.input.reset();}
          this.prediction.reconcile(p,this.canMove(p));
        }else{
          let remote=this.remotes.get(p.playerId);if(!remote){remote=new RemoteInterpolation();this.remotes.set(p.playerId,remote);}
          remote.push(p,this.view.serverTime);
        }
      }
    };
    room.onStateChange(update);this.cleanups.push(()=>room.onStateChange.remove(update));
    const drop=()=>{this.isConnected=false;this.input.reset();this.prediction.reset();};
    const reconnect=()=>{this.isConnected=true;this.input.reset();this.prediction.reset();update();};
    room.onDrop(drop);room.onReconnect(reconnect);
    this.cleanups.push(()=>room.onDrop.remove(drop),()=>room.onReconnect.remove(reconnect));
    const subscribe=<K extends keyof GameplayEvents>(type:K)=>{
      const remove=room.onMessage<GameplayEvents[K]>(type,payload=>{
        // The event name selects the corresponding payload from the shared protocol.
        this.events.push({type,payload} as GameplayEvent);if(this.events.length>64)this.events.shift();
      });this.cleanups.push(remove);
    };
    subscribe('weapon/fired');subscribe('player/hit');subscribe('player/killed');subscribe('player/respawned');
    this.cleanups.push(room.onMessage<{sentAt:number}>('session/pong',p=>{this.ping=Math.max(0,Math.round(performance.now()-p.sentAt));}));
    update();
    const tick=window.setInterval(()=>this.tick(),GAMEPLAY.tickMs);
    const ping=window.setInterval(()=>{if(this.isConnected)room.send('session/ping',{sentAt:performance.now()});},2000);
    this.cleanups.push(()=>window.clearInterval(tick),()=>window.clearInterval(ping),this.input.bind(window));
  }
  serverNow():number{return this.clock.now();}
  local():PlayerView|undefined{return this.view.players.find(p=>p.playerId===this.playerId);}
  canMove(p:PlayerView):boolean{return this.isConnected && p.isConnected && p.status==='alive' && this.view.phase==='playing' && this.serverNow()<this.view.phaseDeadline;}
  destroy():void{this.cleanups.forEach(c=>c());this.input.reset();}
  private tick():void {
    const p=this.local();if(!p || !this.isConnected || this.view.phase!=='playing')return;
    const sample=this.input.sample(),now=this.serverNow();
    const active=this.canMove(p)&&this.input.isEnabled&&!document.hidden;
    const intent=active?{x:sample.x,z:sample.z,yaw:sample.yaw,pitch:sample.pitch,jump:sample.jump,slide:sample.slide,crouch:sample.crouch,sprint:sample.sprint}:{x:0,z:0};
    this.room.send('input/move',this.prediction.predict(intent,this.canMove(p),now,WEAPONS[p.weaponId].moveSpeedMultiplier));
    if(!active)return;
    if(sample.slot!==undefined){this.room.send('action/switch-weapon',{slot:sample.slot});return;}
    if(sample.hasReload){this.room.send('action/reload',{});return;}
    const weapon=WEAPONS[p.weaponId];
    const wantsShot=sample.hasShot || (sample.isFiring && weapon.fireMode==='auto');
    if(wantsShot && now>=Math.max(this.nextShotAt,p.fireReadyAt) && !p.reloadUntil && p.ammo>0){
      this.room.send('action/shoot',{yaw:sample.yaw,pitch:sample.pitch,isAds:sample.isAds});
      this.nextShotAt=now+weapon.fireRateMs;
    }
  }
}
