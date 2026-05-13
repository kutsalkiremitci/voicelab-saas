# API Contract

Base URL: `/api/v1`
Auth: httpOnly cookie `voicelab_session`
Content-Type: `application/json` unless noted.

## Error envelope (always)

```json
{
  "error": {
    "code": "VOICE_NOT_FOUND",
    "message": "The requested voice does not exist.",
    "details": {}
  }
}
```

| HTTP | Meaning |
|------|---------|
| 400 | Bad input |
| 401 | Auth required |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 422 | Validation error (field-level `details`) |
| 429 | Rate limited |
| 500 | Server error |

## Conventions

- Resources plural, kebab-friendly: `/recordings`, `/voices`
- Methods: GET (read), POST (create/action), PUT (full update), PATCH (partial), DELETE
- Dates: ISO 8601 UTC
- IDs: UUID
- Booleans: `is*` / `has*` / `can*`
- Pagination: cursor-based `?cursor=&limit=`, response includes `nextCursor: string | null`

## Auth

```
POST /auth/register              { email, password, name? } → 201 { user }
                                 // status: unverified, no credits granted yet
                                 // verification email sent in background

POST /auth/resend-verification   { email } → 200
                                 // always 200 (don't leak which emails exist)
                                 // rate-limited: 1/min/email, 5/day/email

GET  /auth/verify?token=...      → 302 redirect to /login?verified=1 (success)
                                                  → /verify-email?error=1 (failure)
                                 // on success: status → active, credits row inserted with balance=1000

POST /auth/login                 { email, password } → { user }
                                 // 403 ACCOUNT_UNVERIFIED if not verified
                                 // 403 ACCOUNT_SUSPENDED if suspended

POST /auth/logout                → 200

GET  /auth/me                    → { user, balance, balanceSource }
                                 // balanceSource: "free" (from credits table) | "upstream" (from ElevenLabs subscription, relabeled)
```

`user` shape: `{ id, email, name, role, status, tier, activatedAt, createdAt }`.

`balance` for Free: integer credits remaining in `credits.balance`.
`balance` for Paid: `characterLimit - characterCount` from upstream (relabeled in UI as "VoiceLab credits").

Login error codes (403):
- `ACCOUNT_UNVERIFIED` — email not verified; show resend CTA
- `ACCOUNT_SUSPENDED` — admin suspended

## Recordings

```
POST   /recordings              multipart: audio, name, duration → 201 { recording }
GET    /recordings              ?cursor=&limit= → { recordings, nextCursor }
GET    /recordings/:id          → { recording }
PUT    /recordings/:id          { name } → { recording }
POST   /recordings/:id/re-record  multipart: audio → { recording }
DELETE /recordings/:id          → 204
```

## Voices

The user creates voice clones from saved recordings. `kind` selects Quick (Instant) or Studio (Professional) cloning. Tier gates apply:
- Free → 403 `TIER_LIMIT` (no cloning)
- Basic → `kind: "ivc"` only
- Pro → `kind: "ivc"` or `kind: "pvc"`
- Enterprise → all

```
POST   /voices                  { recordingId, label, kind, description? } → 201 { voice }
GET    /voices                  → { voices }
GET    /voices/:id              → { voice, recentGenerations }
DELETE /voices/:id              → 204  (also deletes upstream voice to free a slot)
POST   /voices/:id/generate           { text, settings? } → 201 { generation }
POST   /voices/:id/speech-to-speech   multipart: audio, settings? → 201 { generation }
```

Validation:
- `label` required, 1–40 chars, single-line
- `label` must be unique per user
- `kind` enum: `"ivc"` | `"pvc"`

## Generations

```
GET    /generations             ?voiceId=&cursor=&limit= → { generations, nextCursor }
GET    /generations/:id         → { generation }
DELETE /generations/:id         → 204
```

## Credits / quota

```
GET  /credits/balance           → { balance, source: "free"|"upstream", plan, resetAt? }
POST /credits/quote             { operation, payload } → { amount, ratePerChar? }
                                // only used by Free tier UI; Paid users don't need quotes (no app-level metering)
```

For Free: `balance` from `credits.balance`. For Paid: `balance = upstream.characterLimit - upstream.characterCount`. `resetAt` only present for Paid (= upstream `next_character_count_reset_unix`).

Insufficient-credit operations return 402:

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Not enough credits",
    "details": { "required": 120, "balance": 80, "deficit": 40 }
  }
}
```

## Admin

All routes under `/admin/*` require `requireAuth` + `requireAdmin`.

```
GET    /admin/users                     ?status=&tier=&search=&cursor=&limit= → { users, nextCursor }
GET    /admin/users/:id                 → { user, balance, upstream?, recentActivity }
                                        // upstream populated for paid tiers (decrypts key, calls getSubscription)
PATCH  /admin/users/:id                 { status?, role?, tier? } → { user }
PUT    /admin/users/:id/api-key         { apiKey, plan } → 200 { user }
                                        // apiKey is the raw upstream key (operator pastes from upstream dashboard)
                                        // Backend AES-encrypts immediately, sets users.elevenlabsApiKey, tier, activatedAt
                                        // plan ∈ "starter" | "creator" | "pro" | "scale"
DELETE /admin/users/:id/api-key         → 200 { user }
                                        // Removes encrypted key; tier downgraded to "free"
POST   /admin/users/:id/credits         { amount, reason?, note? } → 201 { credits }
                                        // Free-tier support comp only. 409 USER_NOT_FREE if tier != "free".
POST   /admin/users/:id/manual-verify   → 200 { user }
                                        // Emergency: marks email verified without token (audit-logged)
GET    /admin/metrics                   → { totalUsers, signupsToday, activeFreeUsers, paidUsersByTier, demoQuotaUsage }
GET    /admin/audit                     ?adminId=&action=&cursor= → { entries, nextCursor }
```

Special rules enforced server-side:
- Admin cannot demote themselves (PATCH with `role: 'user'` on self → 403)
- Setting an API key requires `tier` to match the upstream `plan` (Basic→Starter, Pro→Creator, Enterprise→Pro/Scale); 422 otherwise
- API keys are never returned in any response — `users.elevenlabsApiKey` is hidden by the serialization layer
- All admin writes append to `admin_audit_log` (the `metadata` jsonb never contains the raw key)

## Metrics

```
GET /metrics/user               → per-user totals (current user)
GET /metrics/elevenlabs         → { plan, characterCount, characterLimit, voiceLimit, voiceUsed, resetAt }   // admin-only after Phase 6
```

`metrics/system` is replaced by `admin/metrics` in the SaaS model — the marketing-side dashboard for the user shows only their own usage.

## Files

```
GET /files/:type/:id            type ∈ { recordings, generations }
                                Auth required. Range support. Ownership enforced.
```

## Health

```
GET /health                     → { status, db, redis, elevenlabs }
```

## Rate limits

| Endpoint | Limit |
|----------|-------|
| `POST /auth/register` | 3 / hour / IP |
| `POST /auth/login` | 5 / min / IP |
| `POST /auth/resend-verification` | 1 / min / email, 5 / day / email |
| `POST /recordings` | 10 / min / user |
| `POST /voices` | 5 / hour / user |
| `POST /voices/:id/generate` | 60 / hour / user |
| `POST /voices/:id/speech-to-speech` | 30 / hour / user |
| `POST /admin/*` | 30 / min / admin |
| Other GET | 120 / min / user |

429 response includes `X-RateLimit-Reset` header.

## Validation

All bodies and queries validated with zod schemas from `packages/shared/schemas`. Failure returns 422 with field-level `details`.

## Adding an endpoint — checklist

- [ ] Zod schema in `packages/shared/schemas`
- [ ] Update this file with the new endpoint
- [ ] Implement route per backend folder layout
- [ ] Integration test (per `test-driven-development`)
- [ ] If user-visible, surface in frontend `pages.md`
