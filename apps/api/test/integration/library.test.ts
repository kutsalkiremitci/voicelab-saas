import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users, libraryVoices } from "@voicelab/db/schema";
import { createSession } from "../../src/services/session";
import { internals as voiceAIInternals } from "../../src/services/voice-ai";
import { mockElevenLabsClient, type MockClient } from "../mocks/voice-ai";
import { invalidateLibraryCache } from "../../src/services/library-voices";

const original = voiceAIInternals.clientFactory;
const cleanup: { userId?: string; sid?: string; voiceId?: string }[] = [];

async function makeUser(tier: "free" | "basic" = "free") {
  const pw = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({
      email: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`,
      password: pw,
      status: "active",
      tier,
    })
    .returning({ id: users.id });
  const userId = u!.id;
  const sid = await createSession(userId);
  cleanup.push({ userId, sid });
  return { userId, sid };
}

async function seedVoice(overrides: Partial<{ name: string; isActive: number }> = {}) {
  const [v] = await db
    .insert(libraryVoices)
    .values({
      upstreamVoiceId: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: overrides.name ?? "Test Voice",
      gender: "female",
      age: "young",
      accent: "american",
      category: "narration",
      language: "en",
      previewUrl: null,
      isActive: overrides.isActive ?? 1,
      sortOrder: 0,
    })
    .returning({ id: libraryVoices.id });
  cleanup.push({ voiceId: v!.id });
  return v!.id;
}

let mockClient: MockClient;

beforeEach(() => {
  mockClient = mockElevenLabsClient();
  voiceAIInternals.clientFactory = (() => mockClient) as unknown as typeof original;
});

afterEach(async () => {
  voiceAIInternals.clientFactory = original;
  await invalidateLibraryCache();
  for (const e of cleanup) {
    if (e.sid) await redis.del(`session:${e.sid}`);
    if (e.userId) {
      await redis.del(`models:${e.userId}`);
      await redis.del(`subscription:${e.userId}`);
      await db.delete(users).where(eq(users.id, e.userId));
    }
    if (e.voiceId) await db.delete(libraryVoices).where(eq(libraryVoices.id, e.voiceId));
  }
  cleanup.length = 0;
});

describe("GET /api/v1/library/voices", () => {
  test("401 without auth", async () => {
    const res = await app.request("/api/v1/library/voices");
    expect(res.status).toBe(401);
  });

  test("returns active voices", async () => {
    const { sid } = await makeUser();
    const id = await seedVoice({ name: "Alpha Voice" });

    const res = await app.request("/api/v1/library/voices", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { voices: Array<{ id: string; name: string }> };
    const found = body.voices.find((v) => v.id === id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Alpha Voice");
  });

  test("inactive voices not returned", async () => {
    const { sid } = await makeUser();
    const id = await seedVoice({ isActive: 0 });

    const res = await app.request("/api/v1/library/voices", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    const body = await res.json() as { voices: Array<{ id: string }> };
    expect(body.voices.find((v) => v.id === id)).toBeUndefined();
  });

  test("filters by gender", async () => {
    const { sid } = await makeUser();
    const id = await seedVoice({ name: "Female Voice" });

    const res = await app.request("/api/v1/library/voices?gender=female", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    const body = await res.json() as { voices: Array<{ id: string }> };
    expect(body.voices.find((v) => v.id === id)).toBeDefined();
  });
});

describe("GET /api/v1/library/voices/:id", () => {
  test("returns voice by id", async () => {
    const { sid } = await makeUser();
    const id = await seedVoice({ name: "Single Voice" });

    const res = await app.request(`/api/v1/library/voices/${id}`, {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { voice: { id: string; name: string } };
    expect(body.voice.id).toBe(id);
    expect(body.voice.name).toBe("Single Voice");
  });

  test("404 for unknown id", async () => {
    const { sid } = await makeUser();
    const res = await app.request("/api/v1/library/voices/00000000-0000-0000-0000-000000000000", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/library/voices/:id/generate", () => {
  test("free user generates — 201 + credits charged", async () => {
    const { userId, sid } = await makeUser("free");
    const id = await seedVoice();

    // grant credits
    const { credits } = await import("@voicelab/db/schema");
    await db.insert(credits).values({ userId, balance: 1000 }).onConflictDoNothing();

    const res = await app.request(`/api/v1/library/voices/${id}/generate`, {
      method: "POST",
      headers: {
        Cookie: `voicelab_session=${sid}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Hello world" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { generation: { libraryVoiceId: string } };
    expect(body.generation.libraryVoiceId).toBe(id);
  });

  test("404 for unknown library voice", async () => {
    const { sid } = await makeUser("free");
    const res = await app.request(
      "/api/v1/library/voices/00000000-0000-0000-0000-000000000000/generate",
      {
        method: "POST",
        headers: {
          Cookie: `voicelab_session=${sid}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "Hello" }),
      },
    );
    expect(res.status).toBe(404);
  });
});
