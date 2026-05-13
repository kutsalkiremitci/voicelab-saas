# ADR-005: Credit Accounting (Free-Tier-Only Scope)

**Date:** 2026-05-13
**Status:** Accepted

## Context

In the per-user managed key model (ADR-004), paid users have their own ElevenLabs subscription with its own quota. ElevenLabs itself enforces the limit upstream. We don't need to track characters or operate a complex credit ledger for them — `getSubscription()` returns their real-time state and the UI surfaces it (with VoiceLab branding, never naming ElevenLabs).

But the **Free tier** is different. Free users share a single demo ElevenLabs account, and we must prevent any one user from consuming more than their 1,000-credit allowance. This requires app-level accounting.

The earlier credit-ledger design (now retired) was an append-only, ADR-005-style ledger across **all** users with charges and admin grants. That was overkill for the paid-side reality (ElevenLabs already handles it). The current decision keeps the ledger only for Free.

## Decision

**App-level credit tracking is scoped to Free users.** Paid users see ElevenLabs' real quota as their "credits" in the UI (relabeled).

### Free user accounting

- New verified email → 1,000 credits granted, **one-time, non-renewing**
- Every TTS / cloning operation by a Free user is debited from this allowance
- When balance hits 0 → all operations return 402 with "Upgrade to continue" CTA
- No way to refill Free credits. Period.

### Paid user accounting

- User's "credit balance" displayed in UI = `getSubscription().characterCount` remaining (computed: `characterLimit - characterCount`)
- Cached 60 seconds in Redis
- Surfaced with VoiceLab branding only
- No ledger writes for paid users — ElevenLabs is the source of truth
- Operations don't pre-charge; ElevenLabs handles quota enforcement upstream
- On 402 response from upstream → surface "out of credits this month" UI; user upgrades or waits

## Schema

### `credits` (Free tier only)

| Column | Type | Notes |
|--------|------|-------|
| userId | uuid PK | references `users.id` ON DELETE CASCADE |
| balance | integer | default 1000 on verification, decremented per operation |
| grantedAt | timestamptz | when the 1000 was granted |
| exhaustedAt | timestamptz | nullable; set when balance first hits 0 |

One row per Free user. Created when email is verified. Not updated after exhaustion (the row is the audit trail).

Indexes: PK on `userId` is sufficient. No `(userId, createdAt)` index needed — this isn't a ledger.

### Why not append-only ledger

The previous design was a ledger because we were tracking many operations per user across paid and free. With paid-side moved to ElevenLabs, the Free tier needs only:

- "Did this user get their 1000?" → row exists
- "How much left?" → `balance`
- "Did they hit zero?" → `exhaustedAt`

A single mutable row gives us this in O(1) without ledger complexity. We sacrifice operation-level audit, but Free is a trial, not an accountable financial relationship. If a user disputes "I had 200 left," there's no money involved.

For paid users, the audit trail IS ElevenLabs' own dashboard (operator can see it via `getSubscription`, customer never sees it).

## Charge sequence (Free user)

```ts
async function chargeFreeUser(userId: string, amount: number) {
  const result = await db.transaction(async (tx) => {
    const current = await tx.select().from(credits).where(eq(credits.userId, userId)).forUpdate();
    if (!current[0]) throw new AppError("NO_CREDITS", "Free credits not granted", 402);
    if (current[0].balance < amount) {
      throw new AppError("INSUFFICIENT_CREDITS", "Not enough credits", 402, {
        required: amount,
        balance: current[0].balance,
      });
    }
    const newBalance = current[0].balance - amount;
    await tx.update(credits)
      .set({
        balance: newBalance,
        exhaustedAt: newBalance === 0 ? sql`NOW()` : current[0].exhaustedAt,
      })
      .where(eq(credits.userId, userId));
    return newBalance;
  });
  return result;
}
```

Order of operations stays: **check → upstream call → charge** (only after upstream succeeds). Same principle as before, simpler schema.

## Pricing knob (Free only)

```
CREDIT_PER_CHAR_TTS=1.0     # 1 char of TTS (Multilingual v2) = 1 credit
```

For Free users, this controls how many characters their 1,000 credits buys (currently 1,000 chars = ~1 minute). For paid users this env is unused — ElevenLabs' own metering applies.

Cloning operations are gated by tier (not by credit cost) in the route handler:
- Free tier can't clone at all (route returns 403 `TIER_LIMIT`)
- Basic+ tiers' cloning capability is bounded by their ElevenLabs subscription's voice slots

## Initial grant on email verification

```ts
// POST /auth/verify?token=...
if (validToken && !alreadyVerified) {
  await db.update(users).set({ status: "active", emailVerifiedAt: sql`NOW()` }).where(eq(users.id, userId));
  await db.insert(credits).values({ userId, balance: 1000, grantedAt: sql`NOW()` });
  // No admin action; no manual approval
}
```

If a user re-verifies (e.g. clicks link twice), the second insert hits `UNIQUE(userId)` → rejected silently. No double-grant.

## When to revisit

- **Free→Basic conversion < 10%:** Free allowance may be too low. Try 2,000 or 3,000 (one-time, still non-renewing).
- **Free credits feel "too generous":** if Free users routinely produce hours of audio, lower allowance or shorten grant.
- **A user exhausts Free in seconds (script abuse):** rate-limit the route (already covered by middleware) and require email verification (already in place).
- **Demand for Free monthly renewal:** keep saying no. Non-renewing is the abuse gate.

## Owner

Backend developer responsibility. Tests in `apps/api/test/integration/free-credits.test.ts` MUST cover: first grant, exhaustion, attempted re-grant, concurrent debits, cloning-blocked-for-free.
