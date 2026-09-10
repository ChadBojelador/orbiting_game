import { PlayerState } from '../rooms/lobby-state.js';
import type { LobbyState } from '../rooms/lobby-state.js';
import type { GameplayController } from '../gameplay/gameplay-controller.js';

// How often (ms) a bot picks a new random direction.
const DIRECTION_CHANGE_MS = 2000;

// Readable display names for bots shown in the lobby.
const BOT_NAMES = [
  'IcyBot', 'WaterBot', 'FreezeBot', 'ChillBot', 'SlushBot',
  'SnowBot', 'GlacierBot', 'FrostBot', 'TundraBot', 'ArcticBot',
];

interface BotMotion {
  x: number; // normalised [-1, 1]
  z: number; // normalised [-1, 1]
  nextChangeAt: number;
  sequence: number;
}

/**
 * Dev-only driver for wandering dummy players.
 *
 * Bots are registered as real PlayerState entries in the Colyseus room so
 * every server rule — spawning, freezing, rescue, phase deadlines, elimination
 * — applies to them exactly as it would to a human player. Their sole
 * behaviour is random movement; they do not tag, rescue, or react to game state.
 *
 * Only constructed when DEV_BOT_COUNT > 0, which environment.ts forces to zero
 * in production.
 */
export class BotRunner {
  private readonly botIds: string[] = [];
  private readonly motions = new Map<string, BotMotion>();

  constructor(
    private readonly state: LobbyState,
    private readonly gameplay: GameplayController,
    readonly count: number,
  ) {}

  /** Insert bot players into the room state. Call once inside onCreate. */
  start(): void {
    for (let i = 0; i < this.count; i++) {
      const id = `bot-${i}`;
      const player = new PlayerState();
      player.playerId = id;
      player.displayName = BOT_NAMES[i % BOT_NAMES.length] ?? `Bot ${i + 1}`;
      player.isConnected = true;
      this.state.players.set(id, player);
      this.botIds.push(id);
    }
  }

  /**
   * Feed random movement inputs to each living bot. Call every tick from
   * PrivateRoom.advance() while gameplay is active.
   */
  tick(now: number): void {
    if (this.botIds.length === 0) return;
    for (const id of this.botIds) {
      const player = this.state.players.get(id);
      // Skip if eliminated or frozen — bots cannot self-rescue.
      if (!player || player.status === 'eliminated' || player.status === 'frozen') continue;
      // Pick a new random direction occasionally.
      let motion = this.motions.get(id);
      if (!motion || now >= motion.nextChangeAt) {
        const angle = Math.random() * 2 * Math.PI;
        motion = {
          x: Math.cos(angle),
          z: Math.sin(angle),
          nextChangeAt: now + DIRECTION_CHANGE_MS + Math.random() * 1000,
          sequence: (motion?.sequence ?? 0) + 1,
        };
        this.motions.set(id, motion);
      } else {
        motion.sequence++;
      }
      // Deliver the input through the normal handler so rate-limit and arena
      // boundary enforcement both apply.
      this.gameplay.handle(
        id,
        'input/move',
        { x: motion.x, z: motion.z, sequence: motion.sequence },
        now,
      );
    }
  }

  /** Remove bots from room state. Call from onDispose. */
  stop(): void {
    for (const id of this.botIds) {
      this.state.players.delete(id);
    }
    this.botIds.length = 0;
    this.motions.clear();
  }

  /** True if the given player ID belongs to this runner (not a real player). */
  isBot(playerId: string): boolean {
    return playerId.startsWith('bot-');
  }
}
