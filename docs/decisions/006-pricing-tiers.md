# ADR-006: Pricing Tiers (4-tier — Free / Basic / Pro / Enterprise)

**Date:** 2026-05-13
**Status:** Accepted

## Context

VoiceLab operates as a managed reseller of ElevenLabs (per-user upstream accounts; see ADR-007). End users see VoiceLab branding only — ElevenLabs is never named in the UI. Pricing must achieve four things at once:

1. Let users try the product without payment (Free tier with friction-low onboarding)
2. Be predictably profitable per active paying user
3. Map cleanly to an upstream ElevenLabs subscription tier we provision
4. Prevent free-tier abuse (signups burning quota without intent to convert)

## Decision — four tiers

| | **Free** | **Basic** | **Pro** | **Enterprise** |
|---|----------|-----------|---------|----------------|
| User price | $0 | $15/mo | $59/mo | Custom |
| Internal upstream plan | shared demo account | ElevenLabs Starter ($6) | ElevenLabs Creator ($22) | ElevenLabs Pro/Scale ($99–$299) |
| Credit allowance | **1,000 (one-time, non-renewing)** | 30,000 / month | 121,000 / month | Custom |
| Default voice library | yes | yes | yes | yes |
| **Instant Voice Cloning (IVC)** | no | **yes** | yes | yes |
| **Professional Voice Cloning (PVC)** | no | no | **yes** | yes |
| Speech-to-Speech | no | yes | yes | yes |
| Dubbing studio | no | yes | yes | yes |
| Saved projects | 0 | 20 | 1,000 | 3,000+ |
| Audio quality | standard 128kbps | standard 128kbps | high 192kbps | studio 44.1kHz PCM |
| Commercial license | no | yes | yes | yes |
| Priority support | no | no | email | dedicated |

Sign-up requires **email verification** (token-link from a real inbox). After verification the user is `active` and 1,000 free credits are granted. No admin approval.

## Why these numbers

### Free tier = single-use 1,000 credits

- ~1 minute of TTS to evaluate quality.
- Non-renewing: when the 1,000 are spent, the user must upgrade. Renewing monthly would invite quota abuse with throwaway emails.
- All Free traffic runs through a single shared "demo" ElevenLabs account that the operator funds (Creator tier, $22/month → 121K characters/month → covers ~120 concurrent free users at the 1K allowance).
- **Email verification is the abuse gate.** No verification → no credits → no API call ever made. One credential per email enforced at DB level (`UNIQUE(email)`).

### Cloning available from Basic

ElevenLabs Starter ($6) includes Instant Voice Cloning at the upstream layer. We don't artificially withhold it — the user is paying for it. Hiding cloning from Basic would be a feature-fake; users would discover that we're rate-limiting something they already paid for, and trust dies fast.

### PVC at Pro for upgrade pressure

Professional Voice Cloning is upstream-gated to Creator+, and produces a meaningfully better clone (30+ min audio sample → near-indistinguishable replica). This is the natural Basic→Pro upgrade story: "you already have IVC; upgrade for studio-grade cloning."

### Pricing math

| Tier | User pays | Upstream cost | Stripe (2.9% + $0.30) | Approx infra share | Net | Margin |
|------|-----------|---------------|------------------------|---------------------|------|--------|
| Free | $0.00 | shared (~$0.20/user at 50% util) | $0 | $0.05 | **−$0.25** | acquisition cost |
| Basic | $15.00 | $6.00 | $0.74 | $0.20 | **$8.06** | 54% |
| Pro | $59.00 | $22.00 | $2.01 | $0.40 | **$34.59** | 59% |
| Enterprise | varies | varies | varies | varies | **per-deal** | 50–70% target |

Free is a planned loss (~$0.25/user acquisition cost). Break-even on a Free user converting to Basic = 1 month. Conversion of 20%+ Free→Basic makes the model healthy.

### Cohort scenario (100 users)

```
85 Free × −$0.25   = −$21.25
10 Basic × $8.06   = $80.60
 4 Pro × $34.59    = $138.36
 1 Enterprise      = $100 (assumed mid-range)
─────────────────────────────────────
Net MRR:           = $297.71 (~$3,572/year on 100 users)
```

Heavier paid mix (30% paid) brings net MRR to ~$800/month. See `docs/profitability.md` for the full model.

## Email verification design

- Sign-up: user submits email + password → row created with `status: unverified`
- System sends a verification email containing a one-time token (24-hour expiry)
- User clicks link → `GET /auth/verify?token=...` → status flips to `active`, 1,000 credits granted, redirect to `/app`
- Until verified: login returns 403 `ACCOUNT_UNVERIFIED` with a "resend email" CTA
- Resend rate-limited: 1 email per 60 seconds, max 5/day per email address
- Token table: `email_verifications(id, userId, tokenHash, expiresAt, consumedAt)`
- Tokens stored as bcrypt hash; raw token only ever exists in the email link

**Local dev:** Mailpit (Docker, intercepts all outbound SMTP, exposes a web UI for inspecting emails).
**Production:** Resend.com (free up to 3K emails/month, $20/month for 50K). Adapter pattern in `email-service` so switching providers is a 1-line env change.

## Plan rebranding (UI-facing, never mentions ElevenLabs)

Internal ElevenLabs feature → VoiceLab UI label:

| ElevenLabs term | VoiceLab UI term |
|------------------|-------------------|
| Studio Projects | Saved Projects |
| Voice Library | Voice Catalog |
| Instant Voice Cloning | Quick Voice Clone |
| Professional Voice Cloning | Studio Voice Clone |
| Speech-to-Speech | Voice Conversion |
| Multilingual v2 | Standard model |
| Flash / Turbo | Realtime model (future) |
| Dubbing studio | Multi-language dubbing |
| Sound Effects | Sound generator (future) |
| Music | Music generator (future) |

The marketing copy talks about "AI voice technology" generically. ElevenLabs is not credited anywhere in the user-facing surface.

## Overage behavior

**Hard stop at zero credits.** Next call returns 402 `INSUFFICIENT_CREDITS` with "upgrade your plan" CTA. No metered overage in MVP.

For users who hit Free's 1,000 ceiling: UI shows "You've used your trial credits. Upgrade to Basic to continue."

For paid users who exhaust monthly allowance: UI shows "You've used this month's credits. They'll renew on [date], or upgrade for more."

## What this does NOT decide

- **Annual billing** — Phase: Stripe lands (deferred). Estimate 2 free months annually.
- **TL pricing (Iyzico)** — separate decision when Turkish market is targeted.
- **Coupon codes / referrals** — backlog.
- **Top-up packs** — placeholder in `billing-and-credits/references/stripe-future.md`.

## When to revisit

- **First 20 paying users:** check Free→Basic conversion rate. If < 10%, Free allowance is too small or value isn't clear. If > 30%, prices may be low — consider raising.
- **Shared demo quota near limit:** if the Free demo account regularly hits 80% of its monthly quota mid-month, upgrade demo from Creator to Pro ($22 → $99) or cap monthly Free signups.
- **Margin compression:** ElevenLabs rate change → recalculate within 30 days.
- **Enterprise inquiries:** track manually. If > 3 inquiries/month, formalize Enterprise into the pricing page rather than "Contact sales."

## Owner

Operator owns pricing. Engineering enforces tier limits as configuration (env, DB), not hardcoded. Price changes do not require a deploy.
