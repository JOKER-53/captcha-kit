import { describe, it, expect, beforeEach } from "vitest";
import { MemoryChallengeStore } from "@captcha-kit/core";
import { RotateChallenge } from "./rotate-challenge.js";

describe("RotateChallenge", () => {
  let store: MemoryChallengeStore;
  let challenge: RotateChallenge;

  beforeEach(() => {
    store = new MemoryChallengeStore();
    challenge = new RotateChallenge(store);
  });

  it("generates a challenge with SVG markup and an initial rotation", async () => {
    const result = await challenge.generate();

    expect(result.type).toBe("rotate");
    expect(result.token).toHaveLength(64);
    expect(result.clientData.svg).toContain("<svg");
    expect(result.clientData.initialRotation).toBeTypeOf("number");
  });

  it("initial rotation respects the minimum offset from upright", async () => {
    const result = await challenge.generate({ minOffsetDeg: 60 });
    const rotation = result.clientData.initialRotation as number;
    const distanceFromZero = Math.min(rotation, 360 - rotation);
    expect(distanceFromZero).toBeGreaterThanOrEqual(60);
  });

  it("validates the exact correction as correct", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const required = (stored?.answer as { requiredCorrection: number }).requiredCorrection;

    const validation = await challenge.validate(result.token, { rotationDeg: required });
    expect(validation).toEqual({ valid: true });
  });

  it("validates within tolerance as correct", async () => {
    const result = await challenge.generate({ toleranceDeg: 8 });
    const stored = await store.get(result.token);
    const required = (stored?.answer as { requiredCorrection: number }).requiredCorrection;

    const validation = await challenge.validate(result.token, { rotationDeg: required + 5 });
    expect(validation).toEqual({ valid: true });
  });

  it("handles wraparound correctly (e.g. 359 vs 2 degrees)", async () => {
    const result = await challenge.generate({ toleranceDeg: 8 });
    const stored = await store.get(result.token);
    const required = (stored?.answer as { requiredCorrection: number }).requiredCorrection;
    const wrapped = ((required + 359) % 360); // effectively required - 1, via wraparound

    const validation = await challenge.validate(result.token, { rotationDeg: wrapped });
    expect(validation).toEqual({ valid: true });
  });

  it("rejects a correction outside tolerance", async () => {
    const result = await challenge.generate({ toleranceDeg: 8 });
    const stored = await store.get(result.token);
    const required = (stored?.answer as { requiredCorrection: number }).requiredCorrection;

    const validation = await challenge.validate(result.token, { rotationDeg: required + 90 });
    expect(validation).toEqual({ valid: false, reason: "incorrect_answer" });
  });

  it("rejects an unknown token", async () => {
    const validation = await challenge.validate("nonexistent", { rotationDeg: 0 });
    expect(validation).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("is single-use", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const required = (stored?.answer as { requiredCorrection: number }).requiredCorrection;

    const first = await challenge.validate(result.token, { rotationDeg: required });
    const second = await challenge.validate(result.token, { rotationDeg: required });

    expect(first).toEqual({ valid: true });
    expect(second).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("rejects an expired challenge", async () => {
    const result = await challenge.generate({ ttlMs: 1 });
    const stored = await store.get(result.token);
    const required = (stored?.answer as { requiredCorrection: number }).requiredCorrection;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const validation = await challenge.validate(result.token, { rotationDeg: required });
    expect(validation).toEqual({ valid: false, reason: "expired" });
  });
});
