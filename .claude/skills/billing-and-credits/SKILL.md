---
name: billing-and-credits
description: Use when adding, modifying, or reading from the credit and quota system. Free-tier credits live in a small `credits` table (one row per user, mutable). Paid-tier balances come from the upstream provider's subscription API (relabeled in UI). Use whenever the task mentions credits, balance, quota, charge, top-up, plan, tier, upgrade, admin grant, upstream subscription, free-tier abuse, or "402 Payment Required" — even if "billing" is not explicitly named.
---

# Billing & Credits

VoiceLab uses a **bifurcated** credit/quota model.

**Free tier** — credits are app-level. One row per Free user in the `credits` table. Balance starts at 1,000 on email verification, decrements per operation, never renews. Hitting zero is final until the user upgrades. See ADR-005.

**Paid tiers (Basic / Pro / Enterprise)** — quota lives upstream. We provision a dedicated ElevenLabs subscription per user (ADR-004), and the user's "balance" in our UI is computed from `getSubscription().characterLimit − characterCount`. No ledger writes for paid operations — the upstream provider is the source of truth.

This bifurcation is deliberate: we don't double-count what the upstream already meters, and we keep app-level state minimal for the case where money matters (paid).

## Symptoms (read this skill if any apply)

- Adding or modifying any code that reads or writes credits / quotas
- Implementing a route that charges or checks balance
- Implementing the admin "set API key" flow
- Designing the insufficient-balance error path (402)
- Computing a quote for an operation (Free only — Paid users skip quotes)
- Displaying balance, quota, or "credits remaining" in the UI
- Enforcing tier limits (Basic = IVC only, Pro = IVC + PVC, etc.)
- Granting Free credits as admin support gesture

## Red flags (resist these shortcuts)

- "Just track every paid user's character usage in our DB" → NO. Upstream provider does this. Trust it.
- "Charge paid users from their own credit ledger" → NO. Paid users have no ledger. ElevenLabs enforces upstream.
- "Refill Free credits monthly" → NO. Free is one-time, non-renewing. That's the abuse gate.
- "Add a `balance` column to `users` for Free" → NO. Keep the dedicated `credits` table for Free users; it isolates the lifecycle.
- "Free credits work the same as paid quota in code" → NO. Two different code paths (see `references/balance-resolution.md`).
- "Charge before the upstream call so we can refund if it succeeds" → NO. Charge after success. Refunds are complexity we don't need.
- "Cache the Free balance in Redis for 60 seconds" → NO. Authoritative reads only. Balance is the gate.
- "Return raw API keys in admin endpoints for the operator to inspect" → NEVER. Keys live AES-encrypted; serialization strips them.
- "Trust the client's quote payload for charging" → NEVER. Quote is display-only; server re-computes at submit.

## Non-negotiables

- `credits` table is for Free users only. Paid users have no row there.
- Free balance is `credits.balance` (integer). Paid "balance" is computed on-the-fly from `getSubscription()`.
- Free charging order is fixed: **quote → balance check → upstream call → balance decrement**. Decrement only after upstream success.
- 1,000 credits granted exactly once per Free user, on email verification. No renewal mechanism. Period.
- Cloning routes check `tier`: Free → 403 `TIER_LIMIT`, Basic → IVC only, Pro → IVC + PVC.
- Insufficient Free balance returns 402 with `details: { required, balance, deficit }`.
- 402 from upstream (paid user out of monthly quota) is surfaced as "out of credits this month" UI; no special server logic needed beyond passing the error through.
- Admin `POST /admin/users/:id/credits` only works when user `tier === "free"` (409 otherwise).
- Quote responses include the rate at quote time; the server re-quotes at submit to prevent stale-rate exploits.
- All admin actions append to `admin_audit_log`.

## Free charge flow (mandatory order)

```ts
// In the route handler (Free user TTS)
const tier = await getUserTier(userId);
const quote = freeCreditsService.quote("tts", { text });

if (tier === "free") {
  const balance = await freeCreditsService.getBalance(userId);
  if (balance < quote.amount) {
    throw new AppError("INSUFFICIENT_CREDITS", "Not enough credits", 402, {
      required: quote.amount,
      balance,
      deficit: quote.amount - balance,
    });
  }
}

// Upstream call (uses Free demo key or paid user's key, resolved by voice-ai service)
const result = await voiceAI.generateSpeech(userId, voiceId, text, settings);

// Only Free charges; paid users are metered upstream
if (tier === "free") {
  await freeCreditsService.charge(userId, quote.amount, {
    characters: result.characterCount,
    voiceId,
    generationId: result.id,
  });
}
```

## Paid balance flow (read-only)

```ts
// GET /credits/balance
const tier = await getUserTier(userId);

if (tier === "free") {
  const balance = await freeCreditsService.getBalance(userId);
  return { balance, source: "free", plan: "free" };
}

// Paid: derive from upstream
const sub = await voiceAI.getSubscriptionForUser(userId); // Redis-cached 60s
return {
  balance: sub.characterLimit - sub.characterCount,
  source: "upstream",
  plan: tier,
  resetAt: sub.nextCharacterCountResetUnix,
};
```

## Tier gates (cloning)

```ts
async function checkCloningPermission(userId: string, kind: "ivc" | "pvc") {
  const tier = await getUserTier(userId);
  if (tier === "free") {
    throw new AppError("TIER_LIMIT", "Upgrade to clone your voice", 403, { upgradeTo: "basic" });
  }
  if (kind === "pvc" && tier === "basic") {
    throw new AppError("TIER_LIMIT", "Studio Voice Clone requires Pro tier", 403, { upgradeTo: "pro" });
  }
  // Enterprise and Pro can do everything
}
```

## Authoritative references

- `references/free-tier.md` — `credits` table, charge/quote flow, abuse mitigations
- `references/paid-tier-balance.md` — How upstream subscription state becomes "balance" in our UI
- `references/admin-grants.md` — Free-tier comp grants, audit log pattern
- `references/stripe-future.md` — Webhook design for when paid upgrades go self-serve (deferred)

## Skill handoffs

- Writing the route that consumes credits? Switch to `backend-development` for the route shape and `elevenlabs-integration` for the upstream call.
- Building the credits display in the UI? Switch to `frontend-development` — there are different components for Free (`<FreeCredits />`) and Paid (`<UpstreamQuota />`).
- The user is uploading recordings or generating audio? `audio-recording` for capture, `storage-adapter` for persistence.
- Finished? Hand off to `test-driven-development`. Free credit logic gets especially thorough tests (idempotent grant, race-safe charge, hard floor at 0).
