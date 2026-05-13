import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users, recordings } from "@voicelab/db/schema";
import { storage } from "../../src/services/storage";
import { buildKey } from "../../src/services/storage/keys";
import { createSession } from "../../src/services/session";

const owner = `files-owner-${Date.now()}@voicelab.local`;
const stranger = `files-stranger-${Date.now()}@voicelab.local`;

let ownerId = "";
let strangerId = "";
let ownerSid = "";
let strangerSid = "";
let recordingId = "";
let storageKey = "";
const payload = Buffer.from("voicelab-test-bytes-123456789-abcdef");

async function makeUser(email: string): Promise<string> {
  const hash = await bcrypt.hash("password", 4);
  const [u] = await db
    .insert(users)
    .values({ email, password: hash, status: "active" })
    .returning({ id: users.id });
  return u!.id;
}

beforeAll(async () => {
  ownerId = await makeUser(owner);
  strangerId = await makeUser(stranger);
  ownerSid = await createSession(ownerId);
  strangerSid = await createSession(strangerId);

  storageKey = buildKey(ownerId, "recordings", "wav");
  await storage.put(storageKey, payload, "audio/wav");

  const [rec] = await db
    .insert(recordings)
    .values({
      userId: ownerId,
      name: "test.wav",
      storageKey,
      mimeType: "audio/wav",
      sizeBytes: payload.length,
      durationSec: "1.000",
    })
    .returning({ id: recordings.id });
  recordingId = rec!.id;
});

afterAll(async () => {
  await storage.delete(storageKey);
  await db.delete(recordings).where(eq(recordings.id, recordingId));
  await db.delete(users).where(eq(users.id, ownerId));
  await db.delete(users).where(eq(users.id, strangerId));
  await redis.del(`session:${ownerSid}`, `session:${strangerSid}`);
});

describe("GET /api/v1/files/:type/:id", () => {
  test("401 without session", async () => {
    const res = await app.request(`/api/v1/files/recordings/${recordingId}`);
    expect(res.status).toBe(401);
  });

  test("owner gets full body 200 + Accept-Ranges", async () => {
    const res = await app.request(`/api/v1/files/recordings/${recordingId}`, {
      headers: { Cookie: `voicelab_session=${ownerSid}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-type")).toBe("audio/wav");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(payload)).toBe(true);
  });

  test("Range request returns 206 with sliced body", async () => {
    const res = await app.request(`/api/v1/files/recordings/${recordingId}`, {
      headers: {
        Cookie: `voicelab_session=${ownerSid}`,
        Range: "bytes=0-9",
      },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(
      `bytes 0-9/${payload.length}`,
    );
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.length).toBe(10);
    expect(body.equals(payload.subarray(0, 10))).toBe(true);
  });

  test("stranger gets 404 for owner's file", async () => {
    const res = await app.request(`/api/v1/files/recordings/${recordingId}`, {
      headers: { Cookie: `voicelab_session=${strangerSid}` },
    });
    expect(res.status).toBe(404);
  });

  test("invalid type → 400", async () => {
    const res = await app.request(`/api/v1/files/junk/${recordingId}`, {
      headers: { Cookie: `voicelab_session=${ownerSid}` },
    });
    expect(res.status).toBe(400);
  });
});
