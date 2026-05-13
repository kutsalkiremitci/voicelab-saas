import { randomBytes } from "node:crypto";
import { redis } from "../lib/redis";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7d
const SID_BYTES = 32;
const PREFIX = "session:";

function key(sid: string): string {
  return `${PREFIX}${sid}`;
}

export async function createSession(userId: string): Promise<string> {
  const sid = randomBytes(SID_BYTES).toString("base64url");
  await redis.set(key(sid), userId, "EX", SESSION_TTL_SECONDS);
  return sid;
}

export async function getUserId(sid: string): Promise<string | null> {
  const userId = await redis.get(key(sid));
  if (!userId) return null;
  await redis.expire(key(sid), SESSION_TTL_SECONDS);
  return userId;
}

export async function destroySession(sid: string): Promise<void> {
  await redis.del(key(sid));
}

export const SESSION_COOKIE_NAME = "voicelab_session";
export const SESSION_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
