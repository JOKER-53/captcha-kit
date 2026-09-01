import { describe, it, expect, beforeEach } from "vitest";
import { MemoryChallengeStore } from "@captcha-kit/core";
import { SliderChallenge } from "./slider-challenge.js";

describe("SliderChallenge", () => {
  let store: MemoryChallengeStore;
  let challenge: SliderChallenge;

  beforeEach(() => {
    store = new MemoryChallengeStore();
    challenge = new SliderChallenge(store);
  });

  it("generates a challenge with background/piece SVGs and dimensions", async () => {
    const result = await challenge.generate();

    expect(result.type).toBe("slider");
    expect(result.token).toHaveLength(64);
    expect(result.clientData.backgroundSvg).toContain("<svg");
    expect(result.clientData.pieceSvg).toContain("<svg");
    expect(result.clientData.width).toBeTypeOf("number");
    expect(result.clientData.height).toBeTypeOf("number");
  });

  it("validates a drop within tolerance as correct", async () => {
    const result = await challenge.generate({ toleranceX: 6 });
    const stored = await store.get(result.token);
    const target = (stored?.answer as { x: number }).x;

    const validation = await challenge.validate(result.token, { x: target + 3 });
    expect(validation).toEqual({ valid: true });
  });

  it("rejects a drop outside tolerance", async () => {
    const result = await challenge.generate({ toleranceX: 6 });
    const stored = await store.get(result.token);
    const target = (stored?.answer as { x: number }).x;

    const validation = await challenge.validate(result.token, { x: target + 50 });
    expect(validation).toEqual({ valid: false, reason: "incorrect_answer" });
  });

  it("rejects an unknown token", async () => {
    const validation = await challenge.validate("nonexistent", { x: 100 });
    expect(validation).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("is single-use", async () => {
    const result = await challenge.generate({ toleranceX: 6 });
    const stored = await store.get(result.token);
    const target = (stored?.answer as { x: number }).x;

    const first = await challenge.validate(result.token, { x: target });
    const second = await challenge.validate(result.token, { x: target });

    expect(first).toEqual({ valid: true });
    expect(second).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("rejects an expired challenge", async () => {
    const result = await challenge.generate({ toleranceX: 6, ttlMs: 1 });
    const stored = await store.get(result.token);
    const target = (stored?.answer as { x: number }).x;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const validation = await challenge.validate(result.token, { x: target });
    expect(validation).toEqual({ valid: false, reason: "expired" });
  });

  it("keeps the target away from the edges (within configured width/pieceSize)", async () => {
    const width = 300;
    const pieceSize = 40;
    const result = await challenge.generate({ width, pieceSize });
    const stored = await store.get(result.token);
    const target = (stored?.answer as { x: number }).x;

    expect(target).toBeGreaterThanOrEqual(pieceSize);
    expect(target).toBeLessThanOrEqual(width - pieceSize);
  });
});
