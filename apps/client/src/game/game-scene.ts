/**
 * GameScene — top-level PlayCanvas app for in-game play.
 * Manages third-person follow camera, arena, player entities, and the per-frame loop.
 * Connects to GameSession (networking) and GameInput (controls).
 */
import type { LobbyRoom } from '../network/lobby-client.js';
import { GameSession } from '../network/game-session.js';
import { GAMEPLAY } from '@ice-water/shared';
import { loadCharacterModel } from './character-model.js';

const CAMERA_HEIGHT = 7;
const CAMERA_DISTANCE = 10;
const CAMERA_FOV = 55;
// Smooth-follow spring for camera yaw to avoid jarring snaps.
const CAM_SMOOTH = 0.12;

export class GameScene {
  private readonly session: GameSession;
  private destroyed = false;
  private animFrame = 0;
  private cameraYaw = 0; // current smooth yaw
  private targetCameraYaw = 0;
  private lastPointer: { x: number; y: number } | null = null;
  private readonly cleanups: (() => void)[] = [];

  // PlayCanvas objects allocated after dynamic import.
  private pc?: typeof import('playcanvas');
  private app?: import('playcanvas').Application;
  private arenaScene?: import('./arena-scene.js').ArenaScene;
  private playerEntities?: import('./player-entity.js').PlayerEntityManager;
  private camera?: import('playcanvas').Entity;
  private cameraTarget?: import('playcanvas').Entity;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    room: LobbyRoom,
    playerId: string,
    private readonly onStateChange?: (phase: string) => void,
  ) {
    this.session = new GameSession(room, playerId);
    void this.initPlayCanvas();
    this.bindCameraControls();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.animFrame);
    this.session.destroy();
    for (const fn of this.cleanups) fn();
    this.arenaScene?.destroy();
    this.playerEntities?.destroy();
    this.app?.destroy();
  }

  getInput() {
    return this.session.input;
  }

  private async initPlayCanvas(): Promise<void> {
    const [pcModule, { ArenaScene }, { PlayerEntityManager }] = await Promise.all([
      import('playcanvas'),
      import('./arena-scene.js'),
      import('./player-entity.js'),
    ]);
    if (this.destroyed) return;
    this.pc = pcModule;

    const app = new pcModule.Application(this.canvas, {
      graphicsDeviceOptions: { deviceTypes: ['webgl2', 'webgl1'], antialias: true, alpha: false },
    });
    this.app = app;

    const resize = () => {
      const parent = this.canvas.parentElement;
      if (!parent) return;
      app.setCanvasFillMode(pcModule.FILLMODE_NONE, parent.clientWidth, parent.clientHeight);
      app.setCanvasResolution(pcModule.RESOLUTION_AUTO);
    };
    const observer = new ResizeObserver(resize);
    if (this.canvas.parentElement) observer.observe(this.canvas.parentElement);
    resize();
    this.cleanups.push(() => observer.disconnect());

    // Camera rig: pivot entity at player position, camera offset above and behind.
    const cameraTarget = new pcModule.Entity('cam-target');
    cameraTarget.setPosition(0, 1, 0);
    app.root.addChild(cameraTarget);
    this.cameraTarget = cameraTarget;

    const camera = new pcModule.Entity('camera');
    camera.addComponent('camera', {
      clearColor: new pcModule.Color(0.52, 0.78, 0.88),
      fov: CAMERA_FOV,
      farClip: 300,
    });
    app.root.addChild(camera);
    this.camera = camera;

    const halfExtent = this.session.view.arenaHalfExtent ?? 28;
    this.arenaScene = new ArenaScene(app, pcModule, halfExtent);
    const characterModel = await loadCharacterModel(app, pcModule).catch((error: unknown) => {
      console.warn(error);
      return undefined;
    });
    if (this.destroyed) {
      app.destroy();
      return;
    }
    this.playerEntities = new PlayerEntityManager(app, pcModule, characterModel);

    app.start();

    // Listen for arena boundary changes.
    this.cleanups.push(
      this.session['room' as keyof typeof this.session] !== undefined
        ? (() => {
            return () => {};
          })()
        : (() => {
            return () => {};
          })(),
    );

    this.loop();
  }

  private loop(): void {
    if (this.destroyed) return;
    const { pc, app, camera, cameraTarget, arenaScene, playerEntities, session } = this;
    if (!pc || !app || !camera || !cameraTarget || !arenaScene || !playerEntities) {
      this.animFrame = requestAnimationFrame(() => this.loop());
      return;
    }

    const view = session.view;

    // Notify parent on phase change.
    if (this.onStateChange) this.onStateChange(view.phase);

    // Arena boundary.
    const halfExtent = view.arenaHalfExtent ?? 28;
    arenaScene.setHalfExtent(halfExtent);

    // Resolve positions for all players.
    const serverNow = session.serverNow();
    const renderTime = serverNow - GAMEPLAY.interpolationMs;
    const positions = new Map<string, { x: number; z: number; yaw: number }>();

    const localPlayer = session.local();
    for (const player of view.players) {
      if (player.playerId === session.playerId) {
        // Use client-predicted position for local player.
        const pred = session.prediction;
        positions.set(player.playerId, { x: pred.position.x, z: pred.position.z, yaw: pred.yaw });
      } else {
        const interp = session.remotes.get(player.playerId);
        const sample = interp?.at(renderTime);
        if (sample) {
          positions.set(player.playerId, { x: sample.x, z: sample.z, yaw: sample.yaw });
        } else {
          positions.set(player.playerId, { x: player.x, z: player.z, yaw: player.yaw });
        }
      }
    }

    // Update player entities.
    playerEntities.update(view, positions, session.playerId);

    // Camera: smooth yaw from input, then position behind/above local player.
    this.cameraYaw += (this.targetCameraYaw - this.cameraYaw) * CAM_SMOOTH;
    session.input.cameraYaw = this.cameraYaw;

    const localPos = localPlayer
      ? (positions.get(localPlayer.playerId) ?? { x: 0, z: 0 })
      : { x: 0, z: 0 };
    const camX = localPos.x + Math.sin(this.cameraYaw) * CAMERA_DISTANCE;
    const camZ = localPos.z + Math.cos(this.cameraYaw) * CAMERA_DISTANCE;
    camera.setPosition(camX, CAMERA_HEIGHT, camZ);
    cameraTarget.setPosition(localPos.x, 1.2, localPos.z);
    camera.lookAt(cameraTarget.getPosition());

    app.renderNextFrame = true;
    this.animFrame = requestAnimationFrame(() => this.loop());
  }

  private bindCameraControls(): void {
    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!this.lastPointer) return;
      const dx = e.clientX - this.lastPointer.x;
      this.targetCameraYaw -= dx * 0.006;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => {
      this.lastPointer = null;
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    this.cleanups.push(() => {
      this.canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    });
  }
}
