# Paid Tier — Balance from Upstream

Paid users (Basic / Pro / Enterprise) don't have a row in the `credits` table. Their balance is derived from the upstream provider's subscription API in real-time. This file documents how that derivation happens, how it's cached, and how it's surfaced.

## Source of truth

For Paid users, the upstream `getSubscription()` response is authoritative:

```ts
{
  tier: "creator",                       // upstream's tier — not exposed to user
  characterCount: 12450,
  characterLimit: 121000,
  voiceLimit: 30,
  voiceUsed: 4,
  canExtendCharacterLimit: false,
  nextCharacterCountResetUnix: 1748736000,
}
```

We compute the **VoiceLab-facing** balance from this:

```ts
function paidBalance(sub: UpstreamSubscription) {
  return {
    balance: sub.characterLimit - sub.characterCount,
    source: "upstream" as const,
    plan: voicelabTierFromUpstream(sub.tier),     // remap: starter → basic, creator → pro
    resetAt: new Date(sub.nextCharacterCountResetUnix * 1000),
  };
}
```

`balance` is what the UI shows as "credits remaining." The unit is "characters" but the user sees "credits" (1 char = 1 credit at our default rate).

## Why no app-level tracking

We could track every paid charge in our own DB, but it would just duplicate what upstream is already doing. Three concrete reasons not to:

1. **Truth divergence risk.** If our row and upstream's metering drift (network blip, missed write), reconciliation is painful. Upstream-as-truth eliminates the question.
2. **No commercial reason.** The user is buying access to a paid tier; the dollar relationship is "$X/month for plan Y." We don't owe per-character billing transparency beyond what upstream provides.
3. **Operational simplicity.** No ledger, no charge service for paid, less code, fewer bugs.

The cost: we can't show "TTS history charged against ledger" for paid users. They see their `generations` table (audit trail of what they made) but no money-attached entries. That's fine — they're on a subscription, not metered billing.

## Caching

`getSubscriptionForUser(userId)` is cached 60 seconds in Redis at key `subscription:${userId}`. Reasons:

- Upstream subscription state is slow-changing (resets monthly)
- Dashboard hits this on every page load → caching saves upstream API calls
- 60s freshness is tolerable for "credits remaining"

```ts
async function getSubscriptionForUser(userId: string): Promise<UpstreamSubscription> {
  const cacheKey = `subscription:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const client = await voiceAI.getClientForUser(userId);
  const sub = await client.user.subscription.get();
  await redis.setex(cacheKey, 60, JSON.stringify(sub));
  return sub;
}
```

Cache is invalidated on: tier change (admin sets new API key), user upgrade event, manual admin action.

## Branding (UI surface)

The UI must NOT show:
- The word "ElevenLabs"
- The upstream tier name (`starter`, `creator`, `pro`)
- The character-count semantics ("X characters used")

The UI must show:
- VoiceLab tier name (`Basic`, `Pro`, `Enterprise`)
- "X credits remaining of Y"
- "Renews on [date]"

Remapping happens at the boundary (`paidBalance` function above). The TypeScript types for what gets sent to the frontend explicitly use `"basic" | "pro" | "enterprise"`, never the upstream enum.

## When upstream returns 402

If a paid user's upstream quota is exhausted (they hit their plan's character limit mid-month), the upstream call returns 402. We pass this through with a clear UI:

```json
{
  "error": {
    "code": "UPSTREAM_QUOTA_EXHAUSTED",
    "message": "You've used this month's credits. They'll renew on May 21, 2026.",
    "details": {
      "resetAt": "2026-05-21T00:00:00Z"
    }
  }
}
```

Frontend renders a "Out of credits this month" state with the reset date. No upgrade CTA shown (they're already paying); the message is informational.

If the user wants more before reset, they can:
1. Wait until reset
2. Manually request an upgrade (operator moves their account to next upstream tier, admin updates `users.tier` and re-pastes a new key)

Self-serve mid-cycle upgrades are a Phase 16+ feature (requires Stripe checkout flow).

## Voice slots (cloning quota)

Cloning consumes a voice slot upstream, not characters. The slot count comes from the same `getSubscription()` call:

```ts
const sub = await getSubscriptionForUser(userId);
const slotsRemaining = sub.voiceLimit - sub.voiceUsed;

if (slotsRemaining <= 0) {
  throw new AppError(
    "VOICE_SLOT_FULL",
    "You've used all your voice slots. Delete an existing voice to add a new one.",
    409,
  );
}
```

This is checked client-side too (the "New Voice" button is disabled when slots are full).

## Tests required

In `apps/api/test/integration/paid-balance.test.ts`:

1. Paid user's `GET /credits/balance` queries upstream, returns relabeled values
2. Cache hit on second call within 60s
3. Cache invalidated when admin updates user's API key
4. Upstream 402 surfaces as `UPSTREAM_QUOTA_EXHAUSTED`
5. Free user calling `getSubscriptionForUser` is rejected (or returns Free-shaped response — design choice)
6. Voice slot count returned correctly for cloning gate
