/**
 * Global test setup. Loaded via bunfig.toml `[test] preload`.
 *
 * Wipes the local-storage `audio/` directory after each test file finishes so
 * generation / recording / voice mp3 files from integration tests don't
 * accumulate under `apps/api/storage/audio/{userId}/`.
 *
 * Real route handlers already call `storage.delete(key)` on row deletion,
 * but integration tests cascade-delete user rows in the DB without ever
 * routing through those handlers, so the on-disk blobs leak.
 *
 * `afterAll` runs per test file (not after every individual test), so
 * fixtures created in `beforeAll` are still available throughout that file.
 */
import { afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";

const STORAGE_AUDIO = path.resolve(
  process.env.STORAGE_LOCAL_PATH ?? "./storage",
  "audio",
);

afterAll(async () => {
  await rm(STORAGE_AUDIO, { recursive: true, force: true });
});
