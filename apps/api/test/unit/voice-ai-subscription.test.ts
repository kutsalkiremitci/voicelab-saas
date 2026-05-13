import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users } from "@voicelab/db/schema";
import {
  getSubscriptionForUser,
  invalidateSubscriptionCache,
  internals,
} from "../../src/services/voice-ai";
import { mockElevenLabsClient, type MockClient } from "../mocks/voice-ai";

let client: MockClient;
let userId = "";
const originalFactory = internals.clientFactory;

beforeEach(async () => {
  client = mockElevenLabsClient();
  internals.clientFactory = (() => client) as unknown as typeof originalFactory;

  const password = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({
      email: `vai-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`,
      password,
      status: "active",
      tier: "free",
    })
    .returning({ id: users.id });
  userId = u!.id;
  await invalidateSubscriptionCache(userId);
});

afterEach(async () => {
  internals.clientFactory = originalFactory;
  if (userId) {
    await invalidateSubscriptionCache(userId);
    await db.delete(users).where(eq(users.id, userId));
    userId = "";
  }
});

describe("getSubscriptionForUser", () => {
  test("first call hits SDK, second hits Redis cache", async () => {
    const sub1 = await getSubscriptionForUser(userId);
    expect(sub1.characterLimit).toBe(30000);
    expect(client.user.subscription.get).toHaveBeenCalledTimes(1);

    const sub2 = await getSubscriptionForUser(userId);
    expect(sub2.characterLimit).toBe(30000);
    expect(client.user.subscription.get).toHaveBeenCalledTimes(1);
  });

  test("after cache invalidation, SDK is hit again", async () => {
    await getSubscriptionForUser(userId);
    expect(client.user.subscription.get).toHaveBeenCalledTimes(1);

    await invalidateSubscriptionCache(userId);

    await getSubscriptionForUser(userId);
    expect(client.user.subscription.get).toHaveBeenCalledTimes(2);
  });

  test("cached value is the SDK return shape", async () => {
    const sub = await getSubscriptionForUser(userId);
    const cached = await redis.get(`subscription:${userId}`);
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached!).characterLimit).toBe(sub.characterLimit);
  });
});
