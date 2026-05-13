import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { emailVerifications } from "@voicelab/db/schema";
import { env } from "../env";

const TOKEN_BYTES = 32;
const BCRYPT_ROUNDS = 10;

function ttlMs(): number {
  return env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000;
}

export async function createVerificationToken(userId: string): Promise<string> {
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
  await db.insert(emailVerifications).values({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + ttlMs()),
  });
  return rawToken;
}

export async function consumeVerificationToken(rawToken: string): Promise<string | null> {
  const candidates = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        isNull(emailVerifications.consumedAt),
        gt(emailVerifications.expiresAt, new Date()),
      ),
    );

  for (const row of candidates) {
    if (await bcrypt.compare(rawToken, row.tokenHash)) {
      await db
        .update(emailVerifications)
        .set({ consumedAt: new Date() })
        .where(eq(emailVerifications.id, row.id));
      return row.userId;
    }
  }
  return null;
}

export async function invalidateOpenTokens(userId: string): Promise<void> {
  await db
    .update(emailVerifications)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(emailVerifications.userId, userId),
        isNull(emailVerifications.consumedAt),
      ),
    );
}
