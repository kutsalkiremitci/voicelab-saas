import { sql, eq } from "drizzle-orm";
import { db } from "../lib/db";
import {
  credits,
  creditTransactions,
  type CreditTransactionOperation,
} from "@voicelab/db/schema";
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
  description?: string;
  refType?: string;
  refId?: string;
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

function operationToLedgerOp(op: FreeOperation): CreditTransactionOperation {
  return op as CreditTransactionOperation;
}

export interface ChargeOptions {
  operation: FreeOperation;
  description?: string;
  refType?: string;
  refId?: string;
  metadata?: Record<string, unknown>;
}

export async function chargeFreeUser(
  userId: string,
  amount: number,
  options: ChargeMetadata | (ChargeOptions & ChargeMetadata) = {},
): Promise<number> {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError("INVALID_CHARGE", "Charge amount must be non-negative", 400);
  }

  const opts = options as ChargeMetadata & Partial<ChargeOptions>;
  // Best-effort inference of the operation from metadata when caller did not
  // pass `operation` explicitly (keeps the older call-sites working).
  const operation: CreditTransactionOperation = opts.operation
    ? operationToLedgerOp(opts.operation)
    : opts.transcriptionId
      ? "transcribe"
      : opts.generationId
        ? "tts"
        : "tts";

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

    if (amount > 0) {
      await tx.insert(creditTransactions).values({
        userId,
        operation,
        type: "charge",
        amount,
        balanceAfter: newBalance,
        description: opts.description ?? opts.reason ?? null,
        refType: opts.refType ?? (opts.transcriptionId ? "transcription" : opts.generationId ? "generation" : null),
        refId: opts.refId ?? opts.transcriptionId ?? opts.generationId ?? null,
        metadata: opts.metadata ?? null,
      });
    }

    return newBalance;
  });
}

export interface GrantOptions {
  operation?: "admin_grant" | "admin_refund";
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Add credits to a user's pool, recording the bump in the ledger.
 * Used by admin grants and the email-verification starter grant.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  options: GrantOptions = {},
): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("INVALID_GRANT", "Grant amount must be positive", 400);
  }
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ user_id: string; balance: number }>(
      sql`SELECT user_id, balance FROM credits WHERE user_id = ${userId} FOR UPDATE`,
    );
    const current = rows[0];
    let newBalance: number;
    if (!current) {
      await tx.insert(credits).values({ userId, balance: amount });
      newBalance = amount;
    } else {
      newBalance = current.balance + amount;
      await tx
        .update(credits)
        .set({ balance: newBalance, exhaustedAt: null })
        .where(eq(credits.userId, userId));
    }
    await tx.insert(creditTransactions).values({
      userId,
      operation: options.operation ?? "admin_grant",
      type: "grant",
      amount,
      balanceAfter: newBalance,
      description: options.description ?? null,
      metadata: options.metadata ?? null,
    });
    return newBalance;
  });
}
