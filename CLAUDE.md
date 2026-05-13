# CLAUDE.md

VoiceLab — a managed AI voice generation product. Public registration with email verification. Per-user upstream account (operator-provisioned, hidden from end users). Free tier with one-time 1,000 credits backed by a shared demo account. Solo developer · single `main` branch · English everywhere except user chat (Turkish).

## Bootstrap

**If this is a new session and the skill map has not yet been loaded, first read `NEW_SESSION_PROMPT.md` and follow it to completion.** It loads skill metadata, lists cross-cutting docs, reads `PLAN.md`, and waits for user approval before any work. Once that bootstrap is done, follow the rest of this file for the ongoing rules.

If the skill map is already loaded earlier in this conversation, skip the bootstrap and continue under these rules.

## Phase Work

Phase work follows the `test-driven-development` skill, then `git-workflow`. Those skills own the procedure end-to-end — do not restate it here.

## Stack (Immutable)

Bun · Hono · Drizzle · PostgreSQL · Redis · Next.js 16 · Tailwind 4 · shadcn/ui · Per-user upstream voice AI accounts.

## Hard Rules

- TypeScript strict, no `any`
- Upstream provider name (ElevenLabs) **never appears** in user-facing UI, marketing, or emails
- Each paid user has their own upstream account; API key stored AES-encrypted in `users.elevenlabsApiKey`
- Free users share one demo account via the env-defined `ELEVENLABS_DEMO_API_KEY`
- Free credits granted only after email verification: 1,000, one-time, non-renewing
- Auth: httpOnly cookie + Redis (no JWT)
- Status enum: `unverified | active | suspended` — no admin approval step
- `unverified` and `suspended` users cannot reach any `/app/**` route
- Admin-only routes guarded by `requireAdmin` middleware
- Voice cloning routes check `tier`: Free → 403, Basic → IVC allowed, Pro → IVC + PVC allowed
- All file I/O through `StorageAdapter`
- Email transport: Mailpit (dev), Resend or equivalent (prod); single `EmailService` abstraction
- All commits, code, comments, docs, UI strings: **English**
- User chat: **Turkish**
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- No code is committed until tests pass and the user approves the smoke test

## References

`PLAN.md` · `docs/system-architecture.md` · `docs/profitability.md` · `.claude/skills/*/SKILL.md` · `NEW_SESSION_PROMPT.md`
