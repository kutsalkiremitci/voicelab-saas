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

  if (user.tier === "free") {
    const balance = await getFreeBalance(userId);
    return c.json({
      balance: balance ?? 0,
      source: "free" as const,
      plan: "free" as const,
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
  });
});

credits.post("/quote", requireAuth, async (c) => {
  const userId = c.get("userId");
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tier: true },
  });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  if (user.tier !== "free") {
    throw new AppError("QUOTE_NOT_APPLICABLE", "Quotes are Free-tier only", 409);
  }

  const body = quoteSchema.parse(await c.req.json());
  const quote = quoteFreeOperation(body.operation, body.payload);
  return c.json(quote);
});

export default credits;
