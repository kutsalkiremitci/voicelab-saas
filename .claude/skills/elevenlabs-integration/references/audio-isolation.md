# Audio Isolation (Voice Isolator)

> Used by **Phase 14 — Voice Isolator**. Removes background noise, isolates speech. Returns clean audio stream.

## SDK call

```ts
// apps/api/src/services/voice-ai.ts
async function isolateVoice(
  userId: string,
  audio: Blob,
  fileFormat: "pcm_s16le_16" | "other" = "other",
): Promise<{ audio: ReadableStream }> {
  const client = await getClientForUser(userId);

  return withRetry(async () => {
    const { data, rawResponse } = await client.audioIsolation
      .convert({ audio, fileFormat })
      .withRawResponse();

    if (!data) throw new VoiceAIError("UNKNOWN_UPSTREAM_FAILURE", 500);
    return { audio: data as unknown as ReadableStream };
  });
}
```

## Input

- **audio:** Blob / File (multipart)
- **fileFormat:**
  - `other` (default) — encoded formats: mp3, wav, m4a, ogg, flac, webm
  - `pcm_s16le_16` — raw PCM, 16-bit, 16 kHz, mono, little-endian (lower latency, narrower use)

## Output

- Streaming audio (mp3 by default — verify response `content-type`)
- Empty response body type in OpenAPI = streamed binary, not JSON
- Pipe directly to client or persist via `StorageAdapter`

## Persistence pattern

```ts
// 1. Stream upstream response into storage
const upstream = await isolateVoice(userId, audioBlob);
const outputKey = storageKey(userId, "isolations", "mp3");
await storage.put(outputKey, upstream.audio);

// 2. Write DB row
await db.insert(isolations).values({
  userId,
  inputAudioKey: inputKey,
  outputAudioKey: outputKey,
});
```

## Credit metering

Upstream meters per audio duration. Charge similar to STT:

```ts
const PER_MINUTE_CREDITS = 50;  // tune based on real cost

function quoteIsolate(durationSec: number): number {
  return Math.ceil((durationSec / 60) * PER_MINUTE_CREDITS);
}
```

Charge AFTER success. If pre-upload duration unknown, charge based on input file analyzed server-side (ffprobe) before upstream call.

## Tier gating

Decide per pricing strategy:
- **Free allowed:** more friction → conversion → simpler UI gate (block when balance low)
- **Basic+ only:** cleaner cost story → 403 for Free

PLAN.md leaves this open. Default: Free allowed with per-minute charge (matches STT pattern).

## Retry

- Same as TTS: 3 attempts, skip 401/402/422
- Network 5xx → retry
- Invalid audio (422) → surface immediately

## Errors

| Upstream | Map to | User message |
|----------|--------|--------------|
| 422 | 400 `INVALID_AUDIO` | "Audio format not supported." |
| 413 | 413 `AUDIO_TOO_LARGE` | "File too large." |
| 5xx | 502 `UPSTREAM_FAILURE` | "Try again in a moment." |

## Mock

```ts
export const mockIsolate = async (
  userId: string,
  audio: Blob,
): Promise<{ audio: ReadableStream }> => ({
  audio: new Response(new Uint8Array([0xff, 0xfb])).body!,
});
```

## Useful links

- API ref: <https://elevenlabs.io/docs/api-reference/audio-isolation/convert>
