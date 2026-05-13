# Free Tier — Credit Lifecycle

The Free tier exists to let users evaluate VoiceLab without commitment. Its design balances two goals: low signup friction (no admin approval) and abuse resistance (verified email + non-renewing credits).

## Table

```ts
// packages/db/src/schema.ts
export const credits = pgTable("credits", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(1000),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  exhaustedAt: timestamp("exhausted_at", { withTimezone: true }),
});
```

One row per Free user. No row = no credits granted yet. Insert happens on email verification.

## Grant flow (on email verification)

```ts
// Inside GET /auth/verify?token=...
await db.transaction(async (tx) => {
  // Mark user active
  await tx.update(users).set({
    status: "active",
    emailVerifiedAt: sql`NOW()`,
  }).where(eq(users.id, userId));

  // Grant 1000 credits (idempotent — INSERT ON CONFLICT DO NOTHING)
  await tx.insert(credits).values({
    userId,
    balance: env.FREE_TIER_INITIAL_CREDITS, // 1000 by default
  }).onConflictDoNothing();
});
```

Idempotent: if the verify link is clicked twice, the second insert hits `PRIMARY KEY(userId)` and is a no-op. No double-grant.

## Charge flow

```ts
async function chargeFreeUser(userId: string, amount: number, metadata: object) {
  return await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(credits)
      .where(eq(credits.userId, userId))
      .for("update");

    if (!current) {
      throw new AppError("NO_CREDITS", "Free credits not granted yet", 402);
    }
    if (current.balance < amount) {
      throw new AppError("INSUFFICIENT_CREDITS", "Not enough credits", 402, {
        required: amount,
        balance: current.balance,
      });
    }

    const newBalance = current.balance - amount;
    await tx.update(credits).set({
      balance: newBalance,
      exhaustedAt: newBalance === 0 ? sql`NOW()` : current.exhaustedAt,
    }).where(eq(credits.userId, userId));

    return newBalance;
  });
}
```

Row-level lock (`FOR UPDATE`) makes the operation race-safe under concurrent requests. The hard floor at 0 is enforced by the `if (current.balance < amount)` check inside the transaction.

## Quote helper

```ts
interface FreeQuote {
  amount: number;
  ratePerChar: number;
}

function quoteFreeOperation(operation: "tts", payload: { text: string }): FreeQuote {
  if (operation === "tts") {
    const rate = env.CREDIT_PER_CHAR_TTS; // 1.0 in MVP
    return {
      amount: Math.ceil(payload.text.length * rate),
      ratePerChar: rate,
    };
  }
  throw new Error(`Free tier does not support operation: ${operation}`);
}
```

Free users cannot clone (tier gate rejects before this point). The quote helper exists only for TTS and Speech-to-Speech.

## Insufficient balance response

```json
HTTP 402 Payment Required

{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Not enough credits",
    "details": {
      "required": 240,
      "balance": 80,
      "deficit": 160
    }
  }
}
```

Frontend renders: "You need 160 more credits to generate this. Upgrade to Basic to continue."

## Exhaustion behavior

When balance hits 0:
- `exhaustedAt` is set (one-time, won't reset on retry)
- Subsequent operations return 402 immediately (no upstream call attempted)
- Dashboard shows "You've used your trial credits" with prominent Upgrade CTA
- The row persists in the `credits` table as the audit trail

A Free user cannot be "refilled" by the system. Admin can manually grant additional Free credits via `POST /admin/users/:id/credits` for support cases (e.g. compensating a bug), but this is a deliberate, audited action.

## Re-grant rejection

If somehow a Free user appears without a `credits` row after verification (data drift, manual DB edit), they cannot use the product until admin manually grants. There is no "auto-repair" route — that would be a backdoor to abuse.

## Tests required

In `apps/api/test/integration/free-credits.test.ts`:

1. Grant happens exactly once per user (verify link clicked twice → single insert)
2. Concurrent charges respect the floor (two parallel requests, both think balance is sufficient, one wins)
3. Exhaustion timestamp set only on the first zero-touch
4. Paid user has no `credits` row; `getBalance` for paid returns upstream-derived value
5. Re-verifying already-verified user doesn't double-grant
6. Admin manual grant works only on Free tier (409 if tier is Basic/Pro/Enterprise)

## Abuse layers (defense in depth, from ADR-007)

| Layer | Mechanism |
|-------|-----------|
| 1 | Email verification — no row in `credits` without verified email |
| 2 | `UNIQUE(email)` on `users` — same email can't double-grant |
| 3 | Rate limits on `/auth/register` (3/hr/IP) and `/auth/resend-verification` (5/day/email) |
| 4 | Disposable email blocklist (backlog) |

If layers 1-3 prove insufficient (abuse pattern emerges), add layer 4 + CAPTCHA on register.
