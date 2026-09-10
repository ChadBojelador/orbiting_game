import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { isEmptyPayload, isRecord } from '@ice-water/shared';
import type { GuestIdentity, GuestSessions } from '../auth/guest-session.js';
import { RateLimiter } from '../auth/rate-limiter.js';
import type { ServerConfig } from '../config/environment.js';
import { LobbyController } from './lobby-controller.js';
import { LobbyState, PlayerState } from './lobby-state.js';
import type { RoomDirectory } from './room-directory.js';

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
    private createdAt = Date.now();

    override async onCreate(options: unknown): Promise<void> {
      if (
        !isRecord(options) ||
        typeof options.inviteCode !== 'string' ||
        typeof options.hostPlayerId !== 'string'
      )
        throw new ServerError(403, 'Create a room through the guest lobby');
      this.maxClients = config.maxPlayers;
      this.maxMessagesPerSecond = 12;
      this.seatReservationTimeout = 15;
      this.state.inviteCode = options.inviteCode;
      this.state.hostPlayerId = options.hostPlayerId;
      this.state.maxPlayers = config.maxPlayers;
      await this.setMatchmaking({ private: true, unlisted: true });
      directory.register(this.state.inviteCode, this.roomId);
      this.setTimestep(() => this.advance(), 100);
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
      return identity;
    }

    override onJoin(client: GuestClient): void {
      const identity = client.auth;
      if (!identity) throw new ServerError(401, 'Guest session required');
      if (
        this.state.phase !== 'lobby' ||
        this.state.players.has(identity.playerId) ||
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
      const player = this.state.players.get(client.auth.playerId);
      if (player) player.isConnected = false;
      this.controller.transferHost();
      this.advance();
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
      const player = this.state.players.get(client.auth.playerId);
      if (
        !player ||
        client.auth.expiresAt <= Date.now() ||
        (this.state.phase === 'regular' && player.team === 'unassigned')
      ) {
        void client.leave(4001);
        return;
      }
      player.isConnected = true;
      this.controller.transferHost();
    }

    override onLeave(client: GuestClient): void {
      const identity = client.auth;
      if (!identity) return;
      if (this.state.phase === 'lobby' || this.state.phase === 'countdown')
        this.state.players.delete(identity.playerId);
      else {
        const player = this.state.players.get(identity.playerId);
        if (player) player.isConnected = false;
      }
      directory.release(identity.sessionId, this.roomId);
      this.controller.transferHost();
      this.advance();
    }

    override onDispose(): void {
      directory.dispose(this.state.inviteCode, this.roomId);
    }

    private advance(): void {
      if (Date.now() - this.createdAt > 15000) this.controller.transferHost();
      if (!this.controller.tick(Date.now())) return;
      if (this.state.phase === 'lobby') void this.unlock();
      this.phaseChanged();
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
