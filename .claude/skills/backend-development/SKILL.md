---
name: backend-development
description: Use when working in apps/api or packages/db — adding Hono routes, middleware, services, validation, error handling, sessions, or Drizzle schema/migrations. Use whenever the task mentions endpoint, route, handler, controller, middleware, request, response, validation, status code, error envelope, pagination, rate limit, auth, session, schema, table, column, FK, index, query, or migration — even if the words "backend" or "API" are not used.
---

# Backend Development

## Symptoms (read this skill if any apply)

- Adding or editing a file under `apps/api/**` or `packages/db/**`
- Designing a request body, response shape, or status code
- Writing or modifying middleware (auth, rate limit, logger, error)
- Adding or changing a database table, column, FK, or index
- Generating or applying a Drizzle migration
- Setting an environment variable or changing the env schema
- Defining or changing the error response envelope
- Writing or changing a service class

## Red flags (resist these shortcuts)

- "I'll just hardcode this URL/secret/limit" → NO, env var via zod
- "Tiny endpoint, skip zod validation" → NO, every body/query validated
- "Quick `as any` cast, will fix later" → NO, type the model properly
- "Auth middleware checks the user; I don't need to filter by userId in the query" → NO, always filter by userId in the data layer too
- "console.log this one for debugging" → NO, `logger.debug` and remove or guard
- "Run `drizzle-kit push` on production, it's faster" → NO, only `migrate` with versioned SQL
- "Default export this route handler" → NO, named export only
- "Custom error string, the global handler can string-parse it" → NO, throw `AppError(code, message, status)`

## Non-negotiables

- ESM only. No default exports in server code.
- Every request body and query parameter validated with zod from `packages/shared/schemas`.
- Auth: httpOnly cookie + Redis-backed sessions. No JWT.
- Protected endpoints use `requireAuth` AND enforce row-level ownership explicitly in the data query.
- Errors thrown as `AppError(code, message, status, details?)`. The global handler renders the JSON envelope.
- External calls (ElevenLabs, S3) go through a service module with retry + timeout.
- Logging via `pino`. `console.log` is forbidden.
- Async I/O only. No sync `fs` or `child_process.execSync`.
- Drizzle is the only ORM. No Prisma, no TypeORM.
- Production never runs `drizzle-kit push`. Production runs `drizzle-kit migrate` from versioned SQL files reviewed in git.
- Every FK has an index. Listing queries use composite `(userId, createdAt DESC)`.

## Order of operations when adding an endpoint

1. zod schema → `packages/shared/schemas`
2. DB changes (if any) → `packages/db/src/schema.ts` → generate + review migration
3. Service logic → `apps/api/src/services/`
4. Route handler → `apps/api/src/routes/`
5. Update `references/api-contract.md` with the new endpoint
6. Write integration test FIRST when reasonable, then implementation (see `test-driven-development`)

## Authoritative references

- `references/folder-layout.md` — where each kind of file lives
- `references/api-contract.md` — every endpoint, error codes, rate limit table, pagination
- `references/drizzle-schema.md` — schema, relations, indexes, migration workflow
- `references/middleware-and-errors.md` — auth, rate limit, error envelope, logging

## Skill handoffs

- Calling ElevenLabs from a route? The call must go through the service module — switch to `elevenlabs-integration` for the client, then come back.
- Reading or writing audio files? All I/O goes through `StorageAdapter` — switch to `storage-adapter` for the contract.
- Endpoint complete? Hand off to `test-driven-development` before any git action.
