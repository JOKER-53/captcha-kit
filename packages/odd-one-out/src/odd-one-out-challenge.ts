import type { Challenge, ChallengePayload, ChallengeStore, ValidationResult } from "@captcha-kit/core";
import { generateToken, expiresAt, isExpired } from "@captcha-kit/core";

export interface OddOneOutOptions {
  /** Total number of items shown, including the odd one (default 6) */
  itemCount?: number;
  /** Grid cell size in px */
  cellSize?: number;
  /** Challenge lifetime in ms (default 5 minutes) */
  ttlMs?: number;
  /** What attribute the odd item differs by (default "color") */
  variant?: "color" | "shape";
}

export interface OddOneOutAnswer {
  /** Index of the item the user selected as the odd one out */
  index: number;
}

const SHAPES = ["circle", "square", "triangle"] as const;
type ShapeName = (typeof SHAPES)[number];

const PALETTE = ["#e07a5f", "#3d5a80", "#81b29a", "#f2cc8f", "#9b5de5", "#48cae4"];

const DEFAULT_ITEM_COUNT = 6;
const DEFAULT_CELL_SIZE = 60;

export class OddOneOutChallenge implements Challenge<OddOneOutAnswer> {
  readonly type = "odd-one-out";

  constructor(
    private readonly store: ChallengeStore,
    private readonly defaultOptions: OddOneOutOptions = {}
  ) {}

  async generate(options: OddOneOutOptions = {}): Promise<ChallengePayload> {
    const opts = { ...this.defaultOptions, ...options };
    const itemCount = opts.itemCount ?? DEFAULT_ITEM_COUNT;
    const cellSize = opts.cellSize ?? DEFAULT_CELL_SIZE;
    const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
    const variant = opts.variant ?? "color";

    if (itemCount < 3) {
      throw new Error("OddOneOutChallenge requires itemCount >= 3");
    }

    const oddIndex = Math.floor(Math.random() * itemCount);
    const { items, cols, rows, width, height } = this.buildGrid(itemCount, cellSize, oddIndex, variant);
    const svg = this.renderGrid(items, cols, rows, cellSize, width, height);

    const token = generateToken();
    const expiry = expiresAt(ttlMs);

    await this.store.set(token, { type: this.type, answer: oddIndex, expiresAt: expiry, attempts: 0 });

    return {
      token,
      expiresAt: expiry,
      type: this.type,
      clientData: { svg, itemCount, cols, rows, cellSize, width, height },
    };
  }

  async validate(token: string, answer: OddOneOutAnswer): Promise<ValidationResult> {
    const stored = await this.store.get(token);

    if (!stored || stored.type !== this.type) {
      return { valid: false, reason: "invalid_token" };
    }

    if (isExpired(stored.expiresAt)) {
      await this.store.delete(token);
      return { valid: false, reason: "expired" };
    }

    const correct = stored.answer === answer.index;
    await this.store.delete(token); // single-use

    return correct ? { valid: true } : { valid: false, reason: "incorrect_answer" };
  }

  private buildGrid(
    itemCount: number,
    cellSize: number,
    oddIndex: number,
    variant: "color" | "shape"
  ) {
    const cols = Math.ceil(Math.sqrt(itemCount));
    const rows = Math.ceil(itemCount / cols);
    const width = cols * cellSize;
    const height = rows * cellSize;

    const baseShape: ShapeName = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const baseColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];

    let oddShape: ShapeName = baseShape;
    let oddColor = baseColor;

    if (variant === "shape") {
      const others = SHAPES.filter((s) => s !== baseShape);
      oddShape = others[Math.floor(Math.random() * others.length)];
    } else {
      const others = PALETTE.filter((c) => c !== baseColor);
      oddColor = others[Math.floor(Math.random() * others.length)];
    }

    const items = Array.from({ length: itemCount }, (_, i) => ({
      shape: i === oddIndex ? oddShape : baseShape,
      color: i === oddIndex ? oddColor : baseColor,
    }));

    return { items, cols, rows, width, height };
  }

  private renderGrid(
    items: Array<{ shape: ShapeName; color: string }>,
    cols: number,
    rows: number,
    cellSize: number,
    width: number,
    height: number
  ): string {
    const shapes = items
      .map((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = col * cellSize + cellSize / 2;
        const cy = row * cellSize + cellSize / 2;
        const r = cellSize * 0.32;
        return `<g data-index="${i}">${this.renderShape(item.shape, cx, cy, r, item.color)}</g>`;
      })
      .join("");

    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<rect width="${width}" height="${height}" fill="#fafafa" />
${shapes}
</svg>`;
  }

  private renderShape(shape: ShapeName, cx: number, cy: number, r: number, color: string): string {
    switch (shape) {
      case "circle":
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`;
      case "square":
        return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="${color}" />`;
      case "triangle": {
        const p1 = `${cx} ${cy - r}`;
        const p2 = `${cx - r} ${cy + r}`;
        const p3 = `${cx + r} ${cy + r}`;
        return `<polygon points="${p1}, ${p2}, ${p3}" fill="${color}" />`;
      }
    }
  }
}
