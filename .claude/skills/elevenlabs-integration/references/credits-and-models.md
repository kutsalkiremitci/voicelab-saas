# Credits, Models & Tier Limits

Under the per-user managed account model (ADR-004), upstream cost and quota are scoped to **each user's own subscription**, not a shared pool. This file documents the upstream pricing reference (so engineers know what an operator pays per tier), the model selection policy, and the tier-level limits enforced at the route layer.

## Upstream cost reference (operator-facing)

What the operator pays per ElevenLabs account, by plan:

| Upstream plan | Monthly cost | Multilingual v2 chars | Flash / Turbo chars | Slots (IVC + PVC) |
|---------------|--------------|-----------------------|---------------------|-------------------|
| Starter | $6 | 30,000 | 60,000 | 10 IVC, 0 PVC |
| Creator | $22 | 121,000 | 242,000 | 30 IVC, 1 PVC |
| Pro | $99 | 600,000 | 1,200,000 | 160 IVC, 1 PVC |
| Scale | $299 | 1,800,000 | 3,600,000 | 160 IVC, 3 PVC |

Maps to VoiceLab tiers:

| VoiceLab tier | Maps to upstream | What user pays |
|---------------|-------------------|----------------|
| Free | shared demo (Creator, operator-funded) | $0 |
| Basic | Starter | $15 |
| Pro | Creator | $59 |
| Enterprise | Pro or Scale (per-deal) | Custom |

See `docs/profitability.md` for full unit economics.

## Per-user quota isolation

Because each paying user has their own upstream account:
- Their `characterLimit` is the upstream plan's monthly limit
- Their `voiceLimit` is the upstream plan's slot count
- One user's heavy usage never affects another user's quota
- Concurrent generations are naturally isolated (each upstream account has its own concurrency cap)

This eliminates the "shared pool" coordination problem that the earlier model had.

## Model exposure plan

| Model | Status in MVP | Per-character cost | Notes |
|-------|---------------|---------------------|-------|
| `eleven_multilingual_v2` | **Default for all tiers** | 1 char = 1 char | Highest quality, strongest Turkish |
| `eleven_turbo_v2_5` | Hidden (Phase 2) | 0.5 char | Lower latency, half upstream cost |
| `eleven_flash_v2_5` | Hidden (Phase 2) | 0.5 char | Lowest latency, half upstream cost |

In MVP, only `eleven_multilingual_v2` is exposed. Flash/Turbo open in a later phase if:
- Real-time use cases emerge (Phase 3 product surface)
- Cost optimization becomes desirable (operator passes 50% savings to user)

### Why Multilingual v2 only at launch

- **Highest quality** — voice fidelity matters more than latency for cloning use case
- **Strongest Turkish support** — primary market consideration
- **Pricing simplicity** — one rate per character, simpler UI ("X credits = Y characters")
- **Stable behavior** — Flash/Turbo's lower latency comes with subtle quality trade-offs that need user-facing settings (model selector). Defer until MVP is stable.

## Tier limits enforced at route layer

These limits live in the route handler, NOT in this skill. The voice-ai service trusts the caller. Documented here as a reference for what the route MUST check before calling the service:

```ts
// Pseudo-code for route enforcement
function checkTier(user: User, op: string) {
  if (op === "tts") {
    return true; // All tiers
  }
  if (op === "clone-ivc") {
    if (user.tier === "free") throw new AppError("TIER_LIMIT", "Upgrade to clone", 403);
    return true; // Basic, Pro, Enterprise
  }
  if (op === "clone-pvc") {
    if (user.tier === "free" || user.tier === "basic") {
      throw new AppError("TIER_LIMIT", "Studio Voice Clone requires Pro tier", 403);
    }
    return true; // Pro, Enterprise
  }
  if (op === "speech-to-speech") {
    if (user.tier === "free") throw new AppError("TIER_LIMIT", "Upgrade to use Voice Conversion", 403);
    return true; // Basic, Pro, Enterprise
  }
}
```

The matrix:

| Operation | Free | Basic | Pro | Enterprise |
|-----------|------|-------|-----|------------|
| TTS (default voices) | ✅ | ✅ | ✅ | ✅ |
| TTS (own clones) | ❌ (no clones) | ✅ | ✅ | ✅ |
| IVC (Quick Voice Clone) | ❌ | ✅ | ✅ | ✅ |
| PVC (Studio Voice Clone) | ❌ | ❌ | ✅ | ✅ |
| Speech-to-Speech | ❌ | ✅ | ✅ | ✅ |
| Dubbing | ❌ | ✅ | ✅ | ✅ |
| 192 kbps output | ❌ | ❌ | ✅ | ✅ |
| 44.1 kHz PCM output | ❌ | ❌ | ❌ | ✅ |

## Voice slot lifecycle

Per upstream plan, voice slots are limited (Starter: 10, Creator: 30, Pro: 160). When a user hits the limit:

```ts
const sub = await getSubscriptionForUser(userId);
if (sub.voiceUsed >= sub.voiceLimit) {
  throw new AppError(
    "VOICE_SLOT_FULL",
    "You've used all your voice slots. Delete an existing voice to add a new one.",
    409,
  );
}
```

The user resolves this themselves by deleting an existing voice (`DELETE /voices/:id`). If they regularly hit the limit, they upgrade to a higher tier (operator provisions a higher upstream plan).

## Free tier demo account budget

The shared Free demo account (operator-funded, Creator tier $22/month → 121K credits) supports approximately 120 simultaneous Free users at the 1,000-credit allowance. Monitoring:

- Operator alerted when demo `characterCount / characterLimit` crosses 80%
- Mid-month exhaustion → temporarily upgrade demo to Pro tier ($99 → 600K credits) OR cap new Free signups
- Long-term solution: better Free→Basic conversion, less Free usage per user

The demo account also holds the **default voice catalog** voices (the curated set Free and Basic users see in the Voice Catalog). These are not "cloned" voices but ElevenLabs library voices accessible via the demo key.

## Compliance

- Upstream outputs include an inaudible watermark (anti-deepfake) — this is invisible to us and the user
- Product TOS requires users to attest "this is my voice" before cloning their own voice
- Per-user upstream accounts: see `docs/decisions/004-per-user-managed-api-key.md`

## When to revisit

- A specific user's upstream account regularly exhausts mid-month → operator upgrades that user's upstream tier (and admin updates `users.tier` if it changes the VoiceLab tier)
- Free demo quota > 80% utilization → see "Free tier demo account budget" above
- Real-time use case emerges → enable Flash/Turbo models with a model selector
- Operator wants to lower per-user upstream cost → switch default model from Multilingual v2 to Turbo v2.5 (half cost, slight latency win, similar quality for most cases)
