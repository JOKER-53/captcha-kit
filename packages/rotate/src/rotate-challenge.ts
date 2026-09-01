import type { Challenge, ChallengePayload, ChallengeStore, ValidationResult } from "@captcha-kit/core";
import { generateToken, expiresAt, isExpired } from "@captcha-kit/core";

export interface RotateChallengeOptions {
  /** SVG canvas size in px (square) */
  size?: number;
  /** Challenge lifetime in ms (default 5 minutes) */
  ttlMs?: number;
  /** Allowed degrees of error when validating (default 8) */
  toleranceDeg?: number;
  /** Minimum initial misrotation so the puzzle isn't trivially already upright (default 60) */
  minOffsetDeg?: number;
}

export interface RotateAnswer {
  /** Degrees the user rotated the shape by (their correction), e.g. from a drag/slider */
  rotationDeg: number;
}

const DEFAULT_SIZE = 200;

export class RotateChallenge implements Challenge<RotateAnswer> {
  readonly type = "rotate";

  constructor(
    private readonly store: ChallengeStore,
    private readonly defaultOptions: RotateChallengeOptions = {}
  ) {}

  async generate(options: RotateChallengeOptions = {}): Promise<ChallengePayload> {
    const opts = { ...this.defaultOptions, ...options };
    const size = opts.size ?? DEFAULT_SIZE;
    const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
    const toleranceDeg = opts.toleranceDeg ?? 8;
    const minOffsetDeg = opts.minOffsetDeg ?? 60;

    // Pick a random initial rotation with at least minOffsetDeg of misalignment
    // from upright (0deg), in either direction.
    const initialRotation = this.randomOffsetRotation(minOffsetDeg);
    const svg = this.renderShape(size, initialRotation);

    const token = generateToken();
    const expiry = expiresAt(ttlMs);

    // Correct answer: the user must rotate by -initialRotation (mod 360) to reach upright.
    const requiredCorrection = ((-initialRotation % 360) + 360) % 360;

    await this.store.set(token, {
      type: this.type,
      answer: { requiredCorrection, tolerance: toleranceDeg },
      expiresAt: expiry,
      attempts: 0,
    });

    return {
      token,
      expiresAt: expiry,
      type: this.type,
      clientData: { svg, size, initialRotation },
    };
  }

  async validate(token: string, answer: RotateAnswer): Promise<ValidationResult> {
    const stored = await this.store.get(token);

    if (!stored || stored.type !== this.type) {
      return { valid: false, reason: "invalid_token" };
    }

    if (isExpired(stored.expiresAt)) {
      await this.store.delete(token);
      return { valid: false, reason: "expired" };
    }

    const target = stored.answer as { requiredCorrection: number; tolerance: number };
    const submitted = ((answer.rotationDeg % 360) + 360) % 360;

    const diff = this.angularDistance(submitted, target.requiredCorrection);
    const correct = diff <= target.tolerance;

    await this.store.delete(token); // single-use

    return correct ? { valid: true } : { valid: false, reason: "incorrect_answer" };
  }

  /** Shortest distance between two angles on a circle, in degrees [0, 180]. */
  private angularDistance(a: number, b: number): number {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  /** Random rotation in [0, 360) that is at least minOffsetDeg away from 0/360. */
  private randomOffsetRotation(minOffsetDeg: number): number {
    const span = 360 - minOffsetDeg * 2;
    const magnitude = minOffsetDeg + Math.random() * span; // [minOffsetDeg, 360 - minOffsetDeg)
    return Math.random() < 0.5 ? magnitude : 360 - magnitude;
  }

  /**
   * Renders a simple asymmetric arrow/shape so "upright" has one visually
   * unambiguous correct orientation. Rotated by `rotationDeg` around center.
   */
  private renderShape(size: number, rotationDeg: number): string {
    const c = size / 2;
    // An arrow pointing up when rotation = 0, clearly asymmetric (tail marks "down").
    const arrowPath = `M ${c} ${c - size * 0.32}
      L ${c + size * 0.18} ${c - size * 0.05}
      L ${c + size * 0.08} ${c - size * 0.05}
      L ${c + size * 0.08} ${c + size * 0.3}
      L ${c - size * 0.08} ${c + size * 0.3}
      L ${c - size * 0.08} ${c - size * 0.05}
      L ${c - size * 0.18} ${c - size * 0.05}
      Z`;

    return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
<rect width="${size}" height="${size}" fill="#f4f4f8" />
<circle cx="${c}" cy="${c}" r="${size * 0.4}" fill="none" stroke="#ccc" stroke-width="1" stroke-dasharray="4 4" />
<path d="${arrowPath}" fill="#5b6fd7" stroke="#3d4aa0" stroke-width="2"
  transform="rotate(${rotationDeg.toFixed(1)} ${c} ${c})" />
</svg>`;
  }
}
