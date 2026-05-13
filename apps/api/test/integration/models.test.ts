import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users } from "@voicelab/db/schema";
import { createSession } from "../../src/services/session";
import { internals as voiceAIInternals } from "../../src/services/voice-ai";
import { mockElevenLabsClient, type MockClient } from "../mocks/voice-ai";

const original = voiceAIInternals.clientFactory;
const cleanup: { userId: string; sid: string }[] = [];

async function makeUser(tier: "free" | "basic" = "free") {
  const pw = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({
      email: `models-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`,
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
  voiceAIInternals.clientFactory = (() => mockClient) as unknown as typeof original;
});

afterEach(async () => {
  voiceAIInternals.clientFactory = original;
  for (const e of cleanup) {
    await redis.del(`session:${e.sid}`);
    await redis.del(`models:${e.userId}`);
    await db.delete(users).where(eq(users.id, e.userId));
  }
  cleanup.length = 0;
});

describe("GET /api/v1/models", () => {
  test("401 without auth", async () => {
    const res = await app.request("/api/v1/models");
    expect(res.status).toBe(401);
  });

  test("returns model list for authed user", async () => {
    const { sid } = await makeUser("free");
    const res = await app.request("/api/v1/models", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { models: Array<{ modelId: string }> };
    expect(Array.isArray(body.models)).toBe(true);
    expect(body.models.length).toBeGreaterThan(0);
    expect(mockClient.models.list).toHaveBeenCalledTimes(1);
  });

  test("caches per user — second call skips upstream", async () => {
    const { sid, userId } = await makeUser("free");
    // Prime the cache
    await app.request("/api/v1/models", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    // Clear the mock call count
    (mockClient.models.list as ReturnType<typeof import("bun:test").mock>).mockClear?.();

    // Second request should hit cache
    const res2 = await app.request("/api/v1/models", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res2.status).toBe(200);
    // Upstream was NOT called again
    expect(mockClient.models.list).not.toHaveBeenCalled();
    // Cleanup cache entry
    await redis.del(`models:${userId}`);
  });

  test("response includes Cache-Control header", async () => {
    const { sid } = await makeUser("free");
    const res = await app.request("/api/v1/models", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.headers.get("Cache-Control")).toContain("max-age=300");
  });
});
