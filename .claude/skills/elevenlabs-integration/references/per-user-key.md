# Per-User API Key — Encryption & Resolution

How a paying user's upstream API key flows from the operator's clipboard into a live upstream call. Read this before touching any code that handles keys.

## Lifecycle

```
1. Operator creates upstream account (manual, ~5–10 min)
2. Operator copies the raw API key from the upstream dashboard
3. Operator pastes it into the admin panel form
4. PUT /admin/users/:id/api-key handler:
   a. encryptApiKey(raw) → ciphertext
   b. db.update(users).set({ elevenlabsApiKey: ciphertext, tier, plan, activatedAt })
   c. redis.del(`subscription:${userId}`)  // invalidate cache
   d. audit log written (NEVER includes raw key)
5. Raw key disappears from memory at end of the request
6. On subsequent upstream calls:
   a. voiceAI.getClientForUser(userId) loads ciphertext
   b. decryptApiKey(ciphertext) → raw (in function scope only)
   c. new ElevenLabsClient({ apiKey: raw })
   d. Used for exactly one upstream call, then dereferenced
```

The raw key exists in memory only during step 4 (admin paste, ~milliseconds) and step 6 (per upstream call, ~seconds). It is never persisted in plaintext, never cached, never logged.

## Encryption

AES-256-GCM. Key derivation: `scrypt(ELEVENLABS_KEY_ENCRYPTION_SECRET, "voicelab-api-key-v1", 32)`. The version suffix lets us rotate the derivation scheme later.

```ts
// apps/api/src/services/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let derivedKey: Buffer | null = null;

async function getKey(): Promise<Buffer> {
  if (derivedKey) return derivedKey;
  derivedKey = (await scryptAsync(
    env.ELEVENLABS_KEY_ENCRYPTION_SECRET,
    "voicelab-api-key-v1",
    32,
  )) as Buffer;
  return derivedKey;
}

export async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv (12) || authTag (16) || ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export async function decryptApiKey(ciphertext: string): Promise<string> {
  const key = await getKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
```

The IV is fresh per encryption (never reused). The auth tag detects tampering — a wrong key or modified ciphertext fails `decipher.final()` rather than silently returning garbage.

## Client resolution per user

```ts
// apps/api/src/services/voice-ai.ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

async function getClientForUser(userId: string): Promise<ElevenLabsClient> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tier: true, elevenlabsApiKey: true },
  });
  if (!user) throw new VoiceAIError("USER_NOT_FOUND", 404);

  if (user.tier === "free") {
    // Free users share the demo account
    return new ElevenLabsClient({ apiKey: env.ELEVENLABS_DEMO_API_KEY });
  }

  if (!user.elevenlabsApiKey) {
    // Paid tier but no key provisioned — admin error or pending activation
    throw new VoiceAIError("NO_UPSTREAM_KEY", 503, {
      hint: "Account is on a paid tier but upstream provisioning is incomplete.",
    });
  }

  const rawKey = await decryptApiKey(user.elevenlabsApiKey);
  return new ElevenLabsClient({ apiKey: rawKey });
}
```

Critical points:
- The `columns: { ... }` selector is deliberate — we don't accidentally pull the encrypted key into wider scopes via `findFirst()` defaults.
- `rawKey` lives only inside this function. It's passed to `ElevenLabsClient` constructor which holds it internally for the lifetime of the client.
- The `ElevenLabsClient` instance is created per call, not cached. Bun + Hono handle ~1ms instantiation; not worth caching for the security trade-off.
- Free users land at the demo key path; no decryption needed. The demo key is in env, plaintext, **only used for free demo TTS**.

## Stripping in API responses

The `users.elevenlabsApiKey` column must never appear in API responses, including admin endpoints. Enforce via a serialization helper:

```ts
// apps/api/src/lib/serialize.ts
import type { User } from "@voicelab/db";

export function stripSensitive(user: User) {
  const { password, elevenlabsApiKey, ...safe } = user;
  return safe;
}
```

Every route that returns `user` must pass it through `stripSensitive`. The admin panel sees `"sk_•••••••• (set on 2026-05-13)"` (rendered from `activatedAt` + the presence of a non-null `elevenlabsApiKey`), never the raw or encrypted value.

## Rotation

If `ELEVENLABS_KEY_ENCRYPTION_SECRET` is ever compromised:

1. Generate new secret
2. Write a one-shot migration script: for each user with `elevenlabsApiKey`, decrypt with old secret, re-encrypt with new
3. Update env, restart
4. (Optional) version the key derivation salt (`"voicelab-api-key-v2"`) for future rotation

For MVP this is documented as a manual recovery path. Automated rotation isn't worth building until > 100 paying users.

## What NEVER happens

- Plaintext API key written to disk (DB or otherwise) — only ciphertext
- Plaintext API key logged anywhere (Sentry, Pino, console) — wrap all error messages to strip
- Plaintext API key returned to any HTTP response — including admin reads
- Plaintext API key cached in Redis — decrypt per request
- Encryption key (`ELEVENLABS_KEY_ENCRYPTION_SECRET`) shared with `SESSION_SECRET` — independent secret material
- Decryption result kept alive past the immediate request — JavaScript GC + small scope

## Tests required

In `apps/api/test/integration/api-key-encryption.test.ts`:

1. Encrypt → decrypt roundtrip returns identical plaintext
2. Two encryptions of the same plaintext produce different ciphertext (IV variance)
3. Tampering with ciphertext fails `decipher.final()`
4. Wrong encryption key fails to decrypt
5. `getClientForUser` returns demo client for Free users
6. `getClientForUser` returns user-keyed client for Paid users
7. `getClientForUser` throws `NO_UPSTREAM_KEY` for paid user with null key
8. `stripSensitive` removes `password` and `elevenlabsApiKey` from output
9. Admin endpoint response audit: no test response includes the raw key string
