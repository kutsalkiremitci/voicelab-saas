import { Hono } from "hono";
import { and, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db";
import { users, creditTransactions } from "@voicelab/db/schema";
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

const OPERATION_VALUES = ["transcribe", "tts", "s2s", "admin_grant", "admin_refund"] as const;
const TYPE_VALUES = ["charge", "grant"] as const;

const txQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  operation: z.string().optional(), // comma-sep list
  type: z.enum(TYPE_VALUES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

credits.get("/transactions", requireAuth, async (c) => {
  const userId = c.get("userId");
  const q = txQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));

  const ops = q.operation
    ? q.operation
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is (typeof OPERATION_VALUES)[number] =>
          (OPERATION_VALUES as readonly string[]).includes(s),
        )
    : [];

  const filters = [eq(creditTransactions.userId, userId)];
  if (ops.length > 0) filters.push(inArray(creditTransactions.operation, ops));
  if (q.type) filters.push(eq(creditTransactions.type, q.type));
  if (q.from) filters.push(gte(creditTransactions.createdAt, new Date(q.from)));
  if (q.to) filters.push(lte(creditTransactions.createdAt, new Date(q.to)));
  if (q.cursor) filters.push(lt(creditTransactions.createdAt, new Date(q.cursor)));

  const rows = await db
    .select()
    .from(creditTransactions)
    .where(and(...filters))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const slice = hasMore ? rows.slice(0, q.limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.createdAt.toISOString() : null;

  return c.json({
    transactions: slice.map((r) => ({
      id: r.id,
      operation: r.operation,
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      description: r.description,
      refType: r.refType,
      refId: r.refId,
      metadata: r.metadata,
      createdAt: r.createdAt,
    })),
    nextCursor,
  });
});

export default credits;
