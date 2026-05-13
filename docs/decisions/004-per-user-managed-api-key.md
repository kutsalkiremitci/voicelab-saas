# ADR-004: Per-User Managed ElevenLabs Account

**Date:** 2026-05-13
**Status:** Accepted

## Context

VoiceLab is a managed reseller of voice AI. End users pay VoiceLab; behind the scenes, each paying user has their own ElevenLabs subscription that the operator provisions. End users never see the word "ElevenLabs," never see API keys, never receive emails from the upstream provider.

This replaces an earlier design (now retired) that used a single shared ElevenLabs key for all users — that design conflicted with the OEM Terms restriction on Free/Starter/Creator/Pro tiers making the service "available to third parties."

## Decision

**One ElevenLabs account per paying user.** Operator manually provisions each account, stores the API key encrypted, and the VoiceLab backend uses that user's specific key for every upstream call.

Free tier is the only exception: it routes through one shared demo account funded by the operator, used only for Free trial credits (1,000 per email-verified user, non-renewing).

### Why this is ToS-compliant

ElevenLabs' own published policy:

> *"Users may open multiple paid accounts ... Each account has to be associated with a different email address."*

We are operating exactly as ElevenLabs permits:
- Each paying user has their own paid account (different email = different account)
- Each account has its own quota, slots, and billing
- The operator legitimately pays ElevenLabs for each subscription (Starter $6, Creator $22, Pro $99)

We do not aggregate quota across accounts, do not share API keys between users, do not claim authorized reseller status. We're providing a UX wrapper.

### What we're NOT doing

- ❌ Sharing one API key across many users (the retired design)
- ❌ Pooling quota or rate-limiting upstream artificially
- ❌ Claiming to be ElevenLabs or its partner / agent
- ❌ Using ElevenLabs branding in our UI
- ❌ Offering BYOK (users pasting their own keys) — that's a different model, deferred

### Free tier exception

Free users share a single demo ElevenLabs account (operator-funded, Creator tier $22/month for headroom). Mitigation against quota abuse:

1. **Mandatory email verification** — no API call ever made for an unverified user
2. **One-time 1,000 credit allowance** — never renews; cannot be replenished
3. **One credit grant per email address** — DB-level `UNIQUE(email)` on `users`
4. **Demo account quota monitoring** — operator alert if shared account exceeds 80% mid-month

A free user effectively gets one minute of TTS to evaluate the product. After that, upgrade or stop.

## Operational protocol — when a user upgrades

When a user upgrades from Free to a paid tier (Basic / Pro) — initially via "request upgrade" button, later via Stripe Checkout:

```
1. User pays VoiceLab (Stripe or manual record)
2. Admin receives notification, opens admin panel → user detail
3. Admin opens ElevenLabs in a separate tab
4. Admin creates a new ElevenLabs account with operator email alias
   (e.g. operatoremail+vlu123@gmail.com)
5. Admin subscribes that account to the matching upstream tier
   (Basic → Starter $6, Pro → Creator $22)
6. Admin copies the generated API key
7. Admin pastes key into admin panel: PUT /admin/users/:id/api-key
   Backend AES-encrypts the key and stores in users.elevenlabsApiKey
8. Admin sets users.tier to "basic" or "pro" and users.activatedAt = now()
9. User is notified by email: "Your account is upgraded"
```

Time per user upgrade: 5–10 minutes. Acceptable up to ~50 users; automation deferred (ElevenLabs has no signup API).

### Email alias strategy

The operator never uses real customer emails for upstream accounts. The operator uses **Gmail plus-addressing** (`operatorname+vlu001@gmail.com`, `+vlu002`, etc.) which all route to the operator's single inbox. This means:

- ElevenLabs verification / billing emails go to the operator, not the customer
- The customer never receives any ElevenLabs communication
- The "ElevenLabs" brand is never exposed to the customer

### Payment method

For the first 5–10 accounts: operator's own card. Beyond that, fraud detection on ElevenLabs may flag multiple accounts on the same card. Mitigation:
- Wise multi-currency virtual cards (different card number per account)
- Revolut / N26 disposable virtual cards
- Set an "operator wallet" budget per quarter

This is operational cost, not technical. Not worth automating until > 20 paying users.

## API key handling (security)

- Stored AES-256 encrypted at rest in `users.elevenlabsApiKey` (column type `text`, encrypted via app-level service)
- Encryption key in `ELEVENLABS_KEY_ENCRYPTION_SECRET` env (32-byte, separate from `SESSION_SECRET`)
- Decrypted only at request time, scoped to a single ElevenLabs call
- Never logged, never returned in any API response, never visible in admin UI (showed as `sk_•••••••• (hidden)`)
- Admin can "rotate" key (re-enter a new one from a fresh ElevenLabs account); old key is overwritten

## Risk catalog

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ElevenLabs flags multi-account-same-card | Medium (>5 accounts) | Account locked | Virtual cards from card 5+; document recovery in ops runbook |
| Operator inbox flooded with ElevenLabs emails | High | Annoyance | Gmail filter `elevenlabs.io → Label/Archive` |
| User's upstream account exhausted mid-month | Medium | Service interruption for that user | Pre-warn user at 80%, suggest upgrade |
| Encryption key leak | Very low | All keys decryptable | Rotate per ADR retrospective; key in secret manager in prod |
| User asks "are you using ElevenLabs?" | Low | Brand transparency conflict | Honest answer: "We use enterprise voice AI; we don't disclose providers." Avoids lying but doesn't confirm. |
| Free demo account exhausted by abuse | Medium | Free tier disabled | Email verification + 1K cap + per-email uniqueness; if breached, upgrade demo to Pro |

## What this enables future-state

- Per-user feature gating is natural (different upstream tiers = different upstream features)
- Migrating off ElevenLabs becomes per-user (no shared-state migration)
- Pricing changes upstream affect only new signups (existing keys keep their old subscription)
- BYOK ("bring your own key") is a future opt-in: admin endpoint accepts a user-provided key in place of the operator-provisioned one

## When to revisit

- **> 20 paying users:** consider Authorized Reseller conversation with ElevenLabs to formalize the relationship (potentially better volume pricing)
- **Operator time > 1 hour/week on account provisioning:** evaluate hiring a VA or building a semi-automated workflow (Playwright + 1Password for the manual ElevenLabs signup)
- **Customer requests transparency** ("what AI do you use?"): re-evaluate brand strategy

## Owner

Operator owns the upstream account ledger (which user → which ElevenLabs account → which payment method). A simple offline spreadsheet is sufficient at MVP scale. Engineering owns key encryption and the admin endpoint.
