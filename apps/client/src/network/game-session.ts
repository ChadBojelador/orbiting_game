import {
  GAMEPLAY,
  canRescueInPhase,
  distanceSquared3d,
  hasGameplayLineOfSight,
  isPlayPhase,
  type LobbyView,
  type PlayerView,
} from '@ice-water/shared';

import { cameraRelative, GameInput } from '../input/game-input.js';
import { snapshot, type LobbyRoom } from './lobby-client.js';
import { LocalPrediction, RemoteInterpolation } from './player-motion.js';
import { ServerClock } from './server-clock.js';

export function nearestTarget(view: LobbyView, local: PlayerView): PlayerView | undefined {
  const range = GAMEPLAY.rescueRange;
  if (local.status !== 'active' || local.team !== 'water') return undefined;

  return view.players
    .filter(
      (player) =>
        player.playerId !== local.playerId &&
        player.team === 'water' &&
        player.status === 'frozen' &&
        distanceSquared3d(local, player) <= range * range &&
        hasGameplayLineOfSight(local, player),
    )
    .sort((a, b) => distanceSquared3d(local, a) - distanceSquared3d(local, b))[0];
}

export class GameSession {
  readonly input = new GameInput();
  readonly prediction = new LocalPrediction();
  readonly remotes = new Map<string, RemoteInterpolation>();

  view: LobbyView;
  isConnected = true;

  private readonly clock = new ServerClock();
  private rescueTarget = '';
  private rescueSentAt = 0;
  private readonly cleanups: (() => void)[] = [];

  constructor(
    private readonly room: LobbyRoom,
    readonly playerId: string,
  ) {
    this.view = snapshot(room.state);
    this.clock.update(this.view.serverTime);

    const update = () => {
      this.view = snapshot(room.state);
      this.clock.update(this.view.serverTime);

      for (const player of this.view.players) {
        if (player.playerId === playerId) {
          this.prediction.reconcile(player, this.canMove(player));
        } else {
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
    return this.clock.now();
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

  private stopRescue(): void {
    if (this.rescueTarget && this.isConnected) {
      this.room.send('action/rescue-stop', {});
    }

    this.rescueTarget = '';
  }

  private tick(): void {
    const local = this.local();
    if (!local || !this.isConnected || !isPlayPhase(this.view.phase)) return;
    const input = this.input.sample(GAMEPLAY.tickMs / 1000);
    const now = this.serverNow();

    const canMove = this.canMove(local) && !document.hidden;

    const move = this.prediction.predict(
      canMove ? input : { x: 0, z: 0 },
      canMove,
      canMove && input.hasJump,
    );

    // Send only protocol fields; action flags never enter
    // the movement payload.
    this.room.send('input/move', {
      x: move.x,
      z: move.z,
      sequence: move.sequence,
      jump: move.jump,
    });

    if (
      (input.hasFrostThrow || input.isFrostFiring) &&
      local.team === 'ice' &&
      now >= local.frostReadyAt
    ) {
      const horizontal = cameraRelative({ x: 0, z: -1 }, this.input.cameraYaw);
      const directionY = 0.08;
      const horizontalScale = Math.sqrt(1 - directionY * directionY);
      this.room.send('action/frost-throw', {
        directionX: horizontal.x * horizontalScale,
        directionY,
        directionZ: horizontal.z * horizontalScale,
      });
    }

    const target = nearestTarget(this.view, local);

    if (input.hasPing && local.status === 'frozen' && now >= local.helpPingReadyAt) {
      this.room.send('action/help-ping', {});
    }

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

    if (target.playerId !== this.rescueTarget) {
      this.stopRescue();
    }

    if (!this.rescueTarget || now - this.rescueSentAt >= 200) {
      this.room.send('action/rescue-start', {
        targetId: target.playerId,
      });

      this.rescueTarget = target.playerId;
      this.rescueSentAt = now;
    }
  }
}
