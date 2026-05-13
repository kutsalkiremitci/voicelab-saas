import { describe, expect, test } from "bun:test";
import { validateAudio, MAX_AUDIO_BYTES } from "../../src/services/storage/validation";

function minimalWav(): Buffer {
  return Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([36, 0, 0, 0]),
    Buffer.from("WAVE"),
    Buffer.from("fmt "),
    Buffer.from([16, 0, 0, 0]),
    Buffer.from([1, 0]),
    Buffer.from([1, 0]),
    Buffer.from([0x44, 0xac, 0, 0]),
    Buffer.from([0x88, 0x58, 0x01, 0]),
    Buffer.from([2, 0]),
    Buffer.from([16, 0]),
    Buffer.from("data"),
    Buffer.from([0, 0, 0, 0]),
  ]);
}

describe("validateAudio", () => {
  test("accepts a valid WAV with matching MIME", async () => {
    const v = await validateAudio({ buffer: minimalWav(), declaredMime: "audio/wav" });
    expect(["audio/wav", "audio/wave", "audio/x-wav"]).toContain(v.detectedMime);
    expect(v.ext).toBe("wav");
  });

  test("rejects empty file", async () => {
    await expect(
      validateAudio({ buffer: Buffer.alloc(0), declaredMime: "audio/wav" }),
    ).rejects.toThrow(/Empty/);
  });

  test("rejects oversized file", async () => {
    const big = Buffer.alloc(MAX_AUDIO_BYTES + 1);
    await expect(
      validateAudio({ buffer: big, declaredMime: "audio/wav" }),
    ).rejects.toThrow(/Max 25/);
  });

  test("rejects disallowed declared MIME", async () => {
    await expect(
      validateAudio({ buffer: minimalWav(), declaredMime: "image/png" }),
    ).rejects.toThrow(/Disallowed/);
  });

  test("rejects buffer whose magic bytes don't match audio", async () => {
    const txt = Buffer.from("not an audio file at all, just plain text padding");
    await expect(
      validateAudio({ buffer: txt, declaredMime: "audio/wav" }),
    ).rejects.toThrow();
  });
});
