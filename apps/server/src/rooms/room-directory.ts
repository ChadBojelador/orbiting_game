import { randomInt } from 'node:crypto';
import { INVITE_ALPHABET, INVITE_LENGTH } from '@ice-water/shared';

export class RoomDirectory {
  private readonly codes = new Map<string, string>();
  private readonly memberships = new Map<string, { roomId: string; expiresAt: number }>();

  newCode(): string {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = Array.from(
        { length: INVITE_LENGTH },
        () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)],
      ).join('');
      if (!this.codes.has(code)) {
        this.codes.set(code, '');
        return code;
      }
    }
    throw new Error('Could not allocate invite code');
  }
  register(code: string, roomId: string): void {
    this.codes.set(code, roomId);
  }
  find(code: string): string | undefined {
    return this.codes.get(code) || undefined;
  }
  hasMembership(sessionId: string, now = Date.now()): boolean {
    const membership = this.memberships.get(sessionId);
    if (membership && membership.expiresAt > now) return true;
    this.memberships.delete(sessionId);
    return false;
  }
  claim(sessionId: string, roomId: string, expiresAt: number): boolean {
    if (this.hasMembership(sessionId)) return false;
    this.memberships.set(sessionId, { roomId, expiresAt });
    return true;
  }
  connected(sessionId: string, roomId: string): void {
    this.memberships.set(sessionId, { roomId, expiresAt: Infinity });
  }
  release(sessionId: string, roomId: string): void {
    if (this.memberships.get(sessionId)?.roomId === roomId) this.memberships.delete(sessionId);
  }
  dispose(code: string, roomId: string): void {
    const registeredRoom = this.codes.get(code);
    if (registeredRoom === roomId || (roomId === 'unused' && registeredRoom === '')) {
      this.codes.delete(code);
    }
    for (const [id, membership] of this.memberships)
      if (membership.roomId === roomId) this.memberships.delete(id);
  }
}
