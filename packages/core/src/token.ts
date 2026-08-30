import { randomBytes } from "node:crypto";

/** Generate a cryptographically secure random token. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Compute an expiration timestamp `ttlMs` milliseconds from now. */
export function expiresAt(ttlMs: number): number {
  return Date.now() + ttlMs;
}

/** Check whether a stored expiry timestamp has passed. */
export function isExpired(expiresAtMs: number): boolean {
  return Date.now() > expiresAtMs;
}
