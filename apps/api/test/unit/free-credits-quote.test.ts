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
});
