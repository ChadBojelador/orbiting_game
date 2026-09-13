import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { GAMEPLAY, isEmptyPayload, isRecord, type GameplayMessages } from '@ice-water/shared';
import type { GuestIdentity, GuestSessions } from '../auth/guest-session.js';
import { RateLimiter } from '../auth/rate-limiter.js';
import type { ServerConfig } from '../config/environment.js';
import { LobbyController } from './lobby-controller.js';
import { LobbyState, PlayerState } from './lobby-state.js';
import type { RoomDirectory } from './room-directory.js';
import { GameplayController } from '../gameplay/gameplay-controller.js';
import { MatchController } from '../gameplay/match-controller.js';
import { advanceAuthoritativeTick } from '../gameplay/authoritative-tick.js';
import { BotRunner } from '../simulation/bot-runner.js';

type GuestClient = Client<{ auth: GuestIdentity }>;
export interface RoomDependencies {
  config: ServerConfig;
  sessions: GuestSessions;
  directory: RoomDirectory;
}

export function createPrivateRoom({ config, sessions, directory }: RoomDependencies) {
  return class PrivateRoom extends Room<{ state: LobbyState; client: GuestClient }> {
    override state = new LobbyState();
    private readonly controller = new LobbyController(
      this.state,
      config.countdownSeconds * 1000,
      config.iceBrackets,
    );
    private readonly actions = new RateLimiter(4, 1000);
    private readonly gameplay = new GameplayController(this.state, (event) =>
      this.broadcast(event.type, event.payload),
    );
    private readonly match = new MatchController(
      this.state,
      (event) => this.broadcast(event.type, event.payload as never),
      (now, halfExtent) => this.gameplay.startRound(now, halfExtent),
    );
    private readonly bots: BotRunner | null =
      config.devBotCount > 0 ? new BotRunner(this.state, this.gameplay, config.devBotCount) : null;
    private createdAt = Date.now();

    override async onCreate(options: unknown): Promise<void> {
      if (
        !isRecord(options) ||
        typeof options.inviteCode !== 'string' ||
        typeof options.hostPlayerId !== 'string'
      )
        throw new ServerError(403, 'Create a room through the guest lobby');
      this.maxClients = config.maxHumanPlayers;
      this.maxMessagesPerSecond = 60;
      this.seatReservationTimeout = 15;
      this.state.inviteCode = options.inviteCode;
      this.state.hostPlayerId = options.hostPlayerId;
      this.state.maxPlayers = config.maxPlayers;
      await this.setMatchmaking({ private: true, unlisted: true });
      directory.register(this.state.inviteCode, this.roomId);
      // Populate bot seats before registering message handlers so bots appear
      // in the lobby roster from the moment the first real player joins.
      this.bots?.start();
      this.setTimestep(() => this.advance(), GAMEPLAY.tickMs);
      this.patchRate = GAMEPLAY.tickMs;
      const gameplayMessages: (keyof GameplayMessages)[] = [
        'input/move',
        'action/frost-throw',
        'action/rescue-start',
        'action/rescue-stop',
        'action/help-ping',
      ];
      for (const type of gameplayMessages)
        this.onMessage(type, (client: GuestClient, payload: unknown) => {
          if (!client.auth || client.auth.expiresAt <= Date.now())
            return this.fail(client, 'unauthorized', 'Guest session expired');
          const error = this.gameplay.handle(client.auth.playerId, type, payload, Date.now());
          if (error) this.fail(client, 'invalid-action', error);
        });
      this.onMessage('room/start', (client: GuestClient, payload: unknown) => {
        if (!this.actions.take(client.sessionId))
          return this.fail(client, 'rate-limit', 'Slow down and try again');
        if (!isEmptyPayload(payload))
          return this.fail(client, 'invalid-message', 'Invalid start request');
        if (!client.auth) return this.fail(client, 'unauthorized', 'Guest session required');
        const error = this.controller.start(client.auth.playerId, Date.now());
        if (error) return this.fail(client, 'cannot-start', error);
        void this.lock();
        this.phaseChanged();
      });
      this.onMessage('*', (client) => this.fail(client, 'invalid-message', 'Unknown room action'));
    }

    override onAuth(_client: GuestClient, options: unknown, context: AuthContext): GuestIdentity {
      if (context.headers.get('origin') && context.headers.get('origin') !== config.clientOrigin)
        throw new ServerError(403, 'Origin not allowed');
      if (!isRecord(options)) throw new ServerError(401, 'Guest session required');
      let identity: GuestIdentity;
      try {
        identity = sessions.verify(options.token);
      } catch {
        throw new ServerError(401, 'Guest session is invalid or expired');
      }
      if (options.inviteCode !== this.state.inviteCode || this.state.phase !== 'lobby')
        throw new ServerError(403, 'Room is unavailable');
      if (this.state.players.has(identity.playerId))
        throw new ServerError(409, 'This guest is already in the room');
      if (this.state.players.size >= config.maxPlayers) throw new ServerError(409, 'Room is full');
      return identity;
    }

    override onJoin(client: GuestClient): void {
      const identity = client.auth;
      if (!identity) throw new ServerError(401, 'Guest session required');
      if (
        this.state.phase !== 'lobby' ||
        this.state.players.has(identity.playerId) ||
        this.state.players.size >= config.maxPlayers ||
        identity.expiresAt <= Date.now()
      )
        throw new ServerError(409, 'Seat is no longer available');
      const player = new PlayerState();
      player.playerId = identity.playerId;
      player.displayName = identity.displayName;
      this.state.players.set(player.playerId, player);
      directory.connected(identity.sessionId, this.roomId);
      if (!this.state.hostPlayerId) this.state.hostPlayerId = player.playerId;
    }

    override async onDrop(client: GuestClient): Promise<void> {
      if (!client.auth) return;
      const now = Date.now();
      const player = this.state.players.get(client.auth.playerId);
      if (player) {
        player.isConnected = false;
        player.reconnectDeadline = now + config.reconnectSeconds * 1000;
      }
      this.gameplay.disconnect(client.auth.playerId);
      this.controller.transferHost();
      this.advance(now);
      try {
        await this.allowReconnection(client, config.reconnectSeconds);
      } catch {
        /* onLeave releases the expired seat. */
      }
    }

    override onReconnect(client: GuestClient): void {
      if (!client.auth) {
        void client.leave(4001);
        return;
      }
      const now = Date.now();
      const player = this.state.players.get(client.auth.playerId);
      if (
        !player ||
        client.auth.expiresAt <= now ||
        player.reconnectDeadline === 0 ||
        now >= player.reconnectDeadline ||
        (!['lobby', 'countdown'].includes(this.state.phase) && player.team === 'unassigned')
      ) {
        void client.leave(4001);
        return;
      }
      player.isConnected = true;
      player.reconnectDeadline = 0;
      this.controller.transferHost();
    }

    override onLeave(client: GuestClient): void {
      const identity = client.auth;
      if (!identity) return;
      const now = Date.now();
      this.gameplay.disconnect(identity.playerId);
      if (this.state.phase === 'lobby' || this.state.phase === 'countdown') {
        this.state.players.delete(identity.playerId);
      } else {
        // Resolve an authoritative phase deadline before applying a disconnect
        // forfeit when both happen in the same event-loop turn.
        this.advance(now);
        const player = this.state.players.get(identity.playerId);
        if (player) {
          player.isConnected = false;
          player.reconnectDeadline = 0;
          if (player.status === 'active' || player.status === 'frozen') {
            player.status = 'eliminated';
            player.protectedUntil = 0;
            player.rescueProgress = 0;
            player.rescuingTarget = '';
          }
        }
      }
      directory.release(identity.sessionId, this.roomId);
      this.controller.transferHost();
      this.advance(now);
    }

    override onDispose(): void {
      this.bots?.stop();
      directory.dispose(this.state.inviteCode, this.roomId);
    }

    private advance(now = Date.now()): void {
      // Every room patch carries a fresh authoritative time, including phases
      // that are owned by MatchController rather than LobbyController.
      this.state.serverTime = now;
      if (now - this.createdAt > 15000) this.controller.transferHost();
      // Drive bot movement each tick so they count toward gameplay.
      this.bots?.tick(now);
      if (this.controller.tick(now)) {
        if (this.state.phase === 'lobby') void this.unlock();
        // When the countdown finishes and roles are assigned, start the match.
        if (this.state.phase === 'regular' && this.state.round === 0) {
          this.match.start(now);
          // MatchController.start() emits the first phase-changed — skip duplicate.
          this.gameplay.advance(now);
          return;
        }
        this.phaseChanged();
      }
      if (advanceAuthoritativeTick(now, this.gameplay, this.match)) {
        // MatchController already emitted the phase-changed event.
      }
    }
    private phaseChanged(): void {
      this.broadcast('match/phase-changed', {
        phase: this.state.phase,
        phaseDeadline: this.state.phaseDeadline,
        serverTime: this.state.serverTime,
      });
    }
    private fail(client: GuestClient, code: string, message: string): void {
      client.send('session/error', { code, message });
    }
  };
}
