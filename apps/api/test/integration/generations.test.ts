import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users, recordings, voices, generations, credits } from "@voicelab/db/schema";
import { createSession } from "../../src/services/session";
import { encryptApiKey } from "../../src/services/encryption";
import { storage } from "../../src/services/storage";
import { buildKey } from "../../src/services/storage/keys";
import { internals as voiceAIInternals } from "../../src/services/voice-ai";
import { mockElevenLabsClient, type MockClient } from "../mocks/voice-ai";

const original = voiceAIInternals.clientFactory;
const cleanup: { userId: string; sid: string; storageKey?: string }[] = [];

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

async function makeUserWithVoice(opts: {
  tier: "free" | "basic" | "pro" | "enterprise";
  apiKey?: string | null;
  balance?: number;
}): Promise<{ userId: string; sid: string; voiceId: string; storageKey: string }> {
  const password = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({
      email: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`,
      password,
      status: "active",
      tier: opts.tier,
      elevenlabsApiKey: opts.apiKey ?? null,
    })
    .returning({ id: users.id });
  const userId = u!.id;
  const sid = await createSession(userId);
  if (opts.tier === "free" && opts.balance !== undefined) {
    await db.insert(credits).values({ userId, balance: opts.balance });
  }

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
  const [voice] = await db
    .insert(voices)
    .values({
      userId,
      recordingId: rec!.id,
      name: "V",
      label: "V",
      elevenLabsVoiceId: `el-${crypto.randomUUID()}`,
      status: "ready",
    })
    .returning({ id: voices.id });

  const entry = { userId, sid, storageKey };
  cleanup.push(entry);
  return { ...entry, voiceId: voice!.id };
}

let mockClient: MockClient;

beforeEach(async () => {
  mockClient = mockElevenLabsClient();
  voiceAIInternals.clientFactory = (() => mockClient) as unknown as typeof original;
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(...keys);
});

afterEach(async () => {
  voiceAIInternals.clientFactory = original;
  for (const e of cleanup) {
    await db.delete(generations).where(eq(generations.userId, e.userId));
    await db.delete(voices).where(eq(voices.userId, e.userId));
    await db.delete(recordings).where(eq(recordings.userId, e.userId));
    await db.delete(credits).where(eq(credits.userId, e.userId));
    await redis.del(`session:${e.sid}`);
    if (e.storageKey) await storage.delete(e.storageKey);
    await db.delete(users).where(eq(users.id, e.userId));
  }
  cleanup.length = 0;
});

describe("POST /voices/:id/generate", () => {
  test("Free user with credits: 201 + credits decremented by characterCount", async () => {
    const { sid, voiceId, userId } = await makeUserWithVoice({
      tier: "free",
      balance: 1000,
    });
    const res = await app.request(`/api/v1/voices/${voiceId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ text: "hello voicelab" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { generation: { characterCount: number; url: string } };
    expect(body.generation.characterCount).toBe(42);

    const credit = await db.query.credits.findFirst({ where: eq(credits.userId, userId) });
    expect(credit?.balance).toBe(958);
  });

  test("Free user with insufficient credits: 402 INSUFFICIENT_CREDITS", async () => {
    const { sid, voiceId } = await makeUserWithVoice({ tier: "free", balance: 5 });
    const res = await app.request(`/api/v1/voices/${voiceId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ text: "this is more than five chars" }),
    });
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: { code: string; details: { deficit: number } } };
    expect(body.error.code).toBe("INSUFFICIENT_CREDITS");
    expect(body.error.details.deficit).toBeGreaterThan(0);
  });

  test("Basic user: no charge against credits table", async () => {
    const { sid, voiceId, userId } = await makeUserWithVoice({
      tier: "basic",
      apiKey: encryptApiKey("sk_basic_g"),
    });
    const res = await app.request(`/api/v1/voices/${voiceId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ text: "hello" }),
    });
    expect(res.status).toBe(201);
    const credit = await db.query.credits.findFirst({ where: eq(credits.userId, userId) });
    expect(credit).toBeUndefined();
  });
});

describe("POST /voices/:id/speech-to-speech", () => {
  test("Free → 403 TIER_LIMIT", async () => {
    const { sid, voiceId } = await makeUserWithVoice({ tier: "free", balance: 1000 });
    const fd = new FormData();
    fd.append("audio", new Blob([minimalWav()], { type: "audio/wav" }), "i.wav");
    const res = await app.request(`/api/v1/voices/${voiceId}/speech-to-speech`, {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: fd,
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("TIER_LIMIT");
  });

  test("Basic → 201 with generation row", async () => {
    const { sid, voiceId } = await makeUserWithVoice({
      tier: "basic",
      apiKey: encryptApiKey("sk_b_s2s"),
    });
    const fd = new FormData();
    fd.append("audio", new Blob([minimalWav()], { type: "audio/wav" }), "i.wav");
    const res = await app.request(`/api/v1/voices/${voiceId}/speech-to-speech`, {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: fd,
    });
    expect(res.status).toBe(201);
    expect(mockClient.speechToSpeech.convert).toHaveBeenCalledTimes(1);
  });
});

describe("GET /generations + DELETE /generations/:id", () => {
  test("List filters to owner; delete removes row + storage", async () => {
    const { sid, voiceId, userId } = await makeUserWithVoice({
      tier: "free",
      balance: 5000,
    });
    const create = await app.request(`/api/v1/voices/${voiceId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ text: "abc" }),
    });
    const created = (await create.json()) as { generation: { id: string } };

    const list = await app.request("/api/v1/generations", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(list.status).toBe(200);
    const lb = (await list.json()) as { generations: Array<{ id: string }> };
    expect(lb.generations.some((g) => g.id === created.generation.id)).toBe(true);

    const del = await app.request(`/api/v1/generations/${created.generation.id}`, {
      method: "DELETE",
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(del.status).toBe(204);

    const after = await db.query.generations.findFirst({
      where: eq(generations.id, created.generation.id),
    });
    expect(after).toBeUndefined();
    void userId;
  });
});
