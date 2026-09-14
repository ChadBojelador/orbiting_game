import {
  GAMEPLAY,
  WEAPONS,
  simulateMovement,
  terrainHeightAt,
  isMoveInput,
  isShootIntent,
  isReloadIntent,
  isWeaponSwitchIntent,
  type GameplayEvent,
  type GameplayMessages,
  type MoveInput,
} from '@ice-water/shared';
import type { LobbyState, PlayerState } from '../rooms/lobby-state.js';
import { WeaponController } from './weapon-controller.js';
import { fireHitscan } from './damage-system.js';
import { selectSpawn } from './spawn-manager.js';
interface PendingInput {
  input: MoveInput;
  receivedAt: number;
}
export class GameplayController {
  readonly weapons = new WeaponController();
  private readonly inputs = new Map<string, PendingInput[]>();
  private readonly sequences = new Map<string, number>();
  private readonly budgets = new Map<
    string,
    { moves: number; actions: number; resetsAt: number }
  >();
  private lastTick = 0;
  private hasStarted = false;
  constructor(
    private readonly state: LobbyState,
    private readonly emit: (event: GameplayEvent) => void = () => {},
  ) {}
  start(now: number): void {
    this.hasStarted = true;
    this.lastTick = now;
    this.inputs.clear();
    for (const p of this.state.players.values()) p.status = 'spectator';
    for (const p of this.state.players.values())
      if (p.isConnected && p.team !== 'unassigned') this.respawn(p, now, false);
  }
  advance(now: number): void {
    if (!this.hasStarted || now < this.lastTick) return;
    this.lastTick = Math.max(this.lastTick, now - 250);
    while (now - this.lastTick >= GAMEPLAY.tickMs) {
      this.lastTick += GAMEPLAY.tickMs;
      this.step(this.lastTick);
    }
  }
  handle(id: string, type: keyof GameplayMessages, payload: unknown, now: number): string | null {
    const player = this.state.players.get(id);
    if (!player?.isConnected || player.team === 'unassigned') return 'Player is not available';
    let budget = this.budgets.get(id);
    if (!budget || now >= budget.resetsAt) {
      budget = { moves: 0, actions: 0, resetsAt: now + 1000 };
      this.budgets.set(id, budget);
    }
    if (type === 'input/move' ? ++budget.moves > 30 : ++budget.actions > 25)
      return 'Too many gameplay requests';
    if (!this.hasStarted || !this.canPlay(now)) return 'Gameplay is unavailable in this phase';
    if (type === 'input/move') {
      if (!isMoveInput(payload)) return 'Invalid movement input';
      const previous = this.sequences.get(id) ?? player.inputSequence;
      if (payload.sequence <= previous || payload.sequence > previous + 128)
        return 'Stale or invalid input sequence';
      this.sequences.set(id, payload.sequence);
      if (player.status !== 'alive') {
        player.inputSequence = payload.sequence;
        return null;
      }
      const queue = this.inputs.get(id) ?? [];
      if (queue.length >= GAMEPLAY.maxInputQueue) queue.shift();
      queue.push({ input: payload, receivedAt: now });
      this.inputs.set(id, queue);
      return null;
    }
    this.advance(now);
    if (player.status !== 'alive') return 'Player is not alive';
    if (type === 'action/shoot') {
      if (!isShootIntent(payload)) return 'Invalid shot intent';
      const error = this.weapons.fire(player, now);
      if (error) return error;
      player.yaw = payload.yaw;
      player.pitch = payload.pitch;
      fireHitscan(this.state, player, payload, now, (event) => {
        if (event.type === 'player/killed') this.inputs.delete(event.payload.victimId);
        this.emit(event);
      });
      return null;
    }
    if (type === 'action/reload')
      return isReloadIntent(payload) ? this.weapons.reload(player, now) : 'Invalid reload request';
    if (type === 'action/switch-weapon') {
      if (!isWeaponSwitchIntent(payload)) return 'Invalid weapon slot';
      this.weapons.switch(player, payload.slot);
      return null;
    }
    return 'Unknown gameplay request';
  }
  disconnect(id: string): void {
    this.inputs.delete(id);
    const p = this.state.players.get(id);
    if (p) {
      p.velocityX = 0;
      p.velocityZ = 0;
      p.isSliding = false;
    }
  }
  private canPlay(now: number): boolean {
    return this.state.phase === 'playing' && now < this.state.phaseDeadline;
  }
  private step(now: number): void {
    if (!this.canPlay(now)) return;
    for (const p of this.state.players.values()) {
      if (p.status === 'dead' && p.isConnected && now >= p.respawnAt) this.respawn(p, now, true);
      if (p.status !== 'alive') continue;
      this.weapons.tick(p, now);
      const queue = this.inputs.get(p.playerId);
      let pending = queue?.[0];
      while (pending && now - pending.receivedAt > GAMEPLAY.inputExpiryMs) {
        p.inputSequence = pending.input.sequence;
        queue!.shift();
        pending = queue?.[0];
      }
      const ready = pending && pending.receivedAt <= now ? queue!.shift() : undefined;
      const input = ready?.input ?? { x: 0, z: 0, sequence: p.inputSequence };
      if (ready) {
        p.inputSequence = input.sequence;
        p.yaw = input.yaw ?? p.yaw;
        p.pitch = input.pitch ?? p.pitch;
      }
      Object.assign(
        p,
        simulateMovement(
          p,
          input,
          now,
          GAMEPLAY.tickMs / 1000,
          WEAPONS[p.weaponId].moveSpeedMultiplier,
          this.state.mapId,
        ),
      );
    }
  }
  private respawn(p: PlayerState, now: number, isDeath: boolean): void {
    const spawn = selectSpawn(this.state, p, isDeath ? p : undefined);
    this.inputs.delete(p.playerId);
    p.inputSequence = this.sequences.get(p.playerId) ?? p.inputSequence;
    Object.assign(p, spawn, {
      y: terrainHeightAt(spawn, this.state.mapId),
      velocityX: 0,
      velocityZ: 0,
      verticalVelocity: 0,
      isGrounded: true,
      isSliding: false,
      isCrouching: false,
      slideUntil: 0,
      slideReadyAt: 0,
    });
    p.status = 'alive';
    p.hp = GAMEPLAY.maxHp;
    p.respawnAt = 0;
    p.protectedUntil = now + GAMEPLAY.spawnProtectionMs;
    p.spawnGeneration++;
    p.yaw = Math.atan2(spawn.x, spawn.z);
    p.pitch = 0;
    this.weapons.reset(p);
    this.emit({
      type: 'player/respawned',
      payload: { playerId: p.playerId, x: p.x, y: p.y, z: p.z, serverTime: now },
    });
  }
}
