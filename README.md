# VoiceLab

A managed AI voice generation platform. Users sign up, verify their email, and access voice cloning + text-to-speech. The product is a polished wrapper over enterprise-grade voice AI — users never deal with API keys, providers, or technical setup.

## Stack

**Backend** Bun · Hono · Drizzle ORM · PostgreSQL · Redis
**Frontend** Next.js 16 · Tailwind 4 · shadcn/ui
**Voice AI** Per-user upstream account (operator-provisioned, hidden from end users)
**Email** Mailpit (dev) · Resend (prod)
**Storage** Local FS (S3-ready)
**Billing** Manual upgrades for MVP; Stripe planned (Phase 17)

## Product Surface

- **Marketing site** at `/` — landing, pricing, "who we are"
- **Authenticated app** at `/app` — voice library, clones, TTS, generations, account
- **Admin** at `/admin` — member management, API key provisioning, usage metrics

## Account Lifecycle

1. User registers (email + password) → status `unverified`
2. System emails a verification link → user clicks → status `active`, 1,000 free credits granted
3. User explores on Free tier (1,000 credits, one-time, non-renewing)
4. User upgrades to Basic / Pro / Enterprise → admin provisions an upstream account → user activated on that tier
5. User generates audio via the app; all upstream calls go through their dedicated key

## Tiers

| | **Free** | **Basic** | **Pro** | **Enterprise** |
|---|----------|-----------|---------|----------------|
| Price | $0 | $15/mo | $59/mo | Custom |
| Credits | 1,000 (one-time) | 30,000 / mo | 121,000 / mo | Custom |
| Voice cloning | no | Quick Voice Clone | + Studio Voice Clone | + everything |
| Voice catalog (library) | yes | yes | yes | yes |
| Speech-to-Speech | no | yes | yes | yes |
| Multi-language dubbing | no | yes | yes | yes |
| Audio quality | 128 kbps | 128 kbps | 192 kbps | studio (44.1 kHz PCM) |

See `docs/decisions/006-pricing-tiers.md` for the full tier matrix and `docs/profitability.md` for unit economics.

## Quick Start

```bash
bun install
docker compose up -d postgres redis mailpit
bun db:migrate
bun db:seed        # creates the first admin
bun dev
```

Open: web `http://localhost:3000` · api `http://localhost:3001` · mailpit `http://localhost:8025`

## Repository Layout

```
.
├── PLAN.md                              # Phase-by-phase plan (living)
├── CLAUDE.md                            # Rules for Claude in this repo
├── NEW_SESSION_PROMPT.md                # Bootstrap for new Claude sessions
├── README.md
├── .env.example
├── docs/
│   ├── README.md
│   ├── system-architecture.md
│   ├── profitability.md
│   └── decisions/                       # ADRs
├── .claude/
│   └── skills/                          # 9 skills
├── apps/
│   ├── api/                             # Bun + Hono
│   └── web/                             # Next.js (marketing + app + admin)
└── packages/
    ├── db/                              # Drizzle schema + migrations
    └── shared/                          # zod schemas, shared types
```

## Workflow

Phase by phase. `PLAN.md` is the living document; completed tasks are ticked `[x]`. Every phase ends with: TDD cycle → user-approved smoke test → git actions (each approved separately).

To start a new Claude session: tell Claude "Read `CLAUDE.md` and follow it." The bootstrap auto-triggers.

## Environment

```bash
cp .env.example .env
```

Required for local dev:
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET` (32+ chars)
- `ELEVENLABS_KEY_ENCRYPTION_SECRET` (32 bytes, separate from session secret)
- `ELEVENLABS_DEMO_API_KEY` (single shared key for the Free tier demo account)
- `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` (first admin)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
- `STORAGE_DRIVER` = `local`
- `APP_URL` — for email links

## Scripts

```bash
bun dev                        # all apps
bun --cwd apps/api dev         # backend only
bun --cwd apps/web dev         # frontend only
bun db:generate                # generate migration from schema
bun db:migrate                 # apply migrations
bun db:seed                    # seed first admin
bun test                       # tests
bun lint                       # eslint + tsc
```

## Language Policy

- Code, comments, commits, docs, UI strings: **English**
- User chat: **Turkish**

## Branding rules

- The upstream provider's name is **never** displayed in user-facing UI
- All tier features use VoiceLab-branded labels (see ADR-006 rebrand table)
- Marketing copy refers to "AI voice technology" generically

## Branching

Single `main` branch. Feature branches `feat/<phase-or-feature>` merged back and deleted.

## License

Proprietary.
