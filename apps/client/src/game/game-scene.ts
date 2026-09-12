import { ARENA, GAMEPLAY } from '@ice-water/shared';
import * as THREE from 'three';
import type { LobbyRoom } from '../network/lobby-client.js';
import { GameSession } from '../network/game-session.js';
import { LocalPresentation, type PresentationMotion } from '../network/player-motion.js';
import { WorldLayout, WORLD_CAMERA_FAR, worldHeightAt } from '../world/world-layout.js';
import { loadCharacterModel } from './character-model.js';
import { PlayerEntityManager } from './player-entity.js';
import { renderPixelRatio } from './render-performance.js';
import { ThirdPersonCamera } from './third-person-camera.js';

const CAMERA_FOV = 52;

export class GameScene {
  private readonly session: GameSession;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, WORLD_CAMERA_FAR);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly world: WorldLayout;
  private readonly followCamera = new ThirdPersonCamera();
  private readonly localPresentation = new LocalPresentation();
  private readonly positions = new Map<string, PresentationMotion>();
  private readonly cameraTarget = new THREE.Vector3();
  private playerEntities?: PlayerEntityManager;
  private destroyed = false;
  private animationFrame = 0;
  private lastPointer: { x: number; y: number } | null = null;
  private previousFrameTime = performance.now();
  private previousPhase = '';
  private readonly cleanups: (() => void)[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    room: LobbyRoom,
    playerId: string,
    private readonly onStateChange?: (phase: string) => void,
  ) {
    this.session = new GameSession(room, playerId);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(0xaeddf0);
    this.scene.fog = new THREE.Fog(0xc8e9ec, 250, 560);
    this.configureLighting();
    this.world = new WorldLayout(this.scene, this.session.view.arenaHalfExtent || ARENA.halfExtent);
    this.bindResize();
    this.bindCameraControls();
    void this.initializePlayers();
    this.loop(performance.now());
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrame);
    this.session.destroy();
    for (const cleanup of this.cleanups) cleanup();
    this.playerEntities?.destroy();
    this.world.destroy();
    this.renderer.dispose();
  }

  getInput() {
    return this.session.input;
  }

  private configureLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xcaf4ff, 0x658060, 1.65);
    hemisphere.name = 'sky-fill';
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffe3b5, 2.35);
    sun.name = 'warm-sun';
    sun.position.set(-85, 135, 75);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -220;
    sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220;
    sun.shadow.camera.bottom = -220;
    sun.shadow.camera.near = 30;
    sun.shadow.camera.far = 520;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  private async initializePlayers(): Promise<void> {
    const characterModel = await loadCharacterModel().catch((error: unknown) => {
      console.warn(error);
      return undefined;
    });
    if (this.destroyed) return;
    this.playerEntities = new PlayerEntityManager(this.scene, characterModel);
  }

  private bindResize(): void {
    const resize = () => {
      const parent = this.canvas.parentElement;
      if (!parent) return;
      const width = Math.max(1, parent.clientWidth);
      const height = Math.max(1, parent.clientHeight);
      this.renderer.setPixelRatio(renderPixelRatio(width, height, window.devicePixelRatio));
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    if (this.canvas.parentElement) observer.observe(this.canvas.parentElement);
    resize();
    this.cleanups.push(() => observer.disconnect());
  }

  private loop(now: number): void {
    if (this.destroyed) return;
    const deltaSeconds = Math.min(0.05, Math.max(0, (now - this.previousFrameTime) / 1000));
    this.previousFrameTime = now;
    const view = this.session.view;
    if (view.phase !== this.previousPhase) {
      this.previousPhase = view.phase;
      this.onStateChange?.(view.phase);
    }
    this.world.setHalfExtent(view.arenaHalfExtent || ARENA.halfExtent);
    this.world.update(now / 1000);

    const serverNow = this.session.serverNow();
    const renderTime = serverNow - GAMEPLAY.interpolationMs;
    const positions = this.positions;
    positions.clear();
    const localPlayer = this.session.local();
    for (const player of view.players) {
      if (player.playerId === this.session.playerId) {
        const prediction = this.session.prediction;
        positions.set(
          player.playerId,
          this.localPresentation.update(
            {
              x: prediction.position.x,
              y: prediction.y,
              z: prediction.position.z,
              yaw: prediction.yaw,
            },
            deltaSeconds,
            !this.session.canMove(player),
          ),
        );
        continue;
      }
      const sample = this.session.remotes
        .get(player.playerId)
        ?.at(renderTime, view.arenaHalfExtent || ARENA.halfExtent);
      positions.set(
        player.playerId,
        sample
          ? { x: sample.x, y: sample.y, z: sample.z, yaw: sample.yaw }
          : { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
      );
    }
    this.playerEntities?.update(view, positions, this.session.playerId, deltaSeconds);

    const localPosition = localPlayer
      ? (positions.get(localPlayer.playerId) ?? {
          x: 0,
          y: worldHeightAt(0, 8),
          z: 8,
          yaw: 0,
        })
      : { x: 0, y: worldHeightAt(0, 8), z: 8, yaw: 0 };
    const cameraTarget = this.cameraTarget.set(
      localPosition.x,
      localPosition.y + 1.35,
      localPosition.z,
    );
    const cameraPose = this.followCamera.update(cameraTarget, deltaSeconds, [], (x, z) =>
      worldHeightAt(x, z),
    );
    this.session.input.cameraYaw = cameraPose.yaw;
    this.camera.position.set(cameraPose.position.x, cameraPose.position.y, cameraPose.position.z);
    this.camera.lookAt(cameraPose.target.x, cameraPose.target.y, cameraPose.target.z);
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame((frameTime) => this.loop(frameTime));
  }

  private bindCameraControls(): void {
    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.tagName === 'BUTTON') return;
      this.lastPointer = { x: event.clientX, y: event.clientY };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!this.lastPointer) return;
      this.followCamera.orbit(
        event.clientX - this.lastPointer.x,
        -(event.clientY - this.lastPointer.y),
      );
      this.lastPointer = { x: event.clientX, y: event.clientY };
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
