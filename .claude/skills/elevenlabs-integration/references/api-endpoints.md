# SDK Usage (per-user keys)

> Examples here are adapted from [elevenlabs/skills](https://github.com/elevenlabs/skills) (MIT). VoiceLab adds: per-user key resolution, retry policy, cache strategy, brand-silent error messages.

## Installation

```bash
bun add @elevenlabs/elevenlabs-js
```

**Critical:** never install the `elevenlabs` package — that's the deprecated v1.x line. The current SDK is `@elevenlabs/elevenlabs-js`.

```bash
# If migrating from the old package:
bun remove elevenlabs
bun add @elevenlabs/elevenlabs-js@latest
```

## Client resolution (per user)

There is no single shared client. Every upstream call resolves a client for the requesting user:

```ts
// apps/api/src/services/voice-ai.ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "../env";
import { decryptApiKey } from "./encryption";

async function getClientForUser(userId: string): Promise<ElevenLabsClient> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tier: true, elevenlabsApiKey: true },
  });
  if (!user) throw new VoiceAIError("USER_NOT_FOUND", 404);

  if (user.tier === "free") {
    return new ElevenLabsClient({ apiKey: env.ELEVENLABS_DEMO_API_KEY });
  }
  if (!user.elevenlabsApiKey) {
    throw new VoiceAIError("NO_UPSTREAM_KEY", 503);
  }

  const rawKey = await decryptApiKey(user.elevenlabsApiKey);
  return new ElevenLabsClient({ apiKey: rawKey });
}
```

See `per-user-key.md` for the full encryption / lifecycle story. The rest of this file uses `getClientForUser(userId)` as a primitive.

## Flow 1 — Voice Cloning (IVC and PVC)

Cloning is gated by tier at the route level (Free → 403, Basic → IVC only, Pro+ → IVC or PVC). The service trusts that gate; it just routes to the right SDK call.

```ts
async function cloneVoice(
  userId: string,
  label: string,
  files: Blob[],
  kind: "ivc" | "pvc",
  description?: string,
): Promise<{ voiceId: string }> {
  const client = await getClientForUser(userId);

  if (kind === "ivc") {
    const voice = await client.voices.ivc.create({
      name: label,
      files,
      description: description ?? `${label} (Quick Clone)`,
    });
    return { voiceId: voice.voiceId };
  }

  // PVC requires more audio (30+ min) and takes 3–6 hours to train upstream.
  // The SDK call returns immediately with a pending voice; the user polls.
  const voice = await client.voices.pvc.create({
    name: label,
    files,
    description: description ?? `${label} (Studio Clone)`,
  });
  return { voiceId: voice.voiceId };
}
```

**Single-tone discipline** (applies to both IVC and PVC):
- Each clone receives samples representing **one tone only**. Don't mix calm + angry into a single clone.
- IVC: 1–5 minutes of audio, consistent dynamics throughout.
- PVC: 30+ minutes (3 hours optimal), studio-grade recording.
- The AI replicates the *performance* it hears. There is no `voice_settings.emotion` parameter that can manufacture an emotion absent from the source.

**No retry on cloning** — if it fails, surface the error and let the user re-record. Cloning is deliberate; silent retries hide problems.

### Naming

The `label` is what the user sees in the UI selector. Pass through verbatim to the upstream `name` field. Keep it short and tone-specific (`Calm`, `Angry`, `Storyteller`).

## Flow 2 — Text-to-Speech (hot path)

Called every time the user submits a prompt. Retry, error mapping, and character-count tracking apply here.

```ts
async function generateSpeech(
  userId: string,
  voiceId: string,
  text: string,
  settings: VoiceSettings = DEFAULT_SETTINGS,
): Promise<{ audio: ReadableStream; characterCount: number }> {
  const client = await getClientForUser(userId);

  return withRetry(async () => {
    // withRawResponse gives us headers; we need x-character-count
    const response = await client.textToSpeech.convert.withRawResponse(voiceId, {
      text,
      modelId: "eleven_multilingual_v2",
      voiceSettings: settings,
      outputFormat: "mp3_44100_128",
    });

    const characterCount = Number(response.headers.get("x-character-count") ?? text.length);
    return { audio: response.body as ReadableStream, characterCount };
  });
}

const DEFAULT_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
};
```

The `withRawResponse` variant is non-negotiable — we need `x-character-count` to persist usage to `generations.characterCount` and (for Free) to charge the user.

### Voice settings (cheat sheet)

| Field | Range | Effect | Default |
|-------|-------|--------|---------|
| `stability` | 0–1 | Low = expressive, high = monotone | 0.5 |
| `similarityBoost` | 0–1 | Fidelity to source voice (too high = artifacts) | 0.75 |
| `style` | 0–1 | Style exaggeration (v2+ models only) | 0 |
| `useSpeakerBoost` | bool | Post-processing for clarity | true |

`style` is **not** an emotion knob — it exaggerates whatever traits are already in the sample. To get angry output, use the angry clone.

### Output formats by tier

| Tier | Format | Bitrate |
|------|--------|---------|
| Free | `mp3_44100_128` | 128 kbps |
| Basic | `mp3_44100_128` | 128 kbps |
| Pro | `mp3_44100_192` | 192 kbps |
| Enterprise | `pcm_44100` | uncompressed (44.1 kHz) |

Route handler selects format from user's tier; the service receives it as a parameter.

## Flow 3 — Speech-to-Speech (Basic+)

Convert one voice to another, preserving the source's emotion and timing. Gated to Basic+ at the route level.

```ts
async function speechToSpeech(
  userId: string,
  voiceId: string,
  audio: Blob,
  settings: VoiceSettings = DEFAULT_SETTINGS,
): Promise<{ audio: ReadableStream; characterCount: number }> {
  const client = await getClientForUser(userId);

  return withRetry(async () => {
    const response = await client.speechToSpeech.convert.withRawResponse(voiceId, {
      audio,
      modelId: "eleven_multilingual_sts_v2",
      voiceSettings: settings,
      outputFormat: "mp3_44100_128",
    });

    const characterCount = Number(response.headers.get("x-character-count") ?? 0);
    return { audio: response.body as ReadableStream, characterCount };
  });
}
```

Notes:
- Upstream charges S2S in characters (same metering as TTS), based on the duration of the input audio at roughly 1,000 chars/min.
- The output voice is the user's existing clone (`voiceId`). Input audio can be any voice.
- Max input duration depends on the upstream plan; surface 422 errors as "audio too long, please trim."

## Flow 4 — Subscription / Quota (per user)

Called by the dashboard. Cached 60 seconds in Redis, **per user**.

```ts
async function getSubscriptionForUser(userId: string) {
  const cacheKey = `subscription:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const client = await getClientForUser(userId);
  const sub = await client.user.subscription.get();
  await redis.setex(cacheKey, 60, JSON.stringify(sub));
  return sub;
}
```

Returned shape (subset we use):

```ts
{
  tier: "starter",                   // upstream tier — NEVER exposed to user
  characterCount: 12450,
  characterLimit: 30000,
  voiceLimit: 10,
  voiceUsed: 4,
  canExtendCharacterLimit: false,
  nextCharacterCountResetUnix: 1748736000,
}
```

The caller (in `billing-and-credits/paid-tier-balance.md`) remaps the upstream tier name to the VoiceLab-facing label (`starter → basic`, `creator → pro`, etc.) before surfacing to the UI.

For our use case, **both** matter:
- `characterCount / characterLimit` → text generation budget
- `voiceUsed / voiceLimit` → how many clone slots are filled

## Flow 5 — Voice deletion (free a slot)

```ts
async function deleteVoice(userId: string, voiceId: string): Promise<void> {
  const client = await getClientForUser(userId);
  await client.voices.delete(voiceId);
}
```

After upstream deletion succeeds, delete the local DB row in the same transaction. If upstream succeeds but local fails, log it and surface a reconciliation warning — the slot is freed upstream but our UI still shows the row.

## Testing mock

```ts
// apps/api/test/mocks/voice-ai.ts
export const mockVoiceAI = {
  getClientForUser: async (userId: string) => mockClient,
  cloneVoice: async (userId: string, label: string, files: Blob[], kind: "ivc" | "pvc") => ({
    voiceId: `mock_${kind}_${crypto.randomUUID()}`,
  }),
  generateSpeech: async (userId: string, voiceId: string, text: string) => ({
    audio: new Response(new Uint8Array([0xff, 0xfb])).body!,
    characterCount: text.length,
  }),
  speechToSpeech: async (userId: string, voiceId: string, audio: Blob) => ({
    audio: new Response(new Uint8Array([0xff, 0xfb])).body!,
    characterCount: 500,
  }),
  deleteVoice: async () => undefined,
  getSubscriptionForUser: async (userId: string) => ({
    tier: "starter",
    characterCount: 0,
    characterLimit: 30000,
    voiceLimit: 10,
    voiceUsed: 0,
    canExtendCharacterLimit: false,
    nextCharacterCountResetUnix: Math.floor(Date.now() / 1000) + 86400 * 30,
  }),
};
```

## Useful links

- SDK source: <https://github.com/elevenlabs/elevenlabs-js>
- IVC guidance: <https://elevenlabs.io/docs/creative-platform/voices/voice-cloning/instant-voice-cloning>
- PVC guidance: <https://elevenlabs.io/docs/creative-platform/voices/voice-cloning/professional-voice-cloning>
- API reference: <https://elevenlabs.io/docs/api-reference>
- Status: <https://status.elevenlabs.io>

(These links are for engineers building the integration. They never appear in user-facing surfaces.)
