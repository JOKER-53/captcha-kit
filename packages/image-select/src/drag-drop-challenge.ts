import type { Challenge, ChallengePayload, ChallengeStore, ValidationResult } from "@captcha-kit/core";
import { generateToken, expiresAt, isExpired } from "@captcha-kit/core";

export interface DragDropOptions {
  /** Number of draggable items (default 6) */
  itemCount?: number;
  /** Number of drop zones/categories (default 3, must be <= available shape categories) */
  zoneCount?: number;
  /** Item icon size in px */
  itemSize?: number;
  /** Challenge lifetime in ms (default 5 minutes) */
  ttlMs?: number;
}

export interface DragDropAnswer {
  /** Map of item index -> the zone index the user dropped it into */
  placements: Record<number, number>;
}

const CATEGORIES = ["circle", "square", "triangle", "star"] as const;
type CategoryName = (typeof CATEGORIES)[number];

const COLORS = ["#e07a5f", "#3d5a80", "#81b29a", "#f2cc8f", "#9b5de5"];

const DEFAULT_ITEM_COUNT = 6;
const DEFAULT_ZONE_COUNT = 3;
const DEFAULT_ITEM_SIZE = 50;

export class DragDropChallenge implements Challenge<DragDropAnswer> {
  readonly type = "drag-drop";

  constructor(
    private readonly store: ChallengeStore,
    private readonly defaultOptions: DragDropOptions = {}
  ) {}

  async generate(options: DragDropOptions = {}): Promise<ChallengePayload> {
    const opts = { ...this.defaultOptions, ...options };
    const itemCount = opts.itemCount ?? DEFAULT_ITEM_COUNT;
    const zoneCount = opts.zoneCount ?? DEFAULT_ZONE_COUNT;
    const itemSize = opts.itemSize ?? DEFAULT_ITEM_SIZE;
    const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;

    if (zoneCount < 2 || zoneCount > CATEGORIES.length) {
      throw new Error(`zoneCount must be between 2 and ${CATEGORIES.length}`);
    }
    if (itemCount < zoneCount) {
      throw new Error("itemCount must be >= zoneCount so every zone can have at least one match");
    }

    const zoneCategories = CATEGORIES.slice(0, zoneCount);

    // Ensure every zone gets at least one item, then fill the rest randomly.
    const itemCategories: CategoryName[] = [...zoneCategories];
    while (itemCategories.length < itemCount) {
      itemCategories.push(zoneCategories[Math.floor(Math.random() * zoneCategories.length)]);
    }
    this.shuffle(itemCategories);

    const itemColors = itemCategories.map(() => COLORS[Math.floor(Math.random() * COLORS.length)]);
    const itemsSvg = this.renderItems(itemCategories, itemColors, itemSize);
    const zonesSvg = this.renderZones(zoneCategories, itemSize);

    const correctPlacements: Record<number, number> = {};
    itemCategories.forEach((category, i) => {
      correctPlacements[i] = zoneCategories.indexOf(category);
    });

    const token = generateToken();
    const expiry = expiresAt(ttlMs);

    await this.store.set(token, {
      type: this.type,
      answer: correctPlacements,
      expiresAt: expiry,
      attempts: 0,
    });

    return {
      token,
      expiresAt: expiry,
      type: this.type,
      clientData: {
        itemsSvg,
        zonesSvg,
        itemCount,
        zoneCount,
        itemSize,
        zoneLabels: zoneCategories,
      },
    };
  }

  async validate(token: string, answer: DragDropAnswer): Promise<ValidationResult> {
    const stored = await this.store.get(token);

    if (!stored || stored.type !== this.type) {
      return { valid: false, reason: "invalid_token" };
    }

    if (isExpired(stored.expiresAt)) {
      await this.store.delete(token);
      return { valid: false, reason: "expired" };
    }

    const correctPlacements = stored.answer as Record<number, number>;
    const correctKeys = Object.keys(correctPlacements);
    const submittedKeys = Object.keys(answer.placements);

    const correct =
      correctKeys.length === submittedKeys.length &&
      correctKeys.every((key) => answer.placements[Number(key)] === correctPlacements[Number(key)]);

    await this.store.delete(token); // single-use

    return correct ? { valid: true } : { valid: false, reason: "incorrect_answer" };
  }

  private renderItems(categories: CategoryName[], colors: string[], size: number): string {
    const cols = Math.ceil(Math.sqrt(categories.length));
    const width = cols * size;
    const rows = Math.ceil(categories.length / cols);
    const height = rows * size;

    const icons = categories
      .map((category, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = col * size + size / 2;
        const cy = row * size + size / 2;
        const r = size * 0.3;
        return `<g data-item-index="${i}" data-category="${category}">${this.renderIcon(
          category,
          cx,
          cy,
          r,
          colors[i]
        )}</g>`;
      })
      .join("");

    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<rect width="${width}" height="${height}" fill="#fafafa" />
${icons}
</svg>`;
  }

  private renderZones(categories: CategoryName[], size: number): string {
    const width = categories.length * size * 1.6;
    const height = size * 1.4;
    const zoneWidth = width / categories.length;

    const zones = categories
      .map((category, i) => {
        const x = i * zoneWidth;
        const cx = x + zoneWidth / 2;
        const cy = height / 2;
        return `<g data-zone-index="${i}" data-category="${category}">
<rect x="${x + 4}" y="4" width="${zoneWidth - 8}" height="${height - 8}" fill="none" stroke="#999" stroke-width="1.5" stroke-dasharray="4 3" rx="6" />
${this.renderIcon(category, cx, cy, size * 0.22, "#ccc")}
</g>`;
      })
      .join("");

    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${zones}</svg>`;
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
    }
  }

  private starPoints(cx: number, cy: number, r: number): string {
    const points: string[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.45;
      points.push(`${(cx + radius * Math.cos(angle)).toFixed(1)} ${(cy + radius * Math.sin(angle)).toFixed(1)}`);
    }
    return points.join(", ");
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
