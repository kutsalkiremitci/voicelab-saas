# Middleware & Errors

## Auth middleware

```ts
// middleware/auth.ts
import { getCookie } from "hono/cookie";

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const sid = getCookie(c, "voicelab_session");
  if (!sid) return c.json({ error: { code: "UNAUTHORIZED" } }, 401);

  const userId = await redis.get(`session:${sid}`);
  if (!userId) return c.json({ error: { code: "UNAUTHORIZED" } }, 401);

  await redis.expire(`session:${sid}`, 60 * 60 * 24 * 7); // sliding TTL
  c.set("userId", userId);
  await next();
};
```

## requireVerified middleware

Rejects users whose status is not `active`. Used on all `/app/**` routes (recordings, voices, generations, credits) after `requireAuth`. Replaces the earlier `requireApproved` middleware — there is no admin approval step.

```ts
// middleware/verified.ts
export const requireVerified: MiddlewareHandler = async (c, next) => {
  const userId = c.get("userId");
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { status: true },
  });
  if (!user) return c.json({ error: { code: "USER_NOT_FOUND" } }, 404);
  if (user.status === "unverified") return c.json({ error: { code: "ACCOUNT_UNVERIFIED" } }, 403);
  if (user.status === "suspended") return c.json({ error: { code: "ACCOUNT_SUSPENDED" } }, 403);
  await next();
};
```

## requireAdmin middleware

Used on all `/admin/**` routes after `requireAuth`. The acting admin's userId is already on the context from `requireAuth`.

```ts
// middleware/admin.ts
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const userId = c.get("userId");
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { role: true },
  });
  if (!user || user.role !== "admin") {
    return c.json({ error: { code: "FORBIDDEN" } }, 403);
  }
  await next();
};
```

## Rate limit middleware

```ts
// middleware/rate-limit.ts
export const rateLimit = (opts: {
  key: (c: Context) => string;
  max: number;
  windowSec: number;
}) => async (c: Context, next: Next) => {
  const k = `rl:${opts.key(c)}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, opts.windowSec);
  if (n > opts.max) {
    const ttl = await redis.ttl(k);
    c.header("X-RateLimit-Reset", String(Date.now() + ttl * 1000));
    return c.json({ error: { code: "RATE_LIMITED" } }, 429);
  }
  await next();
};
```

## Error model

```ts
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}
```

## Global error handler

```ts
// middleware/error.ts
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status,
    );
  }
  if (err instanceof ZodError) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.flatten().fieldErrors } },
      422,
    );
  }
  logger.error({ err }, "unhandled");
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, 500);
};
```

## Logging

`pino` with `pino-pretty` in development, JSON in production. Each request logs:
- method, path, status
- durationMs
- userId (if authed)
- requestId (generated per request, propagated downstream)

```ts
// middleware/logger.ts
export const logger: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  await next();
  const ms = Math.round(performance.now() - start);
  log.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: ms,
    userId: c.get("userId"),
    requestId,
  });
};
```

## Validation pattern

```ts
import { z } from "zod";
import { generateSchema } from "@voicelab/shared/schemas";

app.post("/voices/:id/generate", requireAuth, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = generateSchema.parse(await c.req.json()); // throws ZodError → 422

  // Ownership in the data layer too
  const voice = await db.query.voices.findFirst({
    where: and(eq(voices.id, id), eq(voices.userId, userId)),
  });
  if (!voice) throw new AppError("VOICE_NOT_FOUND", "Voice not found", 404);

  // ...
});
```
