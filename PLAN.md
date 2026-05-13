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

- [x] Next.js 16 App Router (`apps/web`)
- [x] Tailwind 4 + theme tokens
- [x] shadcn/ui init + base primitives
- [x] Geist or Inter via `next/font`
- [x] Three route groups: `(marketing)/`, `(app)/`, `(admin)/`
- [x] Layout shells per group (admin has visual context cue, amber accent)
- [x] Theme provider (dark default)
- [x] TanStack Query setup, API client (`lib/api.ts`) with credentials
- [x] Toast (sonner)
- [x] Proxy (Next.js 16 successor to middleware): redirect unauthed from `/app/**` and `/admin/**`; redirect `unverified` to `/verify-email`

**Exit:** Themed shells render; route guards work.

---

## Phase 8 — Auth Pages

**Skills:** `frontend-development`, `email-and-verification`, `test-driven-development`

- [x] `/register` page — email + password + confirm
  - [x] On success → redirect to `/verify-email`
- [x] `/verify-email` page — "Check your inbox" + resend button
  - [x] Resend button calls `POST /auth/resend-verification`
  - [x] Rate-limit feedback ("wait 60s" if 429)
- [x] `/verify?token=...` page — handles the GET, shows success/failure UI, redirects to `/app` on success
- [x] `/login` page
  - [x] On 403 `ACCOUNT_UNVERIFIED` → redirect to `/verify-email`
  - [x] On 403 `ACCOUNT_SUSPENDED` → inline error
  - [x] On 200 → redirect to `/app`
- [x] `/login?verified=1` shows a success banner
- [x] Logout button in topbar

**Exit:** Full register → email → click → app flow works.

---

## Phase 9 — Landing Page

**Skills:** `frontend-development`, `test-driven-development`

- [x] `/` landing
  - [x] Hero, features (3-4 cards), how it works (3 steps)
  - [x] **Pricing section: 4 tier cards** (Free, Basic $15, Pro $59 [Most Popular], Enterprise [Contact sales])
  - [x] "Who we are" section
  - [x] Footer
- [x] `/pricing` standalone page (same cards, larger, FAQ)
- [x] Enterprise card CTA: `mailto:` link
- [x] SEO meta + OpenGraph
- [x] Mobile responsive
- [x] **No mention of upstream provider anywhere**

**Exit:** Public site with concrete pricing; Enterprise inquiries route to operator email.

---

## Phase 10 — User Dashboard, Voice Catalog, Recording Studio

**Skills:** `frontend-development`, `audio-recording`, `billing-and-credits`, `test-driven-development`

- [x] `/app` dashboard
  - [x] Top cards: credits/quota, voices, generations
  - [x] Recent activity table
  - [x] **For Free user:** big "Upgrade" CTA when balance < 200 or exhausted
- [x] `/app/library` — VoiceLab voice catalog (default voices) for everyone (stub; default voices catalog deferred)
- [x] `/app/recordings` — recording studio (mic capture, waveform, save)
- [x] `/app/voices` — list of user's clones (one row per voice)
  - [x] "New Quick Clone" (Basic+) / "New Studio Clone" (Pro+) buttons
  - [x] Tier-gated: Free sees "Upgrade to clone" tooltip
- [x] `/app/generations` — table with filters, pagination, regenerate (regenerate UI lands with detail page in Phase 11)
- [x] `/app/settings` — name, password change, email change (read-only; mutations land later)

**Exit:** Full clone + generate + history flow in UI.

---

## Phase 11 — Speech-to-Speech + Voice Settings

**Skills:** `frontend-development`, `elevenlabs-integration`, `test-driven-development`

- [x] `/app/voices/:id` detail page
  - [x] Tabs: "Generate from text" | "Convert audio" (S2S)
  - [x] **Text input area** (TTS tab): textarea + character counter + per-model max length validation
  - [x] **Audio input** (S2S tab): drag/drop OR record from mic, MIME + duration validated
  - [x] **Voice settings panel:**
    - [x] `stability` slider 0–1 (default 0.5) — low = expressive, high = monotone
    - [x] `similarityBoost` slider 0–1 (default 0.75) — fidelity to source voice
    - [x] `style` slider 0–1 (default 0) — style exaggeration (v2+ models only, disabled if `model.canUseStyle === false`)
    - [x] `useSpeakerBoost` toggle (default true, disabled if `model.canUseSpeakerBoost === false`)
    - [x] `speed` slider 0.7–1.2 (default 1.0)
  - [x] **Model dropdown** (TTS: `eleven_multilingual_v2`, `eleven_turbo_v2_5`, `eleven_flash_v2_5`; S2S: `eleven_multilingual_sts_v2`) — populated from `GET /models`, filtered by capability
  - [x] **Output format dropdown** (tier-allowed):
    - [x] Free / Basic → `mp3_44100_128`
    - [x] Pro → `mp3_44100_128`, `mp3_44100_192`
    - [x] Enterprise → above + `pcm_44100`
  - [x] Credit quote for Free; for Paid, show remaining monthly allowance (from `getSubscriptionForUser`)
  - [x] Generate button (loading state)
  - [x] Inline player + download (filename derived from format)
  - [x] "Reset to defaults" button
- [x] Backend: `generateSpeech` + `speechToSpeech` accept `modelId`, `outputFormat`, and full `voiceSettings` (no longer hard-coded)
- [x] Backend: validate `modelId` against `models.list()` capability flags (TTS vs S2S; alpha access)
- [x] Backend: validate `outputFormat` against user's tier (route handler, before service)
- [x] `GET /models` route — proxies `client.models.list()`, 5 min Redis cache (per user)

**Exit:** TTS and S2S flows complete; user picks model + output format + all voice settings + speed; backend validates per tier and per model capability. Settings documented in `.claude/skills/elevenlabs-integration/references/tts-settings.md`.

---

## Phase 12 — Default Voice Library

**Skills:** `backend-development`, `frontend-development`, `elevenlabs-integration`, `test-driven-development`
**Cross-cutting docs:** `docs/system-architecture.md`

> Replaces the Phase 10 stub. Required so Free users (no clones) and Paid users without clones can generate speech.

- [x] DB: `library_voices` table (id, upstreamVoiceId, name, description, gender, age, accent, category, previewUrl, language, isActive, sortOrder)
- [x] Migration applied
- [x] Backend service `library-voices.ts`:
  - [x] `syncFromUpstream()` — calls `client.voices.getShared()` using operator demo key, upserts curated picks
  - [x] `list({ gender?, accent?, language?, search? })` — Redis 5 min cache
- [x] Routes:
  - [x] `GET /library/voices` (public to authed users, filters)
  - [x] `GET /library/voices/:id/preview` (proxies preview audio)
  - [x] `POST /admin/library/sync` (admin-only re-sync)
- [x] `voice-ai.ts.generateSpeech` accepts library voiceId directly (already does — works because upstream voiceId is global)
- [x] Frontend `/app/library` — real catalog
  - [x] **Filter chips: gender, age** (language, accent, category filters available via API)
  - [x] Search box (free-text, debounced)
  - [x] Card per voice: avatar, name, preview play button (inline `<audio>` from `/library/voices/:id/preview` proxy)
  - [x] "Generate from this voice" → opens generate panel using library voice (reuses Phase 11 settings component)
  - [x] Free + Paid: both can use library voices
- [x] Frontend `/app/library/:id/generate` — TTS form with model + speed + settings (same component as Phase 11)

**Exit:** Free user can pick a library voice and generate speech without cloning. Paid users see same catalog plus their clones.

---

## Phase 13 — Speech to Text

**Skills:** `backend-development`, `frontend-development`, `elevenlabs-integration`, `audio-recording`, `storage-adapter`, `billing-and-credits`, `test-driven-development`

- [ ] DB: `transcriptions` table (id, userId, audioKey, text, language, durationSec, model, createdAt)
- [ ] Migration applied
- [ ] `voice-ai.ts.transcribe(userId, audioFile, { language?, model? })` — calls `client.speechToText.convert` (model `scribe_v1`)
- [ ] Free credit quote: per minute of audio (define in `FreeCreditsService.quote`)
- [ ] Routes:
  - [ ] `POST /transcribe` (multipart, audio file)
  - [ ] `GET /transcriptions` (paginated)
  - [ ] `GET /transcriptions/:id`
  - [ ] `DELETE /transcriptions/:id`
- [ ] Audio stored via `StorageAdapter`, MIME validated
- [ ] Frontend `/app/transcribe`
  - [ ] Upload OR record (reuse Phase 10 recorder)
  - [ ] Language dropdown (auto-detect default)
  - [ ] Model dropdown (when more than one available)
  - [ ] "Transcribe" button (loading state)
  - [ ] Result text area, copy button, download `.txt`
- [ ] Frontend `/app/transcriptions` history list with player + text view

**Exit:** All tiers can upload/record audio → receive transcript. Free user is charged per minute.

---

## Phase 14 — Voice Isolator

**Skills:** `backend-development`, `frontend-development`, `elevenlabs-integration`, `audio-recording`, `storage-adapter`, `billing-and-credits`, `test-driven-development`

- [ ] DB: `isolations` table (id, userId, inputAudioKey, outputAudioKey, createdAt)
- [ ] Migration applied
- [ ] `voice-ai.ts.isolateVoice(userId, audioFile)` — calls `client.audioIsolation.convert`
- [ ] Free credit quote: per minute of audio (or block to Basic+ — decide on cost)
- [ ] Routes:
  - [ ] `POST /isolate` (multipart)
  - [ ] `GET /isolations` (paginated)
  - [ ] `DELETE /isolations/:id`
- [ ] Frontend `/app/isolate`
  - [ ] Upload OR record
  - [ ] "Isolate" button (loading)
  - [ ] Before/after dual player
  - [ ] Download clean audio
- [ ] Frontend `/app/isolations` history

**Exit:** Noisy audio in → clean speech out. History persisted.

---

## Phase 15 — Admin Panel

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

## Phase 16 — Polish & Accessibility

**Skills:** `frontend-development`, `test-driven-development`

- [ ] Skeleton loaders on every async surface
- [ ] Empty states with CTAs
- [ ] Error states
- [ ] Keyboard navigation audit, focus rings, ARIA
- [ ] Mobile responsive across all three layouts
- [ ] Lighthouse > 90 on `/`, `/pricing`, `/app`

**Exit:** Presentation-quality UI.

---

## Phase 17 — E2E & Hardening

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

## Phase 18 — Deployment

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

## Phase 19 — Stripe Integration (deferred)

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

## Phase 20 — S3 Migration (deferred)

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

**Auth / Account**
- Disposable-email blocklist (anti-abuse layer 4 from ADR-007)
- Password reset flow
- Email change flow
- Social login (Google / Apple)
- Two-factor authentication

**Billing**
- Stripe self-serve upgrade (currently operator-mediated)
- BYOK ("bring your own key") opt-in
- Annual billing
- TL pricing (Iyzico)
- Coupon codes
- Affiliate program

**ElevenLabs features (deferred — not in plan)**
- Sound Effects (`text-to-sound-effects`)
- Voice Design (`text-to-voice`)
- Music composition + stem separation
- Dubbing (translate/localize audio + video)
- Text to Dialogue (multi-character)
- Audio Native (website embed)
- Conversational AI Agents (phone / chat / WebSocket)
- Forced Alignment (text-to-audio timestamps)
- Streaming TTS / Multi-context WebSocket
- TTS with timestamps

**Workspace**
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
