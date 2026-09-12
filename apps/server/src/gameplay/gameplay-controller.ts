import {
  GAMEPLAY,
  advanceVerticalMotion,
  canRescueInPhase,
  createSpawnPoints,
  distanceSquared3d,
  hasGameplayLineOfSight,
  hasProjectileLineOfSight,
  isEmptyPayload,
  isFrostThrowIntent,
  isMoveInput,
  isPlayPhase,
  isTargetIntent,
  moveKinematic,
  terrainHeightAt,
  type GameplayEvent,
  type GameplayMessages,
  type MoveInput,
  type SpatialPosition,
} from '@ice-water/shared';
import { FrostProjectileState, type LobbyState, type PlayerState } from '../rooms/lobby-state.js';
import { SpatialGrid } from '../simulation/spatial-grid.js';

interface PendingInput {
  input: MoveInput;
  receivedAt: number;
}
interface RescueIntent {
  targetId: string;
  expiresAt: number;
  startedAt: number;
}
interface MessageBudget {
  moves: number;
  actions: number;
  resetsAt: number;
}

function distanceToSegmentSquared(
  start: SpatialPosition,
  end: SpatialPosition,
  point: SpatialPosition,
): { distanceSquared: number; time: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const time =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) /
              lengthSquared,
          ),
        );
  const closestX = start.x + dx * time;
  const closestY = start.y + dy * time;
  const closestZ = start.z + dz * time;
  return {
    distanceSquared:
      (point.x - closestX) ** 2 + (point.y - closestY) ** 2 + (point.z - closestZ) ** 2,
    time,
  };
}

export class GameplayController {
  private readonly grid = new SpatialGrid<PlayerState>();
  private readonly inputs = new Map<string, PendingInput[]>();
  private readonly sequences = new Map<string, number>();
  private readonly rescues = new Map<string, RescueIntent>();
  private readonly progress = new Map<string, number>();
  private readonly budgets = new Map<string, MessageBudget>();
  private lastTick = 0;
  private hasStarted = false;
  private projectileSequence = 0;

  constructor(
    private readonly state: LobbyState,
    private readonly emit: (event: GameplayEvent) => void = () => {},
  ) {}

  /** Called once per round start. Spawns/respawns active (non-eliminated) players. */
  startRound(now: number, _halfExtent: number): void {
    this.hasStarted = true;
    this.lastTick = now;
    // Clear all pending input and rescue intent at the start of each round.
    this.inputs.clear();
    this.rescues.clear();
    this.progress.clear();
    this.state.projectiles.clear();
    // Respawn every non-eliminated player.
    const spawns = createSpawnPoints();
    let index = 0;
    for (const player of this.state.players.values()) {
      if (player.team === 'unassigned' || player.status === 'eliminated') continue;
      // Thaw temporarily-frozen Water players at round start.
      if (player.status === 'frozen') player.status = 'active';
      player.protectedUntil = 0;
      player.rescueProgress = 0;
      player.rescuingTarget = '';
      player.knockbackX = 0;
      player.knockbackZ = 0;
      player.verticalVelocity = 0;
      player.isGrounded = true;
      const spawn = spawns[index++];
      if (!spawn) throw new Error('Arena does not have enough spawn points');
      player.x = spawn.x;
      player.y = terrainHeightAt(spawn);
      player.z = spawn.z;
    }
    this.grid.rebuild(this.state.players.values());
  }

  /** @deprecated Use startRound() — kept for backward compat during migration. */
  start(now: number): void {
    this.startRound(now, this.state.arenaHalfExtent);
  }

  // The clock alone grants simulation time. Input count/duration cannot buy speed.
  advance(now: number): void {
    if (!this.hasStarted) return;
    if (now < this.lastTick) return;
    this.lastTick = Math.max(this.lastTick, now - 250);
    while (now - this.lastTick >= GAMEPLAY.tickMs) {
      this.lastTick += GAMEPLAY.tickMs;
      this.step(this.lastTick);
    }
  }

  handle(
    playerId: string,
    type: keyof GameplayMessages,
    payload: unknown,
    now: number,
  ): string | null {
    const player = this.state.players.get(playerId);
    if (!player?.isConnected || player.team === 'unassigned') return 'Player is not available';
    let budget = this.budgets.get(playerId);
    if (!budget || now >= budget.resetsAt) {
      budget = { moves: 0, actions: 0, resetsAt: now + 1000 };
      this.budgets.set(playerId, budget);
    }
    if (type === 'input/move' ? ++budget.moves > 30 : ++budget.actions > 12)
      return 'Too many gameplay requests';
    if (type === 'action/rescue-stop') {
      if (!isEmptyPayload(payload)) return 'Invalid rescue request';
      this.stopRescue(playerId);
      return null;
    }
    if (!this.hasStarted || !this.canPlay(now)) return 'Gameplay is unavailable in this phase';
    if (type === 'input/move') {
      if (!isMoveInput(payload)) return 'Invalid movement input';
      const previous = this.sequences.get(playerId) ?? player.inputSequence;
      if (payload.sequence <= previous || payload.sequence > previous + 128)
        return 'Stale or invalid input sequence';
      this.sequences.set(playerId, payload.sequence);
      if (player.status !== 'active') {
        player.inputSequence = payload.sequence;
        return null;
      }
      const queue = this.inputs.get(playerId) ?? [];
      queue.push({ input: payload, receivedAt: now });
      if (queue.length > GAMEPLAY.maxInputQueue) queue.shift();
      this.inputs.set(playerId, queue);
      return null;
    }
    if (type === 'action/help-ping') {
      if (!isEmptyPayload(payload)) return 'Invalid help request';
      if (player.team !== 'water' || player.status !== 'frozen')
        return 'Only frozen Water can request help';
      if (now < player.helpPingReadyAt) return 'Help ping is cooling down';
      player.helpPingReadyAt = now + GAMEPLAY.helpCooldownMs;
      player.helpPingUntil = now + GAMEPLAY.helpDurationMs;
      this.emit({
        type: 'player/help-ping',
        payload: { playerId, until: player.helpPingUntil, serverTime: now },
      });
      return null;
    }
    if (type === 'action/frost-throw') {
      if (!isFrostThrowIntent(payload)) return 'Invalid frost throw';
      if (player.status !== 'active') return 'Frozen or eliminated players cannot act';
      return this.throwFrost(player, payload, now);
    }
    if (!isTargetIntent(payload)) return 'Invalid target';
    if (player.status !== 'active') return 'Frozen or eliminated players cannot act';
    if (!canRescueInPhase(this.state.phase, this.state.phaseDeadline, now))
      return 'Rescue is locked';
    if (player.team !== 'water') return 'Only Water can rescue';
    const target = this.nearbyTarget(player, payload.targetId, GAMEPLAY.rescueRange);
    if (!target || target.team !== 'water' || target.status !== 'frozen')
      return 'Move closer to a frozen teammate';
    const previous = this.rescues.get(playerId);
    this.rescues.set(playerId, {
      targetId: target.playerId,
      expiresAt: now + GAMEPLAY.rescueLeaseMs,
      startedAt:
        previous?.targetId === target.playerId && previous.expiresAt > now
          ? previous.startedAt
          : now,
    });
    player.rescuingTarget = target.playerId;
    return null;
  }

  disconnect(playerId: string): void {
    this.clearInput(playerId);
    this.stopRescue(playerId);
  }

  private canPlay(now: number): boolean {
    return (
      isPlayPhase(this.state.phase) &&
      (this.state.phaseDeadline === 0 || now < this.state.phaseDeadline)
    );
  }

  private nearbyTarget(
    player: PlayerState,
    targetId: string,
    range: number,
  ): PlayerState | undefined {
    if (targetId === player.playerId) return undefined;
    return this.grid
      .nearby(player, range)
      .find(
        (target) =>
          target.playerId === targetId &&
          distanceSquared3d(player, target) <= range * range &&
          hasGameplayLineOfSight(player, target),
      );
  }

  private throwFrost(
    player: PlayerState,
    direction: { directionX: number; directionY: number; directionZ: number },
    now: number,
  ): string | null {
    if (player.team !== 'ice') return 'Only Ice can throw frost';
    if (now < player.frostReadyAt) return 'Frost is cooling down';
    if (this.state.projectiles.size >= GAMEPLAY.maxFrostProjectiles)
      return 'Too much frost is already in flight';

    const magnitude = Math.hypot(direction.directionX, direction.directionY, direction.directionZ);
    const x = direction.directionX / magnitude;
    const y = direction.directionY / magnitude;
    const z = direction.directionZ / magnitude;
    const projectile = new FrostProjectileState();
    projectile.projectileId = `frost-${++this.projectileSequence}`;
    projectile.ownerPlayerId = player.playerId;
    const offset = GAMEPLAY.playerRadius + GAMEPLAY.frostProjectileRadius + 0.1;
    projectile.x = player.x + x * offset;
    projectile.y = player.y + GAMEPLAY.interactionHeight + y * offset;
    projectile.z = player.z + z * offset;
    projectile.velocityX = x * GAMEPLAY.frostProjectileSpeed;
    projectile.velocityY = y * GAMEPLAY.frostProjectileSpeed;
    projectile.velocityZ = z * GAMEPLAY.frostProjectileSpeed;
    projectile.expiresAt = now + GAMEPLAY.frostProjectileLifetimeMs;
    this.state.projectiles.set(projectile.projectileId, projectile);
    player.frostReadyAt = now + GAMEPLAY.frostThrowCooldownMs;
    this.emit({
      type: 'frost/thrown',
      payload: {
        projectileId: projectile.projectileId,
        ownerPlayerId: player.playerId,
        serverTime: now,
      },
    });
    return null;
  }

  private freezeTarget(
    owner: PlayerState,
    target: PlayerState,
    velocityX: number,
    velocityZ: number,
    now: number,
  ): boolean {
    if (target.team !== 'water' || target.status !== 'active' || now < target.protectedUntil)
      return false;
    target.status = 'frozen';
    target.protectedUntil = 0;
    const distance = Math.hypot(velocityX, velocityZ);
    if (distance > 0.001) {
      target.knockbackX = (velocityX / distance) * GAMEPLAY.knockbackSpeed;
      target.knockbackZ = (velocityZ / distance) * GAMEPLAY.knockbackSpeed;
      target.verticalVelocity = GAMEPLAY.knockbackVerticalSpeed;
      target.isGrounded = false;
    }
    target.rescueProgress = 0;
    this.clearInput(target.playerId);
    this.stopRescue(target.playerId);
    owner.tags++;
    this.emit({
      type: 'player/frozen',
      payload: { playerId: target.playerId, by: owner.playerId, serverTime: now },
    });
    return true;
  }

  private clearInput(playerId: string): void {
    this.inputs.delete(playerId);
    const player = this.state.players.get(playerId);
    if (player) player.inputSequence = this.sequences.get(playerId) ?? player.inputSequence;
  }

  private stopRescue(playerId: string): void {
    this.rescues.delete(playerId);
    const player = this.state.players.get(playerId);
    if (player) player.rescuingTarget = '';
  }

  private step(now: number): void {
    const canPlay = this.canPlay(now);
    const dt = GAMEPLAY.tickMs / 1000;
    if (!canPlay) this.state.projectiles.clear();
    for (const player of this.state.players.values()) {
      if (player.status === 'eliminated' || player.status === 'spectator') {
        this.clearInput(player.playerId);
        continue;
      }
      if (!canPlay) {
        this.clearInput(player.playerId);
        this.advanceVertical(player, dt, false);
        continue;
      }

      if (player.status === 'frozen') {
        player.x += player.knockbackX * dt;
        player.z += player.knockbackZ * dt;
        player.x = Math.max(
          -this.state.arenaHalfExtent,
          Math.min(this.state.arenaHalfExtent, player.x),
        );
        player.z = Math.max(
          -this.state.arenaHalfExtent,
          Math.min(this.state.arenaHalfExtent, player.z),
        );
        player.knockbackX *= GAMEPLAY.knockbackDecay;
        player.knockbackZ *= GAMEPLAY.knockbackDecay;
        if (Math.abs(player.knockbackX) < 0.05) player.knockbackX = 0;
        if (Math.abs(player.knockbackZ) < 0.05) player.knockbackZ = 0;
        this.clearInput(player.playerId);
        this.advanceVertical(player, dt, false);
        continue;
      }

      if (!player.isConnected) {
        this.clearInput(player.playerId);
        this.advanceVertical(player, dt, false);
        continue;
      }

      const queue = this.inputs.get(player.playerId);
      while (queue?.[0] && now - queue[0].receivedAt > GAMEPLAY.inputExpiryMs) {
        player.inputSequence = queue.shift()!.input.sequence;
      }
      const next = queue?.shift();
      if (next) {
        const position = moveKinematic(player, next.input, dt, this.state.arenaHalfExtent);
        player.x = position.x;
        player.z = position.z;
        if (next.input.x || next.input.z) player.yaw = Math.atan2(next.input.x, next.input.z);
        player.inputSequence = next.input.sequence;
      }
      this.advanceVertical(player, dt, next?.input.jump === true);
    }

    this.grid.rebuild(this.state.players.values());
    if (canPlay) this.advanceProjectiles(now, dt);

    const contributors = new Map<string, { ids: string[]; elapsed: number }>();

    for (const [id, intent] of this.rescues) {
      const rescuer = this.state.players.get(id);
      const target = rescuer && this.nearbyTarget(rescuer, intent.targetId, GAMEPLAY.rescueRange);

      if (
        !canRescueInPhase(this.state.phase, this.state.phaseDeadline, now) ||
        now >= intent.expiresAt ||
        !rescuer?.isConnected ||
        rescuer.status !== 'active' ||
        rescuer.team !== 'water' ||
        !target ||
        target.status !== 'frozen' ||
        target.team !== 'water'
      ) {
        this.stopRescue(id);
        continue;
      }

      const group = contributors.get(target.playerId) ?? {
        ids: [],
        elapsed: 0,
      };

      group.ids.push(id);
      group.elapsed = Math.max(
        group.elapsed,
        Math.min(GAMEPLAY.tickMs, Math.max(0, now - intent.startedAt)),
      );

      contributors.set(target.playerId, group);
    }

    for (const player of this.state.players.values()) {
      const group = contributors.get(player.playerId);

      if (!group) {
        this.progress.delete(player.playerId);
        player.rescueProgress = 0;
        continue;
      }

      const elapsed = (this.progress.get(player.playerId) ?? 0) + group.elapsed;

      this.progress.set(player.playerId, elapsed);
      player.rescueProgress = Math.min(1, elapsed / GAMEPLAY.rescueMs);

      if (elapsed < GAMEPLAY.rescueMs) continue;

      player.status = 'active';
      player.protectedUntil = now + GAMEPLAY.protectionMs;
      player.helpPingUntil = 0;
      player.rescueProgress = 0;
      this.progress.delete(player.playerId);

      for (const id of group.ids) {
        const rescuer = this.state.players.get(id);
        if (rescuer) rescuer.rescues++;
        this.stopRescue(id);
      }

      this.emit({
        type: 'player/rescued',
        payload: {
          playerId: player.playerId,
          by: group.ids,
          protectedUntil: player.protectedUntil,
          serverTime: now,
        },
      });
    }
  }

  private advanceProjectiles(now: number, seconds: number): void {
    for (const projectile of this.state.projectiles.values()) {
      if (now >= projectile.expiresAt) {
        this.state.projectiles.delete(projectile.projectileId);
        continue;
      }

      const start = { x: projectile.x, y: projectile.y, z: projectile.z };
      const end = {
        x: start.x + projectile.velocityX * seconds,
        y: start.y + projectile.velocityY * seconds,
        z: start.z + projectile.velocityZ * seconds,
      };
      const midpoint = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
      const searchRadius =
        Math.hypot(end.x - start.x, end.z - start.z) / 2 + GAMEPLAY.frostProjectileHitRadius;
      let collision: { target: PlayerState; time: number } | undefined;
      for (const target of this.grid.nearby(midpoint, searchRadius)) {
        if (
          target.playerId === projectile.ownerPlayerId ||
          target.team !== 'water' ||
          target.status !== 'active'
        ) {
          continue;
        }
        const result = distanceToSegmentSquared(start, end, {
          x: target.x,
          y: target.y + GAMEPLAY.interactionHeight,
          z: target.z,
        });
        if (
          result.distanceSquared > GAMEPLAY.frostProjectileHitRadius ** 2 ||
          (collision && collision.time <= result.time)
        ) {
          continue;
        }
        collision = { target, time: result.time };
      }

      if (collision) {
        const owner = this.state.players.get(projectile.ownerPlayerId);
        const impact = {
          x: start.x + (end.x - start.x) * collision.time,
          y: start.y + (end.y - start.y) * collision.time,
          z: start.z + (end.z - start.z) * collision.time,
        };
        if (
          owner &&
          impact.y > terrainHeightAt(impact) + GAMEPLAY.frostProjectileRadius &&
          hasProjectileLineOfSight(start, impact)
        ) {
          this.freezeTarget(
            owner,
            collision.target,
            projectile.velocityX,
            projectile.velocityZ,
            now,
          );
        }
        this.state.projectiles.delete(projectile.projectileId);
        continue;
      }

      const isOutsideBoundary =
        Math.abs(end.x) > this.state.arenaHalfExtent ||
        Math.abs(end.z) > this.state.arenaHalfExtent;
      const isBelowTerrain = end.y <= terrainHeightAt(end) + GAMEPLAY.frostProjectileRadius;
      if (isOutsideBoundary || isBelowTerrain || !hasProjectileLineOfSight(start, end)) {
        this.state.projectiles.delete(projectile.projectileId);
        continue;
      }

      projectile.x = end.x;
      projectile.y = end.y;
      projectile.z = end.z;
    }
  }

  private advanceVertical(player: PlayerState, seconds: number, wantsJump: boolean): void {
    const next = advanceVerticalMotion(player, player, seconds, wantsJump);
    player.y = next.y;
    player.verticalVelocity = next.verticalVelocity;
    player.isGrounded = next.isGrounded;
  }
}
