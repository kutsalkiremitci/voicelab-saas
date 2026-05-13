import { createCipheriv, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, sql } from "./client";
import { users, credits } from "./schema";

/**
 * Seed:
 *   1. First admin (always, from ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD)
 *   2. Three test users covering all tiers (only if test env vars present):
 *      - free@voicelab.local  (tier=free, 1000 credits)
 *      - basic@voicelab.local (tier=basic, encrypted upstream key, plan=creator)
 *      - pro@voicelab.local   (tier=pro,   encrypted upstream key, plan=pro)
 *
 *      Shared password is hard-coded as TEST_USER_PASSWORD below (local dev only).
 *
 * Idempotent: skips users that already exist.
 */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function encryptApiKey(plaintext: string, secret: string): string {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

const adminEnv = z.object({
  ADMIN_SEED_EMAIL: z.string().email(),
  ADMIN_SEED_PASSWORD: z.string().min(8),
});

const TEST_USER_PASSWORD = "Test12345!";

const testEnv = z.object({
  SEED_ELEVENLABS_API_KEY: z.string().startsWith("sk_"),
  ELEVENLABS_KEY_ENCRYPTION_SECRET: z.string().min(16),
});

type TestUser = {
  email: string;
  tier: "free" | "basic" | "pro";
  elevenlabsPlan: "starter" | "creator" | "pro" | "scale" | null;
  attachKey: boolean;
  grantFreeCredits: boolean;
};

const TEST_USERS: TestUser[] = [
  {
    email: "free@voicelab.local",
    tier: "free",
    elevenlabsPlan: null,
    attachKey: false,
    grantFreeCredits: true,
  },
  {
    email: "basic@voicelab.local",
    tier: "basic",
    elevenlabsPlan: "creator",
    attachKey: true,
    grantFreeCredits: false,
  },
  {
    email: "pro@voicelab.local",
    tier: "pro",
    elevenlabsPlan: "pro",
    attachKey: true,
    grantFreeCredits: false,
  },
];

async function seedAdmin() {
  const env = adminEnv.parse({
    ADMIN_SEED_EMAIL: process.env.ADMIN_SEED_EMAIL,
    ADMIN_SEED_PASSWORD: process.env.ADMIN_SEED_PASSWORD,
  });

  const existing = await db.query.users.findFirst({
    where: eq(users.email, env.ADMIN_SEED_EMAIL),
    columns: { id: true, role: true },
  });

  if (existing) {
    console.log(
      `[seed] admin ${env.ADMIN_SEED_EMAIL} already exists (id=${existing.id}, role=${existing.role}); skipping.`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);

  const inserted = await db
    .insert(users)
    .values({
      email: env.ADMIN_SEED_EMAIL,
      password: passwordHash,
      role: "admin",
      status: "active",
      tier: "free",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id, email: users.email });

  const created = inserted[0];
  if (!created) throw new Error("seed insert returned no rows");
  console.log(`[seed] created admin: id=${created.id} email=${created.email}`);
}

async function seedTestUsers() {
  const parsed = testEnv.safeParse({
    SEED_ELEVENLABS_API_KEY: process.env.SEED_ELEVENLABS_API_KEY,
    ELEVENLABS_KEY_ENCRYPTION_SECRET: process.env.ELEVENLABS_KEY_ENCRYPTION_SECRET,
  });

  if (!parsed.success) {
    console.log(
      "[seed] test-user env vars missing or invalid; skipping test users " +
        "(set SEED_ELEVENLABS_API_KEY and ELEVENLABS_KEY_ENCRYPTION_SECRET to enable).",
    );
    return;
  }

  const env = parsed.data;
  const passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, 12);
  const encryptedKey = encryptApiKey(
    env.SEED_ELEVENLABS_API_KEY,
    env.ELEVENLABS_KEY_ENCRYPTION_SECRET,
  );
  const now = new Date();

  for (const u of TEST_USERS) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, u.email),
      columns: { id: true, tier: true },
    });

    if (existing) {
      console.log(
        `[seed] ${u.email} already exists (id=${existing.id}, tier=${existing.tier}); skipping.`,
      );
      continue;
    }

    const inserted = await db
      .insert(users)
      .values({
        email: u.email,
        password: passwordHash,
        role: "user",
        status: "active",
        tier: u.tier,
        elevenlabsApiKey: u.attachKey ? encryptedKey : null,
        elevenlabsPlan: u.elevenlabsPlan,
        emailVerifiedAt: now,
        activatedAt: u.attachKey ? now : null,
      })
      .returning({ id: users.id, email: users.email, tier: users.tier });

    const created = inserted[0];
    if (!created) throw new Error(`seed insert returned no rows for ${u.email}`);

    if (u.grantFreeCredits) {
      await db
        .insert(credits)
        .values({ userId: created.id, balance: 1000 })
        .onConflictDoNothing();
    }

    console.log(
      `[seed] created ${created.email} (tier=${created.tier}, id=${created.id})`,
    );
  }
}

async function main() {
  await seedAdmin();
  await seedTestUsers();
  await sql.end();
}

main().catch(async (err) => {
  console.error("[seed] failed:", err);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
});
