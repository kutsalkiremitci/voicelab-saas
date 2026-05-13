# Backend Folder Layout

```
apps/api/
├── src/
│   ├── index.ts                # entry, Hono app
│   ├── env.ts                  # zod-validated env
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── recordings.ts
│   │   ├── voices.ts
│   │   ├── generations.ts
│   │   ├── metrics.ts
│   │   ├── files.ts
│   │   └── health.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── rate-limit.ts
│   │   ├── error.ts
│   │   └── logger.ts
│   ├── services/
│   │   ├── elevenlabs.ts
│   │   ├── storage/
│   │   │   ├── index.ts
│   │   │   ├── adapter.ts
│   │   │   ├── local.ts
│   │   │   └── s3.ts
│   │   ├── session.ts
│   │   └── metrics.ts
│   ├── lib/
│   │   ├── redis.ts
│   │   ├── logger.ts
│   │   └── errors.ts
│   └── seed/
│       └── users.ts
├── test/
│   ├── unit/
│   ├── integration/
│   ├── mocks/
│   └── setup.ts
├── package.json
└── tsconfig.json

packages/db/
├── src/
│   ├── schema.ts               # single source of truth for schema
│   ├── client.ts               # db instance
│   └── seed.ts                 # seed runner
├── migrations/                 # generated SQL, committed
└── drizzle.config.ts
```

## Entry point

```ts
// apps/api/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "./middleware/logger";
import { errorHandler } from "./middleware/error";
import auth from "./routes/auth";
import recordings from "./routes/recordings";
// ...

const app = new Hono();
app.use("*", logger);
app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.onError(errorHandler);

app.route("/api/v1/auth", auth);
app.route("/api/v1/recordings", recordings);
// ...

export default { port: env.PORT, fetch: app.fetch };
```

## Env validation

```ts
// apps/api/src/env.ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  WEB_ORIGIN: z.string().url(),
  ELEVENLABS_API_KEY: z.string().min(1),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./storage"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
});

export const env = schema.parse(process.env);
```
