# System Architecture

The only cross-cutting doc in this repo. Every other detail lives inside skill `references/` directories.

## Overview

VoiceLab is a managed AI voice generation product. Users register, verify email, and use voice cloning + text-to-speech. Behind the scenes, each paying user has their own upstream voice AI subscription — operator-provisioned, hidden from the user. Free users share a single demo account. The upstream provider's name (ElevenLabs) never appears in user-facing surfaces.

Three layers: Next.js 16 frontend (marketing + app + admin), Bun + Hono backend, PostgreSQL + Redis data layer. Files start on local FS and migrate to S3 / R2 at scale.

## High-level diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                              Browser                                │
│  Next.js 16 — three route groups:                                   │
│    (marketing)/   public · landing · pricing · register · login ·   │
│                   verify-email                                      │
│    (app)/         verified users · recordings · voices ·            │
│                   generations · credits · billing                   │
│    (admin)/       admin-only · members · API key provisioning ·     │
│                   audit · metrics                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS · httpOnly session cookie
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Backend (Bun + Hono)                          │
│  Middleware: requireAuth · requireVerified · requireAdmin ·         │
│              rate limit · logger · error handler                    │
│  Routes:     /auth · /credits · /recordings · /voices ·             │
│              /generations · /files · /admin/* · /health             │
│  Services:   VoiceAIService · StorageAdapter · SessionService ·     │
│              FreeCreditsService · EmailService · EncryptionService ·│
│              AuditLogService                                        │
└──┬───────────┬──────────────┬────────────────┬─────────────────────┘
   │           │              │                │
   ▼           ▼              ▼                ▼
┌──────────────┐  ┌──────────┐  ┌─────────────────────────────────┐
│  PostgreSQL  │  │  Redis   │  │   Upstream voice AI provider    │
│  (Drizzle)   │  │ sessions │  │   (ElevenLabs — name silent)    │
│              │  │  cache   │  │                                 │
│  users       │  │  rate    │  │   Paid users  → per-user keys   │
│  email_      │  │  limits  │  │     (AES-encrypted in DB,       │
│   verifi-    │  └──────────┘  │      decrypted per request)     │
│   cations    │                │   Free users  → shared demo key │
│  recordings  │  ┌─────────────────────────────────────────────┐ │
│  voices      │  │ Email transport                             │ │
│  generations │  │   Dev: Mailpit (localhost:1025)             │ │
│  credits     │  │   Prod: Resend (smtp.resend.com)            │ │
│  admin_audit │  └─────────────────────────────────────────────┘
│   _log       │
└──────────────┘  ┌─────────────────────────────────────────────┐
                  │  Storage (env-selected)                     │
                  │  Local FS  →  S3 / R2                       │
                  │  via StorageAdapter interface               │
                  └─────────────────────────────────────────────┘
```

## Principles

1. **Brand silence.** The upstream provider's name is never displayed in UI, marketing, emails, or surfaced errors. Internal docs and code can name it; user-facing surfaces use "voice service" or VoiceLab-branded labels.
2. **Per-user upstream isolation.** Each paying user has their own upstream subscription, key, and quota. No shared pool. No cross-user side effects.
3. **Authoritative state lives upstream for Paid users.** We don't duplicate character counting — the upstream provider does it. We surface their `getSubscription()` response (relabeled).
4. **App-level credit tracking is scoped to Free.** Free users have a small mutable balance in our DB; the upstream demo account is shared and we don't try to allocate it precisely.
5. **Email verification is the abuse gate.** No admin approval, no waiting room. Verify your email, get 1,000 free credits, start using the product.
6. **Encryption at rest for API keys.** AES-256-GCM. Decrypted only at request time. Never logged. Never returned in responses.
7. **Skills own how-to detail.** This doc is "what" and "why". The skills' `references/` are "how".
8. **Storage portable.** All file I/O through `StorageAdapter`. Local for dev, S3 / R2 in prod, swap by env.

## Data flow — happy path (paid user generates speech)

```
1. User clicks "Generate" in /app/voices/abc → POST /voices/abc/generate
2. requireAuth (cookie → Redis session → userId)
3. requireVerified (user.status === "active")
4. Rate limit check (60/hr/user)
5. Route handler:
   a. Look up voice ownership (voice.userId === userId)
   b. Look up user.tier — if Free, run Free quote + balance check
   c. For Paid: skip app-level check (upstream enforces)
6. voiceAI.generateSpeech(userId, voiceId, text, settings)
   a. getClientForUser(userId) → decrypts user.elevenlabsApiKey, returns scoped client
   b. client.textToSpeech.convert.withRawResponse(...) (with retry)
   c. Returns { audio: stream, characterCount }
7. storage.put("audio/{userId}/gen/{uuid}.mp3", stream)
8. db.insert(generations) with characterCount, voiceId, settings, fileKey
9. If Free: freeCreditsService.charge(userId, characterCount, { generationId })
10. Return 201 { generation: { id, url, ... } }
```

## Data flow — sign-up

```
1. User submits /register → POST /auth/register
2. Rate limit (3/hr/IP)
3. Insert user with status="unverified"
4. Generate token, store bcrypt hash in email_verifications (24h TTL)
5. EmailService.send({ to: user.email, template: "verify", link: APP_URL + "/verify?token=" + raw })
6. Return 201 { success: true }

(Dev: email lands in Mailpit UI at localhost:8025)

7. User clicks link → GET /auth/verify?token=raw
8. Find unconsumed, unexpired token matching bcrypt.compare
9. Transaction:
   a. update users SET status="active", emailVerifiedAt=NOW()
   b. update email_verifications SET consumedAt=NOW()
   c. insert credits (userId, balance=1000) ON CONFLICT DO NOTHING
10. 302 → /login?verified=1
11. User logs in → /app dashboard, 1,000 credits showing
```

## Data flow — paid user upgrade

```
1. Free user clicks "Upgrade to Pro" → /app/billing (Phase 16+: Stripe checkout; MVP: contact form)
2. Operator receives notification
3. Operator (manual, ~5–10 min):
   a. Opens upstream provider dashboard
   b. Creates new account with email alias (operator+vlu123@gmail.com)
   c. Subscribes to Creator plan ($22)
   d. Copies API key
4. Operator opens VoiceLab admin → /admin/users/{id}
5. Operator clicks "Activate Account" wizard
   a. Pastes API key
   b. Selects plan: "Creator"
6. PUT /admin/users/{id}/api-key
   a. encryptApiKey(raw) → ciphertext
   b. update users SET elevenlabsApiKey=ciphertext, elevenlabsPlan="creator",
                       tier="pro", activatedAt=NOW()
   c. delete from credits WHERE userId (paid users have no app-level credits)
   d. redis.del(subscription:{userId})
   e. audit log "SET_API_KEY" (no raw key in metadata)
7. EmailService.send({ to: user.email, template: "upgraded" })
8. User refreshes → sees Pro tier, fresh quota
```

## State machine — user.status

```
[register] → unverified
              │
              │ click verify link (within 24h)
              ▼
            active ◄────┐
              │         │ admin unsuspends
              │ admin suspends
              ▼
            suspended ──┘
```

There is no admin approval step. There are no `pending`/`declined` states.

`unverified` users cannot reach `/app/**`. They are redirected to `/verify-email` where they can resend the verification email (rate limited: 1/min/email, 5/day/email).

## State machine — user.tier

```
[register/verify] → free (1,000 one-time credits)
                       │
                       │ admin sets API key with plan="starter"
                       ▼
                     basic ◄──── admin removes API key
                       │
                       │ admin sets API key with plan="creator"
                       ▼
                      pro ◄──── admin sets API key with plan="starter" → back to basic
                       │
                       │ admin sets API key with plan="pro" or "scale"
                       ▼
                  enterprise
```

Tier transitions are admin-driven (paste-key-flow). Free credits are NEVER re-granted on downgrade — you only get them once.

## Scaling roadmap

The simplest thing that works first. Each step triggered by concrete pain.

| Trigger | Action |
|---------|--------|
| > 20 paying users | Phase 16: Stripe self-serve checkout (operator still pastes keys) |
| Local disk > 50% OR > 100 users | Phase 17: S3 / R2 migration |
| Operator provisioning time > 2 hr/week | Playwright semi-automation of upstream signup |
| > 50 paying users | Authorized Reseller conversation with upstream (volume pricing) |
| API key on same card > 5 accounts | Switch to Wise/Revolut virtual cards per account |
| Redis ops > capacity | Move from local Docker to Upstash |
| DB > 10 GB | Move from local Postgres to Neon |
| Free demo account > 80% quota mid-month | Upgrade demo from Creator ($22) to Pro ($99); OR cap Free signups |

## Trust boundaries

| Boundary | Trust direction |
|----------|-----------------|
| Browser → Backend | Backend trusts nothing from client; validate every input via zod |
| Backend → DB | Drizzle with parameterized queries; row-level ownership in every read |
| Backend → Upstream | Per-user API key, encrypted at rest; never exposed to frontend |
| Backend → Redis | Cache and session, no PII beyond userId |
| Backend → Email transport | Transactional only; no marketing emails |
| Admin → Audit log | Every admin write produces a row; raw API keys never written to audit |

## What this doc does NOT cover

- Specific API contracts → `.claude/skills/backend-development/references/api-contract.md`
- Drizzle schema → `.claude/skills/backend-development/references/drizzle-schema.md`
- ADR-level decisions → `docs/decisions/`
- Day-to-day workflow → `PLAN.md`, `CLAUDE.md`
- Skill-specific patterns → individual `SKILL.md` files
