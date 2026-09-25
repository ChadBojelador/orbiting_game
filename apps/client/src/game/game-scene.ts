import {
  GAMEPLAY,
  isSwimming,
  isUnderwater,
  surfaceAt,
  type PlayerView,
} from '@ice-water/shared';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  Fog,
  FogExp2,
  PCFSoftShadowMap,
  ACESFilmicToneMapping,
  HemisphereLight,
  DirectionalLight,
  Group,
  Mesh,
  Sprite,
  BoxGeometry,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';
import { GameSession } from '../network/game-session.js';
import type { LobbyRoom } from '../network/lobby-client.js';
import { LocalPresentation } from '../network/player-motion.js';
import { FrostlineMap } from '../world/frostline-map.js';
import { OriginalWorldMap } from '../world/original-world-map.js';
import { OriginalWorldLighting } from '../world/original-world-lighting.js';
import { IslandMap } from '../world/island-map.js';
import { FirstPersonCamera } from './first-person-camera.js';
import {
  loadGameplayCharacterFactories,
  type CharacterAnimation,
  type CharacterInstance,
  type FrozenIceInstance,
  type GameplayCharacterFactories,
} from './character-model.js';
import { HitEffects } from './hit-effects.js';
import { AudioManager } from '../audio/audio-manager.js';
import { readSettings, type FpsSettings } from './fps-settings.js';
import { renderPixelRatio } from './render-performance.js';
import { waterEnvironmentFor } from './water-presentation.js';
import {
  createPlayerNameplate,
  disposePlayerNameplate,
  setNameplateTone,
} from './player-nameplate.js';
export class GameScene {
  readonly session: GameSession;
  settings: FpsSettings = readSettings();
  isLocked = false;
  isPaused = false;
  get isMapReady(): boolean {
    return !this.island || this.island.isReady;
  }
  get hasMapError(): boolean {
    return this.island?.hasError ?? false;
  }
  get isTouch(): boolean {
    if (this.settings.controls !== 'auto') return this.settings.controls === 'touch';
    return (
      matchMedia('(any-pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      innerWidth <= 800 ||
      innerHeight <= 500
    );
  }
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(96, 1, 0.05, 320);
  private renderer: WebGLRenderer;
  private world?: FrostlineMap | OriginalWorldMap;
  private originalLighting?: OriginalWorldLighting;
  private island?: IslandMap;
  private cameraMotion = new FirstPersonCamera();
  private presentation = new LocalPresentation();
  private effects: HitEffects;
  private audio = new AudioManager();
  private readonly players = new Map<string, Group>();
  private readonly nameplates = new Map<string, Sprite>();
  private readonly materials = new Map<string, MeshStandardMaterial>();
  private characterFactories: GameplayCharacterFactories = {};
  private readonly characters = new Map<string, CharacterInstance>();
  private readonly frozenIce = new Map<string, FrozenIceInstance>();
  private readonly characterAnimations = new Map<string, CharacterAnimation>();
  private readonly previousStatuses = new Map<string, PlayerView['status']>();
  private body = new BoxGeometry(0.65, 1.15, 0.42);
  private head = new BoxGeometry(0.5, 0.45, 0.48);
  private cleanups: (() => void)[] = [];
  private frame = 0;
  private destroyed = false;
  private previous = performance.now();
  private lastStep = 0;
  private remoteSteps = new Map<string, number>();
  private wasGrounded = true;
  private wasSwimming = false;
  private wasSliding = false;
  private wasUnderwater = false;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    room: LobbyRoom,
    playerId: string,
    private readonly onMapStatusChange?: () => void,
  ) {
    this.session = new GameSession(room, playerId);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: !this.isTouch,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.applyWaterEnvironment(false);
    const isOriginalNight = this.session.view.mapId === 'original';
    if (isOriginalNight) {
      this.originalLighting = new OriginalWorldLighting();
      this.scene.add(this.originalLighting.group);
      this.renderer.shadowMap.type = PCFSoftShadowMap;
      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
    } else {
      this.scene.add(new HemisphereLight(0xedfaff, 0x41617b, 2.5));
      const keyLight = new DirectionalLight(0xfff0d0, 2);
      keyLight.name = 'sunlight';
      keyLight.position.set(-30, 60, -35);
      this.scene.add(keyLight);
    }
    if (this.session.view.mapId === 'island') {
      this.island = new IslandMap(this.scene);
      void this.island.ready.then(() => {
        if (!this.destroyed) this.onMapStatusChange?.();
      });
    } else if (this.session.view.mapId === 'original') {
      this.world = new OriginalWorldMap(this.scene);
      this.camera.far = 600;
      this.camera.updateProjectionMatrix();
    } else this.world = new FrostlineMap(this.scene);
    this.scene.add(this.camera);
    this.effects = new HitEffects(this.scene);
    void loadGameplayCharacterFactories().then((factories) => {
      if (this.destroyed) return;
      this.characterFactories = factories;
    });
    this.session.input.isEnabled = this.isTouch;
    const resize = () => {
      const w = canvas.clientWidth || innerWidth,
        h = canvas.clientHeight || innerHeight;
      this.renderer.setPixelRatio(
        Math.min(this.isTouch ? 1.4 : 2, renderPixelRatio(w, h, devicePixelRatio)),
      );
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    this.cleanups.push(() => observer.disconnect());
    this.bindControls();
    this.loop(performance.now());
  }
  getInput() {
    return this.session.input;
  }
  lock(): void {
    this.audio.unlock();
    this.canvas.tabIndex = 0;
    this.canvas.focus();
    if (!this.isTouch) void this.canvas.requestPointerLock()?.catch(() => {});
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.cleanups.forEach((c) => c());
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.session.destroy();
    this.effects.destroy();
    this.world?.destroy();
    this.originalLighting?.destroy();
    this.island?.destroy();
    this.audio.destroy();
    this.body.dispose();
    this.head.dispose();
    this.materials.forEach((m) => m.dispose());
    this.nameplates.forEach(disposePlayerNameplate);
    this.nameplates.clear();
    this.characters.clear();
    this.frozenIce.clear();
    this.characterAnimations.clear();
    this.previousStatuses.clear();
    this.renderer.dispose();
  }
  private bindControls(): void {
    const input = this.session.input;
    const lock = () => {
      this.isLocked = document.pointerLockElement === this.canvas;
      input.isEnabled = !this.isPaused;
      if (!this.isLocked) input.reset();
    };
    const down = (e: PointerEvent) => {
      this.audio.unlock();
      if (e.pointerType === 'touch') return;
      if (!this.isLocked) {
        this.lock();
      }
      if (e.button === 0) input.pressInteract();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
    };
    const move = (e: MouseEvent) => {
      if (this.isLocked) input.look(e.movementX, e.movementY);
    };
    const context = (e: Event) => e.preventDefault();
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      this.isLocked = false;
      input.reset();
      input.isEnabled = !this.isPaused;
    };
    window.addEventListener('keydown', escape);
    this.canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    document.addEventListener('mousemove', move);
    document.addEventListener('pointerlockchange', lock);
    this.canvas.addEventListener('contextmenu', context);
    const unlockAudio = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    this.cleanups.push(() => {
      window.removeEventListener('keydown', escape);
      this.canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('pointerlockchange', lock);
      this.canvas.removeEventListener('contextmenu', context);
      window.removeEventListener('pointerdown', unlockAudio);
    });
  }
  private model(player: PlayerView): Group {
    let model = this.players.get(player.playerId);
    const factory = this.characterFactories[player.team === 'water' ? 'water' : 'ice'];
    if (model) {
      if (factory && !this.characters.has(player.playerId)) this.attachCharacter(model, player, factory);
      if (player.team === 'water' && this.characterFactories.frozenIce && !this.frozenIce.has(player.playerId))
        this.attachFrozenIce(model, player);
      return model;
    }
    model = new Group();
    const torso = new Mesh(this.body, this.material('body', 0x308cad));
    torso.position.y = 0.9;
    const head = new Mesh(this.head, this.material('head', 0xedf6fa));
    head.position.y = 1.575;
    torso.castShadow = true;
    head.castShadow = true;
    torso.receiveShadow = true;
    head.receiveShadow = true;
    model.add(torso, head);
    if (factory) this.attachCharacter(model, player, factory);
    if (player.team === 'water' && this.characterFactories.frozenIce) this.attachFrozenIce(model, player);
    this.scene.add(model);
    this.players.set(player.playerId, model);
    const nameplate = createPlayerNameplate(player.displayName);
    this.scene.add(nameplate);
    this.nameplates.set(player.playerId, nameplate);
    return model;
  }
  private attachFrozenIce(model: Group, player: PlayerView): void {
    const factory = this.characterFactories.frozenIce;
    if (!factory || player.team !== 'water' || this.frozenIce.has(player.playerId)) return;
    const effect = factory.instantiate();
    model.add(effect.root);
    this.frozenIce.set(player.playerId, effect);
    if (player.status === 'frozen') effect.playFreeze();
  }
  private attachCharacter(model: Group, player: PlayerView, factory: GameplayCharacterFactories['ice']): void {
    if (!factory) return;
    const fallback = [...model.children];
    const character = factory.instantiate(player.team === 'water' ? '#43c6d6' : '#bdefff', 'Idle');
    // Gameplay uses the opposite facing from the lobby's display pose.
    character.root.rotation.y = Math.PI;
    fallback.forEach((child) => child.removeFromParent());
    model.add(character.root);
    this.characters.set(player.playerId, character);
    this.characterAnimations.set(player.playerId, 'Idle');
  }
  private setCharacterAnimation(player: PlayerView, animation: CharacterAnimation): void {
    const character = this.characters.get(player.playerId);
    if (!character) return;
    if (this.characterAnimations.get(player.playerId) === animation) return;
    character.play(animation);
    this.characterAnimations.set(player.playerId, animation);
  }
  private material(key: string, color: number): MeshStandardMaterial {
    let material = this.materials.get(key);
    if (!material) {
      material = new MeshStandardMaterial({ color, roughness: 0.65 });
      this.materials.set(key, material);
    }
    return material;
  }
  private applyWaterEnvironment(isCameraUnderwater: boolean): void {
    const environment = waterEnvironmentFor(this.session.view.mapId, isCameraUnderwater);
    this.scene.background = new Color(environment.background);
    this.scene.fog =
      this.session.view.mapId === 'original' && !isCameraUnderwater
        ? new FogExp2(environment.fogColor, 0.0032)
        : new Fog(environment.fogColor, environment.fogNear, environment.fogFar);
  }
  private loop(now: number): void {
    if (this.destroyed) return;
    const seconds = Math.min(0.05, Math.max(0, (now - this.previous) / 1000));
    this.previous = now;
    const session = this.session,
      p = session.local(),
      serverNow = session.serverNow(),
      input = session.input;
    input.isEnabled = !this.isPaused;
    input.sensitivity = this.settings.sensitivity * 0.002;
    this.audio.volume = this.settings.isMuted
      ? 0
      : Math.min(1, this.settings.volume * this.settings.sfxVolume * 1.35);
    if (p) {
      const predicted = session.prediction.motion;
      const swimming = isSwimming(predicted, session.view.mapId);
      const pos = this.presentation.update(
        { ...predicted, yaw: input.cameraYaw },
        seconds,
        p.status !== 'alive',
      );
      const eye = this.cameraMotion.update(pos, predicted, seconds, this.settings.reducedEffects);
      this.camera.position.set(eye.x, eye.y, eye.z);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(input.cameraPitch, input.cameraYaw, 0);
      const cameraIsUnderwater = isUnderwater(eye, session.view.mapId);
      if (cameraIsUnderwater !== this.wasUnderwater) {
        this.wasUnderwater = cameraIsUnderwater;
        this.applyWaterEnvironment(cameraIsUnderwater);
        this.audio.setUnderwater(cameraIsUnderwater);
      }
      const fov = this.settings.fov;
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-18 * seconds));
      this.camera.updateProjectionMatrix();
      this.audio.listener(eye, input.cameraYaw);
      if (p.status === 'alive') {
        if (
          Math.hypot(predicted.velocityX, predicted.velocityZ) > 1 &&
          (predicted.isGrounded || swimming) &&
          now - this.lastStep > (swimming ? 450 : 320)
        ) {
          this.audio.play(surfaceAt(predicted, session.view.mapId));
          this.lastStep = now;
        }
        if (!this.wasSwimming && swimming) this.audio.play('water');
        if (this.wasGrounded && !predicted.isGrounded && !swimming) this.audio.play('jump');
        if (!this.wasGrounded && predicted.isGrounded && !this.wasSwimming) this.audio.play('land');
        if (!this.wasSliding && predicted.isSliding) this.audio.play('slide');
      }
      this.wasGrounded = predicted.isGrounded;
      this.wasSwimming = swimming;
      this.wasSliding = predicted.isSliding;
    }
    for (const remote of session.view.players) {
      if (remote.playerId === session.playerId) continue;
      const model = this.model(remote);
      const character = this.characters.get(remote.playerId);
      const frozenIce = this.frozenIce.get(remote.playerId);
      if (frozenIce) {
        const previousStatus = this.previousStatuses.get(remote.playerId);
        if (previousStatus !== 'frozen' && remote.status === 'frozen') frozenIce.playFreeze();
        if (previousStatus === 'frozen' && remote.status === 'alive') frozenIce.playUnfreeze();
        frozenIce.update(seconds);
      }
      if (character) {
        let animation: CharacterAnimation = 'Idle';
        if (remote.status === 'frozen') animation = 'Frozen';
        else if (remote.lungeUntil > serverNow) animation = 'Lunge';
        else if (remote.isWallRunning) animation = 'Run';
        else if (!remote.isGrounded) animation = remote.verticalVelocity > 0 ? 'Jump' : 'FallIdle';
        else if (Math.hypot(remote.velocityX, remote.velocityZ) > 1) animation = 'Run';
        this.setCharacterAnimation(remote, animation);
        character.update(seconds);
        character.material.color.setHex(
          remote.status === 'frozen'
            ? 0xbdefff
            : remote.team === 'water'
              ? 0x43c6d6
              : 0x74d9ec,
        );
      }
      this.previousStatuses.set(remote.playerId, remote.status);
      model.visible = remote.status !== 'dead' && remote.status !== 'spectator';
      const position =
        session.remotes.get(remote.playerId)?.at(serverNow - GAMEPLAY.interpolationMs) ?? remote;
      model.position.set(position.x, position.y, position.z);
      model.rotation.y = position.yaw;
      model.scale.y = remote.isCrouching || remote.isSliding ? 0.61 : 1;
      const friend = session.view.gameMode === 'tdm' && remote.team === p?.team;
      const key =
        remote.status === 'frozen'
          ? 'frozen'
          : remote.protectedUntil > serverNow
            ? 'protected'
            : friend
              ? 'friend'
              : 'enemy';
      if (!character)
        (model.children[0] as Mesh).material = this.material(
          key,
          key === 'frozen' ? 0xbdefff : key === 'protected' ? 0xf3b747 : friend ? 0x308cad : 0xe96958,
        );
      model.scale.y = remote.status === 'frozen' ? 1.1 : remote.isCrouching || remote.isSliding ? 0.61 : 1;
      const nameplate = this.nameplates.get(remote.playerId);
      if (nameplate) {
        nameplate.visible = model.visible;
        nameplate.position.set(
          position.x,
          position.y + (remote.isCrouching || remote.isSliding ? 1.28 : 2.03),
          position.z,
        );
        setNameplateTone(nameplate, key);
      }
      if (
        model.visible &&
        Math.hypot(remote.velocityX, remote.velocityZ) > 1 &&
        p &&
        Math.hypot(remote.x - p.x, remote.z - p.z) < 35
      ) {
        const remoteIsSwimming = isSwimming(position, session.view.mapId);
        if (
          (remote.isGrounded || remoteIsSwimming) &&
          now - (this.remoteSteps.get(remote.playerId) ?? 0) > (remoteIsSwimming ? 500 : 380)
        ) {
          this.audio.play(
            remoteIsSwimming ? 'water' : surfaceAt(remote, session.view.mapId),
            remote,
          );
          this.remoteSteps.set(remote.playerId, now);
        }
      }
    }
    for (const event of session.events.splice(0)) {
      const local = session.playerId;
      if (event.type === 'player/frozen' && event.payload.attackerId === local)
        this.audio.play('ice');
      if (event.type === 'player/rescued' && event.payload.rescuerIds.includes(local))
        this.audio.play('ice');
    }
    if (this.world instanceof OriginalWorldMap) {
      const quality = this.settings.reducedEffects ? 'low' : this.isTouch ? 'medium' : 'high';
      this.renderer.shadowMap.enabled = quality !== 'low';
      this.originalLighting?.update(this.camera.position, quality);
      this.world.update(now / 1000, this.camera.position, quality);
    }
    this.effects.update(now);
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame((t) => this.loop(t));
  }
}
