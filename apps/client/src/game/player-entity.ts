/**
 * Creates and updates one PlayCanvas entity per player. The shared character model
 * carries pose and motion while simple ground markers preserve crowd readability.
 */
import type * as PC from 'playcanvas';
import type { LobbyView, PlayerView } from '@ice-water/shared';
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
  root: PC.Entity;
  accent: PC.Entity;
  bodyMat: PC.StandardMaterial;
  materials: PC.StandardMaterial[];
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
    private readonly app: PC.Application,
    private readonly pc: typeof PC,
    private readonly characterModel?: CharacterModelFactory,
  ) {}

  update(
    view: LobbyView,
    positions: Map<string, { x: number; y: number; z: number; yaw: number }>,
    localPlayerId: string,
  ): void {
    const seen = new Set<string>();
    for (const player of view.players) {
      seen.add(player.playerId);
      const pos = positions.get(player.playerId);
      if (!pos) continue;
      let entity = this.entities.get(player.playerId);
      if (!entity) entity = this.createEntity(player, localPlayerId);
      this.updateEntity(entity, player, pos);
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
    const { pc, app } = this;
    const root = new pc.Entity(`player-${player.playerId}`);
    app.root.addChild(root);

    const initialColor = player.team === 'ice' ? COLORS.ice : COLORS.water;
    const fallbackMaterial = new pc.StandardMaterial();
    fallbackMaterial.diffuse = new pc.Color().fromString(initialColor);
    fallbackMaterial.gloss = 0.3;
    fallbackMaterial.update();

    let character: CharacterInstance | undefined;
    if (this.characterModel) {
      character = this.characterModel.instantiate(initialColor, 'Idle');
      root.addChild(character.entity);
      fallbackMaterial.destroy();
    } else {
      // If the GLB request fails, players remain visible as the original lightweight shape.
      const body = new pc.Entity('fallback-body');
      body.addComponent('render', { type: 'sphere', material: fallbackMaterial });
      body.setLocalScale(0.7, 0.85, 0.7);
      body.setLocalPosition(0, 0.85, 0);
      root.addChild(body);
    }

    const accentMaterial = new pc.StandardMaterial();
    accentMaterial.diffuse = new pc.Color().fromString(
      player.team === 'ice' ? COLORS.iceAccent : COLORS.water,
    );
    accentMaterial.emissive = new pc.Color().fromString(
      player.team === 'ice' ? COLORS.iceAccent : COLORS.water,
    );
    accentMaterial.emissiveIntensity = 0.25;
    accentMaterial.gloss = 0.65;
    accentMaterial.update();

    const accent = new pc.Entity('team-marker');
    accent.addComponent('render', { type: 'cylinder', material: accentMaterial });
    accent.setLocalScale(1.05, 0.06, 1.05);
    accent.setLocalPosition(0, 0.03, 0);
    root.addChild(accent);

    if (player.playerId === localPlayerId) root.setLocalScale(1.12, 1.12, 1.12);

    const bodyMat = character?.material ?? fallbackMaterial;
    const entity: PlayerEntity = {
      root,
      accent,
      bodyMat,
      materials: [bodyMat, accentMaterial],
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
    pos: { x: number; y: number; z: number; yaw: number },
  ): void {
    const { pc } = this;
    const previousStatus = entity.currentStatus;
    const dx = pos.x - entity.lastX;
    const dz = pos.z - entity.lastZ;
    const isMoving = dx * dx + dz * dz > 0.000_004;
    entity.lastX = pos.x;
    entity.lastZ = pos.z;

    entity.root.setPosition(pos.x, pos.y, pos.z);
    entity.root.setEulerAngles(0, pos.yaw * (180 / Math.PI), 0);

    const isProtected = Date.now() < player.protectedUntil;
    if (
      entity.currentStatus !== player.status ||
      entity.isProtected !== isProtected ||
      entity.currentTeam !== player.team
    ) {
      entity.currentStatus = player.status;
      entity.currentTeam = player.team;
      entity.isProtected = isProtected;

      if (player.status === 'eliminated') {
        entity.bodyMat.diffuse = new pc.Color().fromString(COLORS.eliminated);
        entity.bodyMat.gloss = 0.05;
      } else if (player.status === 'frozen') {
        entity.bodyMat.diffuse = new pc.Color().fromString(COLORS.frozen);
        entity.bodyMat.gloss = 0.6;
      } else if (isProtected && player.team === 'water') {
        entity.bodyMat.diffuse = new pc.Color().fromString(COLORS.protected);
        entity.bodyMat.gloss = 0.5;
      } else if (player.team === 'ice') {
        entity.bodyMat.diffuse = new pc.Color().fromString(COLORS.ice);
        entity.bodyMat.gloss = 0.3;
      } else {
        entity.bodyMat.diffuse = new pc.Color().fromString(COLORS.water);
        entity.bodyMat.gloss = 0.3;
      }
      entity.bodyMat.update();

      const accentColor =
        isProtected && player.team === 'water'
          ? COLORS.protected
          : player.team === 'ice'
            ? COLORS.iceAccent
            : COLORS.water;
      const accentMaterial = entity.materials[1];
      if (accentMaterial) {
        accentMaterial.diffuse = new pc.Color().fromString(accentColor);
        accentMaterial.emissive = new pc.Color().fromString(accentColor);
        accentMaterial.update();
      }
      entity.accent.enabled = player.status !== 'eliminated' && player.status !== 'spectator';
      entity.root.enabled = player.status !== 'spectator';

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
  }

  private destroyEntity(entity: PlayerEntity): void {
    this.app.root.removeChild(entity.root);
    entity.root.destroy();
    for (const material of entity.materials) material.destroy();
  }
}
