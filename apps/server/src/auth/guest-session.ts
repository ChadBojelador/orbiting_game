import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isRecord, sanitizeDisplayName, type GuestSession } from '@ice-water/shared';

export interface GuestIdentity {
  playerId: string;
  sessionId: string;
  displayName: string;
  expiresAt: number;
}

export class GuestSessions {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
    private readonly now: () => number = Date.now,
  ) {}

  issue(displayName: string, previous?: GuestIdentity): GuestSession {
    const name = sanitizeDisplayName(displayName);
    if (!name) throw new Error('Use a display name with 2–20 letters or numbers');
    const identity: GuestIdentity = {
      playerId: previous?.playerId ?? randomUUID(),
      sessionId: previous?.sessionId ?? randomUUID(),
      displayName: previous?.displayName ?? name,
      expiresAt: this.now() + this.ttlSeconds * 1000,
    };
    const payload = Buffer.from(JSON.stringify({ ...identity, version: 1 })).toString('base64url');
    return {
      token: `${payload}.${this.sign(payload)}`,
      playerId: identity.playerId,
      displayName: identity.displayName,
      expiresAt: identity.expiresAt,
    };
  }

  verify(token: unknown): GuestIdentity {
    if (typeof token !== 'string' || token.length > 2048) throw new Error('Invalid guest session');
    const pieces = token.split('.');
    const [payload, signature] = pieces;
    if (
      pieces.length !== 2 ||
      !payload ||
      !signature ||
      !/^[\w-]+$/.test(payload) ||
      !/^[\w-]+$/.test(signature)
    )
      throw new Error('Invalid guest session');
    const expected = Buffer.from(this.sign(payload));
    const supplied = Buffer.from(signature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
      throw new Error('Invalid guest session');
    let identity: unknown;
    try {
      identity = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
    } catch {
      throw new Error('Invalid guest session');
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (
      !isRecord(identity) ||
      identity.version !== 1 ||
      typeof identity.playerId !== 'string' ||
      !uuid.test(identity.playerId) ||
      typeof identity.sessionId !== 'string' ||
      !uuid.test(identity.sessionId) ||
      typeof identity.displayName !== 'string' ||
      sanitizeDisplayName(identity.displayName) !== identity.displayName ||
      typeof identity.expiresAt !== 'number' ||
      !Number.isSafeInteger(identity.expiresAt) ||
      identity.expiresAt <= this.now()
    )
      throw new Error('Guest session is invalid or expired');
    return {
      playerId: identity.playerId,
      sessionId: identity.sessionId,
      displayName: identity.displayName,
      expiresAt: identity.expiresAt,
    };
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret)
      .update(`ice-water-guest-v1:${payload}`)
      .digest('base64url');
  }
}
