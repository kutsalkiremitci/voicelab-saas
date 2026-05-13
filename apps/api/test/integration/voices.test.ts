import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users, recordings, voices } from "@voicelab/db/schema";
import { createSession } from "../../src/services/session";
import { encryptApiKey } from "../../src/services/encryption";
import { storage } from "../../src/services/storage";
import { buildKey } from "../../src/services/storage/keys";
import { internals as voiceAIInternals } from "../../src/services/voice-ai";
import { mockElevenLabsClient, type MockClient } from "../mocks/voice-ai";

const original = voiceAIInternals.clientFactory;
const cleanup: { userId: string; sid: string; recId?: string; storageKey?: string }[] = [];

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

async function makeUserWithRecording(opts: {
  tier: "free" | "basic" | "pro" | "enterprise";
  apiKey?: string | null;
}): Promise<{ userId: string; sid: string; recId: string; storageKey: string }> {
  const password = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({
      email: `voi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`,
      password,
      status: "active",
      tier: opts.tier,
      elevenlabsApiKey: opts.apiKey ?? null,
    })
    .returning({ id: users.id });
  const userId = u!.id;
  const sid = await createSession(userId);

  const wav = minimalWav();
  const storageKey = buildKey(userId, "recordings", "wav");
  await storage.put(storageKey, wav, "audio/wav");

  const [rec] = await db
    .insert(recordings)
    .values({
      userId,
      name: "src",
      storageKey,
      mimeType: "audio/wav",
      sizeBytes: wav.length,
      durationSec: "1.000",
    })
    .returning({ id: recordings.id });

  const entry = { userId, sid, recId: rec!.id, storageKey };
  cleanup.push(entry);
  return entry;
}

let mockClient: MockClient;

beforeEach(() => {
  mockClient = mockElevenLabsClient();
  voiceAIInternals.clientFactory = (() => mockClient) as unknown as typeof original;
});

afterEach(async () => {
  voiceAIInternals.clientFactory = original;
  for (const e of cleanup) {
    if (e.recId) await db.delete(recordings).where(eq(recordings.id, e.recId));
    if (e.storageKey) await storage.delete(e.storageKey);
    await redis.del(`session:${e.sid}`);
    await db.delete(voices).where(eq(voices.userId, e.userId));
    await db.delete(users).where(eq(users.id, e.userId));
  }
  cleanup.length = 0;
});

describe("POST /api/v1/voices (cloning)", () => {
  test("Free → 403 TIER_LIMIT", async () => {
    const { sid, recId } = await makeUserWithRecording({ tier: "free" });
    const res = await app.request("/api/v1/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ recordingId: recId, label: "Calm", kind: "ivc" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("TIER_LIMIT");
  });

  test("Basic → IVC OK, returns voice with elevenLabsVoiceId", async () => {
    const { sid, recId } = await makeUserWithRecording({
      tier: "basic",
      apiKey: encryptApiKey("sk_basic_test"),
    });
    const res = await app.request("/api/v1/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ recordingId: recId, label: "Calm", kind: "ivc" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      voice: { id: string; label: string; elevenLabsVoiceId: string; status: string };
    };
    expect(body.voice.label).toBe("Calm");
    expect(body.voice.elevenLabsVoiceId).toBe("mock-ivc-id");
    expect(body.voice.status).toBe("ready");
    expect(mockClient.voices.ivc.create).toHaveBeenCalledTimes(1);
  });

  test("Basic → PVC 403 TIER_LIMIT", async () => {
    const { sid, recId } = await makeUserWithRecording({
      tier: "basic",
      apiKey: encryptApiKey("sk_basic_test"),
    });
    const res = await app.request("/api/v1/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ recordingId: recId, label: "Studio", kind: "pvc" }),
    });
    expect(res.status).toBe(403);
  });

  test("Pro → PVC OK", async () => {
    const { sid, recId } = await makeUserWithRecording({
      tier: "pro",
      apiKey: encryptApiKey("sk_pro_test"),
    });
    const res = await app.request("/api/v1/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ recordingId: recId, label: "Studio", kind: "pvc" }),
    });
    expect(res.status).toBe(201);
    expect(mockClient.voices.pvc.create).toHaveBeenCalledTimes(1);
  });

  test("Duplicate label per user → 409 LABEL_TAKEN", async () => {
    const { sid, recId } = await makeUserWithRecording({
      tier: "basic",
      apiKey: encryptApiKey("sk_b1"),
    });
    const ok = await app.request("/api/v1/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ recordingId: recId, label: "Same", kind: "ivc" }),
    });
    expect(ok.status).toBe(201);

    const dup = await app.request("/api/v1/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ recordingId: recId, label: "Same", kind: "ivc" }),
    });
    expect(dup.status).toBe(409);
  });

  test("Stranger's recordingId → 404 RECORDING_NOT_FOUND", async () => {
    const owner = await makeUserWithRecording({
      tier: "basic",
      apiKey: encryptApiKey("sk_owner"),
    });
    const stranger = await makeUserWithRecording({
      tier: "basic",
      apiKey: encryptApiKey("sk_stranger"),
    });
    const res = await app.request("/api/v1/voices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${stranger.sid}`,
      },
      body: JSON.stringify({ recordingId: owner.recId, label: "X", kind: "ivc" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("voices CRUD", () => {
  test("DELETE /:id removes local row + calls upstream delete", async () => {
    const { sid, recId } = await makeUserWithRecording({
      tier: "pro",
      apiKey: encryptApiKey("sk_del"),
    });
    const create = await app.request("/api/v1/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ recordingId: recId, label: "ToDelete", kind: "ivc" }),
    });
    const created = (await create.json()) as { voice: { id: string } };
    const id = created.voice.id;

    const del = await app.request(`/api/v1/voices/${id}`, {
      method: "DELETE",
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(del.status).toBe(204);
    expect(mockClient.voices.delete).toHaveBeenCalledTimes(1);

    const after = await app.request(`/api/v1/voices/${id}`, {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(after.status).toBe(404);
  });

  test("GET /voices lists owner's voices", async () => {
    const { sid, recId } = await makeUserWithRecording({
      tier: "basic",
      apiKey: encryptApiKey("sk_list"),
    });
    await app.request("/api/v1/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ recordingId: recId, label: "Listed", kind: "ivc" }),
    });
    const res = await app.request("/api/v1/voices", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { voices: Array<{ label: string }> };
    expect(body.voices.some((v) => v.label === "Listed")).toBe(true);
  });
});
