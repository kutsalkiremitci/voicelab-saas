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

  test("normalizes video/webm declared MIME — does not reject on that alone", async () => {
    // video/webm is what browsers emit for audio-only WebM recordings.
    // The declared MIME check must pass; the WAV magic bytes are still valid audio.
    const v = await validateAudio({ buffer: minimalWav(), declaredMime: "video/webm" });
    expect(["audio/wav", "audio/wave", "audio/x-wav"]).toContain(v.detectedMime);
  });

  test("normalizes video/webm detected MIME — file-type lib reports video/webm for WebM audio bytes", async () => {
    // Minimal valid EBML/WebM header so file-type can detect the format.
    // file-type returns { mime: "video/webm" } for any WebM — must normalize to audio/webm.
    // EBML ID (4) + vint size 0x9f=31 + header children (31 bytes) = 36 bytes total
    const webm = Buffer.from(
      "1a45dfa39f" +         // EBML element ID + 1-byte vint size 31
      "4286810142f78101" +   // EBMLVersion=1, EBMLReadVersion=1
      "42f2810442f38108" +   // EBMLMaxIDLength=4, EBMLMaxSizeLength=8
      "4282847765626d" +     // DocType ID + size=4 + "webm"
      "4287810242858102",    // DocTypeVersion=2, DocTypeReadVersion=2
      "hex",
    );
    const v = await validateAudio({ buffer: webm, declaredMime: "video/webm" });
    expect(v.detectedMime).toBe("audio/webm");
    expect(v.ext).toBe("webm");
  });
});
