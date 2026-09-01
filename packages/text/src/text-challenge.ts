import type { Challenge, ChallengePayload, ChallengeStore, ValidationResult } from "@captcha-kit/core";
import { generateToken, expiresAt, isExpired } from "@captcha-kit/core";

export interface TextChallengeOptions {
  /** Number of characters in the challenge text (default 6) */
  length?: number;
  /** Character set to draw from (default excludes ambiguous chars like 0/O, 1/l/I) */
  charset?: string;
  /** Challenge lifetime in ms (default 5 minutes) */
  ttlMs?: number;
  /** SVG canvas width/height in px */
  width?: number;
  height?: number;
}

const DEFAULT_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

export class TextChallenge implements Challenge<string> {
  readonly type = "text";

  constructor(
    private readonly store: ChallengeStore,
    private readonly defaultOptions: TextChallengeOptions = {}
  ) {}

  async generate(options: TextChallengeOptions = {}): Promise<ChallengePayload> {
    const opts = { ...this.defaultOptions, ...options };
    const length = opts.length ?? 6;
    const charset = opts.charset ?? DEFAULT_CHARSET;
    const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
    const width = opts.width ?? 200;
    const height = opts.height ?? 70;

    const text = this.randomText(length, charset);
    const svg = this.renderSvg(text, width, height);

    const token = generateToken();
    const expiry = expiresAt(ttlMs);

    await this.store.set(token, {
      type: this.type,
      answer: text.toLowerCase(),
      expiresAt: expiry,
      attempts: 0,
    });

    return {
      token,
      expiresAt: expiry,
      type: this.type,
      clientData: { svg, width, height },
    };
  }

  async validate(token: string, answer: string): Promise<ValidationResult> {
    const stored = await this.store.get(token);

    if (!stored || stored.type !== this.type) {
      return { valid: false, reason: "invalid_token" };
    }

    if (isExpired(stored.expiresAt)) {
      await this.store.delete(token);
      return { valid: false, reason: "expired" };
    }

    const submitted = answer.toLowerCase().trim();
    const correct = stored.answer === submitted;
    await this.store.delete(token); // single-use

    return correct ? { valid: true } : { valid: false, reason: "incorrect_answer" };
  }

  private randomText(length: number, charset: string): string {
    let out = "";
    for (let i = 0; i < length; i++) {
      out += charset[Math.floor(Math.random() * charset.length)];
    }
    return out;
  }

  /**
   * Render distorted text as SVG: per-character rotation/offset jitter plus
   * noise lines/dots — no native canvas dependency required.
   */
  private renderSvg(text: string, width: number, height: number): string {
    const charWidth = width / (text.length + 1);
    const chars = text
      .split("")
      .map((ch, i) => {
        const x = charWidth * (i + 1);
        const y = height / 2 + this.jitter(6);
        const rotate = this.jitter(25);
        const fontSize = 26 + this.jitter(6);
        const fill = this.randomMutedColor();
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${fontSize.toFixed(
          1
        )}" fill="${fill}" text-anchor="middle" transform="rotate(${rotate.toFixed(
          1
        )} ${x.toFixed(1)} ${y.toFixed(1)})" font-family="monospace" font-weight="bold">${this.escapeXml(
          ch
        )}</text>`;
      })
      .join("");

    const noiseLines = Array.from({ length: 5 }, () => {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const x2 = Math.random() * width;
      const y2 = Math.random() * height;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(
        1
      )}" stroke="${this.randomMutedColor()}" stroke-width="1" opacity="0.5" />`;
    }).join("");

    const noiseDots = Array.from({ length: 40 }, () => {
      const cx = Math.random() * width;
      const cy = Math.random() * height;
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1" fill="${this.randomMutedColor()}" opacity="0.4" />`;
    }).join("");

    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#f0f0f0" />${noiseLines}${noiseDots}${chars}</svg>`;
  }

  private jitter(range: number): number {
    return (Math.random() - 0.5) * range;
  }

  private randomMutedColor(): string {
    const r = 40 + Math.floor(Math.random() * 100);
    const g = 40 + Math.floor(Math.random() * 100);
    const b = 40 + Math.floor(Math.random() * 100);
    return `rgb(${r},${g},${b})`;
  }

  private escapeXml(ch: string): string {
    return ch.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
