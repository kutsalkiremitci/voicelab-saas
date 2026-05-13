import { sql, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { credits } from "@voicelab/db/schema";
import { env } from "../env";
import { AppError } from "../lib/errors";

export type FreeOperation = "tts" | "s2s" | "transcribe";

export interface FreeQuote {
  amount: number;
  ratePerChar: number;
  operation: FreeOperation;
}

export interface FreeQuotePayload {
  text?: string;
  durationSec?: number;
  keytermsCount?: number;
}

export interface ChargeMetadata {
  characters?: number;
  voiceId?: string;
  generationId?: string;
  transcriptionId?: string;
  durationSec?: number;
  reason?: string;
  [key: string]: unknown;
}

// Upstream Scribe keyterm surcharge: +$0.05 on top of $0.22/hour base = 1.227x.
// Round to 1.23 to keep the user-facing line "+23% for keywords" simple.
export const KEYTERM_SURCHARGE_MULTIPLIER = 1.23;

export function quoteFreeOperation(
  operation: FreeOperation,
  payload: FreeQuotePayload,
): FreeQuote {
  const rate = env.CREDIT_PER_CHAR_TTS;
  if (operation === "tts") {
    const text = payload.text ?? "";
    return { amount: Math.ceil(text.length * rate), ratePerChar: rate, operation };
  }
  if (operation === "s2s") {
    const sec = payload.durationSec ?? 0;
    const charsApprox = Math.ceil((sec / 60) * 1000);
    return { amount: Math.ceil(charsApprox * rate), ratePerChar: rate, operation };
  }
  if (operation === "transcribe") {
    const sec = Math.max(payload.durationSec ?? 0, 0);
    const perMinute = env.CREDIT_PER_MINUTE_TRANSCRIBE;
    let amount = Math.ceil((sec / 60) * perMinute);
    if (amount < 1 && sec > 0) amount = 1;
    if ((payload.keytermsCount ?? 0) > 0) {
      amount = Math.ceil(amount * KEYTERM_SURCHARGE_MULTIPLIER);
    }
    return { amount, ratePerChar: perMinute, operation };
  }
  throw new Error(`Free tier unsupported operation: ${operation as string}`);
}

export async function getFreeBalance(userId: string): Promise<number | null> {
  const row = await db.query.credits.findFirst({
    where: eq(credits.userId, userId),
    columns: { balance: true },
  });
  return row?.balance ?? null;
}

export async function chargeFreeUser(
  userId: string,
  amount: number,
  _metadata: ChargeMetadata = {},
): Promise<number> {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError("INVALID_CHARGE", "Charge amount must be non-negative", 400);
  }
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{
      user_id: string;
      balance: number;
      exhausted_at: Date | null;
    }>(sql`SELECT user_id, balance, exhausted_at FROM credits WHERE user_id = ${userId} FOR UPDATE`);
    const current = rows[0];
    if (!current) {
      throw new AppError("NO_CREDITS", "Free credits not granted yet", 402);
    }
    if (current.balance < amount) {
      throw new AppError("INSUFFICIENT_CREDITS", "Not enough credits", 402, {
        required: amount,
        balance: current.balance,
        deficit: amount - current.balance,
      });
    }
    const newBalance = current.balance - amount;
    const exhaustedAt = newBalance === 0 && !current.exhausted_at ? new Date() : current.exhausted_at;
    await tx
      .update(credits)
      .set({ balance: newBalance, exhaustedAt })
      .where(eq(credits.userId, userId));
    return newBalance;
  });
}
