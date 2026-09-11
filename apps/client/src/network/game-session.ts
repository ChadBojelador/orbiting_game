import {
  GAMEPLAY,
  canRescueInPhase,
  distanceSquared,
  hasLineOfSight,
  isPlayPhase,
  type LobbyView,
  type PlayerView,
} from '@ice-water/shared';
import { GameInput } from '../input/game-input.js';
import { snapshot, type LobbyRoom } from './lobby-client.js';
import { LocalPrediction, RemoteInterpolation } from './player-motion.js';

export function nearestTarget(
  view: LobbyView,
  local: PlayerView,
  now: number,
): PlayerView | undefined {
  const range = local.team === 'ice' ? GAMEPLAY.tagRange : GAMEPLAY.rescueRange;
  if (local.status !== 'active') return undefined;
  return view.players
    .filter(
      (player) =>
        player.playerId !== local.playerId &&
        player.team === 'water' &&
        (local.team === 'ice'
          ? player.status === 'active' && now >= player.protectedUntil
          : player.status === 'frozen') &&
        distanceSquared(local, player) <= range * range &&
        hasLineOfSight(local, player),
    )
    .sort((a, b) => distanceSquared(local, a) - distanceSquared(local, b))[0];
}

export class GameSession {
  readonly input = new GameInput();
  readonly prediction = new LocalPrediction();
  readonly remotes = new Map<string, RemoteInterpolation>();
  view: LobbyView;
  isConnected = true;
  private receivedAt = performance.now();
  private rescueTarget = '';
  private rescueSentAt = 0;
  private jumpRequested = false;
  private readonly cleanups: (() => void)[] = [];

  constructor(
    private readonly room: LobbyRoom,
    readonly playerId: string,
  ) {
    this.view = snapshot(room.state);
    const update = () => {
      this.view = snapshot(room.state);
      this.receivedAt = performance.now();
      for (const player of this.view.players) {
        if (player.playerId === playerId) this.prediction.reconcile(player, this.canMove(player));
        else {
          let motion = this.remotes.get(player.playerId);
          if (!motion) {
            motion = new RemoteInterpolation();
            this.remotes.set(player.playerId, motion);
          }
          motion.push(player, this.view.serverTime);
        }
      }
    };
    room.onStateChange(update);
    this.cleanups.push(() => room.onStateChange.remove(update));
    const onDropHandler = () => {
      this.isConnected = false;
      this.input.reset();
      this.prediction.reset();
      this.rescueTarget = '';
    };
    room.onDrop(onDropHandler);
    this.cleanups.push(() => room.onDrop.remove(onDropHandler));
    const onReconnectHandler = () => {
      this.isConnected = true;
      this.input.reset();
      this.prediction.reset();
      update();
    };
    room.onReconnect(onReconnectHandler);
    this.cleanups.push(() => room.onReconnect.remove(onReconnectHandler));
    update();
    const timer = window.setInterval(() => this.tick(), GAMEPLAY.tickMs);
    this.cleanups.push(() => window.clearInterval(timer));
    this.cleanups.push(this.input.bind(window, () => this.stopRescue()));
  }

  serverNow(): number {
    return this.view.serverTime + performance.now() - this.receivedAt;
  }
  local(): PlayerView | undefined {
    return this.view.players.find((player) => player.playerId === this.playerId);
  }
  canMove(player: PlayerView): boolean {
    return (
      this.isConnected &&
      player.isConnected &&
      player.status === 'active' &&
      isPlayPhase(this.view.phase) &&
      (this.view.phaseDeadline === 0 || this.serverNow() < this.view.phaseDeadline)
    );
  }
  destroy(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.stopRescue();
  }

  consumeJumpRequest(): boolean {
    const requested = this.jumpRequested;
    this.jumpRequested = false;
    return requested;
  }

  private stopRescue(): void {
    if (this.rescueTarget && this.isConnected) this.room.send('action/rescue-stop', {});
    this.rescueTarget = '';
  }
  private tick(): void {
    const local = this.local();
    if (!local || !this.isConnected || !isPlayPhase(this.view.phase)) return;
    const input = this.input.sample(GAMEPLAY.tickMs / 1000);
    this.jumpRequested ||= input.hasJump;
    const now = this.serverNow();
    const canMove = this.canMove(local) && !document.hidden;
    const move = this.prediction.predict(canMove ? input : { x: 0, z: 0 }, canMove);
    // Send only protocol fields; action flags never enter the movement payload.
    this.room.send('input/move', { x: move.x, z: move.z, sequence: move.sequence });
    const target = nearestTarget(this.view, local, now);
    if (input.hasTag && local.team === 'ice' && target && now >= local.tagReadyAt)
      this.room.send('action/tag', { targetId: target.playerId });
    if (input.hasPing && local.status === 'frozen' && now >= local.helpPingReadyAt)
      this.room.send('action/help-ping', {});
    const canRescue =
      canMove &&
      input.isRescuing &&
      local.team === 'water' &&
      target &&
      canRescueInPhase(this.view.phase, this.view.phaseDeadline, now);
    if (!canRescue) {
      this.stopRescue();
      return;
    }
    if (target.playerId !== this.rescueTarget) this.stopRescue();
    if (!this.rescueTarget || now - this.rescueSentAt >= 200) {
      this.room.send('action/rescue-start', { targetId: target.playerId });
      this.rescueTarget = target.playerId;
      this.rescueSentAt = now;
    }
  }
}
