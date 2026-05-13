import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users, credits } from "@voicelab/db/schema";
import { createSession } from "../../src/services/session";
import { encryptApiKey } from "../../src/services/encryption";
import {
  internals as voiceAIInternals,
  invalidateSubscriptionCache,
} from "../../src/services/voice-ai";
import { mockElevenLabsClient, type MockClient } from "../mocks/voice-ai";

const original = voiceAIInternals.clientFactory;
const created: { id: string; sid: string }[] = [];

async function makeUserWithSession(opts: {
  tier: "free" | "basic" | "pro" | "enterprise";
  apiKey?: string | null;
  balance?: number;
}): Promise<{ id: string; sid: string }> {
  const password = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({
      email: `crd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`,
      password,
      status: "active",
      tier: opts.tier,
      elevenlabsApiKey: opts.apiKey ?? null,
    })
    .returning({ id: users.id });
  const id = u!.id;
  if (opts.tier === "free" && opts.balance !== undefined) {
    await db.insert(credits).values({ userId: id, balance: opts.balance });
  }
  const sid = await createSession(id);
  created.push({ id, sid });
  return { id, sid };
}

let mockClient: MockClient;

beforeEach(() => {
  mockClient = mockElevenLabsClient();
  voiceAIInternals.clientFactory = (() => mockClient) as unknown as typeof original;
});

afterEach(async () => {
  voiceAIInternals.clientFactory = original;
  for (const { id, sid } of created) {
    await invalidateSubscriptionCache(id);
    await redis.del(`session:${sid}`);
    await db.delete(credits).where(eq(credits.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
  created.length = 0;
});

describe("GET /api/v1/credits/balance", () => {
  test("Free user returns balance from credits table", async () => {
    const { sid } = await makeUserWithSession({ tier: "free", balance: 850 });
    const res = await app.request("/api/v1/credits/balance", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { balance: number; source: string; plan: string };
    expect(body.balance).toBe(850);
    expect(body.source).toBe("free");
    expect(body.plan).toBe("free");
  });

  test("Free user with no credits row returns 0", async () => {
    const { sid } = await makeUserWithSession({ tier: "free" });
    const res = await app.request("/api/v1/credits/balance", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { balance: number };
    expect(body.balance).toBe(0);
  });

  test("Paid user balance comes from upstream subscription", async () => {
    const enc = encryptApiKey("sk_paid_test");
    const { sid } = await makeUserWithSession({ tier: "pro", apiKey: enc });
    const res = await app.request("/api/v1/credits/balance", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      balance: number;
      source: string;
      plan: string;
      resetAt: string | null;
    };
    expect(body.source).toBe("upstream");
    expect(body.plan).toBe("pro");
    expect(body.balance).toBe(30000);
    expect(body.resetAt).not.toBeNull();
  });

  test("401 without session", async () => {
    const res = await app.request("/api/v1/credits/balance");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/credits/quote", () => {
  test("Free user quote: tts amount equals text length", async () => {
    const { sid } = await makeUserWithSession({ tier: "free", balance: 1000 });
    const res = await app.request("/api/v1/credits/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${sid}`,
      },
      body: JSON.stringify({ operation: "tts", payload: { text: "hello" } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { amount: number; operation: string };
    expect(body.amount).toBe(5);
    expect(body.operation).toBe("tts");
  });

  test("Paid user → 409 QUOTE_NOT_APPLICABLE", async () => {
    const enc = encryptApiKey("sk_paid_q");
    const { sid } = await makeUserWithSession({ tier: "pro", apiKey: enc });
    const res = await app.request("/api/v1/credits/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${sid}`,
      },
      body: JSON.stringify({ operation: "tts", payload: { text: "hi" } }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("QUOTE_NOT_APPLICABLE");
  });
});
