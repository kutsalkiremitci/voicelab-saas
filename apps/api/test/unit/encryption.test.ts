import { describe, expect, test } from "bun:test";
import { encryptApiKey, decryptApiKey } from "../../src/services/encryption";

describe("encryption service", () => {
  test("round-trip preserves plaintext", () => {
    const plain = "sk_abc123def456ghi789";
    const ciphertext = encryptApiKey(plain);
    expect(ciphertext).not.toBe(plain);
    expect(decryptApiKey(ciphertext)).toBe(plain);
  });

  test("each encrypt produces unique ciphertext (random IV)", () => {
    const plain = "same-input";
    const a = encryptApiKey(plain);
    const b = encryptApiKey(plain);
    expect(a).not.toBe(b);
    expect(decryptApiKey(a)).toBe(plain);
    expect(decryptApiKey(b)).toBe(plain);
  });

  test("tampered ciphertext throws", () => {
    const ciphertext = encryptApiKey("secret");
    const buf = Buffer.from(ciphertext, "base64");
    buf[buf.length - 1] = (buf[buf.length - 1] ?? 0) ^ 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptApiKey(tampered)).toThrow();
  });

  test("malformed input throws", () => {
    expect(() => decryptApiKey("not-real")).toThrow();
  });
});
