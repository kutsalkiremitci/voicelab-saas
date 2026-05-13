# PLAN.md — VoiceLab

> Living document. Tick `[x]` as tasks complete.
> Solo developer · single `main` branch · feature branches merged back to `main`.
> Scope: managed voice AI product. Public registration with **email verification** (no admin approval), per-user upstream account for paid tiers, shared demo account for Free. Manual upgrade provisioning by operator (Stripe deferred to Phase 16).

**Stack:** Bun · Hono · Drizzle · PostgreSQL · Redis · Next.js 16 · Tailwind 4 · shadcn/ui · per-user upstream AI accounts · Mailpit (dev) / Resend (prod)

> Every phase ends with the `test-driven-development` cycle (unit + integration + lint + typecheck), then a user-approved smoke test, then the `git-workflow` end-of-phase report. These three are implicit at the end of every phase.

---

## Phase 0 — Bootstrap

**Skills:** `git-workflow`, `deployment`, `test-driven-development`
**Cross-cutting docs:** `docs/system-architecture.md`

- [x] Initialize Git repo, push to GitHub, set `main` as default
- [x] `.gitignore`, `.editorconfig`, `.nvmrc` / `.bun-version`
- [x] Monorepo layout: `apps/web`, `apps/api`, `packages/db`, `packages/shared`
- [x] Bun workspaces in root `package.json`
- [x] `.env.example` with all required variables
- [x] CI workflow stub (lint + typecheck + test)
- [x] `simple-git-hooks`: pre-push runs `bun run test && bun run lint && bun run typecheck`
- [x] Docker Compose for local Postgres + Redis + **Mailpit**
- [ ] Operator's demo ElevenLabs account created and key in `.env`

**Exit:** Empty monorepo, local DB up, CI runs on push.

---

## Phase 1 — Backend Foundation + Auth + Email Verification

**Skills:** `backend-development`, `email-and-verification`, `test-driven-development`

- [x] Bun + Hono server, env validated with zod (`apps/api/src/env.ts`)
- [x] Pino logger
- [x] Drizzle setup, `packages/db/src/schema.ts`
- [x] Tables: `users` (with `status`, `tier`, encrypted `elevenlabsApiKey`, `elevenlabsPlan`), `credits` (Free only), `email_verifications`, `recordings`, `voices`, `generations`, `admin_audit_log`
- [x] Migrations generated (`drizzle-kit`)
- [x] Seed script: first admin from `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`
- [x] Redis client + session service (sliding TTL)
- [x] AES-256 encryption service for API keys (`encryptApiKey`, `decryptApiKey`)
- [x] `EmailService` abstraction (nodemailer under the hood) + verification template
- [x] Middleware: `requireAuth`, `requireVerified`, `requireAdmin`
- [x] Routes:
  - [x] `POST /auth/register` (creates `unverified` user, sends verification email)
  - [x] `GET /auth/verify?token=...` (activates user, grants 1,000 Free credits)
  - [x] `POST /auth/resend-verification` (rate limited)
  - [x] `POST /auth/login` (rejects `unverified` / `suspended`)
  - [x] `POST /auth/logout`
  - [x] `GET /auth/me` (returns user + balance: Free → app credits, Paid → upstream remaining)
- [x] `GET /health` (db + redis + smtp check)
- [x] Global error handler, structured JSON errors
- [x] CORS configured

**Exit:** Register → email lands in Mailpit → click link → verified → can log in → 1,000 credits visible.

---

## Phase 2 — Storage Abstraction

**Skills:** `storage-adapter`, `backend-development`, `test-driven-development`

- [x] `StorageAdapter` interface (`put`, `get`, `delete`, `exists`)
- [x] `LocalStorageAdapter` (writes to `./storage`)
- [x] `S3StorageAdapter` skeleton (compiles, unit-tested with mock)
- [x] Key naming: `audio/{userId}/{kind}/{uuid}.{ext}`
- [x] MIME + magic-byte validation utility
- [x] Authenticated proxy endpoint: `GET /files/:type/:id` (ownership enforced)
- [x] Range request support (audio seeking)
- [x] Adapter swap by `STORAGE_DRIVER` env

**Exit:** Same API path works with local; S3 adapter passes unit tests.

---

## Phase 3 — Voice AI Service (per-user key resolution)

**Skills:** `elevenlabs-integration`, `backend-development`, `test-driven-development`

- [x] `bun add @elevenlabs/elevenlabs-js`
- [x] Service module `apps/api/src/services/voice-ai.ts`:
  - [x] `getClientForUser(userId)` — decrypts user's key, returns scoped `ElevenLabsClient`
  - [x] For Free users: returns client backed by `ELEVENLABS_DEMO_API_KEY`
  - [x] `cloneVoice(userId, name, files, kind)` — IVC for Basic+, PVC for Pro+
  - [x] `generateSpeech(userId, voiceId, text, settings)` — TTS hot path
  - [x] `speechToSpeech(userId, voiceId, audioFile, settings)` — voice conversion
  - [x] `deleteVoice(userId, voiceId)`
  - [x] `getSubscriptionForUser(userId)` (Redis 60s cache per user)
- [x] Retry on TTS / S2S (3 attempts, skip on 401/402/422)
- [x] `VoiceAIError` class + boundary wrapper
- [x] Test mocks under `apps/api/test/mocks/voice-ai.ts`

**Exit:** Service routes calls through the right key per user; mocked in tests.

---

## Phase 4 — Free Tier Credits

**Skills:** `billing-and-credits`, `backend-development`, `test-driven-development`

- [x] `credits` table migration applied (one row per Free user)
- [x] `FreeCreditsService`:
  - [x] `getBalance(userId)`
  - [x] `charge(userId, amount, reason, metadata)` (transactional, ON UPDATE no negative)
  - [x] `quote(operation, payload)` (pure)
- [x] On `GET /auth/verify` success → grant 1,000 credits row (insert-or-skip if exists)
- [x] Free users hit 402 with `INSUFFICIENT_CREDITS` when balance is below quote amount
- [x] Routes: `GET /credits/balance` returns `{ balance, plan, source: "free"|"upstream" }`

**Exit:** Free user can spend down to 0; 1001st character is rejected; Paid user sees upstream-derived balance.

---

## Phase 5 — Recording, Voice & Generation Endpoints

**Skills:** `backend-development`, `storage-adapter`, `elevenlabs-integration`, `billing-and-credits`, `test-driven-development`

- [x] `POST /recordings` (multipart upload)
- [x] `GET /recordings`, `PUT`, `DELETE`
- [x] `POST /voices` body `{ recordingId, label, kind: "ivc"|"pvc" }`
  - [x] Tier gate: Free → 403, Basic → IVC only, Pro+ → IVC or PVC
  - [x] Routes through `voice-ai.cloneVoice(userId, ...)`
- [x] `GET /voices`, `DELETE /voices/:id` (also deletes upstream)
- [x] `POST /voices/:id/generate` body `{ text, settings? }`
  - [x] Free: quote against `credits` table; Paid: rely on upstream metering
- [x] `POST /voices/:id/speech-to-speech` (Basic+)
- [x] `GET /generations`, `DELETE /generations/:id`
- [x] Rate limit middleware (Redis sliding window)
- [x] Per-user ownership enforced in every query

**Exit:** Verified user can record → (Basic+) clone → generate; tier gates enforced; Free user blocked from cloning.

---

## Phase 6 — Admin API

**Skills:** `backend-development`, `billing-and-credits`, `test-driven-development`

- [x] All routes under `/admin/*` guarded by `requireAdmin`
- [x] `GET /admin/users` (filters: status, tier, search, cursor)
- [x] `GET /admin/users/:id` (full detail including upstream subscription state)
- [x] `PATCH /admin/users/:id` body `{ status?, tier? }`
- [x] `PUT /admin/users/:id/api-key` body `{ apiKey, plan }` — encrypts, stores, activates tier
- [x] `DELETE /admin/users/:id/api-key` — removes encrypted key, downgrades user
- [x] `POST /admin/users/:id/credits` (one-shot grant for support cases, e.g. "comp 500 credits"; only works on Free)
- [x] `GET /admin/metrics` (signups today, conversions, total active tiers)
- [x] `GET /admin/audit` (paginated)
- [x] Every admin write produces an `admin_audit_log` row

**Exit:** Admin can list users, paste API keys to upgrade them, suspend, and view metrics via curl.

---

## Phase 7 — Frontend Foundation

**Skills:** `frontend-development`, `test-driven-development`

- [ ] Next.js 16 App Router (`apps/web`)
- [ ] Tailwind 4 + theme tokens
- [ ] shadcn/ui init + base primitives
- [ ] Geist or Inter via `next/font`
- [ ] Three route groups: `(marketing)/`, `(app)/`, `(admin)/`
- [ ] Layout shells per group (admin has visual context cue, amber accent)
- [ ] Theme provider (dark default)
- [ ] TanStack Query setup, API client (`lib/api.ts`) with credentials
- [ ] Toast (sonner)
- [ ] Middleware: redirect unauthed away from `/app/**` and `/admin/**`; redirect `unverified` users to `/verify-email`

**Exit:** Themed shells render; route guards work.

---

## Phase 8 — Auth Pages

**Skills:** `frontend-development`, `email-and-verification`, `test-driven-development`

- [ ] `/register` page — email + password + confirm
  - [ ] On success → redirect to `/verify-email`
- [ ] `/verify-email` page — "Check your inbox" + resend button
  - [ ] Resend button calls `POST /auth/resend-verification`
  - [ ] Rate-limit feedback ("wait 60s" if 429)
- [ ] `/verify?token=...` page — handles the GET, shows success/failure UI, redirects to `/app` on success
- [ ] `/login` page
  - [ ] On 403 `ACCOUNT_UNVERIFIED` → redirect to `/verify-email`
  - [ ] On 403 `ACCOUNT_SUSPENDED` → inline error
  - [ ] On 200 → redirect to `/app`
- [ ] `/login?verified=1` shows a success banner
- [ ] Logout button in topbar

**Exit:** Full register → email → click → app flow works.

---

## Phase 9 — Landing Page

**Skills:** `frontend-development`, `test-driven-development`

- [ ] `/` landing
  - [ ] Hero, features (3-4 cards), how it works (3 steps)
  - [ ] **Pricing section: 4 tier cards** (Free, Basic $15, Pro $59 [Most Popular], Enterprise [Contact sales])
  - [ ] "Who we are" section
  - [ ] Footer
- [ ] `/pricing` standalone page (same cards, larger, FAQ)
- [ ] Enterprise card CTA: `mailto:` link
- [ ] SEO meta + OpenGraph
- [ ] Mobile responsive
- [ ] **No mention of upstream provider anywhere**

**Exit:** Public site with concrete pricing; Enterprise inquiries route to operator email.

---

## Phase 10 — User Dashboard, Voice Catalog, Recording Studio

**Skills:** `frontend-development`, `audio-recording`, `billing-and-credits`, `test-driven-development`

- [ ] `/app` dashboard
  - [ ] Top cards: credits/quota, voices, generations
  - [ ] Recent activity table
  - [ ] **For Free user:** big "Upgrade" CTA when balance < 200 or exhausted
- [ ] `/app/library` — VoiceLab voice catalog (default voices) for everyone
- [ ] `/app/recordings` — recording studio (mic capture, waveform, save)
- [ ] `/app/voices` — list of user's clones (one row per voice)
  - [ ] "New Quick Clone" (Basic+) / "New Studio Clone" (Pro+) buttons
  - [ ] Tier-gated: Free sees "Upgrade to clone" tooltip
- [ ] `/app/generations` — table with filters, pagination, regenerate
- [ ] `/app/settings` — name, password change, email change (Phase 2)

**Exit:** Full clone + generate + history flow in UI.

---

## Phase 11 — Speech-to-Speech + Voice Settings

**Skills:** `frontend-development`, `elevenlabs-integration`, `test-driven-development`

- [ ] `/app/voices/:id` detail page
  - [ ] Tabs: "Generate from text" | "Convert audio" (S2S)
  - [ ] Voice settings: stability, similarity, style sliders + speaker boost
  - [ ] Speed control (0.7–1.2)
  - [ ] Output quality (tier-gated: standard for Basic, high for Pro, studio for Enterprise)
  - [ ] Credit quote for Free; for Paid, show remaining monthly allowance
  - [ ] Generate button (loading state)
  - [ ] Inline player + download

**Exit:** TTS and S2S flows complete with full settings UI.

---

## Phase 12 — Admin Panel

**Skills:** `frontend-development`, `billing-and-credits`, `test-driven-development`

- [ ] `/admin` overview
  - [ ] Cards: total users, today's signups, conversions, active subscriptions
  - [ ] Recent audit log
- [ ] `/admin/users` list (filters: status, tier, search)
- [ ] `/admin/users/:id` detail
  - [ ] Profile, status, tier
  - [ ] **"Activate Account" wizard** — paste API key, select plan, click activate
  - [ ] Suspend / unsuspend buttons
  - [ ] Add Free credits modal (support comp)
  - [ ] Recent activity (generations, last login)
- [ ] `/admin/audit` global audit log table

**Exit:** Operator can run the day-to-day flow via UI: review signups, paste keys to activate paid users, suspend bad actors.

---

## Phase 13 — Polish & Accessibility

**Skills:** `frontend-development`, `test-driven-development`

- [ ] Skeleton loaders on every async surface
- [ ] Empty states with CTAs
- [ ] Error states
- [ ] Keyboard navigation audit, focus rings, ARIA
- [ ] Mobile responsive across all three layouts
- [ ] Lighthouse > 90 on `/`, `/pricing`, `/app`

**Exit:** Presentation-quality UI.

---

## Phase 14 — E2E & Hardening

**Skills:** `test-driven-development`, `backend-development`, `frontend-development`, `deployment`

- [ ] Playwright E2E:
  - [ ] register → verify (read Mailpit API) → login → free generation → exhaust credits → 402
  - [ ] admin activates user (paste key) → user gets paid features
  - [ ] suspended user blocked
- [ ] Drizzle migration smoke test (fresh DB)
- [ ] Adapter swap test (local ↔ S3 mock)
- [ ] Rate limit tests
- [ ] Sentry wired (frontend + backend)

**Exit:** Green E2E suite; observability online.

---

## Phase 15 — Deployment

**Skills:** `deployment`, `git-workflow`, `test-driven-development`

- [ ] Dockerfile for `apps/api` and `apps/web`
- [ ] `docker-compose.prod.yml`
- [ ] Caddy reverse proxy + automatic SSL
- [ ] Managed Postgres (Neon)
- [ ] Managed Redis (Upstash)
- [ ] **Resend (or alternative)** email transport configured in prod
- [ ] Domain + DNS configured; SPF/DKIM/DMARC for email
- [ ] Production `.env` populated via secret manager
- [ ] Health monitoring + uptime alerts
- [ ] Backup cron (pg_dump → offsite)
- [ ] Deploy workflow in GitHub Actions

**Exit:** Public URL serves VoiceLab, monitored, email verification works in prod.

---

## Phase 16 — Stripe Integration (deferred)

> Trigger: > 20 paying users OR operator time on manual provisioning > 2 hours/week.

**Skills:** `billing-and-credits`, `backend-development`, `frontend-development`, `test-driven-development`

- [ ] Stripe account + products (Basic, Pro)
- [ ] `POST /billing/checkout` creates session
- [ ] `POST /billing/webhook` verifies signature, sends operator notification email
- [ ] `GET /billing/portal` returns billing portal URL
- [ ] `/app/billing` page
- [ ] Webhook idempotency table
- [ ] On `checkout.session.completed`: notify operator → operator manually provisions upstream account → admin pastes key (existing flow)

**Exit:** Users pay via Stripe; operator gets a clear "new paying customer, provision X" notification.

---

## Phase 17 — S3 Migration (deferred)

> Trigger: local disk > 50% OR > 100 active users.

**Skills:** `storage-adapter`, `deployment`, `test-driven-development`

- [ ] S3 / R2 bucket and credentials
- [ ] Migration script: copy local → S3
- [ ] Switch `STORAGE_DRIVER=s3`
- [ ] Verify proxy + signed URLs
- [ ] Decommission local storage volume after 7 days

**Exit:** Storage scales independently.

---

## Backlog

- Disposable-email blocklist (anti-abuse layer 4 from ADR-007)
- Password reset flow
- Email change flow
- Social login (Google / Apple)
- Two-factor authentication
- Stripe self-serve upgrade (currently operator-mediated)
- Speech-to-Text, Sound Effects, Music, Dubbing — full feature set rollout
- BYOK ("bring your own key") opt-in
- Annual billing
- TL pricing (Iyzico)
- Coupon codes
- Affiliate program
- Workspace / team accounts

---

## Skill map (9 skills)

| Skill | Domain |
|-------|--------|
| `test-driven-development` | Test cycle, smoke test, red-green-refactor |
| `frontend-development` | Next.js, components, hooks, design system, shadcn |
| `backend-development` | Hono routes, middleware, services, API contract, Drizzle schema |
| `elevenlabs-integration` | Per-user upstream API calls, key resolution, model selection |
| `audio-recording` | MediaRecorder, waveform, parallel recording, upload |
| `storage-adapter` | File storage (local / S3) |
| `billing-and-credits` | Free-tier credits, upstream-derived paid balance, charge flow |
| `git-workflow` | Commits, branches, PR, merge, push gates |
| `deployment` | Docker, CI/CD, monitoring, backups |

## Cross-cutting docs

- `docs/system-architecture.md`
- `docs/profitability.md`
- `docs/decisions/001-skill-granularity.md`
- `docs/decisions/002-elevenlabs-skill-source.md`
- `docs/decisions/003-multi-tone-clones.md`
- `docs/decisions/004-per-user-managed-api-key.md`
- `docs/decisions/005-credit-system-design.md`
- `docs/decisions/006-pricing-tiers.md`
- `docs/decisions/007-email-verification.md`
