# ADR-007: Email Verification & Abuse Prevention

**Date:** 2026-05-13
**Status:** Accepted

## Context

The Free tier (1,000 credits per email, one-time, non-renewing) is the open door of VoiceLab. Without abuse prevention, a single bad actor with throwaway emails could:
- Create 100 accounts → consume 100,000 free credits → cost VoiceLab the equivalent of $10 in upstream cost (small now, but linear)
- Burn through the shared demo account's monthly quota, blocking legitimate Free users
- Train internal abuse detection blindspots before we have real production data

The fix: email verification is the abuse gate. No verification → no credits → no API call ever made.

Admin approval (the earlier design) is removed entirely. It was operator-hostile (manual click for every signup) and didn't actually solve abuse — an admin can't distinguish "legitimate hobbyist" from "abuser" at signup time.

## Decision

### Sign-up flow

1. User submits form: `email`, `password`, optional `name`
2. `POST /auth/register` →
   - Validate email format, password strength
   - Reject if email already exists (`UNIQUE` constraint, returns 409 `EMAIL_TAKEN`)
   - Create user with `status: "unverified"`, `tier: "free"`, no credits row yet
   - Generate cryptographically random token (32 bytes, base64url)
   - Store `bcrypt(token)` in `email_verifications` with 24h expiry
   - Send email with link: `${APP_URL}/verify?token=${rawToken}`
   - Return 201 (no error info that would let an attacker enumerate emails)
3. User receives email, clicks link
4. `GET /auth/verify?token=...` →
   - Find unconsumed, unexpired verification matching `bcrypt.compare(token, hash)`
   - If found: mark consumed, flip `users.status` to `active`, insert `credits` row with `balance: 1000`
   - If not: 404 with generic "link invalid or expired" message
5. User redirected to `/login?verified=1`, can log in immediately

### Login restrictions

- `unverified` user attempts login → 403 `ACCOUNT_UNVERIFIED` with "Resend verification email" CTA
- `suspended` user attempts login → 403 `ACCOUNT_SUSPENDED`
- `active` user logs in normally

`pending` / `declined` statuses removed (no admin approval anymore). Status enum is now `{ unverified, active, suspended }`.

### Resend verification

- `POST /auth/resend-verification` body `{ email }`
- Rate limited: **1 per 60 seconds per email**, **max 5 per day per email**
- Always returns 200 (avoid leaking which emails exist)
- Generates new token, invalidates old token
- Side effect: email always sent if the email matches a real `unverified` user

### Token security

- Tokens are 32 bytes (~256 bits entropy) — unguessable
- Stored as bcrypt hash; raw token only ever transits via the email link
- Single-use: `consumedAt` set on successful verify; expired tokens cannot be reused
- Expiry: 24 hours from generation
- A user can have multiple unconsumed tokens (each resend issues a fresh one); only one needs to succeed

## Schema

### `email_verifications`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| userId | uuid FK → users.id | ON DELETE CASCADE |
| tokenHash | text | bcrypt of the raw token |
| expiresAt | timestamptz | grant time + 24h |
| consumedAt | timestamptz | nullable; set on successful verify |
| createdAt | timestamptz | |

Indexes: `(userId)`, `(expiresAt)` for cleanup cron.

### Users table additions

```ts
status: text("status", { enum: ["unverified", "active", "suspended"] }).notNull().default("unverified"),
emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
```

The previous `pending / approved / declined / suspended` enum is replaced. There is no admin approval step — verifying email is what activates the account.

## Email transport

### Local development → Mailpit

[Mailpit](https://github.com/axllent/mailpit) is a tiny Docker container that:
- Accepts SMTP on `localhost:1025`
- Provides a web UI at `localhost:8025` for inspecting every email the dev server sends
- No actual emails leave the machine

Added to `docker-compose.yml`:

```yaml
services:
  mailpit:
    image: axllent/mailpit:latest
    ports: ["1025:1025", "8025:8025"]
    restart: unless-stopped
```

Backend `.env.local`:

```
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=VoiceLab <hello@voicelab.local>
```

### Production → Resend

[Resend](https://resend.com) — free up to 3,000 emails / month, $20 / month for 50,000. Modern API, deliverability is solid.

Production env (managed by secret manager):

```
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_xxx...
EMAIL_FROM=VoiceLab <hello@voicelab.com>
```

The backend uses a single `EmailService` abstraction (Nodemailer under the hood). Provider change = env-only.

## Anti-abuse layers (defense in depth)

1. **Email verification (this ADR)** — primary gate
2. **`UNIQUE(email)` at DB level** — no duplicate accounts via the same email
3. **Rate limits**:
   - `POST /auth/register`: 3/hour/IP
   - `POST /auth/resend-verification`: 1/min/email, 5/day/email
   - `POST /auth/login`: 5/min/IP (existing)
4. **Disposable-email blocklist** (Phase 2, optional): maintain a list of known throwaway-email domains (mailinator.com, etc.) and reject at register-time. Updated quarterly from a public list (e.g. github.com/disposable-email-domains/disposable-email-domains).
5. **Free credits granted only after verification** — unverified accounts never consume API calls
6. **Shared demo account quota monitoring** — operator alerted at 80% of monthly limit

If layer 1 (verification) is consistently bypassed in practice, layer 4 (blocklist) is the next move. Beyond that, CAPTCHA at register-time. None of this is in MVP — verification is the only abuse gate at launch.

## What this does NOT cover

- **Password reset flow** — separate ADR if/when needed; same email infrastructure, different token type
- **Email change flow** — Backlog
- **Social login (Google/Apple)** — Backlog. Would supplement, not replace, email verification
- **Two-factor authentication** — Not in MVP

## When to revisit

- **Free abuse signals appear** (e.g. > 30% of Free signups never spend credits → throwaway emails creating accounts and abandoning) → add disposable email blocklist
- **Email deliverability issues** (Resend bounces > 2%) → review sender reputation, SPF/DKIM/DMARC
- **Production email volume > 3,000/month** → upgrade Resend or evaluate Postmark
- **A real user complains "I never got the email"** → support flow: admin can manually verify via `PATCH /admin/users/:id { status: "active" }`. Audit-logged.

## Owner

Backend developer owns the verification flow and EmailService. The email template content (the actual email body) is operator-owned and lives in `apps/api/src/emails/`. Templates are simple HTML strings for MVP; React Email if/when complexity grows.
