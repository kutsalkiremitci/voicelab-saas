# Error Handling

VoiceLab's brand strategy is silent on the upstream provider — error messages reaching the user must follow that rule. SDK errors mention "ElevenLabs"; our wrappers strip that and produce neutral, branded messages.

## Status code mapping (upstream → our API)

| Upstream | Meaning | Action | Surfaced to user |
|----------|---------|--------|-------------------|
| 401 | API key invalid / revoked | Alert operator; do NOT retry | `Voice service is temporarily unavailable` (500) |
| 402 | Quota exceeded | Map to 402 to client | `You've used this month's credits. They'll renew on [date].` |
| 422 | Invalid voice or text | Map to 422 | `That input couldn't be processed. Please check and try again.` |
| 429 | Upstream rate-limited | Backoff + retry; if persistent → 503 | `Service is busy, please retry in a moment` |
| 500–504 | Upstream issue | Retry; if persistent → 502 | `Voice service is temporarily unavailable` |

Critical rule: **no surfaced error message includes "ElevenLabs" or any other provider name**, even on hard failures. The brand surface is silent.

## Error class

```ts
// apps/api/src/services/voice-ai.ts
export class VoiceAIError extends Error {
  constructor(
    public code: string,
    public status: number,
    public body?: unknown,
  ) {
    super(code);
  }
}
```

Note: the `code` is opaque (`"NO_UPSTREAM_KEY"`, `"QUOTA_EXCEEDED"`) and never user-facing on its own. The route boundary converts it to a localized user-facing string.

## Wrapping SDK errors

The `@elevenlabs/elevenlabs-js` SDK throws its own error types (`BadRequestError`, `UnauthenticatedError`, `RateLimitError`). We wrap these so the rest of the codebase sees one consistent shape AND so no upstream messaging leaks:

```ts
import * as EL from "@elevenlabs/elevenlabs-js";

function wrapSdkError(e: unknown): never {
  if (e instanceof EL.errors.ElevenLabsError) {
    // Map status, drop the original message (it may contain provider name).
    // Body is opaque enough to keep for backend debugging; never log to user.
    throw new VoiceAIError(
      mapStatusToCode(e.statusCode ?? 500),
      e.statusCode ?? 500,
      e.body,
    );
  }
  if (e instanceof Error && /fetch|network|ECONNREFUSED|timeout/i.test(e.message)) {
    throw new VoiceAIError("UPSTREAM_UNREACHABLE", 503);
  }
  throw new VoiceAIError("UNKNOWN_UPSTREAM_FAILURE", 500);
}

function mapStatusToCode(status: number): string {
  if (status === 401) return "UPSTREAM_AUTH_FAILED";
  if (status === 402) return "QUOTA_EXCEEDED";
  if (status === 422) return "INVALID_INPUT";
  if (status === 429) return "UPSTREAM_RATE_LIMITED";
  if (status >= 500) return "UPSTREAM_ERROR";
  return "UPSTREAM_ERROR";
}

// Usage inside the service module
async function generateSpeechSafe(client: ElevenLabsClient, voiceId: string, text: string) {
  try {
    return await client.textToSpeech.convert.withRawResponse(voiceId, {
      text,
      modelId: "eleven_multilingual_v2",
    });
  } catch (e) {
    wrapSdkError(e);
  }
}
```

Why wrap?
1. Routes catch one error type, not three SDK-internal types.
2. Status code is always set, even for network errors.
3. SDK upgrades that rename error classes don't ripple through routes.
4. **The original SDK message, which often contains "ElevenLabs," never escapes the service.**

## Retry policy

```ts
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      // Hard fails — do not retry
      if (e instanceof VoiceAIError && ["UPSTREAM_AUTH_FAILED", "QUOTA_EXCEEDED", "INVALID_INPUT"].includes(e.code)) {
        throw e;
      }
      // Backoff: 500ms, 1s, 2s
      await new Promise(r => setTimeout(r, 2 ** i * 500));
    }
  }
  throw lastErr;
}
```

Retries apply to:
- TTS (`generateSpeech`)
- S2S (`speechToSpeech`)

Retries do NOT apply to:
- Cloning (`cloneVoice`) — user-initiated, expensive to silently retry, fail fast
- Voice deletion — idempotent, no value in retry
- Subscription read — caller falls back to cached or errors out

## Mapping to AppError at the route boundary

```ts
// apps/api/src/lib/voice-ai-error-map.ts
import { VoiceAIError } from "../services/voice-ai";
import { AppError } from "./errors";

export function mapToAppError(e: unknown): AppError {
  if (e instanceof VoiceAIError) {
    switch (e.code) {
      case "QUOTA_EXCEEDED":
        return new AppError(
          "UPSTREAM_QUOTA_EXHAUSTED",
          "You've used this month's credits. They'll renew soon.",
          402,
        );
      case "INVALID_INPUT":
        return new AppError(
          "INVALID_VOICE_INPUT",
          "That input couldn't be processed. Please check and try again.",
          422,
        );
      case "UPSTREAM_RATE_LIMITED":
        return new AppError(
          "UPSTREAM_BUSY",
          "Service is busy, please retry in a moment.",
          503,
        );
      case "UPSTREAM_AUTH_FAILED":
      case "NO_UPSTREAM_KEY":
      case "UPSTREAM_UNREACHABLE":
      case "UPSTREAM_ERROR":
      default:
        return new AppError(
          "VOICE_SERVICE_UNAVAILABLE",
          "Voice service is temporarily unavailable. We've been notified.",
          502,
        );
    }
  }
  throw e;
}
```

`UPSTREAM_AUTH_FAILED` and `NO_UPSTREAM_KEY` are critical — they mean the operator's provisioning is broken. The service emits a Sentry alert in addition to the user-facing message. The user sees a neutral "unavailable" message; the operator gets paged.

## What NOT to do

- Don't expose SDK error messages verbatim to clients. They may say "Your ElevenLabs API key is invalid."
- Don't log audio bodies or the API key.
- Don't include the provider name in audit logs, even backend-internal logs (defense in depth).
- Don't retry on `UPSTREAM_AUTH_FAILED` — it's a config error, not transient.
- Don't retry on `QUOTA_EXCEEDED` — it's a quota state, won't change for hours.
- Don't retry on `INVALID_INPUT` — re-running with the same payload fails the same way.

## Concurrency notes

Upstream enforces concurrent generation limits per plan (Starter: 2, Creator: 5, Pro: 10). Because each user has their own subscription in our per-user model, **concurrency is naturally isolated** — user A's 2-call burst doesn't affect user B.

This means we don't need a global semaphore. If a single user generates more than their plan allows in parallel, they get a 429; we surface it as `UPSTREAM_BUSY` and they retry. Per-user concurrency monitoring is a future optimization, not MVP.
