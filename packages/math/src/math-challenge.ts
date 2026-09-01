import type { Challenge, ChallengePayload, ChallengeStore, ValidationResult } from "@captcha-kit/core";
import { generateToken, expiresAt, isExpired } from "@captcha-kit/core";

export interface MathChallengeOptions {
  /** Max value for each operand (default 10) */
  maxOperand?: number;
  /** Allowed operators (default ["+", "-"]) */
  operators?: Array<"+" | "-" | "*">;
  /** Challenge lifetime in ms (default 5 minutes) */
  ttlMs?: number;
}

export class MathChallenge implements Challenge<number> {
  readonly type = "math";

  constructor(
    private readonly store: ChallengeStore,
    private readonly defaultOptions: MathChallengeOptions = {}
  ) {}

  async generate(options: MathChallengeOptions = {}): Promise<ChallengePayload> {
    const opts = { ...this.defaultOptions, ...options };
    const maxOperand = opts.maxOperand ?? 10;
    const operators = opts.operators ?? ["+", "-"];
    const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;

    const a = Math.floor(Math.random() * maxOperand) + 1;
    const b = Math.floor(Math.random() * maxOperand) + 1;
    const operator = operators[Math.floor(Math.random() * operators.length)];

    const answer = this.computeAnswer(a, b, operator);
    const token = generateToken();
    const expiry = expiresAt(ttlMs);

    await this.store.set(token, { type: this.type, answer, expiresAt: expiry, attempts: 0 });

    return {
      token,
      expiresAt: expiry,
      type: this.type,
      clientData: { question: `${a} ${operator} ${b}` },
    };
  }

  async validate(token: string, answer: number): Promise<ValidationResult> {
    const stored = await this.store.get(token);

    if (!stored || stored.type !== this.type) {
      return { valid: false, reason: "invalid_token" };
    }

    if (isExpired(stored.expiresAt)) {
      await this.store.delete(token);
      return { valid: false, reason: "expired" };
    }

    const correct = stored.answer === answer;
    await this.store.delete(token); // single-use

    return correct ? { valid: true } : { valid: false, reason: "incorrect_answer" };
  }

  private computeAnswer(a: number, b: number, operator: "+" | "-" | "*"): number {
    switch (operator) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
    }
  }
}
