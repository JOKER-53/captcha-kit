import { describe, it, expect, beforeEach } from "vitest";
import { MemoryChallengeStore } from "@captcha-kit/core";
import { MathChallenge } from "./math-challenge.js";

describe("MathChallenge", () => {
  let store: MemoryChallengeStore;
  let challenge: MathChallenge;

  beforeEach(() => {
    store = new MemoryChallengeStore();
    challenge = new MathChallenge(store);
  });

  it("generates a challenge with a token, expiry, and question", async () => {
    const result = await challenge.generate();

    expect(result.type).toBe("math");
    expect(result.token).toHaveLength(64); // 32 bytes hex-encoded
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(result.clientData.question).toMatch(/^\d+ [+\-*] \d+$/);
  });

  it("validates a correct answer", async () => {
    const result = await challenge.generate({ maxOperand: 5, operators: ["+"] });
    const [a, , b] = (result.clientData.question as string).split(" ");
    const answer = Number(a) + Number(b);

    const validation = await challenge.validate(result.token, answer);
    expect(validation).toEqual({ valid: true });
  });

  it("rejects an incorrect answer", async () => {
    const result = await challenge.generate({ maxOperand: 5, operators: ["+"] });
    const validation = await challenge.validate(result.token, -9999);

    expect(validation).toEqual({ valid: false, reason: "incorrect_answer" });
  });

  it("rejects an unknown/invalid token", async () => {
    const validation = await challenge.validate("nonexistent-token", 1);
    expect(validation).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("is single-use — validating twice fails the second time", async () => {
    const result = await challenge.generate({ maxOperand: 5, operators: ["+"] });
    const [a, , b] = (result.clientData.question as string).split(" ");
    const answer = Number(a) + Number(b);

    const first = await challenge.validate(result.token, answer);
    const second = await challenge.validate(result.token, answer);

    expect(first).toEqual({ valid: true });
    expect(second).toEqual({ valid: false, reason: "invalid_token" });
  });

  it("rejects an expired challenge", async () => {
    const result = await challenge.generate({ maxOperand: 5, operators: ["+"], ttlMs: 1 });
    const [a, , b] = (result.clientData.question as string).split(" ");
    const answer = Number(a) + Number(b);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const validation = await challenge.validate(result.token, answer);
    expect(validation).toEqual({ valid: false, reason: "expired" });
  });
});
