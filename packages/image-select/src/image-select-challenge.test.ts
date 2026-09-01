import { describe, it, expect, beforeEach } from "vitest";
import { MemoryChallengeStore } from "@captcha-kit/core";
import { ImageSelectChallenge } from "./image-select-challenge.js";

describe("ImageSelectChallenge", () => {
  let store: MemoryChallengeStore;
  let challenge: ImageSelectChallenge;

  beforeEach(() => {
    store = new MemoryChallengeStore();
    challenge = new ImageSelectChallenge(store);
  });

  it("generates a challenge with SVG markup and a prompt", async () => {
    const result = await challenge.generate();

    expect(result.type).toBe("image-select");
    expect(result.token).toHaveLength(64);
    expect(result.clientData.svg).toContain("<svg");
    expect(result.clientData.prompt).toMatch(/^Select all \w+s$/);
  });

  it("renders exactly itemCount icon groups", async () => {
    const result = await challenge.generate({ itemCount: 9 });
    const svg = result.clientData.svg as string;
    const groupCount = (svg.match(/<g data-index=/g) ?? []).length;
    expect(groupCount).toBe(9);
  });

  it("throws for itemCount below 4", async () => {
    await expect(challenge.generate({ itemCount: 3 })).rejects.toThrow();
  });

  it("throws when minMatches/maxMatches are out of range", async () => {
    await expect(challenge.generate({ itemCount: 5, minMatches: 5 })).rejects.toThrow();
  });

  it("stores between minMatches and maxMatches correct indices", async () => {
    const result = await challenge.generate({ itemCount: 9, minMatches: 3, maxMatches: 4 });
    const stored = await store.get(result.token);
    const answer = stored?.answer as number[];

    expect(answer.length).toBeGreaterThanOrEqual(3);
    expect(answer.length).toBeLessThanOrEqual(4);
  });

  it("validates the correct set of indices", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const answer = stored?.answer as number[];

    const validation = await challenge.validate(result.token, { indices: answer });
    expect(validation).toEqual({ valid: true });
  });

  it("validates correct set regardless of submitted order", async () => {
    const result = await challenge.generate({ itemCount: 9, minMatches: 3, maxMatches: 3 });
    const stored = await store.get(result.token);
    const answer = stored?.answer as number[];
    const reversed = [...answer].reverse();

    const validation = await challenge.validate(result.token, { indices: reversed });
    expect(validation).toEqual({ valid: true });
  });

  it("rejects a partially correct selection", async () => {
    const result = await challenge.generate({ itemCount: 9, minMatches: 3, maxMatches: 3 });
    const stored = await store.get(result.token);
    const answer = stored?.answer as number[];
    const partial = answer.slice(0, answer.length - 1);

    const validation = await challenge.validate(result.token, { indices: partial });
    expect(validation).toEqual({ valid: false, reason: "incorrect_answer" });
  });

  it("rejects extra incorrect indices even if correct ones are included", async () => {
    const result = await challenge.generate({ itemCount: 9, minMatches: 2, maxMatches: 2 });
    const stored = await store.get(result.token);
    const answer = stored?.answer as number[];
    const withExtra = [...answer, ...Array.from({ length: 9 }, (_, i) => i).filter((i) => !answer.includes(i))].slice(
      0,
      answer.length + 1
    );

    const validation = await challenge.validate(result.token, { indices: withExtra });
    expect(validation).toEqual({ valid: false, reason: "incorrect_answer" });
  });

  it("rejects an unknown token", async () => {
    const validation = await challenge.validate("nonexistent", { indices: [0] });
    expect(validation).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("is single-use", async () => {
    const result = await challenge.generate();
    const stored = await store.get(result.token);
    const answer = stored?.answer as number[];

    const first = await challenge.validate(result.token, { indices: answer });
    const second = await challenge.validate(result.token, { indices: answer });

    expect(first).toEqual({ valid: true });
    expect(second).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("rejects an expired challenge", async () => {
    const result = await challenge.generate({ ttlMs: 1 });
    const stored = await store.get(result.token);
    const answer = stored?.answer as number[];

    await new Promise((resolve) => setTimeout(resolve, 10));

    const validation = await challenge.validate(result.token, { indices: answer });
    expect(validation).toEqual({ valid: false, reason: "expired" });
  });
});
