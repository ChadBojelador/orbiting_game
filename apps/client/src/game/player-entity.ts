import type { LobbyView, PlayerView } from '@ice-water/shared';
import * as THREE from 'three';
import { worldHeightAt } from '../world/world-layout.js';
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
  bodyMaterial: THREE.MeshStandardMaterial;
  accentMaterial: THREE.MeshStandardMaterial;
  ownedGeometries: THREE.BufferGeometry[];
  character?: CharacterInstance;
  currentStatus: string;
  currentTeam: string;
  isProtected: boolean;
  lastX: number;
  lastZ: number;
  recoveryEndsAt: number;
}

export class PlayerEntityManager {
  private readonly entities = new Map<string, PlayerEntity>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly characterModel?: CharacterModelFactory,
  ) {}

  update(
    view: LobbyView,
    positions: Map<string, { x: number; z: number; yaw: number }>,
    localPlayerId: string,
    deltaSeconds: number,
  ): void {
    const seen = new Set<string>();
    for (const player of view.players) {
      seen.add(player.playerId);
      const position = positions.get(player.playerId);
      if (!position) continue;
      let entity = this.entities.get(player.playerId);
      if (!entity) entity = this.createEntity(player, localPlayerId);
      this.updateEntity(entity, player, position, deltaSeconds);
    }
    for (const [id, entity] of this.entities) {
      if (!seen.has(id)) {
        this.destroyEntity(entity);
        this.entities.delete(id);
      }
    }
  }

  destroy(): void {
    for (const entity of this.entities.values()) this.destroyEntity(entity);
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
    if (player.playerId === localPlayerId) root.scale.setScalar(1.12);

    const entity: PlayerEntity = {
      root,
      accent,
      bodyMaterial: character?.material ?? fallbackMaterial,
      accentMaterial,
      ownedGeometries,
      character,
      currentStatus: player.status,
      currentTeam: player.team,
      isProtected: false,
      lastX: player.x,
      lastZ: player.z,
      recoveryEndsAt: 0,
    };
    this.entities.set(player.playerId, entity);
    return entity;
  }

  private updateEntity(
    entity: PlayerEntity,
    player: PlayerView,
    position: { x: number; z: number; yaw: number },
    deltaSeconds: number,
  ): void {
    const previousStatus = entity.currentStatus;
    const dx = position.x - entity.lastX;
    const dz = position.z - entity.lastZ;
    const isMoving = dx * dx + dz * dz > 0.000_004;
    entity.lastX = position.x;
    entity.lastZ = position.z;
    entity.root.position.set(position.x, worldHeightAt(position.x, position.z) + 0.08, position.z);
    entity.root.rotation.y = position.yaw;

    const isProtected = Date.now() < player.protectedUntil;
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
      entity.root.visible = player.status !== 'spectator';

      if (previousStatus === 'frozen' && player.status === 'active') {
        entity.recoveryEndsAt = Date.now() + 450;
        entity.character?.play('Unfrozen', 0.05);
      }
    }

    const nextAnimation: CharacterAnimation =
      player.status === 'frozen' || player.status === 'eliminated'
        ? 'Frozen'
        : Date.now() < entity.recoveryEndsAt
          ? 'Unfrozen'
          : isMoving
            ? 'Run'
            : 'Idle';
    entity.character?.play(nextAnimation);
    entity.character?.update(deltaSeconds);
  }

  private destroyEntity(entity: PlayerEntity): void {
    this.scene.remove(entity.root);
    for (const geometry of entity.ownedGeometries) geometry.dispose();
    entity.bodyMaterial.dispose();
    entity.accentMaterial.dispose();
  }
}
