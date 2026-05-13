# Drizzle Schema

PostgreSQL 16 + Drizzle ORM.

## Layout

```
users
  ├─< recordings
  ├─< voices ──< generations
  └─< sessions   (in Redis, not in DB)
```

## Tables

### users

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | `defaultRandom()` |
| email | text UNIQUE | not null |
| password | text | bcrypt hash |
| name | text | nullable |
| role | text | `'user' | 'admin'`, default `'user'` |
| status | text | `'unverified' | 'active' | 'suspended'`, default `'unverified'` |
| tier | text | `'free' | 'basic' | 'pro' | 'enterprise'`, default `'free'` |
| elevenlabsApiKey | text | nullable, AES-256 encrypted, set only by admin on tier activation |
| elevenlabsPlan | text | nullable, `'starter' | 'creator' | 'pro' | 'scale'` — operator's record of which upstream plan was provisioned |
| emailVerifiedAt | timestamptz | nullable, set on successful verification |
| activatedAt | timestamptz | nullable, set when admin upgrades user to a paid tier |
| createdAt | timestamptz | not null |
| updatedAt | timestamptz | not null |

Indexes: `(status)`, `(tier)`, `(email)` already covered by UNIQUE.

Public registration is open; new users land as `status: unverified`. Verifying email flips them to `active` and grants 1,000 Free credits. There is no admin approval step. The first admin is created via seed (`role: admin`, `status: active`).

### email_verifications

Append-only token store for email verification. Tokens are bcrypt-hashed at rest; raw token only travels in the verification email link.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| userId | uuid FK → users.id | ON DELETE CASCADE |
| tokenHash | text | bcrypt of the raw token (32 random bytes, base64url) |
| expiresAt | timestamptz | grant time + 24h (configurable via `EMAIL_VERIFICATION_TOKEN_TTL_HOURS`) |
| consumedAt | timestamptz | nullable; set on successful verify |
| createdAt | timestamptz | |

Indexes: `(userId)`, `(expiresAt)` (for cleanup cron).

### credits (Free tier only)

One row per Free user, mutable balance. Created on email verification. Replaces the earlier ledger design — paid users use upstream metering instead.

| Column | Type | Notes |
|--------|------|-------|
| userId | uuid PK | references `users.id` ON DELETE CASCADE |
| balance | integer | starts at 1000, decremented per operation, hard floor 0 |
| grantedAt | timestamptz | when the row was created |
| exhaustedAt | timestamptz | nullable, set when balance first hits 0 |

No `created_at DESC` index — the row is mutable, queries are by primary key only.

### recordings

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| userId | uuid FK → users.id | ON DELETE CASCADE |
| name | text | not null |
| storageKey | text | adapter key, not null |
| mimeType | text | |
| sizeBytes | bigint | |
| durationSec | numeric(10,3) | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

Index: `(userId, createdAt DESC)`

### voices

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| userId | uuid FK → users.id | ON DELETE CASCADE |
| recordingId | uuid FK → recordings.id | nullable, ON DELETE SET NULL |
| name | text | original ElevenLabs voice name (echoes `label` on create) |
| label | text | not null, user-defined tone label: "Calm", "Angry", "Happy", etc. Displayed in UI selectors. |
| description | text | nullable |
| elevenLabsVoiceId | text UNIQUE | |
| status | text | `'pending' | 'ready' | 'failed'` |
| error | text | nullable |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

Indexes: `(userId, createdAt DESC)`, `(elevenLabsVoiceId)`

### generations

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| userId | uuid FK → users.id | ON DELETE CASCADE |
| voiceId | uuid FK → voices.id | ON DELETE CASCADE |
| text | text | not null |
| storageKey | text | not null |
| mimeType | text | `audio/mpeg` |
| sizeBytes | bigint | |
| durationSec | numeric(10,3) | |
| characterCount | integer | ElevenLabs credit tracking |
| settings | jsonb | voice settings snapshot |
| createdAt | timestamptz | |

Indexes: `(userId, createdAt DESC)`, `(voiceId, createdAt DESC)`

## Drizzle schema (excerpt)

```ts
// packages/db/src/schema.ts
import { pgTable, uuid, text, timestamp, bigint, numeric, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  status: text("status", { enum: ["unverified", "active", "suspended"] }).notNull().default("unverified"),
  tier: text("tier", { enum: ["free", "basic", "pro", "enterprise"] }).notNull().default("free"),
  elevenlabsApiKey: text("elevenlabs_api_key"),  // AES-256 encrypted, set by admin
  elevenlabsPlan: text("elevenlabs_plan", { enum: ["starter", "creator", "pro", "scale"] }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const credits = pgTable("credits", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(1000),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  exhaustedAt: timestamp("exhausted_at", { withTimezone: true }),
});

export const recordings = pgTable("recordings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  durationSec: numeric("duration_sec", { precision: 10, scale: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const voices = pgTable("voices", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recordingId: uuid("recording_id").references(() => recordings.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  elevenLabsVoiceId: text("elevenlabs_voice_id").notNull().unique(),
  status: text("status", { enum: ["pending", "ready", "failed"] }).notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const generations = pgTable("generations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  voiceId: uuid("voice_id").notNull().references(() => voices.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull().default("audio/mpeg"),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  durationSec: numeric("duration_sec", { precision: 10, scale: 3 }),
  characterCount: integer("character_count").notNull(),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const voicesRelations = relations(voices, ({ one, many }) => ({
  user: one(users, { fields: [voices.userId], references: [users.id] }),
  recording: one(recordings, { fields: [voices.recordingId], references: [recordings.id] }),
  generations: many(generations),
}));
```

## Migration workflow

```bash
# 1. edit schema.ts
bun db:generate           # drizzle-kit generates SQL
# 2. review packages/db/migrations/000X_xxx.sql in git diff
bun db:migrate            # apply locally
# 3. integration tests should still pass against fresh DB
# 4. commit schema + migration together
```

Production never runs `drizzle-kit push`. The deploy step runs `drizzle-kit migrate` against versioned SQL files.

## SaaS-specific tables

### admin_audit_log

Append-only record of admin actions. Every `requireAdmin` route that mutates state writes a row here.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| adminId | uuid FK → users.id | not null |
| action | text | `ACTIVATE_USER`, `DEACTIVATE_USER`, `SUSPEND_USER`, `UNSUSPEND_USER`, `PROMOTE_TO_ADMIN`, `DEMOTE_FROM_ADMIN`, `SET_API_KEY`, `REMOVE_API_KEY`, `GRANT_FREE_CREDITS`, `MANUAL_VERIFY` |
| metadata | jsonb | per-action context (targetUserId, tier, amount, plan, etc. — never the raw API key) |
| createdAt | timestamptz | |

Indexes: `(adminId, createdAt DESC)`, `(action)`.

## Seed

```bash
bun run seed
```

Creates the first admin user from `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`. The admin lands with `role: 'admin'`, `status: 'active'`, `tier: 'free'` (admins don't need a paid tier). No other users seeded; the public registration + verification flow handles the rest.

## Performance notes

- Every FK has an index (Drizzle creates them automatically).
- `(userId, createdAt DESC)` is the workhorse composite for listings.
- `settings` jsonb is not queried; no index.
