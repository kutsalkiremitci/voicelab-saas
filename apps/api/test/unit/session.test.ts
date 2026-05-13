import { describe, expect, test } from "bun:test";
import { createSession, getUserId, destroySession } from "../../src/services/session";
import { redis } from "../../src/lib/redis";

describe("session service", () => {
  test("create + get returns the userId", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const sid = await createSession(userId);
    expect(sid).toMatch(/^[A-Za-z0-9_-]+$/);
    const got = await getUserId(sid);
    expect(got).toBe(userId);
    await destroySession(sid);
  });

  test("get refreshes TTL (sliding)", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const sid = await createSession(userId);
    const ttl1 = await redis.ttl(`session:${sid}`);
    expect(ttl1).toBeGreaterThan(0);

    await redis.expire(`session:${sid}`, 60); // shrink
    const before = await redis.ttl(`session:${sid}`);
    expect(before).toBeLessThanOrEqual(60);

    await getUserId(sid); // should bump back to 7d
    const after = await redis.ttl(`session:${sid}`);
    expect(after).toBeGreaterThan(60);

    await destroySession(sid);
  });

  test("destroy removes the session", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const sid = await createSession(userId);
    await destroySession(sid);
    expect(await getUserId(sid)).toBeNull();
  });

  test("get for missing sid returns null", async () => {
    expect(await getUserId("does-not-exist")).toBeNull();
  });
});
