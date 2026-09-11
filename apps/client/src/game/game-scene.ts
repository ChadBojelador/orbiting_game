/**
 * GameScene — top-level PlayCanvas app for in-game play.
 * Manages third-person follow camera, arena, player entities, and the per-frame loop.
 * Connects to GameSession (networking) and GameInput (controls).
 */
import type { LobbyRoom } from '../network/lobby-client.js';
import { GameSession } from '../network/game-session.js';
import { GAMEPLAY } from '@ice-water/shared';
import { loadCharacterModel } from './character-model.js';
import { ThirdPersonCamera } from './third-person-camera.js';

const CAMERA_FOV = 55;
const CAMERA_TARGET_HEIGHT = 1.2;

export class GameScene {
  private readonly session: GameSession;
  private readonly cameraController = new ThirdPersonCamera();
  private destroyed = false;
  private animFrame = 0;
  private lastFrameAt = 0;
  private lastPointer: { x: number; y: number } | null = null;
  private activePointerId: number | null = null;
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

    this.loop(performance.now());
  }

  private loop(frameAt: number): void {
    if (this.destroyed) return;
    const { pc, app, camera, cameraTarget, arenaScene, playerEntities, session } = this;
    if (!pc || !app || !camera || !cameraTarget || !arenaScene || !playerEntities) {
      this.animFrame = requestAnimationFrame((time) => this.loop(time));
      return;
    }
    const seconds = this.lastFrameAt
      ? Math.min(0.1, Math.max(0, (frameAt - this.lastFrameAt) / 1000))
      : 0;
    this.lastFrameAt = frameAt;

    const view = session.view;

    // Notify parent on phase change.
    if (this.onStateChange) this.onStateChange(view.phase);

    // Arena boundary.
    const halfExtent = view.arenaHalfExtent ?? 28;
    arenaScene.setHalfExtent(halfExtent);

    // Resolve positions for all players.
    const serverNow = session.serverNow();
    const renderTime = serverNow - GAMEPLAY.interpolationMs;
    const positions = new Map<string, { x: number; y: number; z: number; yaw: number }>();

    const localPlayer = session.local();
    for (const player of view.players) {
      if (player.playerId === session.playerId) {
        // Use client-predicted position for local player.
        const pred = session.prediction;
        positions.set(player.playerId, {
          x: pred.position.x,
          y: arenaScene.getGroundHeight(pred.position.x, pred.position.z),
          z: pred.position.z,
          yaw: pred.yaw,
        });
      } else {
        const interp = session.remotes.get(player.playerId);
        const sample = interp?.at(renderTime);
        if (sample) {
          positions.set(player.playerId, {
            x: sample.x,
            y: arenaScene.getGroundHeight(sample.x, sample.z),
            z: sample.z,
            yaw: sample.yaw,
          });
        } else {
          positions.set(player.playerId, {
            x: player.x,
            y: arenaScene.getGroundHeight(player.x, player.z),
            z: player.z,
            yaw: player.yaw,
          });
        }
      }
    }

    // Update player entities.
    playerEntities.update(view, positions, session.playerId);

    const localPos = localPlayer
      ? (positions.get(localPlayer.playerId) ?? { x: 0, y: 0, z: 0 })
      : { x: 0, y: 0, z: 0 };
    const pose = this.cameraController.update(
      { x: localPos.x, y: localPos.y + CAMERA_TARGET_HEIGHT, z: localPos.z },
      seconds,
      arenaScene.getCameraObstacles(),
      (x, z) => arenaScene.getGroundHeight(x, z),
    );
    session.input.cameraYaw = pose.yaw;
    camera.setPosition(pose.position.x, pose.position.y, pose.position.z);
    cameraTarget.setPosition(pose.target.x, pose.target.y, pose.target.z);
    camera.lookAt(cameraTarget.getPosition());

    app.renderNextFrame = true;
    this.animFrame = requestAnimationFrame((time) => this.loop(time));
  }

  private bindCameraControls(): void {
    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) return;
      this.activePointerId = e.pointerId;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!this.lastPointer || e.pointerId !== this.activePointerId) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.cameraController.orbit(dx, dy);
      this.lastPointer = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      if (this.canvas.hasPointerCapture(e.pointerId))
        this.canvas.releasePointerCapture(e.pointerId);
      this.lastPointer = null;
      this.activePointerId = null;
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    this.cleanups.push(() => {
      if (this.activePointerId !== null && this.canvas.hasPointerCapture(this.activePointerId)) {
        this.canvas.releasePointerCapture(this.activePointerId);
      }
      this.canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    });
  }
}
