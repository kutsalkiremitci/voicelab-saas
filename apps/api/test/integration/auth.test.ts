import { describe, expect, test, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users, credits, emailVerifications } from "@voicelab/db/schema";
import { env } from "../../src/env";

const MAILPIT_API = "http://localhost:8025/api/v1";

async function clearRateLimits(): Promise<void> {
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(...keys);
}

async function wipeUser(email: string): Promise<void> {
  const u = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });
  if (!u) return;
  await db.delete(emailVerifications).where(eq(emailVerifications.userId, u.id));
  await db.delete(credits).where(eq(credits.userId, u.id));
  await db.delete(users).where(eq(users.id, u.id));
}

async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_API}/messages`, { method: "DELETE" });
}

async function findVerifyLinkFor(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(
      `${MAILPIT_API}/search?query=to:${encodeURIComponent(email)}`,
    );
    const data = (await res.json()) as { messages: Array<{ ID: string }> };
    if (data.messages.length > 0) {
      const detail = (await (
        await fetch(`${MAILPIT_API}/message/${data.messages[0]!.ID}`)
      ).json()) as { Text: string };
      const m = detail.Text.match(/https?:\S*\/verify\?token=[A-Za-z0-9_\-=]+/);
      if (m) return m[0];
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no verify message arrived for ${email}`);
}

beforeEach(async () => {
  await clearRateLimits();
  await clearMailpit();
});

describe("auth flow", () => {
  test("register → verify → login → /me returns balance 1000", async () => {
    const email = `flow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`;
    await wipeUser(email);

    const reg = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1" },
      body: JSON.stringify({ email, password: "hunter2pass" }),
    });
    expect(reg.status).toBe(201);
    const regBody = (await reg.json()) as { user: { id: string; status: string } };
    expect(regBody.user.status).toBe("unverified");

    const verifyLink = await findVerifyLinkFor(email);
    const verifyUrl = new URL(verifyLink);
    const verify = await app.request(
      `/api/v1/auth${verifyUrl.pathname}${verifyUrl.search}`,
    );
    expect(verify.status).toBe(302);
    expect(verify.headers.get("location")).toBe(`${env.APP_URL}/login?verified=1`);

    const userRow = await db.query.users.findFirst({
      where: eq(users.id, regBody.user.id),
      columns: { status: true, emailVerifiedAt: true },
    });
    expect(userRow?.status).toBe("active");
    expect(userRow?.emailVerifiedAt).not.toBeNull();

    const creditRow = await db.query.credits.findFirst({
      where: eq(credits.userId, regBody.user.id),
    });
    expect(creditRow?.balance).toBe(1000);

    const login = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1" },
      body: JSON.stringify({ email, password: "hunter2pass" }),
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get("set-cookie");
    expect(setCookie).toContain("voicelab_session=");

    const sidMatch = setCookie?.match(/voicelab_session=([^;]+)/);
    expect(sidMatch).not.toBeNull();
    const sid = sidMatch![1];

    const me = await app.request("/api/v1/auth/me", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as {
      user: { email: string; tier: string };
      balance: number;
      balanceSource: string;
    };
    expect(meBody.user.email).toBe(email);
    expect(meBody.user.tier).toBe("free");
    expect(meBody.balance).toBe(1000);
    expect(meBody.balanceSource).toBe("free");

    await wipeUser(email);
  });

  test("login on unverified user → 403 ACCOUNT_UNVERIFIED", async () => {
    const email = `unverified-${Date.now()}@voicelab.local`;
    await wipeUser(email);

    await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.2" },
      body: JSON.stringify({ email, password: "hunter2pass" }),
    });

    await clearRateLimits();

    const login = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.2" },
      body: JSON.stringify({ email, password: "hunter2pass" }),
    });
    expect(login.status).toBe(403);
    const body = (await login.json()) as { error: { code: string } };
    expect(body.error.code).toBe("ACCOUNT_UNVERIFIED");

    await wipeUser(email);
  });

  test("login on suspended user → 403 ACCOUNT_SUSPENDED", async () => {
    const email = `suspended-${Date.now()}@voicelab.local`;
    await wipeUser(email);

    const reg = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.3" },
      body: JSON.stringify({ email, password: "hunter2pass" }),
    });
    const regBody = (await reg.json()) as { user: { id: string } };

    await db
      .update(users)
      .set({ status: "suspended" })
      .where(eq(users.id, regBody.user.id));

    await clearRateLimits();

    const login = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.3" },
      body: JSON.stringify({ email, password: "hunter2pass" }),
    });
    expect(login.status).toBe(403);
    const body = (await login.json()) as { error: { code: string } };
    expect(body.error.code).toBe("ACCOUNT_SUSPENDED");

    await wipeUser(email);
  });

  test("register validation: short password → 422", async () => {
    const reg = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.4" },
      body: JSON.stringify({ email: "short@voicelab.local", password: "short" }),
    });
    expect(reg.status).toBe(422);
    const body = (await reg.json()) as { error: { code: string; details: unknown } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
  });

  test("resend-verification: 1st call ok, 2nd within 60s → 429", async () => {
    const email = `resend-${Date.now()}@voicelab.local`;
    await wipeUser(email);

    await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.5" },
      body: JSON.stringify({ email, password: "hunter2pass" }),
    });

    const r1 = await app.request("/api/v1/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.5" },
      body: JSON.stringify({ email }),
    });
    expect(r1.status).toBe(200);

    const r2 = await app.request("/api/v1/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.5" },
      body: JSON.stringify({ email }),
    });
    expect(r2.status).toBe(429);

    await wipeUser(email);
  });
});
