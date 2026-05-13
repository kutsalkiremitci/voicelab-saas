import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users, credits, adminAuditLog } from "@voicelab/db/schema";
import { createSession } from "../../src/services/session";
import { decryptApiKey } from "../../src/services/encryption";

const created: { id: string; sid: string }[] = [];

async function makeUser(opts: {
  role?: "user" | "admin";
  status?: "unverified" | "active" | "suspended";
  tier?: "free" | "basic" | "pro" | "enterprise";
  balance?: number;
} = {}): Promise<{ id: string; sid: string }> {
  const password = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({
      email: `adm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`,
      password,
      role: opts.role ?? "user",
      status: opts.status ?? "active",
      tier: opts.tier ?? "free",
    })
    .returning({ id: users.id });
  const id = u!.id;
  const sid = await createSession(id);
  if (opts.tier === "free" && opts.balance !== undefined) {
    await db.insert(credits).values({ userId: id, balance: opts.balance });
  }
  created.push({ id, sid });
  return { id, sid };
}

beforeEach(async () => {
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(...keys);
});

afterEach(async () => {
  for (const { id, sid } of created) {
    await db.delete(adminAuditLog).where(eq(adminAuditLog.adminId, id));
    await db.delete(credits).where(eq(credits.userId, id));
    await redis.del(`session:${sid}`, `subscription:${id}`);
    await db.delete(users).where(eq(users.id, id));
  }
  created.length = 0;
});

describe("admin auth gate", () => {
  test("non-admin → 403", async () => {
    const { sid } = await makeUser({ role: "user" });
    const res = await app.request("/api/v1/admin/users", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(403);
  });

  test("unauth → 401", async () => {
    const res = await app.request("/api/v1/admin/users");
    expect(res.status).toBe(401);
  });

  test("admin → 200 list", async () => {
    const { sid } = await makeUser({ role: "admin" });
    const res = await app.request("/api/v1/admin/users", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: unknown[] };
    expect(Array.isArray(body.users)).toBe(true);
  });
});

describe("PUT /admin/users/:id/api-key", () => {
  test("encrypts key, sets tier, removes Free credits, audits without raw key", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser({ tier: "free", balance: 1000 });

    const rawKey = "sk_real_paid_key_zzz123";
    const res = await app.request(`/api/v1/admin/users/${target.id}/api-key`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${admin.sid}`,
      },
      body: JSON.stringify({ apiKey: rawKey, plan: "creator" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { tier: string; elevenlabsPlan: string; hasApiKey: boolean };
    };
    expect(body.user.tier).toBe("pro");
    expect(body.user.elevenlabsPlan).toBe("creator");
    expect(body.user.hasApiKey).toBe(true);

    const row = await db.query.users.findFirst({
      where: eq(users.id, target.id),
      columns: { elevenlabsApiKey: true },
    });
    expect(row?.elevenlabsApiKey).not.toBe(rawKey);
    expect(decryptApiKey(row!.elevenlabsApiKey!)).toBe(rawKey);

    const credit = await db.query.credits.findFirst({ where: eq(credits.userId, target.id) });
    expect(credit).toBeUndefined();

    const audit = await db.query.adminAuditLog.findFirst({
      where: eq(adminAuditLog.adminId, admin.id),
    });
    expect(audit?.action).toBe("SET_API_KEY");
    expect(JSON.stringify(audit?.metadata)).not.toContain(rawKey);
  });

  test("unverified target → 409 USER_NOT_ACTIVE", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser({ status: "unverified" });
    const res = await app.request(`/api/v1/admin/users/${target.id}/api-key`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${admin.sid}`,
      },
      body: JSON.stringify({ apiKey: "sk_long_enough_test_key", plan: "starter" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("DELETE /admin/users/:id/api-key", () => {
  test("removes key, downgrades to Free, no auto-regrant of Free credits", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser({ tier: "pro", status: "active" });
    await db
      .update(users)
      .set({ elevenlabsApiKey: "ENC_XXX", elevenlabsPlan: "creator" })
      .where(eq(users.id, target.id));

    const res = await app.request(`/api/v1/admin/users/${target.id}/api-key`, {
      method: "DELETE",
      headers: { Cookie: `voicelab_session=${admin.sid}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { tier: string; hasApiKey: boolean } };
    expect(body.user.tier).toBe("free");
    expect(body.user.hasApiKey).toBe(false);

    const credit = await db.query.credits.findFirst({ where: eq(credits.userId, target.id) });
    expect(credit).toBeUndefined();
  });
});

describe("PATCH /admin/users/:id", () => {
  test("admin suspends a user; audit row written", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser({ status: "active" });
    const res = await app.request(`/api/v1/admin/users/${target.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${admin.sid}`,
      },
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { status: string } };
    expect(body.user.status).toBe("suspended");

    const audit = await db.query.adminAuditLog.findFirst({
      where: eq(adminAuditLog.adminId, admin.id),
    });
    expect(audit?.action).toBe("SUSPEND_USER");
  });

  test("admin cannot demote self → 403", async () => {
    const admin = await makeUser({ role: "admin" });
    const res = await app.request(`/api/v1/admin/users/${admin.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${admin.sid}`,
      },
      body: JSON.stringify({ role: "user" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("CANNOT_DEMOTE_SELF");
  });
});

describe("POST /admin/users/:id/credits", () => {
  test("Free user with row → balance incremented", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser({ tier: "free", balance: 100 });

    const res = await app.request(`/api/v1/admin/users/${target.id}/credits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${admin.sid}`,
      },
      body: JSON.stringify({ amount: 250, reason: "comp" }),
    });
    expect(res.status).toBe(201);
    const credit = await db.query.credits.findFirst({ where: eq(credits.userId, target.id) });
    expect(credit?.balance).toBe(350);
  });

  test("Paid user → 409 USER_NOT_FREE", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser({ tier: "pro" });
    const res = await app.request(`/api/v1/admin/users/${target.id}/credits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${admin.sid}`,
      },
      body: JSON.stringify({ amount: 100 }),
    });
    expect(res.status).toBe(409);
  });
});

describe("GET /admin/metrics + /admin/audit", () => {
  test("metrics returns counts", async () => {
    const admin = await makeUser({ role: "admin" });
    const res = await app.request("/api/v1/admin/metrics", {
      headers: { Cookie: `voicelab_session=${admin.sid}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totalUsers: number;
      paidUsersByTier: Record<string, number>;
    };
    expect(body.totalUsers).toBeGreaterThanOrEqual(1);
    expect(body.paidUsersByTier).toBeDefined();
  });

  test("audit list returns entries", async () => {
    const admin = await makeUser({ role: "admin" });
    const target = await makeUser();
    await app.request(`/api/v1/admin/users/${target.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${admin.sid}`,
      },
      body: JSON.stringify({ status: "suspended" }),
    });
    const res = await app.request(`/api/v1/admin/audit?adminId=${admin.id}`, {
      headers: { Cookie: `voicelab_session=${admin.sid}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: Array<{ action: string }> };
    expect(body.entries.length).toBeGreaterThanOrEqual(1);
  });
});
