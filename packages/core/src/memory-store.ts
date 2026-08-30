import type { ChallengeStore, StoredChallenge } from "./challenge.js";

/**
 * Simple in-memory ChallengeStore for development/testing.
 * NOT suitable for multi-instance production deployments — use Redis
 * or a DB-backed store there instead.
 */
export class MemoryChallengeStore implements ChallengeStore {
  private store = new Map<string, StoredChallenge>();

  async set(token: string, data: StoredChallenge, ttlMs: number): Promise<void> {
    this.store.set(token, data);
    const timer = setTimeout(() => this.store.delete(token), ttlMs) as unknown as { unref?: () => void };
    timer.unref?.();
  }

  async get(token: string): Promise<StoredChallenge | null> {
    return this.store.get(token) ?? null;
  }

  async delete(token: string): Promise<void> {
    this.store.delete(token);
  }
}
