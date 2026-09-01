import type { Challenge, ChallengePayload, ChallengeStore, ValidationResult } from "@captcha-kit/core";
import { generateToken, expiresAt, isExpired } from "@captcha-kit/core";

export interface ImageSelectOptions {
  /** Total number of items shown in the grid (default 9) */
  itemCount?: number;
  /** Grid cell size in px */
  cellSize?: number;
  /** Challenge lifetime in ms (default 5 minutes) */
  ttlMs?: number;
  /** Minimum number of matching items to include (default 2) */
  minMatches?: number;
  /** Maximum number of matching items to include (default itemCount - 2) */
  maxMatches?: number;
}

export interface ImageSelectAnswer {
  /** Indices of items the user selected */
  indices: number[];
}

/**
 * Icon categories used as stand-ins for "real" photo categories (cat, car,
 * tree, etc.) — kept as simple hand-drawn SVG icons so this module has zero
 * external image/asset dependencies. Swap in a real icon/photo set via a
 * custom render function if you want photographic realism.
 */
const CATEGORIES = ["star", "heart", "circle", "square", "triangle"] as const;
type CategoryName = (typeof CATEGORIES)[number];

const COLORS = ["#e07a5f", "#3d5a80", "#81b29a", "#f2cc8f", "#9b5de5", "#48cae4"];

const DEFAULT_ITEM_COUNT = 9;
const DEFAULT_CELL_SIZE = 60;

export class ImageSelectChallenge implements Challenge<ImageSelectAnswer> {
  readonly type = "image-select";

  constructor(
    private readonly store: ChallengeStore,
    private readonly defaultOptions: ImageSelectOptions = {}
  ) {}

  async generate(options: ImageSelectOptions = {}): Promise<ChallengePayload> {
    const opts = { ...this.defaultOptions, ...options };
    const itemCount = opts.itemCount ?? DEFAULT_ITEM_COUNT;
    const cellSize = opts.cellSize ?? DEFAULT_CELL_SIZE;
    const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
    const minMatches = opts.minMatches ?? 2;
    const maxMatches = opts.maxMatches ?? Math.max(minMatches, itemCount - 2);

    if (itemCount < 4) {
      throw new Error("ImageSelectChallenge requires itemCount >= 4");
    }
    if (minMatches < 1 || maxMatches >= itemCount) {
      throw new Error("minMatches/maxMatches out of range for itemCount");
    }

    const targetCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const matchCount = minMatches + Math.floor(Math.random() * (maxMatches - minMatches + 1));

    const { categories, matchIndices } = this.assignCategories(itemCount, targetCategory, matchCount);
    const cols = Math.ceil(Math.sqrt(itemCount));
    const rows = Math.ceil(itemCount / cols);
    const width = cols * cellSize;
    const height = rows * cellSize;

    const svg = this.renderGrid(categories, cols, cellSize, width, height);

    const token = generateToken();
    const expiry = expiresAt(ttlMs);
    const sortedAnswer = [...matchIndices].sort((a, b) => a - b);

    await this.store.set(token, {
      type: this.type,
      answer: sortedAnswer,
      expiresAt: expiry,
      attempts: 0,
    });

    return {
      token,
      expiresAt: expiry,
      type: this.type,
      clientData: { svg, prompt: `Select all ${targetCategory}s`, itemCount, cols, rows, cellSize, width, height },
    };
  }

  async validate(token: string, answer: ImageSelectAnswer): Promise<ValidationResult> {
    const stored = await this.store.get(token);

    if (!stored || stored.type !== this.type) {
      return { valid: false, reason: "invalid_token" };
    }

    if (isExpired(stored.expiresAt)) {
      await this.store.delete(token);
      return { valid: false, reason: "expired" };
    }

    const correctIndices = stored.answer as number[];
    const submitted = [...new Set(answer.indices)].sort((a, b) => a - b);
    const correct =
      submitted.length === correctIndices.length && submitted.every((v, i) => v === correctIndices[i]);

    await this.store.delete(token); // single-use

    return correct ? { valid: true } : { valid: false, reason: "incorrect_answer" };
  }

  private assignCategories(
    itemCount: number,
    targetCategory: CategoryName,
    matchCount: number
  ): { categories: CategoryName[]; matchIndices: number[] } {
    const indices = Array.from({ length: itemCount }, (_, i) => i);
    this.shuffle(indices);
    const matchIndices = indices.slice(0, matchCount);
    const matchSet = new Set(matchIndices);

    const distractorCategories = CATEGORIES.filter((c) => c !== targetCategory);
    const categories: CategoryName[] = Array.from({ length: itemCount }, (_, i) => {
      if (matchSet.has(i)) return targetCategory;
      return distractorCategories[Math.floor(Math.random() * distractorCategories.length)];
    });

    return { categories, matchIndices };
  }

  private renderGrid(
    categories: CategoryName[],
    cols: number,
    cellSize: number,
    width: number,
    height: number
  ): string {
    const icons = categories
      .map((category, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = col * cellSize + cellSize / 2;
        const cy = row * cellSize + cellSize / 2;
        const r = cellSize * 0.3;
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        return `<g data-index="${i}">${this.renderIcon(category, cx, cy, r, color)}</g>`;
      })
      .join("");

    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<rect width="${width}" height="${height}" fill="#fafafa" />
${icons}
</svg>`;
  }

  private renderIcon(category: CategoryName, cx: number, cy: number, r: number, color: string): string {
    switch (category) {
      case "circle":
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`;
      case "square":
        return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="${color}" />`;
      case "triangle":
        return `<polygon points="${cx} ${cy - r}, ${cx - r} ${cy + r}, ${cx + r} ${cy + r}" fill="${color}" />`;
      case "star":
        return `<polygon points="${this.starPoints(cx, cy, r)}" fill="${color}" />`;
      case "heart":
        return this.renderHeart(cx, cy, r, color);
    }
  }

  private starPoints(cx: number, cy: number, r: number): string {
    const points: string[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.45;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return points.join(", ");
  }

  private renderHeart(cx: number, cy: number, r: number, color: string): string {
    const top = cy - r * 0.3;
    return `<path d="M ${cx} ${top + r * 0.9}
      C ${cx - r * 1.3} ${top - r * 0.3}, ${cx - r * 0.6} ${top - r * 1.1}, ${cx} ${top - r * 0.2}
      C ${cx + r * 0.6} ${top - r * 1.1}, ${cx + r * 1.3} ${top - r * 0.3}, ${cx} ${top + r * 0.9} Z"
      fill="${color}" />`;
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
