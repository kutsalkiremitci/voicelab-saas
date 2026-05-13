import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users, credits } from "@voicelab/db/schema";
import { createSession } from "../../src/services/session";
import { internals as voiceAIInternals } from "../../src/services/voice-ai";
import { mockElevenLabsClient, type MockClient } from "../mocks/voice-ai";
import { invalidateLibraryCache } from "../../src/services/library-voices";

const original = voiceAIInternals.clientFactory;
const cleanup: { userId?: string; sid?: string }[] = [];

const FAKE_VOICE_ID = "test-lib-voice-001";

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

let mockClient: MockClient;

beforeEach(() => {
  mockClient = mockElevenLabsClient();

  // Extend mock client with getShared
  (mockClient as unknown as Record<string, unknown>).voices = {
    ...(mockClient as unknown as Record<string, { list: unknown }>).voices,
    getShared: mock(async () => ({
      voices: [
        {
          voiceId: FAKE_VOICE_ID,
          name: "Test Library Voice",
          description: "A test voice",
          gender: "female",
          age: "young",
          accent: "american",
          useCase: "narration",
          category: "professional",
          language: "en",
          previewUrl: null,
          descriptive: "warm",
        },
      ],
      hasMore: false,
      totalCount: 1,
    })),
    get: mock(async (id: string) => ({
      voiceId: id,
      name: "Test Library Voice",
      description: "A test voice",
      category: "professional",
      previewUrl: null,
      labels: { gender: "female", age: "young", accent: "american", language: "en" },
    })),
  };

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
      await redis.del(`library:v2:voice:${FAKE_VOICE_ID}`);
      await db.delete(users).where(eq(users.id, e.userId));
    }
  }
  cleanup.length = 0;
});

describe("GET /api/v1/library/voices", () => {
  test("401 without auth", async () => {
    const res = await app.request("/api/v1/library/voices");
    expect(res.status).toBe(401);
  });

  test("returns paginated voices from upstream", async () => {
    const { sid } = await makeUser();
    const res = await app.request("/api/v1/library/voices?page=0&pageSize=20", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      voices: Array<{ voiceId: string; name: string }>;
      hasMore: boolean;
      totalCount: number;
      page: number;
    };
    expect(body.voices.length).toBeGreaterThan(0);
    expect(body.voices[0]?.voiceId).toBe(FAKE_VOICE_ID);
    expect(body.hasMore).toBe(false);
    expect(body.page).toBe(0);
  });

  test("second call hits Redis cache, not upstream", async () => {
    const { sid } = await makeUser();
    await app.request("/api/v1/library/voices", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    await app.request("/api/v1/library/voices", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });

    const voicesMock = (mockClient as unknown as {
      voices: { getShared: { mock: { calls: unknown[] } } };
    }).voices.getShared.mock;
    expect(voicesMock.calls.length).toBe(1);
  });
});

describe("GET /api/v1/library/voices/:voiceId", () => {
  test("returns voice by ElevenLabs voiceId", async () => {
    const { sid } = await makeUser();
    const res = await app.request(`/api/v1/library/voices/${FAKE_VOICE_ID}`, {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { voice: { voiceId: string } };
    expect(body.voice.voiceId).toBe(FAKE_VOICE_ID);
  });
});

describe("POST /api/v1/library/voices/:voiceId/generate", () => {
  test("free user generates — 201", async () => {
    const { userId, sid } = await makeUser("free");
    await db.insert(credits).values({ userId, balance: 1000 }).onConflictDoNothing();

    const res = await app.request(`/api/v1/library/voices/${FAKE_VOICE_ID}/generate`, {
      method: "POST",
      headers: {
        Cookie: `voicelab_session=${sid}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Hello world" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { generation: { settings: { libraryVoiceId: string } } };
    expect(body.generation.settings.libraryVoiceId).toBe(FAKE_VOICE_ID);
  });
});
