import type { ChallengeStore, StoredChallenge } from "./challenge.js";

/**
 * Simple in-memory ChallengeStore for development/testing.
 * NOT suitable for multi-instance production deployments — use Redis
 * or a DB-backed store there instead.
 */
export class MemoryChallengeStore implements ChallengeStore {
  private store = new Map<string, StoredChallenge>();

  async set(token: string, data: StoredChallenge): Promise<void> {
    this.store.set(token, data);
  }

  async get(token: string): Promise<StoredChallenge | null> {
    const entry = this.store.get(token) ?? null;
    if (entry && Date.now() > entry.expiresAt) {
      this.store.delete(token);
      return entry; // still return it so validate() can report "expired" (not "invalid_token")
    }
    return entry;
  }

  async delete(token: string): Promise<void> {
    this.store.delete(token);
  }
}
