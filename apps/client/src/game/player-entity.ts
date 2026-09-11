/**
 * PlayerEntityManager — creates and updates one PlayCanvas entity per player.
 * Renders distinct visuals for: Ice, active Water, protected Water, frozen Water, eliminated/spectator.
 * Follows ART_DIRECTION.md color system.
 */
import type * as PC from 'playcanvas';
import type { LobbyView, PlayerView } from '@ice-water/shared';

// Art-direction palette.
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
  body: PC.Entity;
  /** Accent ring shown only for Ice team. */
  accent?: PC.Entity;
  /** Crown overlay for frozen state. */
  frozenCrown?: PC.Entity;
  bodyMat: PC.StandardMaterial;
  currentStatus: string;
  currentTeam: string;
  isProtected: boolean;
}

export class PlayerEntityManager {
  private readonly entities = new Map<string, PlayerEntity>();

  constructor(
    private readonly app: PC.Application,
    private readonly pc: typeof PC,
  ) {}

  /** Call every frame with the latest LobbyView and interpolated/predicted positions. */
  update(
    view: LobbyView,
    positions: Map<string, { x: number; z: number; yaw: number }>,
    localPlayerId: string,
  ): void {
    const seen = new Set<string>();
    for (const player of view.players) {
      seen.add(player.playerId);
      const pos = positions.get(player.playerId);
      if (!pos) continue;
      let ent = this.entities.get(player.playerId);
      if (!ent) ent = this.createEntity(player, localPlayerId);
      this.updateEntity(ent, player, pos);
    }
    // Remove entities for players no longer in the view.
    for (const [id, ent] of this.entities) {
      if (!seen.has(id)) {
        this.destroyEntity(ent);
        this.entities.delete(id);
      }
    }
  }

  destroy(): void {
    for (const ent of this.entities.values()) this.destroyEntity(ent);
    this.entities.clear();
  }

  private createEntity(player: PlayerView, localPlayerId: string): PlayerEntity {
    const { pc, app } = this;
    const root = new pc.Entity(`player-${player.playerId}`);
    app.root.addChild(root);

    const bodyMat = new pc.StandardMaterial();
    bodyMat.diffuse = new pc.Color().fromString(player.team === 'ice' ? COLORS.ice : COLORS.water);
    bodyMat.gloss = 0.3;
    bodyMat.update();

    // Body — capsule-like: sphere on top of a short cylinder.
    const body = new pc.Entity('body');
    body.addComponent('render', { type: 'sphere', material: bodyMat });
    body.setLocalScale(0.7, 0.85, 0.7);
    body.setLocalPosition(0, 0.85, 0);
    root.addChild(body);

    const legs = new pc.Entity('legs');
    legs.addComponent('render', { type: 'cylinder', material: bodyMat });
    legs.setLocalScale(0.55, 0.45, 0.55);
    legs.setLocalPosition(0, 0.22, 0);
    root.addChild(legs);

    // Ice accent ring.
    let accent: PC.Entity | undefined;
    if (player.team === 'ice') {
      const accentMat = new pc.StandardMaterial();
      accentMat.diffuse = new pc.Color().fromString(COLORS.iceAccent);
      accentMat.gloss = 0.7;
      accentMat.update();
      accent = new pc.Entity('ice-accent');
      accent.addComponent('render', { type: 'box', material: accentMat });
      accent.setLocalScale(0.85, 0.15, 0.85);
      accent.setLocalPosition(0, 1.45, 0);
      root.addChild(accent);
    }

    // Name label entity (billboard — just a box placeholder; a real game would use a texture).
    // Locally controlled player gets a slightly larger body for self-identification.
    if (player.playerId === localPlayerId) {
      root.setLocalScale(1.12, 1.12, 1.12);
    }

    const ent: PlayerEntity = {
      root,
      body,
      accent,
      bodyMat,
      currentStatus: player.status,
      currentTeam: player.team,
      isProtected: false,
    };
    this.entities.set(player.playerId, ent);
    return ent;
  }

  private updateEntity(
    ent: PlayerEntity,
    player: PlayerView,
    pos: { x: number; z: number; yaw: number },
  ): void {
    const { pc } = this;

    // Position and facing.
    ent.root.setPosition(pos.x, 0, pos.z);
    ent.root.setEulerAngles(0, pos.yaw * (180 / Math.PI), 0);

    // State-driven visual update.
    const isProtected = Date.now() < player.protectedUntil;
    if (
      ent.currentStatus !== player.status ||
      ent.isProtected !== isProtected ||
      ent.currentTeam !== player.team
    ) {
      ent.currentStatus = player.status;
      ent.currentTeam = player.team;
      ent.isProtected = isProtected;

      if (player.status === 'eliminated') {
        // Static desaturated statue.
        ent.bodyMat.diffuse = new pc.Color().fromString(COLORS.eliminated);
        ent.bodyMat.gloss = 0.05;
      } else if (player.status === 'frozen') {
        ent.bodyMat.diffuse = new pc.Color().fromString(COLORS.frozen);
        ent.bodyMat.gloss = 0.6;
      } else if (isProtected && player.team === 'water') {
        ent.bodyMat.diffuse = new pc.Color().fromString(COLORS.protected);
        ent.bodyMat.gloss = 0.5;
      } else if (player.team === 'ice') {
        ent.bodyMat.diffuse = new pc.Color().fromString(COLORS.ice);
        ent.bodyMat.gloss = 0.3;
      } else {
        ent.bodyMat.diffuse = new pc.Color().fromString(COLORS.water);
        ent.bodyMat.gloss = 0.3;
      }
      ent.bodyMat.update();

      // Hide/show accent for Ice.
      if (ent.accent) {
        ent.accent.enabled = player.team === 'ice' && player.status !== 'eliminated';
      }

      // Show eliminated players but make them motionless.
      ent.root.enabled = player.status !== 'spectator';
    }
  }

  private destroyEntity(ent: PlayerEntity): void {
    this.app.root.removeChild(ent.root);
    ent.root.destroy();
    ent.bodyMat.destroy();
  }
}
