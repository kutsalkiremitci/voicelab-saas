import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, credits } from "@voicelab/db/schema";
import { chargeFreeUser, getFreeBalance } from "../../src/services/free-credits";
import { AppError } from "../../src/lib/errors";

let userId = "";

async function makeFreeUserWithBalance(start: number): Promise<string> {
  const password = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({
      email: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`,
      password,
      status: "active",
      tier: "free",
    })
    .returning({ id: users.id });
  const id = u!.id;
  await db.insert(credits).values({ userId: id, balance: start });
  return id;
}

beforeEach(async () => {
  userId = await makeFreeUserWithBalance(1000);
});

afterEach(async () => {
  if (userId) {
    await db.delete(credits).where(eq(credits.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    userId = "";
  }
});

describe("free credits service", () => {
  test("getFreeBalance returns 1000 after grant", async () => {
    expect(await getFreeBalance(userId)).toBe(1000);
  });

  test("charge decrements balance", async () => {
    const after = await chargeFreeUser(userId, 250, { reason: "test" });
    expect(after).toBe(750);
    expect(await getFreeBalance(userId)).toBe(750);
  });

  test("charge throws INSUFFICIENT_CREDITS when amount > balance", async () => {
    let caught: unknown;
    try {
      await chargeFreeUser(userId, 2000);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe("INSUFFICIENT_CREDITS");
    expect((caught as AppError).status).toBe(402);
    expect(await getFreeBalance(userId)).toBe(1000);
  });

  test("charge to exactly 0 sets exhaustedAt", async () => {
    const after = await chargeFreeUser(userId, 1000);
    expect(after).toBe(0);
    const row = await db.query.credits.findFirst({ where: eq(credits.userId, userId) });
    expect(row?.exhaustedAt).not.toBeNull();
  });

  test("user with no credits row → NO_CREDITS 402", async () => {
    const password = await bcrypt.hash("x", 4);
    const [u] = await db
      .insert(users)
      .values({
        email: `nocr-${Date.now()}@voicelab.local`,
        password,
        status: "active",
        tier: "free",
      })
      .returning({ id: users.id });
    let caught: unknown;
    try {
      await chargeFreeUser(u!.id, 10);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe("NO_CREDITS");
    await db.delete(users).where(eq(users.id, u!.id));
  });

  test("concurrent charges respect the floor (race-safe)", async () => {
    const id = await makeFreeUserWithBalance(100);
    const tasks = Array.from({ length: 5 }, () =>
      chargeFreeUser(id, 30).catch((e) => e),
    );
    const results = await Promise.all(tasks);
    const balance = await getFreeBalance(id);
    const succeeded = results.filter((r) => typeof r === "number");
    const failed = results.filter((r) => r instanceof AppError);
    expect(succeeded.length + failed.length).toBe(5);
    expect(balance).toBeGreaterThanOrEqual(0);
    expect(balance).toBeLessThanOrEqual(100);
    expect(succeeded.length).toBeLessThanOrEqual(3);
    await db.delete(credits).where(eq(credits.userId, id));
    await db.delete(users).where(eq(users.id, id));
  });
});
