import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  SESSION_SECRET: z.string().min(32),

  WEB_ORIGIN: z.string().url(),
  APP_URL: z.string().url(),

  ELEVENLABS_KEY_ENCRYPTION_SECRET: z.string().min(32),
  ELEVENLABS_DEMO_API_KEY: z.string().min(1),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  EMAIL_FROM: z.string().min(1),

  EMAIL_VERIFICATION_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(24),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./storage"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),

  CREDIT_PER_CHAR_TTS: z.coerce.number().positive().default(1),
  CREDIT_PER_MINUTE_TRANSCRIBE: z.coerce.number().positive().default(33),
  TRANSCRIBE_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(1024 * 1024 * 1024),
  FREE_TIER_INITIAL_CREDITS: z.coerce.number().int().positive().default(1000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

export const env = parsed.data;
export type Env = typeof env;
