import { GAMEPLAY,WEAPONS,surfaceAt,type PlayerView } from '@ice-water/shared';
import { Scene,PerspectiveCamera,WebGLRenderer,Color,Fog,HemisphereLight,DirectionalLight,Group,Mesh,BoxGeometry,MeshStandardMaterial,SRGBColorSpace } from 'three';
import { GameSession } from '../network/game-session.js';
import type { LobbyRoom } from '../network/lobby-client.js';
import { LocalPresentation } from '../network/player-motion.js';
import { FrostlineMap } from '../world/frostline-map.js';
import { FirstPersonCamera } from './first-person-camera.js';
import { WeaponRenderer } from './weapon-renderer.js';
import { HitEffects } from './hit-effects.js';
import { AudioManager } from '../audio/audio-manager.js';
import { readSettings,type FpsSettings } from './fps-settings.js';
import { renderPixelRatio } from './render-performance.js';
export class GameScene {
  readonly session:GameSession;settings:FpsSettings=readSettings();isLocked=false;
  readonly isTouch=matchMedia('(pointer: coarse)').matches;
  private readonly scene=new Scene();private readonly camera=new PerspectiveCamera(96,1,0.05,140);
  private renderer:WebGLRenderer;private world:FrostlineMap;
  private cameraMotion=new FirstPersonCamera();private presentation=new LocalPresentation();
  private weapon:WeaponRenderer;private effects:HitEffects;private audio=new AudioManager();
  private readonly players=new Map<string,Group>();private readonly materials=new Map<string,MeshStandardMaterial>();
  private body=new BoxGeometry(0.65,1.15,0.42);private head=new BoxGeometry(0.5,0.45,0.48);
  private cleanups:(()=>void)[]=[];private frame=0;private destroyed=false;private previous=performance.now();private lastStep=0;
  private remoteSteps=new Map<string,number>();private wasGrounded=true;private wasSliding=false;private wasReloading=false;
  constructor(private readonly canvas:HTMLCanvasElement,room:LobbyRoom,playerId:string){
    this.session=new GameSession(room,playerId);
    this.renderer=new WebGLRenderer({canvas,antialias:!this.isTouch,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=SRGBColorSpace;
    this.scene.background=new Color(0xc5e4ef);this.scene.fog=new Fog(0xc5e4ef,65,135);
    this.scene.add(new HemisphereLight(0xedfaff,0x41617b,2.5));
    const sun=new DirectionalLight(0xfff0d0,2);sun.position.set(-30,60,20);this.scene.add(sun);
    this.world=new FrostlineMap(this.scene);this.scene.add(this.camera);
    this.weapon=new WeaponRenderer(this.camera);this.effects=new HitEffects(this.scene);
    this.session.input.isEnabled=this.isTouch;
    const resize=()=>{const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;this.renderer.setPixelRatio(Math.min(this.isTouch?1.4:2,renderPixelRatio(w,h,devicePixelRatio)));this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();this.cleanups.push(()=>observer.disconnect());
    this.bindControls();this.loop(performance.now());
  }
  getInput(){return this.session.input;}
  lock():void {this.audio.unlock();this.canvas.tabIndex=0;this.canvas.focus();if(!this.isTouch)void this.canvas.requestPointerLock()?.catch(()=>{});}
  destroy():void{
    if(this.destroyed)return;this.destroyed=true;cancelAnimationFrame(this.frame);
    this.cleanups.forEach(c=>c());if(document.pointerLockElement===this.canvas)document.exitPointerLock();
    this.session.destroy();this.weapon.destroy();this.effects.destroy();this.world.destroy();this.audio.destroy();
    this.body.dispose();this.head.dispose();this.materials.forEach(m=>m.dispose());this.renderer.dispose();
  }
  private bindControls():void {
    const input=this.session.input;
    const lock=()=>{this.isLocked=document.pointerLockElement===this.canvas;input.isEnabled=this.isTouch||this.isLocked;if(!this.isLocked)input.reset();};
    const down=(e:PointerEvent)=>{this.audio.unlock();if(e.pointerType==='touch')return;if(!this.isLocked){this.lock();return;}if(e.button===0)input.pressFire();if(e.button===2)input.isAds=true;};
    const up=(e:PointerEvent)=>{if(e.pointerType==='touch')return;if(e.button===0)input.isFiring=false;if(e.button===2)input.isAds=false;};
    const move=(e:MouseEvent)=>{if(this.isLocked)input.look(e.movementX,e.movementY);};
    const wheel=(e:WheelEvent)=>{if(this.isLocked){e.preventDefault();input.switchWeapon((this.session.local()?.currentWeaponSlot??0)+(e.deltaY>0?1:-1));}};
    const context=(e:Event)=>e.preventDefault();
    this.canvas.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);document.addEventListener('mousemove',move);
    document.addEventListener('pointerlockchange',lock);this.canvas.addEventListener('wheel',wheel,{passive:false});this.canvas.addEventListener('contextmenu',context);
    const unlockAudio=()=>this.audio.unlock();window.addEventListener('pointerdown',unlockAudio,{once:true});
    this.cleanups.push(()=>{this.canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);document.removeEventListener('mousemove',move);document.removeEventListener('pointerlockchange',lock);this.canvas.removeEventListener('wheel',wheel);this.canvas.removeEventListener('contextmenu',context);window.removeEventListener('pointerdown',unlockAudio);});
  }
  private model(player:PlayerView):Group {
    let model=this.players.get(player.playerId);if(model)return model;
    model=new Group();
    const torso=new Mesh(this.body,this.material('body',0x308cad));torso.position.y=0.9;
    const head=new Mesh(this.head,this.material('head',0xedf6fa));head.position.y=1.575;
    model.add(torso,head);this.scene.add(model);this.players.set(player.playerId,model);return model;
  }
  private material(key:string,color:number):MeshStandardMaterial {
    let material=this.materials.get(key);if(!material){material=new MeshStandardMaterial({color,roughness:0.65});this.materials.set(key,material);}return material;
  }
  private loop(now:number):void{
    if(this.destroyed)return;
    const seconds=Math.min(0.05,Math.max(0,(now-this.previous)/1000));this.previous=now;
    const session=this.session,p=session.local(),serverNow=session.serverNow(),input=session.input;
    input.sensitivity=this.settings.sensitivity*0.002;this.audio.volume=this.settings.volume;
    if(p){
      const predicted=session.prediction.motion;
      const pos=this.presentation.update({...predicted,yaw:input.cameraYaw},seconds,p.status!=='alive');
      const eye=this.cameraMotion.update(pos,predicted,seconds,this.settings.reducedEffects);
      this.camera.position.set(eye.x,eye.y,eye.z);this.camera.rotation.order='YXZ';this.camera.rotation.set(input.cameraPitch,input.cameraYaw,0);
      const fov=input.isAds?WEAPONS[p.weaponId].adsZoomFov:this.settings.fov;
      this.camera.fov+=(fov-this.camera.fov)*(1-Math.exp(-18*seconds));this.camera.updateProjectionMatrix();
      this.weapon.update(p.weaponId,now,seconds,input.isAds,p.reloadUntil>serverNow,this.settings.reducedEffects);
      this.audio.listener(eye,input.cameraYaw);
      if(p.status==='alive'){
        if(Math.hypot(predicted.velocityX,predicted.velocityZ)>1 && predicted.isGrounded && now-this.lastStep>320){this.audio.play(surfaceAt(predicted));this.lastStep=now;}
        if(this.wasGrounded&&!predicted.isGrounded)this.audio.play('jump');
        if(!this.wasGrounded&&predicted.isGrounded)this.audio.play('land');
        if(!this.wasSliding&&predicted.isSliding)this.audio.play('slide');
        if(!this.wasReloading&&p.reloadUntil>serverNow)this.audio.play('reload');
      }
      this.wasGrounded=predicted.isGrounded;this.wasSliding=predicted.isSliding;this.wasReloading=p.reloadUntil>serverNow;
    }
    for(const remote of session.view.players){
      if(remote.playerId===session.playerId)continue;
      const model=this.model(remote);model.visible=remote.status==='alive';
      const position=session.remotes.get(remote.playerId)?.at(serverNow-GAMEPLAY.interpolationMs)??remote;
      model.position.set(position.x,position.y,position.z);model.rotation.y=position.yaw;
      model.scale.y=remote.isCrouching||remote.isSliding?0.61:1;
      const friend=session.view.gameMode==='tdm'&&remote.team===p?.team;
      const key=remote.protectedUntil>serverNow?'protected':friend?'friend':'enemy';
      (model.children[0] as Mesh).material=this.material(key,key==='protected'?0xf3b747:friend?0x308cad:0xe96958);
      if(model.visible&&Math.hypot(remote.velocityX,remote.velocityZ)>1&&remote.isGrounded&&p&&Math.hypot(remote.x-p.x,remote.z-p.z)<35&&now-(this.remoteSteps.get(remote.playerId)??0)>380){
        this.audio.play(surfaceAt(remote),remote);this.remoteSteps.set(remote.playerId,now);
      }
    }
    for(const event of session.events.splice(0)){
      const local=session.playerId;
      if(event.type==='weapon/fired'){
        if(!this.settings.reducedEffects)this.effects.shot(event.payload.origin,event.payload.end,now);
        this.audio.play('shot',event.payload.playerId===local?undefined:event.payload.origin);
        if(event.payload.playerId===local){
          this.weapon.fire(now);
          if(!this.settings.reducedEffects)input.cameraPitch=Math.min(Math.PI*89/180,input.cameraPitch+WEAPONS[event.payload.weaponId].recoilVertical*Math.PI/180);
        }
      }
      if(event.type==='player/hit'&&event.payload.attackerId===local)this.audio.play(event.payload.isHeadshot?'headshot':'hit');
      if(event.type==='player/killed'&&event.payload.killerId===local)this.audio.play('kill');
    }
    this.effects.update(now);this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(t=>this.loop(t));
  }
}
