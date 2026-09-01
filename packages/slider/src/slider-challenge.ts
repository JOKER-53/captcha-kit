import type { Challenge, ChallengePayload, ChallengeStore, ValidationResult } from "@captcha-kit/core";
import { generateToken, expiresAt, isExpired } from "@captcha-kit/core";

export interface SliderChallengeOptions {
  /** Canvas width/height in px */
  width?: number;
  height?: number;
  /** Diameter of the puzzle piece notch */
  pieceSize?: number;
  /** Challenge lifetime in ms (default 5 minutes) */
  ttlMs?: number;
  /** Allowed pixel tolerance when validating the dropped position (default 6) */
  toleranceX?: number;
}

export interface SliderAnswer {
  /** The x position (px) the user dropped the piece at */
  x: number;
}

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 150;
const DEFAULT_PIECE_SIZE = 40;

export class SliderChallenge implements Challenge<SliderAnswer> {
  readonly type = "slider";

  constructor(
    private readonly store: ChallengeStore,
    private readonly defaultOptions: SliderChallengeOptions = {}
  ) {}

  async generate(options: SliderChallengeOptions = {}): Promise<ChallengePayload> {
    const opts = { ...this.defaultOptions, ...options };
    const width = opts.width ?? DEFAULT_WIDTH;
    const height = opts.height ?? DEFAULT_HEIGHT;
    const pieceSize = opts.pieceSize ?? DEFAULT_PIECE_SIZE;
    const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
    const toleranceX = opts.toleranceX ?? 6;

    // Keep the target away from the very edges so the piece is fully visible
    const margin = pieceSize;
    const targetX = margin + Math.random() * (width - 2 * margin);
    const targetY = margin / 2 + Math.random() * (height - pieceSize - margin);

    const { backgroundSvg, pieceSvg } = this.renderPuzzle(width, height, pieceSize, targetX, targetY);

    const token = generateToken();
    const expiry = expiresAt(ttlMs);

    await this.store.set(token, {
      type: this.type,
      answer: { x: Math.round(targetX), tolerance: toleranceX },
      expiresAt: expiry,
      attempts: 0,
    });

    return {
      token,
      expiresAt: expiry,
      type: this.type,
      clientData: {
        backgroundSvg,
        pieceSvg,
        width,
        height,
        pieceSize,
        pieceStartY: Math.round(targetY),
      },
    };
  }

  async validate(token: string, answer: SliderAnswer): Promise<ValidationResult> {
    const stored = await this.store.get(token);

    if (!stored || stored.type !== this.type) {
      return { valid: false, reason: "invalid_token" };
    }

    if (isExpired(stored.expiresAt)) {
      await this.store.delete(token);
      return { valid: false, reason: "expired" };
    }

    const target = stored.answer as { x: number; tolerance: number };
    const correct = Math.abs(target.x - answer.x) <= target.tolerance;

    await this.store.delete(token); // single-use

    return correct ? { valid: true } : { valid: false, reason: "incorrect_answer" };
  }

  /**
   * Renders a background image with a puzzle-piece-shaped notch cut out at
   * (targetX, targetY), and a separate draggable piece SVG matching that shape.
   * SVG-based — no native canvas/image dependency required.
   */
  private renderPuzzle(
    width: number,
    height: number,
    size: number,
    targetX: number,
    targetY: number
  ): { backgroundSvg: string; pieceSvg: string } {
    const r = size / 2;
    const notchPath = this.puzzlePiecePath(targetX - r, targetY, size);
    const backgroundFill = this.randomBackgroundGradientId();

    const backgroundSvg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="${backgroundFill}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#6b7fd7" />
    <stop offset="100%" stop-color="#a06bd7" />
  </linearGradient>
  <mask id="notchMask">
    <rect width="${width}" height="${height}" fill="white" />
    <path d="${notchPath}" fill="black" />
  </mask>
</defs>
<rect width="${width}" height="${height}" fill="url(#${backgroundFill})" mask="url(#notchMask)" />
<path d="${notchPath}" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" />
</svg>`;

    const pieceSvg = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
<path d="${this.puzzlePiecePath(0, 0, size)}" fill="url(#${backgroundFill})" stroke="white" stroke-width="1.5" />
<defs>
  <linearGradient id="${backgroundFill}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#6b7fd7" />
    <stop offset="100%" stop-color="#a06bd7" />
  </linearGradient>
</defs>
</svg>`;

    return { backgroundSvg, pieceSvg };
  }

  /** A simple rounded-square "puzzle piece" outline path, offset to (x, y). */
  private puzzlePiecePath(x: number, y: number, size: number): string {
    const r = size * 0.18; // corner radius
    return `M ${x + r} ${y}
      H ${x + size - r}
      Q ${x + size} ${y} ${x + size} ${y + r}
      V ${y + size - r}
      Q ${x + size} ${y + size} ${x + size - r} ${y + size}
      H ${x + r}
      Q ${x} ${y + size} ${x} ${y + size - r}
      V ${y + r}
      Q ${x} ${y} ${x + r} ${y}
      Z`;
  }

  private randomBackgroundGradientId(): string {
    return `slider-grad-${Math.random().toString(36).slice(2, 10)}`;
  }
}
