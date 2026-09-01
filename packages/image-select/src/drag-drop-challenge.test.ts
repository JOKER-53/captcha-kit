import { describe, it, expect, beforeEach } from "vitest";
import { MemoryChallengeStore } from "@captcha-kit/core";
import { DragDropChallenge } from "./drag-drop-challenge.js";

describe("DragDropChallenge", () => {
  let store: MemoryChallengeStore;
  let challenge: DragDropChallenge;

  beforeEach(() => {
    store = new MemoryChallengeStore();
    challenge = new DragDropChallenge(store);
  });

  it("generates a challenge with items and zones SVG", async () => {
    const result = await challenge.generate();

    expect(result.type).toBe("drag-drop");
    expect(result.token).toHaveLength(64);
    expect(result.clientData.itemsSvg).toContain("<svg");
    expect(result.clientData.zonesSvg).toContain("<svg");
    expect(result.clientData.zoneLabels).toHaveLength(3);
  });

  it("renders exactly itemCount item groups", async () => {
    const result = await challenge.generate({ itemCount: 8, zoneCount: 3 });
    const svg = result.clientData.itemsSvg as string;
    const groupCount = (svg.match(/data-item-index=/g) ?? []).length;
    expect(groupCount).toBe(8);
  });

  it("renders exactly zoneCount zone groups", async () => {
    const result = await challenge.generate({ zoneCount: 4, itemCount: 6 });
    const svg = result.clientData.zonesSvg as string;
    const groupCount = (svg.match(/data-zone-index=/g) ?? []).length;
    expect(groupCount).toBe(4);
  });

  it("throws when zoneCount is out of supported range", async () => {
    await expect(challenge.generate({ zoneCount: 1 })).rejects.toThrow();
    await expect(challenge.generate({ zoneCount: 10 })).rejects.toThrow();
  });

  it("throws when itemCount is less than zoneCount", async () => {
    await expect(challenge.generate({ itemCount: 2, zoneCount: 3 })).rejects.toThrow();
  });

  it("ensures every zone has at least one matching item", async () => {
    const result = await challenge.generate({ itemCount: 6, zoneCount: 3 });
    const stored = await store.get(result.token);
    const placements = stored?.answer as Record<number, number>;
    const zonesUsed = new Set(Object.values(placements));
    expect(zonesUsed.size).toBe(3);
  });

  it("validates the fully correct placement mapping", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const placements = stored?.answer as Record<number, number>;

    const validation = await challenge.validate(result.token, { placements });
    expect(validation).toEqual({ valid: true });
  });

  it("rejects a placement with one wrong mapping", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const placements = { ...(stored?.answer as Record<number, number>) };
    const firstKey = Number(Object.keys(placements)[0]);
    placements[firstKey] = (placements[firstKey] + 1) % 3;

    const validation = await challenge.validate(result.token, { placements });
    expect(validation).toEqual({ valid: false, reason: "incorrect_answer" });
  });

  it("rejects an incomplete placement", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const full = stored?.answer as Record<number, number>;
    const partial = Object.fromEntries(Object.entries(full).slice(0, -1));

    const validation = await challenge.validate(result.token, { placements: partial });
    expect(validation).toEqual({ valid: false, reason: "incorrect_answer" });
  });

  it("rejects an unknown token", async () => {
    const validation = await challenge.validate("nonexistent", { placements: {} });
    expect(validation).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("is single-use", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const placements = stored?.answer as Record<number, number>;

    const first = await challenge.validate(result.token, { placements });
    const second = await challenge.validate(result.token, { placements });

    expect(first).toEqual({ valid: true });
    expect(second).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("rejects an expired challenge", async () => {
    const result = await challenge.generate({ ttlMs: 1 });
    const stored = await store.get(result.token);
    const placements = stored?.answer as Record<number, number>;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const validation = await challenge.validate(result.token, { placements });
    expect(validation).toEqual({ valid: false, reason: "expired" });
  });
});
