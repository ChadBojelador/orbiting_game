import { lazy,Suspense,useEffect,useRef,useState,type FormEvent } from 'react';
import { sanitizeDisplayName,normalizeInviteCode,type GuestSession,type LobbyView,type GameMode,type SessionError,type GameplayEvents,type WeaponId } from '@ice-water/shared';
import { createGuest,readGuest,forgetGuest,reserveRoom,reconnectRoom,saveReconnect,clearReconnect,snapshot,type LobbyRoom } from '../network/lobby-client.js';
import { ServerClock } from '../network/server-clock.js';
import type { GameScene } from '../game/game-scene.js';
import { readSettings,saveSettings } from '../game/fps-settings.js';
import { GameHud,type KillEntry } from './game-hud.js';
import { TouchControls } from './touch-controls.js';
import { Scoreboard } from './scoreboard.js';
import { DeathScreen } from './death-screen.js';
import { ResultsScreen } from './results-screen.js';
import { LoadoutScreen } from './loadout-screen.js';
import { SettingsPanel } from './settings-panel.js';
const LobbyPreview=lazy(()=>import('../game/lobby-preview.js').then(m=>({default:m.LobbyPreview})));
export function App(){
  const [guest,setGuest]=useState<GuestSession|null>(readGuest),[name,setName]=useState(''),[code,setCode]=useState('');
  const [room,setRoom]=useState<LobbyRoom|null>(null),[view,setView]=useState<LobbyView|null>(null);
  const [error,setError]=useState(''),[isBusy,setBusy]=useState(true),[connection,setConnection]=useState('Connected');
  const [scene,setScene]=useState<GameScene|null>(null),[now,setNow]=useState(0),[settings,setSettings]=useState(readSettings);
  const [isSettings,setIsSettings]=useState(false),[feed,setFeed]=useState<KillEntry[]>([]);
  const [hit,setHit]=useState({until:0,headshot:false}),[damage,setDamage]=useState({until:0,angle:0});
  const [copy,setCopy]=useState('Copy invite code'),[mode,setMode]=useState<GameMode>('ffa');
  const [primary,setPrimary]=useState<WeaponId>('assault-rifle');
  const canvas=useRef<HTMLCanvasElement>(null),roomRef=useRef<LobbyRoom|null>(null),sceneRef=useRef<GameScene|null>(null);
  const clock=useRef(new ServerClock()),feedKey=useRef(0),roomCleanup=useRef<(()=>void)[]>([]);
  const isInGame=!!view && !['lobby','countdown'].includes(view.phase);
  const isComplete=view?.phase==='finished'||view?.phase==='intermission';
  useEffect(()=>{
    if(isComplete){document.exitPointerLock();sceneRef.current?.getInput().reset();}
  },[isComplete]);
  useEffect(()=>{
    let active=true;
    void reconnectRoom().then(next=>{if(next&&active)attach(next);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to reconnect');}).finally(()=>{if(active)setBusy(false);});
    const timer=window.setInterval(()=>setNow(clock.current.now()),100);
    return ()=>{active=false;window.clearInterval(timer);roomCleanup.current.forEach(c=>c());};
  },[]);
  useEffect(()=>{
    if(!isInGame||!room||!guest||!canvas.current)return;
    let active=true;const element=canvas.current;
    void import('../game/game-scene.js').then(({GameScene})=>{
      if(!active)return;
      try{const next=new GameScene(element,room,guest.playerId);sceneRef.current=next;setScene(next);}
      catch{setError('Unable to start 3D. Enable WebGL 2 in your browser and reload.');}
    });
    return ()=>{active=false;sceneRef.current?.destroy();sceneRef.current=null;setScene(null);};
  },[isInGame,room,guest]);
  useEffect(()=>{saveSettings(settings);if(scene)scene.settings=settings;},[settings,scene]);
  useEffect(()=>{
    if(!scene)return;
    if(isSettings){document.exitPointerLock();scene.getInput().reset();scene.getInput().isEnabled=false;}
    else scene.getInput().isEnabled=scene.isTouch||scene.isLocked;
  },[isSettings,scene]);
  function attach(next:LobbyRoom){
    roomCleanup.current.forEach(c=>c());roomCleanup.current=[];roomRef.current=next;setRoom(next);setError('');setFeed([]);setConnection('Connected');
    const update=()=>{if(!next.state?.players)return;const v=snapshot(next.state);setView(v);clock.current.update(v.serverTime);setNow(clock.current.now());};
    next.onStateChange(update);roomCleanup.current.push(()=>next.onStateChange.remove(update));
    roomCleanup.current.push(next.onMessage<SessionError>('session/error',m=>setError(m.message)));
    roomCleanup.current.push(next.onMessage('match/phase-changed',()=>setError('')),next.onMessage('match/result',()=>{}));
    roomCleanup.current.push(next.onMessage('player/respawned',()=>{}),next.onMessage('weapon/fired',()=>{}));
    roomCleanup.current.push(next.onMessage<GameplayEvents['player/killed']>('player/killed',m=>setFeed(old=>[...old.slice(-4),{...m,key:++feedKey.current}])));
    roomCleanup.current.push(next.onMessage<GameplayEvents['player/hit']>('player/hit',m=>{
      const local=readGuest()?.playerId;
      if(m.attackerId===local)setHit({until:m.serverTime+200,headshot:m.isHeadshot});
      if(m.victimId===local){
        const players=[...next.state.players.values()],attacker=players.find(p=>p.playerId===m.attackerId),victim=players.find(p=>p.playerId===m.victimId);
        const yaw=sceneRef.current?.getInput().cameraYaw??0;
        const angle=attacker&&victim?Math.atan2(attacker.x-victim.x,-(attacker.z-victim.z))+yaw:0;
        setDamage({until:m.serverTime+450,angle});
      }
    }));
    const drop=()=>setConnection('Reconnecting…'),reconnect=()=>{setConnection('Connected');saveReconnect(next);};
    next.onDrop(drop);next.onReconnect(reconnect);roomCleanup.current.push(()=>next.onDrop.remove(drop),()=>next.onReconnect.remove(reconnect));
    next.onError((_code,message)=>setError(message??'Room connection failed'));
    next.onLeave(()=>{
      if(roomRef.current!==next)return;
      const complete=next.state.phase==='finished'||next.state.phase==='intermission';
      roomRef.current=null;clearReconnect();setRoom(null);setView(null);
      setError(complete?'':'Your room connection ended. Create a room or join again.');
    });
    update();
  }
  async function run(action:()=>Promise<void>){setError('');setBusy(true);try{await action();}catch(e){setError(e instanceof Error?e.message:'Unable to complete this action. Try again.');}finally{setBusy(false);}}
  function identify(e:FormEvent){e.preventDefault();const value=sanitizeDisplayName(name);if(!value){setError('Choose a name with 2–20 letters or numbers.');return;}void run(async()=>setGuest(await createGuest(value)));}
  async function create(){if(!guest)return;const next=await reserveRoom(guest);attach(next);next.send('room/configure',{gameMode:mode});next.send('player/loadout',{primaryWeapon:primary});}
  function join(e:FormEvent){e.preventDefault();const invite=normalizeInviteCode(code);if(!invite){setError('Enter the eight-character invite code from your host.');return;}if(guest)void run(async()=>{const next=await reserveRoom(guest,invite);attach(next);next.send('player/loadout',{primaryWeapon:primary});});}
  async function leave(){if(!room)return;roomRef.current=null;clearReconnect();await room.leave();setRoom(null);setView(null);setError('');}
  const local=view?.players.find(p=>p.playerId===guest?.playerId);
  const isHost=view?.hostPlayerId===guest?.playerId,count=view?.players.filter(p=>p.isConnected).length??0;
  const seconds=Math.max(0,Math.ceil(((view?.phaseDeadline??0)-now)/1000));
  const settingsPanel=isSettings&&<div className="modal-backdrop"><SettingsPanel value={settings} onChange={setSettings} onClose={()=>setIsSettings(false)}/></div>;
  if(isInGame&&view&&guest){
    const complete=view.phase==='finished'||view.phase==='intermission';
    return <main className="game-shell">
      <canvas className="game-canvas" ref={canvas} aria-label="3D game arena"/>
      {!complete&&<GameHud view={view} localPlayerId={guest.playerId} serverNow={now} feed={feed} hitUntil={hit.until} damageUntil={damage.until} damageAngle={damage.angle} headshot={hit.headshot} crosshair={settings.crosshair}/>}
      {scene?.isTouch&&!complete&&!isSettings&&<TouchControls input={scene.getInput()} slot={local?.currentWeaponSlot??0}/>}
      {!complete&&local?.status==='dead'&&<DeathScreen view={view} player={local} now={now}/>}
      {!complete&&scene?.getInput().isScoreboard&&<div className="scoreboard-overlay"><Scoreboard view={view} localPlayerId={guest.playerId} ping={scene.session.ping}/></div>}
      {!complete&&scene&&!scene.isTouch&&!scene.isLocked&&!isSettings&&<div className="pause-screen"><h2>Frostline</h2><p>Click to aim. Esc releases your cursor.</p><button className="primary" onClick={()=>scene.lock()}>Enter arena</button></div>}
      {complete&&<ResultsScreen view={view} localPlayerId={guest.playerId} result={{winner:view.matchWinner,reason:view.resultReason||'time-limit',gameMode:view.gameMode}} onLeave={()=>void run(leave)}/>}
      <nav className="game-menu"><button onClick={()=>setIsSettings(true)}>Settings</button><button onClick={()=>void run(leave)} disabled={isBusy}>Leave room</button></nav>
      {connection!=='Connected'&&<p className="connection-banner" role="status">{connection}</p>}
      {error&&<p className="error-toast" role="alert">{error}</p>}{settingsPanel}
    </main>;
  }
  return <main className="lobby-shell">
    <header className="lobby-header"><a href="/" className="brand">Ice Ice Water!</a><div><span>Private playtest</span><button onClick={()=>setIsSettings(true)}>Settings</button></div></header>
    <section className="arena-stage"><Suspense fallback={<div className="preview-fallback"/>}><LobbyPreview/></Suspense>
      <div className="arena-title"><h1>Ice Ice<br/>Water!</h1><p>Cold arena. Quick reflexes.</p></div>
      <div className="map-caption"><strong>Frostline</strong><span>Three lanes. Six weapons. One more match.</span></div>
    </section>
    <section className="lobby-board" aria-label="Private room lobby" aria-busy={isBusy}>
      {!guest?<><h2>Ready to play?</h2><p>Choose a name. Invite your friends.</p><form onSubmit={identify}><label htmlFor="display-name">Display name</label><input id="display-name" value={name} onChange={e=>setName(e.target.value)} maxLength={100} autoComplete="nickname" placeholder="Your player name" required/><small>2–20 characters. No account needed.</small><button className="primary" disabled={isBusy}>{isBusy?'Connecting…':'Let’s go'}</button></form></>
      :!room?<><h2>Welcome, {guest.displayName}</h2><p>Host a match or enter an invite code.</p>
        <label htmlFor="game-mode">Game mode</label><select id="game-mode" value={mode} onChange={e=>setMode(e.target.value as GameMode)}><option value="ffa">Free-for-all</option><option value="tdm">Team deathmatch</option><option value="duel">Duel · 1v1</option></select>
        <button className="primary" onClick={()=>void run(create)} disabled={isBusy||guest.expiresAt<=Date.now()}>Create private room</button>
        <form className="join-form" onSubmit={join}><label htmlFor="invite-code">Invite code</label><div><input id="invite-code" value={code} onChange={e=>setCode(e.target.value)} maxLength={8} placeholder="ABCDEFGH" autoCapitalize="characters" required/><button type="submit" disabled={isBusy}>Join room</button></div></form>
        <LoadoutScreen value={primary} onChange={setPrimary}/>
        <button className="text-button" onClick={()=>{forgetGuest();setGuest(null);}}>Change name</button>
      </>:!view?<p role="status">Joining your room…</p>:<>
        <h2>{view.phase==='countdown'?`Starting in ${seconds}`:'Your room is ready'}</h2>
        <p role="status" aria-label="Connected players">{count} / {view.maxPlayers} connected</p>
        <output className="invite-output" aria-label="Room invite code">{view.inviteCode}</output>
        <button onClick={()=>void navigator.clipboard.writeText(view.inviteCode).then(()=>setCopy('Copied!'),()=>setCopy('Select and copy the code above'))}>{copy}</button>
        <label htmlFor="room-mode">Game mode</label><select id="room-mode" value={view.gameMode} disabled={!isHost||view.phase!=='lobby'} onChange={e=>room.send('room/configure',{gameMode:e.target.value})}><option value="ffa">Free-for-all</option><option value="tdm">Team deathmatch</option><option value="duel">Duel · 1v1</option></select>
        <LoadoutScreen value={local?.primaryWeapon??primary} onChange={id=>room.send('player/loadout',{primaryWeapon:id})} disabled={view.phase!=='lobby'}/>
        <ul className="roster">{view.players.map(p=><li key={p.playerId}><span>{p.displayName}</span><small>{p.playerId===view.hostPlayerId?'Host':p.isBot?'Practice bot':p.isConnected?'Ready':'Away'}</small></li>)}</ul>
        {isHost?<button className="primary" disabled={view.phase!=='lobby'||count<view.minPlayers} onClick={()=>room.send('room/start',{})}>Start countdown</button>:<p>Waiting for the host to start.</p>}
        <small>{count===1?'Start solo to learn the map, or invite a friend.':'Share the code before starting. New joins close at countdown.'}</small>
        <button className="text-button" onClick={()=>void run(leave)}>Leave room</button>
      </>}
      {error&&<p className="inline-error" role="alert">{error}</p>}
    </section>
    <footer className="lobby-footer"><p><strong>Move fast. Make it count.</strong><span>Jump and slide through cover. Respawn and get back in.</span></p><span>Keyboard & mouse + touch</span></footer>
    {settingsPanel}
  </main>;
}
