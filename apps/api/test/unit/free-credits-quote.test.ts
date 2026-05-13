import { describe, expect, test } from "bun:test";
import { quoteFreeOperation } from "../../src/services/free-credits";

describe("quoteFreeOperation", () => {
  test("tts amount = ceil(text.length * rate)", () => {
    const q = quoteFreeOperation("tts", { text: "hello world" });
    expect(q.amount).toBe(11);
    expect(q.operation).toBe("tts");
    expect(q.ratePerChar).toBeGreaterThan(0);
  });

  test("tts empty text → 0", () => {
    expect(quoteFreeOperation("tts", { text: "" }).amount).toBe(0);
  });

  test("s2s scales with duration (1000 chars/min)", () => {
    const q60 = quoteFreeOperation("s2s", { durationSec: 60 });
    expect(q60.amount).toBe(1000);

    const q30 = quoteFreeOperation("s2s", { durationSec: 30 });
    expect(q30.amount).toBe(500);
  });

  test("transcribe at 60s = CREDIT_PER_MINUTE rate", () => {
    const q = quoteFreeOperation("transcribe", { durationSec: 60 });
    expect(q.operation).toBe("transcribe");
    expect(q.amount).toBe(33);
  });

  test("transcribe at 3s rounds up to >= 1 credit", () => {
    const q = quoteFreeOperation("transcribe", { durationSec: 3 });
    expect(q.amount).toBeGreaterThanOrEqual(1);
    expect(q.amount).toBeLessThanOrEqual(2);
  });

  test("transcribe 0 duration = 0 credits", () => {
    expect(quoteFreeOperation("transcribe", { durationSec: 0 }).amount).toBe(0);
  });

  test("transcribe with keyterms adds 20% surcharge", () => {
    const base = quoteFreeOperation("transcribe", { durationSec: 60, keytermsCount: 0 });
    const surcharged = quoteFreeOperation("transcribe", { durationSec: 60, keytermsCount: 3 });
    expect(surcharged.amount).toBe(Math.ceil(base.amount * 1.2));
    expect(surcharged.amount).toBe(40);
  });

  test("transcribe surcharge does not apply when keyterms count is 0", () => {
    const a = quoteFreeOperation("transcribe", { durationSec: 120, keytermsCount: 0 });
    const b = quoteFreeOperation("transcribe", { durationSec: 120 });
    expect(a.amount).toBe(b.amount);
  });
});
