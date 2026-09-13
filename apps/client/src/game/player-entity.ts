import type { LobbyView, PlayerView } from '@ice-water/shared';
import * as THREE from 'three';
import type {
  CharacterAnimation,
  CharacterInstance,
  CharacterModelFactory,
} from './character-model.js';

const COLORS = {
  ice: '#4056D8',
  water: '#48CFE3',
  frozen: '#BDEFFF',
  protected: '#FFD66B',
  eliminated: '#D8F5FF',
  iceAccent: '#7EEBFF',
} as const;

interface PlayerEntity {
  root: THREE.Group;
  accent: THREE.Mesh;
  frostLauncher: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  accentMaterial: THREE.MeshStandardMaterial;
  ownedGeometries: THREE.BufferGeometry[];
  ownedMaterials: THREE.Material[];
  character?: CharacterInstance;
  currentStatus: string;
  currentTeam: string;
  isProtected: boolean;
  isLocal: boolean;
  castsShadow: boolean;
  lastX: number;
  lastZ: number;
  movingUntil: number;
  recoveryEndsAt: number;
  animationElapsed: number;
}

const MOVEMENT_ANIMATION_HOLD_MS = 180;
const FULL_ANIMATION_DISTANCE_SQUARED = 45 * 45;
const REDUCED_ANIMATION_DISTANCE_SQUARED = 90 * 90;
const SHADOW_ENABLE_DISTANCE_SQUARED = 42 * 42;
const SHADOW_DISABLE_DISTANCE_SQUARED = 52 * 52;

export class PlayerEntityManager {
  private readonly entities = new Map<string, PlayerEntity>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly characterModel?: CharacterModelFactory,
  ) {}

  update(
    view: LobbyView,
    positions: Map<string, { x: number; y: number; z: number; yaw: number }>,
    localPlayerId: string,
    deltaSeconds: number,
  ): void {
    const seen = new Set<string>();
    const localPosition = positions.get(localPlayerId);
    const now = Date.now();

    for (const player of view.players) {
      seen.add(player.playerId);

      const position = positions.get(player.playerId);
      if (!position) continue;

      let entity = this.entities.get(player.playerId);

      if (!entity) {
        entity = this.createEntity(player, localPlayerId);
      }

      this.updateEntity(
        entity,
        player,
        position,
        deltaSeconds,
        localPosition
          ? (position.x - localPosition.x) ** 2 + (position.z - localPosition.z) ** 2
          : 0,
        now,
      );
    }

    for (const [id, entity] of this.entities) {
      if (!seen.has(id)) {
        this.destroyEntity(entity);
        this.entities.delete(id);
      }
    }
  }

  destroy(): void {
    for (const entity of this.entities.values()) {
      this.destroyEntity(entity);
    }

    this.entities.clear();
  }

  private createEntity(player: PlayerView, localPlayerId: string): PlayerEntity {
    const root = new THREE.Group();
    root.name = `player-${player.playerId}`;
    this.scene.add(root);

    const initialColor = player.team === 'ice' ? COLORS.ice : COLORS.water;

    const fallbackMaterial = new THREE.MeshStandardMaterial({
      color: initialColor,
      roughness: 0.58,
    });

    const ownedGeometries: THREE.BufferGeometry[] = [];
    const ownedMaterials: THREE.Material[] = [];

    let character: CharacterInstance | undefined;

    if (this.characterModel) {
      character = this.characterModel.instantiate(initialColor, 'Idle');

      root.add(character.root);
      fallbackMaterial.dispose();
    } else {
      const bodyGeometry = new THREE.SphereGeometry(0.7, 10, 8);

      const body = new THREE.Mesh(bodyGeometry, fallbackMaterial);

      body.name = 'fallback-body';
      body.scale.y = 1.2;
      body.position.y = 0.85;
      body.castShadow = true;

      root.add(body);
      ownedGeometries.push(bodyGeometry);
    }

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: player.team === 'ice' ? COLORS.iceAccent : COLORS.water,
      emissive: player.team === 'ice' ? COLORS.iceAccent : COLORS.water,
      emissiveIntensity: 0.25,
      roughness: 0.3,
    });

    const accentGeometry = new THREE.CylinderGeometry(0.53, 0.53, 0.06, 16);

    const accent = new THREE.Mesh(accentGeometry, accentMaterial);

    accent.name = 'team-marker';
    accent.position.y = 0.03;

    root.add(accent);
    ownedGeometries.push(accentGeometry);

    const frostLauncher = new THREE.Group();
    frostLauncher.name = 'frost-launcher';
    frostLauncher.position.set(0.58, 1.05, 0.18);
    const launcherBodyMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.ice,
      emissive: COLORS.iceAccent,
      emissiveIntensity: 0.18,
      roughness: 0.42,
    });
    const launcherAccentMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.iceAccent,
      emissive: COLORS.iceAccent,
      emissiveIntensity: 0.7,
      roughness: 0.2,
    });
    const launcherBodyGeometry = new THREE.BoxGeometry(0.34, 0.28, 0.72);
    const launcherBarrelGeometry = new THREE.CylinderGeometry(0.1, 0.14, 0.62, 8);
    const launcherTipGeometry = new THREE.OctahedronGeometry(0.16, 0);
    const launcherBody = new THREE.Mesh(launcherBodyGeometry, launcherBodyMaterial);
    launcherBody.name = 'frost-launcher-body';
    const launcherBarrel = new THREE.Mesh(launcherBarrelGeometry, launcherAccentMaterial);
    launcherBarrel.name = 'frost-launcher-barrel';
    launcherBarrel.rotation.x = Math.PI / 2;
    launcherBarrel.position.z = 0.54;
    const launcherTip = new THREE.Mesh(launcherTipGeometry, launcherAccentMaterial);
    launcherTip.name = 'frost-launcher-tip';
    launcherTip.position.z = 0.86;
    frostLauncher.add(launcherBody, launcherBarrel, launcherTip);
    root.add(frostLauncher);
    ownedGeometries.push(launcherBodyGeometry, launcherBarrelGeometry, launcherTipGeometry);
    ownedMaterials.push(launcherBodyMaterial, launcherAccentMaterial);
    frostLauncher.visible = player.team === 'ice' && player.status === 'active';

    const isLocal = player.playerId === localPlayerId;

    if (isLocal) {
      root.scale.setScalar(1.12);
    }

    this.setShadowCasting(root, isLocal);

    const entity: PlayerEntity = {
      root,
      accent,
      frostLauncher,
      bodyMaterial: character?.material ?? fallbackMaterial,
      accentMaterial,
      ownedGeometries,
      ownedMaterials,
      character,
      currentStatus: player.status,
      currentTeam: player.team,
      isProtected: false,
      isLocal,
      castsShadow: isLocal,
      lastX: player.x,
      lastZ: player.z,
      movingUntil: 0,
      recoveryEndsAt: 0,
      animationElapsed: 0,
    };

    this.entities.set(player.playerId, entity);

    return entity;
  }

  private updateEntity(
    entity: PlayerEntity,
    player: PlayerView,
    position: {
      x: number;
      y: number;
      z: number;
      yaw: number;
    },
    deltaSeconds: number,
    distanceSquared: number,
    now: number,
  ): void {
    const previousStatus = entity.currentStatus;

    const dx = position.x - entity.lastX;

    const dz = position.z - entity.lastZ;

    if (dx * dx + dz * dz > 0.000_004) {
      entity.movingUntil = now + MOVEMENT_ANIMATION_HOLD_MS;
    }

    const isMoving = now < entity.movingUntil;

    entity.lastX = position.x;
    entity.lastZ = position.z;
    entity.root.position.set(position.x, position.y + 0.08, position.z);
    entity.root.rotation.y = position.yaw;

    const shadowThreshold = entity.castsShadow
      ? SHADOW_DISABLE_DISTANCE_SQUARED
      : SHADOW_ENABLE_DISTANCE_SQUARED;
    const shouldCastShadow = entity.isLocal || distanceSquared <= shadowThreshold;
    if (shouldCastShadow !== entity.castsShadow) {
      entity.castsShadow = shouldCastShadow;
      this.setShadowCasting(entity.root, shouldCastShadow);
    }

    const isProtected = now < player.protectedUntil;

    if (
      entity.currentStatus !== player.status ||
      entity.isProtected !== isProtected ||
      entity.currentTeam !== player.team
    ) {
      entity.currentStatus = player.status;

      entity.currentTeam = player.team;

      entity.isProtected = isProtected;

      const bodyColor =
        player.status === 'eliminated'
          ? COLORS.eliminated
          : player.status === 'frozen'
            ? COLORS.frozen
            : isProtected && player.team === 'water'
              ? COLORS.protected
              : player.team === 'ice'
                ? COLORS.ice
                : COLORS.water;

      entity.bodyMaterial.color.set(bodyColor);

      entity.bodyMaterial.roughness = player.status === 'frozen' ? 0.22 : 0.58;

      const accentColor =
        isProtected && player.team === 'water'
          ? COLORS.protected
          : player.team === 'ice'
            ? COLORS.iceAccent
            : COLORS.water;

      entity.accentMaterial.color.set(accentColor);

      entity.accentMaterial.emissive.set(accentColor);

      entity.accent.visible = player.status !== 'eliminated' && player.status !== 'spectator';

      entity.frostLauncher.visible =
        player.team === 'ice' && player.status === 'active' && !isProtected;

      entity.root.visible = player.status !== 'spectator';

      if (previousStatus === 'frozen' && player.status === 'active') {
        entity.recoveryEndsAt = now + 450;

        entity.character?.play('Unfrozen', 0.05);
      }
    }

    const nextAnimation: CharacterAnimation =
      player.status === 'frozen' || player.status === 'eliminated'
        ? 'Frozen'
        : now < entity.recoveryEndsAt
          ? 'Unfrozen'
          : isMoving
            ? 'Run'
            : 'Wave';

    entity.character?.play(nextAnimation);

    entity.animationElapsed += deltaSeconds;
    const animationInterval =
      distanceSquared > REDUCED_ANIMATION_DISTANCE_SQUARED
        ? 1 / 10
        : distanceSquared > FULL_ANIMATION_DISTANCE_SQUARED
          ? 1 / 20
          : 0;
    if (animationInterval === 0 || entity.animationElapsed >= animationInterval) {
      entity.character?.update(Math.min(entity.animationElapsed, 0.1));
      entity.animationElapsed = 0;
    }
  }

  private setShadowCasting(root: THREE.Object3D, shouldCastShadow: boolean): void {
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = shouldCastShadow;
    });
  }

  private destroyEntity(entity: PlayerEntity): void {
    this.scene.remove(entity.root);

    for (const geometry of entity.ownedGeometries) {
      geometry.dispose();
    }

    for (const material of entity.ownedMaterials) {
      material.dispose();
    }

    entity.bodyMaterial.dispose();
    entity.accentMaterial.dispose();
  }
}
