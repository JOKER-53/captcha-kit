import { describe, it, expect, beforeEach } from "vitest";
import { MemoryChallengeStore } from "@captcha-kit/core";
import { OddOneOutChallenge } from "./odd-one-out-challenge.js";

describe("OddOneOutChallenge", () => {
  let store: MemoryChallengeStore;
  let challenge: OddOneOutChallenge;

  beforeEach(() => {
    store = new MemoryChallengeStore();
    challenge = new OddOneOutChallenge(store);
  });

  it("generates a challenge with SVG markup and grid metadata", async () => {
    const result = await challenge.generate();

    expect(result.type).toBe("odd-one-out");
    expect(result.token).toHaveLength(64);
    expect(result.clientData.svg).toContain("<svg");
    expect(result.clientData.itemCount).toBe(6);
  });

  it("renders exactly itemCount shape groups", async () => {
    const result = await challenge.generate({ itemCount: 8 });
    const svg = result.clientData.svg as string;
    const groupCount = (svg.match(/<g data-index=/g) ?? []).length;
    expect(groupCount).toBe(8);
  });

  it("throws for itemCount below 3", async () => {
    await expect(challenge.generate({ itemCount: 2 })).rejects.toThrow();
  });

  it("validates the correct index", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const correctIndex = stored?.answer as number;

    const validation = await challenge.validate(result.token, { index: correctIndex });
    expect(validation).toEqual({ valid: true });
  });

  it("rejects an incorrect index", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const correctIndex = stored?.answer as number;
    const wrongIndex = (correctIndex + 1) % 6;

    const validation = await challenge.validate(result.token, { index: wrongIndex });
    expect(validation).toEqual({ valid: false, reason: "incorrect_answer" });
  });

  it("rejects an unknown token", async () => {
    const validation = await challenge.validate("nonexistent", { index: 0 });
    expect(validation).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("is single-use", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const correctIndex = stored?.answer as number;

    const first = await challenge.validate(result.token, { index: correctIndex });
    const second = await challenge.validate(result.token, { index: correctIndex });

    expect(first).toEqual({ valid: true });
    expect(second).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("rejects an expired challenge", async () => {
    const result = await challenge.generate({ ttlMs: 1 });
    const stored = await store.get(result.token);
    const correctIndex = stored?.answer as number;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const validation = await challenge.validate(result.token, { index: correctIndex });
    expect(validation).toEqual({ valid: false, reason: "expired" });
  });

  it("supports shape-variant odd-item generation", async () => {
    const result = await challenge.generate({ variant: "shape", itemCount: 5 });
    expect(result.clientData.svg).toContain("<svg");
  });
});
