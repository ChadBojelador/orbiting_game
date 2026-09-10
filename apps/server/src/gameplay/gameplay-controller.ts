import {
  GAMEPLAY,
  canRescueInPhase,
  createSpawnPoints,
  hasLineOfSight,
  isEmptyPayload,
  isMoveInput,
  isPlayPhase,
  isTargetIntent,
  moveKinematic,
  type GameplayEvent,
  type GameplayMessages,
  type MoveInput,
} from '@ice-water/shared';
import type { LobbyState, PlayerState } from '../rooms/lobby-state.js';
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

export class GameplayController {
  private readonly grid = new SpatialGrid<PlayerState>();
  private readonly inputs = new Map<string, PendingInput[]>();
  private readonly sequences = new Map<string, number>();
  private readonly rescues = new Map<string, RescueIntent>();
  private readonly progress = new Map<string, number>();
  private readonly budgets = new Map<string, MessageBudget>();
  private lastTick = 0;
  private hasStarted = false;

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
      const spawn = spawns[index++];
      if (!spawn) throw new Error('Arena does not have enough spawn points');
      player.x = spawn.x;
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
    if (!isTargetIntent(payload)) return 'Invalid target';
    if (player.status !== 'active') return 'Frozen or eliminated players cannot act';
    if (type === 'action/tag') return this.tag(player, payload.targetId, now);
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
      .find((target) => target.playerId === targetId && hasLineOfSight(player, target));
  }

  private tag(player: PlayerState, targetId: string, now: number): string | null {
    if (player.team !== 'ice') return 'Only Ice can tag';
    if (now < player.tagReadyAt) return 'Tag is cooling down';
    const target = this.nearbyTarget(player, targetId, GAMEPLAY.tagRange);
    if (!target || target.team !== 'water' || target.status !== 'active')
      return 'Move closer to active Water';
    if (now < target.protectedUntil) return 'This player is protected';
    target.status = 'frozen';
    target.protectedUntil = 0;
    target.rescueProgress = 0;
    this.clearInput(target.playerId);
    this.stopRescue(target.playerId);
    player.tagReadyAt = now + GAMEPLAY.tagCooldownMs;
    player.tags++;
    this.emit({
      type: 'player/frozen',
      payload: { playerId: targetId, by: player.playerId, serverTime: now },
    });
    return null;
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
    for (const player of this.state.players.values()) {
      if (!canPlay || !player.isConnected || player.status !== 'active') {
        this.clearInput(player.playerId);
        continue;
      }
      const queue = this.inputs.get(player.playerId);
      if (!queue) continue;
      while (queue[0] && now - queue[0].receivedAt > GAMEPLAY.inputExpiryMs) {
        player.inputSequence = queue.shift()!.input.sequence;
      }
      const next = queue.shift();
      if (!next) continue;
      const position = moveKinematic(
        player,
        next.input,
        GAMEPLAY.tickMs / 1000,
        this.state.arenaHalfExtent,
      );
      player.x = position.x;
      player.z = position.z;
      if (next.input.x || next.input.z) player.yaw = Math.atan2(next.input.x, next.input.z);
      player.inputSequence = next.input.sequence;
    }
    this.grid.rebuild(this.state.players.values());
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
      const group = contributors.get(target.playerId) ?? { ids: [], elapsed: 0 };
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
}
