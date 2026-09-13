/**
 * Extrapolates server time between authoritative patches without allowing
 * network jitter or an older patch to move the displayed clock backward.
 */
export class ServerClock {
  private serverTime = 0;
  private receivedAt = 0;

  update(serverTime: number, receivedAt = performance.now()): void {
    const previousEstimate = this.now(receivedAt);
    this.serverTime = Math.max(serverTime, previousEstimate);
    this.receivedAt = receivedAt;
  }

  now(clientNow = performance.now()): number {
    return this.serverTime + Math.max(0, clientNow - this.receivedAt);
  }
}
