export class RateLimiter {
  private readonly entries = new Map<string, { count: number; resetsAt: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  take(key: string): boolean {
    const now = this.now();
    if (this.entries.size >= 10000) {
      for (const [id, entry] of this.entries) if (entry.resetsAt <= now) this.entries.delete(id);
      if (this.entries.size >= 10000 && !this.entries.has(key)) return false;
    }
    const entry = this.entries.get(key);
    if (!entry || entry.resetsAt <= now) {
      this.entries.set(key, { count: 1, resetsAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count++;
    return true;
  }
}
