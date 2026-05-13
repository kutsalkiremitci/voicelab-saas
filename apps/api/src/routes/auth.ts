import { Hono, type Context } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { users, credits } from "@voicelab/db/schema";
import { env } from "../env";
import { AppError } from "../lib/errors";
import {
  createSession,
  destroySession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
} from "../services/session";
import {
  createVerificationToken,
  consumeVerificationToken,
  invalidateOpenTokens,
} from "../services/verification";
import { emailService } from "../services/email";
import { rateLimit } from "../middleware/rate-limit";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import {
  registerSchema,
  loginSchema,
  resendSchema,
} from "@voicelab/shared/schemas/auth";

const auth = new Hono<{ Variables: AuthVariables }>();

const PASSWORD_ROUNDS = 12;

function publicUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    tier: u.tier,
    activatedAt: u.activatedAt,
    createdAt: u.createdAt,
  };
}

function clientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

function setSessionCookie(c: Context, sid: string): void {
  setCookie(c, SESSION_COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
}

auth.post(
  "/register",
  rateLimit({
    prefix: "register",
    key: (c) => clientIp(c),
    max: 3,
    windowSec: 3600,
  }),
  async (c) => {
    const body = registerSchema.parse(await c.req.json());

    const existing = await db.query.users.findFirst({
      where: eq(users.email, body.email),
      columns: { id: true },
    });
    if (existing) {
      throw new AppError("EMAIL_TAKEN", "Email already registered", 409);
    }

    const passwordHash = await bcrypt.hash(body.password, PASSWORD_ROUNDS);
    const inserted = await db
      .insert(users)
      .values({
        email: body.email,
        password: passwordHash,
        name: body.name,
      })
      .returning();
    const user = inserted[0];
    if (!user) throw new AppError("INTERNAL_ERROR", "Failed to create user", 500);

    const rawToken = await createVerificationToken(user.id);
    const verifyLink = `${env.APP_URL}/verify?token=${rawToken}`;
    await emailService.sendVerification(user.email, verifyLink);

    return c.json({ user: publicUser(user) }, 201);
  },
);

auth.get("/verify", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.redirect(`${env.APP_URL}/verify-email?error=missing-token`, 302);
  }

  const userId = await consumeVerificationToken(token);
  if (!userId) {
    return c.redirect(`${env.APP_URL}/verify-email?error=invalid-or-expired`, 302);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ status: "active", emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
    await tx
      .insert(credits)
      .values({ userId, balance: env.FREE_TIER_INITIAL_CREDITS })
      .onConflictDoNothing({ target: credits.userId });
  });

  return c.redirect(`${env.APP_URL}/login?verified=1`, 302);
});

auth.post(
  "/resend-verification",
  rateLimit({
    prefix: "resend-min",
    key: async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { email?: string };
      return body.email?.toLowerCase() ?? "anon";
    },
    max: 1,
    windowSec: 60,
  }),
  rateLimit({
    prefix: "resend-day",
    key: async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { email?: string };
      return body.email?.toLowerCase() ?? "anon";
    },
    max: 5,
    windowSec: 86400,
  }),
  async (c) => {
    const body = resendSchema.parse(await c.req.json());
    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
      columns: { id: true, status: true, email: true },
    });

    if (user && user.status === "unverified") {
      await invalidateOpenTokens(user.id);
      const rawToken = await createVerificationToken(user.id);
      const verifyLink = `${env.APP_URL}/verify?token=${rawToken}`;
      await emailService.sendVerification(user.email, verifyLink);
    }
    return c.json({ ok: true }, 200);
  },
);

auth.post(
  "/login",
  rateLimit({
    prefix: "login",
    key: (c) => clientIp(c),
    max: 5,
    windowSec: 60,
  }),
  async (c) => {
    const body = loginSchema.parse(await c.req.json());
    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });

    const ok = user
      ? await bcrypt.compare(body.password, user.password)
      : await bcrypt.compare(body.password, "$2a$12$invalid.hash.for.timing.protection.padding.padding");

    if (!user || !ok) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    if (user.status === "unverified") {
      throw new AppError("ACCOUNT_UNVERIFIED", "Email not verified", 403);
    }
    if (user.status === "suspended") {
      throw new AppError("ACCOUNT_SUSPENDED", "Account suspended", 403);
    }

    const sid = await createSession(user.id);
    setSessionCookie(c, sid);
    return c.json({ user: publicUser(user) }, 200);
  },
);

auth.post("/logout", async (c) => {
  const sid = getCookie(c, SESSION_COOKIE_NAME);
  if (sid) await destroySession(sid);
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true }, 200);
});

auth.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);

  let balance: number | null = null;
  let balanceSource: "free" | "upstream" = "free";
  if (user.tier === "free") {
    const row = await db.query.credits.findFirst({
      where: eq(credits.userId, userId),
      columns: { balance: true },
    });
    balance = row?.balance ?? 0;
    balanceSource = "free";
  } else {
    balance = null;
    balanceSource = "upstream";
  }

  return c.json({ user: publicUser(user), balance, balanceSource }, 200);
});

export default auth;
