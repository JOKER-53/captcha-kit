/**
 * captcha-kit core — shared Challenge interface
 * Every challenge module (math, text, slider, etc.) implements this contract.
 */

export interface ChallengePayload {
  /** Unique token identifying this challenge instance */
  token: string;
  /** Unix timestamp (ms) when this challenge expires */
  expiresAt: number;
  /** Challenge type identifier, e.g. "math", "text", "slider" */
  type: string;
  /** Data sent to the client to render the challenge (never includes the answer) */
  clientData: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  /** Present only when valid is false — machine-readable reason */
  reason?: "expired" | "invalid_token" | "incorrect_answer" | "rate_limited";
}

/**
 * Every challenge module must implement this interface.
 * TAnswer is the shape of the user's submitted response (e.g. number, string, {x,y}).
 */
export interface Challenge<TAnswer = unknown> {
  /** Unique type name for this challenge, e.g. "math" */
  readonly type: string;

  /** Generate a new challenge instance (server-side). */
  generate(options?: Record<string, unknown>): Promise<ChallengePayload>;

  /**
   * Validate a submitted answer against the stored challenge state.
   * Must be called server-side only.
   */
  validate(token: string, answer: TAnswer): Promise<ValidationResult>;
}

/**
 * Minimal storage contract challenges use to persist pending challenge state
 * (answer, expiry) between generate() and validate(). Implementations can be
 * in-memory, Redis, DB-backed, etc.
 */
export interface ChallengeStore {
  set(token: string, data: StoredChallenge, ttlMs: number): Promise<void>;
  get(token: string): Promise<StoredChallenge | null>;
  delete(token: string): Promise<void>;
}

export interface StoredChallenge {
  type: string;
  answer: unknown;
  expiresAt: number;
  attempts: number;
}
