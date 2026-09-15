import { useEffect, useRef, useState } from 'react';
import {
  sanitizeDisplayName,
  normalizeInviteCode,
  type GuestSession,
  type LobbyView,
  type GameMode,
  type MapId,
  type SessionError,
  type GameplayEvents,
  type WeaponId,
} from '@ice-water/shared';
import {
  createGuest,
  readGuest,
  forgetGuest,
  reserveRoom,
  reconnectRoom,
  saveReconnect,
  clearReconnect,
  snapshot,
  type LobbyRoom,
} from '../network/lobby-client.js';
import { ServerClock } from '../network/server-clock.js';
import type { GameScene } from '../game/game-scene.js';
import { readSettings, saveSettings } from '../game/fps-settings.js';
import { LobbyAudio } from '../audio/lobby-audio.js';
import { GameHud, type KillEntry } from './game-hud.js';
import { TouchControls } from './touch-controls.js';
import { Scoreboard } from './scoreboard.js';
import { DeathScreen } from './death-screen.js';
import { ResultsScreen } from './results-screen.js';
import { SettingsPanel } from './settings-panel.js';
import { LobbyScreen } from './lobby-screen.js';

export function App() {
  const [guest, setGuest] = useState<GuestSession | null>(readGuest);
  const [room, setRoom] = useState<LobbyRoom | null>(null),
    [view, setView] = useState<LobbyView | null>(null);
  const [error, setError] = useState(''),
    [isBusy, setBusy] = useState(true),
    [connection, setConnection] = useState('Connected');
  const [scene, setScene] = useState<GameScene | null>(null),
    [now, setNow] = useState(0),
    [settings, setSettings] = useState(readSettings);
  const [, refreshMapStatus] = useState(0);
  const [isSettings, setIsSettings] = useState(false),
    [feed, setFeed] = useState<KillEntry[]>([]);
  const [hit, setHit] = useState({ until: 0, headshot: false }),
    [damage, setDamage] = useState({ until: 0, angle: 0 });
  const canvas = useRef<HTMLCanvasElement>(null),
    roomRef = useRef<LobbyRoom | null>(null),
    sceneRef = useRef<GameScene | null>(null);
  const clock = useRef(new ServerClock()),
    feedKey = useRef(0),
    roomCleanup = useRef<(() => void)[]>([]);
  const lobbyAudio = useRef<LobbyAudio | null>(null);
  if (!lobbyAudio.current) lobbyAudio.current = new LobbyAudio(settings);
  const isInGame = !!view && !['lobby', 'countdown'].includes(view.phase);
  const isComplete = view?.phase === 'finished' || view?.phase === 'intermission';

  useEffect(() => {
    if (isComplete) {
      document.exitPointerLock();
      sceneRef.current?.getInput().reset();
    }
  }, [isComplete]);
  useEffect(() => {
    let active = true;
    void reconnectRoom()
      .then((next) => {
        if (next && active) attach(next);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to reconnect');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    const timer = window.setInterval(() => setNow(clock.current.now()), 100);
    return () => {
      active = false;
      window.clearInterval(timer);
      roomCleanup.current.forEach((cleanup) => cleanup());
    };
  }, []);
  useEffect(() => {
    const audio = lobbyAudio.current;
    return () => audio?.destroy();
  }, []);
  useEffect(() => {
    if (!isInGame || !room || !guest || !canvas.current) return;
    let active = true;
    const element = canvas.current;
    void import('../game/game-scene.js').then(({ GameScene }) => {
      if (!active) return;
      try {
        const next = new GameScene(element, room, guest.playerId, () =>
          refreshMapStatus((value) => value + 1),
        );
        sceneRef.current = next;
        setScene(next);
      } catch {
        setError('Unable to start 3D. Enable WebGL 2 in your browser and reload.');
      }
    });
    return () => {
      active = false;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      setScene(null);
    };
  }, [isInGame, room, guest]);
  useEffect(() => {
    saveSettings(settings);
    if (scene) scene.settings = settings;
    lobbyAudio.current?.setSettings(settings);
    lobbyAudio.current?.setActive(!isInGame);
  }, [settings, scene, isInGame]);
  useEffect(() => {
    if (!scene) return;
    scene.isPaused = isSettings;
    if (isSettings) {
      document.exitPointerLock();
      scene.getInput().reset();
      scene.getInput().isEnabled = false;
    } else scene.getInput().isEnabled = scene.isTouch || scene.isLocked;
  }, [isSettings, scene]);

  function attach(next: LobbyRoom) {
    roomCleanup.current.forEach((cleanup) => cleanup());
    roomCleanup.current = [];
    roomRef.current = next;
    setRoom(next);
    setError('');
    setFeed([]);
    setConnection('Connected');
    const update = () => {
      if (!next.state?.players) return;
      const current = snapshot(next.state);
      setView(current);
      clock.current.update(current.serverTime);
      setNow(clock.current.now());
    };
    next.onStateChange(update);
    roomCleanup.current.push(() => next.onStateChange.remove(update));
    roomCleanup.current.push(
      next.onMessage<SessionError>('session/error', (message) => setError(message.message)),
    );
    roomCleanup.current.push(
      next.onMessage('match/phase-changed', () => setError('')),
      next.onMessage('match/result', () => {}),
    );
    roomCleanup.current.push(
      next.onMessage('player/respawned', () => {}),
      next.onMessage('weapon/fired', () => {}),
    );
    roomCleanup.current.push(
      next.onMessage<GameplayEvents['player/killed']>('player/killed', (message) =>
        setFeed((old) => [...old.slice(-4), { ...message, key: ++feedKey.current }]),
      ),
    );
    roomCleanup.current.push(
      next.onMessage<GameplayEvents['player/hit']>('player/hit', (message) => {
        const localId = readGuest()?.playerId;
        if (message.attackerId === localId)
          setHit({ until: message.serverTime + 200, headshot: message.isHeadshot });
        if (message.victimId === localId) {
          const players = [...next.state.players.values()],
            attacker = players.find((player) => player.playerId === message.attackerId),
            victim = players.find((player) => player.playerId === message.victimId);
          const yaw = sceneRef.current?.getInput().cameraYaw ?? 0,
            angle =
              attacker && victim
                ? Math.atan2(attacker.x - victim.x, -(attacker.z - victim.z)) + yaw
                : 0;
          setDamage({ until: message.serverTime + 450, angle });
        }
      }),
    );
    const drop = () => setConnection('Reconnecting…'),
      reconnect = () => {
        setConnection('Connected');
        saveReconnect(next);
      };
    next.onDrop(drop);
    next.onReconnect(reconnect);
    roomCleanup.current.push(
      () => next.onDrop.remove(drop),
      () => next.onReconnect.remove(reconnect),
    );
    next.onError((_code, message) => setError(message ?? 'Room connection failed'));
    next.onLeave(() => {
      if (roomRef.current !== next) return;
      const complete = next.state.phase === 'finished' || next.state.phase === 'intermission';
      roomRef.current = null;
      clearReconnect();
      setRoom(null);
      setView(null);
      setError(complete ? '' : 'Your room connection ended. Create a room or join again.');
    });
    update();
  }

  async function run(action: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to complete this action. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  function identify(name: string) {
    const value = sanitizeDisplayName(name);
    if (!value) {
      setError('Choose a name with 2–20 letters or numbers.');
      return;
    }
    void run(async () => setGuest(await createGuest(value)));
  }
  async function create(mode: GameMode, mapId: MapId, primary: WeaponId) {
    if (!guest) return;
    const next = await reserveRoom(guest);
    attach(next);
    next.send('room/configure', { gameMode: mode, mapId });
    next.send('player/loadout', { primaryWeapon: primary });
  }
  function join(code: string, primary: WeaponId) {
    const invite = normalizeInviteCode(code);
    if (!invite) {
      setError('Enter the eight-character invite code from your host.');
      return;
    }
    if (guest)
      void run(async () => {
        const next = await reserveRoom(guest, invite);
        attach(next);
        next.send('player/loadout', { primaryWeapon: primary });
      });
  }
  async function leave() {
    if (!room) return;
    roomRef.current = null;
    clearReconnect();
    await room.leave();
    setRoom(null);
    setView(null);
    setError('');
  }

  const local = view?.players.find((player) => player.playerId === guest?.playerId);
  const settingsPanel = isSettings && (
    <div className="modal-backdrop">
      <SettingsPanel value={settings} onChange={setSettings} onClose={() => setIsSettings(false)} />
    </div>
  );
  if (isInGame && view && guest) {
    const complete = view.phase === 'finished' || view.phase === 'intermission';
    return (
      <main className={scene?.isTouch ? 'game-shell is-touch' : 'game-shell'}>
        <canvas className="game-canvas" ref={canvas} aria-label="3D game arena" />
        {!complete && (
          <GameHud
            view={view}
            localPlayerId={guest.playerId}
            serverNow={now}
            feed={feed}
            hitUntil={hit.until}
            damageUntil={damage.until}
            damageAngle={damage.angle}
            headshot={hit.headshot}
            crosshair={settings.crosshair}
          />
        )}
        {scene?.isTouch && !complete && !isSettings && (
          <TouchControls input={scene.getInput()} slot={local?.currentWeaponSlot ?? 0} />
        )}
        {!complete && local?.status === 'dead' && (
          <DeathScreen view={view} player={local} now={now} />
        )}
        {!complete && scene?.getInput().isScoreboard && (
          <div className="scoreboard-overlay">
            <Scoreboard view={view} localPlayerId={guest.playerId} ping={scene.session.ping} />
          </div>
        )}
        {!complete && scene && !scene.isMapReady && (
          <div className="pause-screen">
            <h2>{scene.hasMapError ? 'Frost Island failed to load' : 'Loading Frost Island…'}</h2>
            {scene.hasMapError && <button onClick={() => leave()}>Back to lobby</button>}
          </div>
        )}
        {!complete &&
          scene &&
          scene.isMapReady &&
          !scene.isTouch &&
          !scene.isLocked &&
          !isSettings && (
            <div className="pause-screen">
              <h2>{view.mapId === 'island' ? 'Frost Island' : 'Frostline'}</h2>
              <p>Click to aim. Esc releases your cursor.</p>
              <button className="primary" onClick={() => scene.lock()}>
                Enter arena
              </button>
            </div>
          )}
        {complete && (
          <ResultsScreen
            view={view}
            localPlayerId={guest.playerId}
            result={{
              winner: view.matchWinner,
              reason: view.resultReason || 'time-limit',
              gameMode: view.gameMode,
            }}
            onLeave={() => void run(leave)}
          />
        )}
        <nav className="game-menu">
          <button onClick={() => setIsSettings(true)}>Settings</button>
          <button onClick={() => void run(leave)} disabled={isBusy}>
            Leave room
          </button>
        </nav>
        {connection !== 'Connected' && (
          <p className="connection-banner" role="status">
            {connection}
          </p>
        )}
        {error && (
          <p className="error-toast" role="alert">
            {error}
          </p>
        )}
        {settingsPanel}
      </main>
    );
  }

  return (
    <LobbyScreen
      guest={guest}
      room={room}
      view={view}
      error={error}
      isBusy={isBusy}
      now={now}
      settings={settings}
      onSettings={setSettings}
      onIdentify={identify}
      onCreate={(mode, mapId, weapon) => void run(() => create(mode, mapId, weapon))}
      onJoin={join}
      onLeave={() => void run(leave)}
      onForgetGuest={() => {
        forgetGuest();
        setGuest(null);
        setError('');
      }}
      onAudioUnlock={() => void lobbyAudio.current?.unlock()}
      onUiCue={(cue) => lobbyAudio.current?.cue(cue)}
    />
  );
}
