/**
 * Minimal in-memory rate limiter — limits how many challenge attempts/generations
 * a given key (e.g. IP address) can make within a time window.
 * Swap for a Redis-backed limiter in production/multi-instance deployments.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly maxHits: number,
    private readonly windowMs: number
  ) {}

  /** Returns true if the request is allowed; false if the key is rate-limited. */
  check(key: string): boolean {
    const now = Date.now();
    const timestamps = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);

    if (timestamps.length >= this.maxHits) {
      this.hits.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}
