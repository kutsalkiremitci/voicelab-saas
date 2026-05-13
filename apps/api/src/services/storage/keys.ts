import { randomUUID } from "node:crypto";

export type StorageKind = "recordings" | "generations";

const ALLOWED_EXTS = new Set(["webm", "mp3", "wav", "ogg", "m4a", "mp4"]);

export function buildKey(userId: string, kind: StorageKind, ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_EXTS.has(e)) {
    throw new Error(`storage: extension not allowed: ${ext}`);
  }
  return `audio/${userId}/${kind}/${randomUUID()}.${e}`;
}

export function parseKey(key: string): { userId: string; kind: StorageKind; uuid: string; ext: string } | null {
  const m = key.match(/^audio\/([^/]+)\/(recordings|generations)\/([0-9a-f-]{36})\.([a-z0-9]+)$/i);
  if (!m) return null;
  return {
    userId: m[1]!,
    kind: m[2] as StorageKind,
    uuid: m[3]!,
    ext: m[4]!,
  };
}
