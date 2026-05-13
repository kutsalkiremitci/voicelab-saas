import { describe, expect, test } from "bun:test";
import { buildKey, parseKey } from "../../src/services/storage/keys";

describe("storage keys", () => {
  test("buildKey conforms to audio/{userId}/{kind}/{uuid}.{ext}", () => {
    const userId = "3f7c-aaaa";
    const k = buildKey(userId, "recordings", "webm");
    expect(k).toMatch(/^audio\/3f7c-aaaa\/recordings\/[0-9a-f-]{36}\.webm$/);
  });

  test("buildKey rejects unknown extensions", () => {
    expect(() => buildKey("u", "recordings", "exe")).toThrow();
  });

  test("parseKey round-trips a built key", () => {
    const k = buildKey("u1", "generations", "mp3");
    const parsed = parseKey(k);
    expect(parsed?.userId).toBe("u1");
    expect(parsed?.kind).toBe("generations");
    expect(parsed?.ext).toBe("mp3");
  });

  test("parseKey returns null for malformed key", () => {
    expect(parseKey("garbage")).toBeNull();
    expect(parseKey("audio/u1/wrong/abc.mp3")).toBeNull();
  });
});
