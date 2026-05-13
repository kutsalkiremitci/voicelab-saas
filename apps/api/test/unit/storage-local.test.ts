import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalAdapter } from "../../src/services/storage/local";

let baseDir: string;
let adapter: LocalAdapter;

beforeEach(async () => {
  baseDir = await mkdtemp(path.join(tmpdir(), "voicelab-storage-"));
  adapter = new LocalAdapter(baseDir);
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("LocalAdapter", () => {
  test("put + get round-trip preserves bytes", async () => {
    const key = "audio/u1/recordings/abc.webm";
    const payload = Buffer.from("hello voicelab");
    const result = await adapter.put(key, payload, "audio/webm");
    expect(result.key).toBe(key);
    expect(result.size).toBe(payload.length);

    const stream = await adapter.get(key);
    const buf = Buffer.from(await new Response(stream).arrayBuffer());
    expect(buf.equals(payload)).toBe(true);
  });

  test("exists toggles after put + delete", async () => {
    const key = "audio/u1/recordings/x.mp3";
    expect(await adapter.exists(key)).toBe(false);
    await adapter.put(key, Buffer.from("x"), "audio/mpeg");
    expect(await adapter.exists(key)).toBe(true);
    await adapter.delete(key);
    expect(await adapter.exists(key)).toBe(false);
  });

  test("rejects path traversal in key", async () => {
    expect(() => adapter.resolve("../../../etc/passwd")).toThrow();
  });

  test("creates parent directories", async () => {
    const key = "audio/deep/nested/folder/file.wav";
    await adapter.put(key, Buffer.from("ok"), "audio/wav");
    expect(await adapter.exists(key)).toBe(true);
    expect(await adapter.sizeOf(key)).toBe(2);
  });
});
