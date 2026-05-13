import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db";
import { users } from "@voicelab/db/schema";
import { AppError } from "../lib/errors";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { getFreeBalance, quoteFreeOperation } from "../services/free-credits";
import { getSubscriptionForUser } from "../services/voice-ai";

const credits = new Hono<{ Variables: AuthVariables }>();

const quoteSchema = z.object({
  operation: z.enum(["tts", "s2s", "transcribe"]),
  payload: z.object({
    text: z.string().optional(),
    durationSec: z.number().nonnegative().optional(),
    keytermsCount: z.number().int().nonnegative().optional(),
  }),
});

credits.get("/balance", requireAuth, async (c) => {
  const userId = c.get("userId");
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tier: true },
  });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);

  // `credits` table is the universal app-credit pool used by Speech-to-Text
  // for every tier (no free STT for anyone).
  const appCredits = (await getFreeBalance(userId)) ?? 0;

  if (user.tier === "free") {
    return c.json({
      balance: appCredits,
      source: "free" as const,
      plan: "free" as const,
      transcribeBalance: appCredits,
    });
  }

  const sub = await getSubscriptionForUser(userId);
  return c.json({
    balance: sub.characterLimit - sub.characterCount,
    source: "upstream" as const,
    plan: user.tier,
    resetAt: sub.nextCharacterCountResetUnix
      ? new Date(sub.nextCharacterCountResetUnix * 1000).toISOString()
      : null,
    transcribeBalance: appCredits,
  });
});

credits.post("/quote", requireAuth, async (c) => {
  const userId = c.get("userId");
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tier: true },
  });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);

  const body = quoteSchema.parse(await c.req.json());

  // STT charges from the universal `credits` pool on every tier. TTS / S2S
  // remain Free-only (paid plans use upstream metering for those).
  if (body.operation !== "transcribe" && user.tier !== "free") {
    throw new AppError("QUOTE_NOT_APPLICABLE", "Quotes are Free-tier only for this operation", 409);
  }

  const quote = quoteFreeOperation(body.operation, body.payload);
  return c.json(quote);
});

export default credits;
