/**
 * Global test setup. Loaded via bunfig.toml `[test] preload`, which runs BEFORE
 * any test file imports `src/`, so we can override STORAGE_LOCAL_PATH here and
 * env.ts will pick it up when validate-on-import fires.
 *
 * The dev server defaults to `./storage` for uploaded audio. If tests share
 * that path, the afterAll cleanup nukes files the operator created via the
 * UI, leaving orphan DB rows whose audioKey points at deleted blobs. So we
 * force tests onto a dedicated `./storage-test` tree and only delete THAT.
 */
import { afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";

const DEFAULT_TEST_STORAGE = "./storage-test";
if (
  !process.env.STORAGE_LOCAL_PATH ||
  process.env.STORAGE_LOCAL_PATH === "./storage" ||
  process.env.STORAGE_LOCAL_PATH.endsWith("/storage")
) {
  process.env.STORAGE_LOCAL_PATH = DEFAULT_TEST_STORAGE;
}

const STORAGE_AUDIO = path.resolve(process.env.STORAGE_LOCAL_PATH, "audio");

afterAll(async () => {
  await rm(STORAGE_AUDIO, { recursive: true, force: true });
});
