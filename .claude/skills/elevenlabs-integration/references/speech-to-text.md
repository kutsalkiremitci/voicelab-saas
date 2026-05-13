# Speech to Text (Transcription)

> Used by **Phase 13 — Speech to Text**. Audio in → text out. Available to all tiers.

## SDK call

```ts
// apps/api/src/services/voice-ai.ts
async function transcribe(
  userId: string,
  audio: Blob,
  opts: { languageCode?: string; diarize?: boolean; timestampsGranularity?: "word" | "character" } = {},
): Promise<TranscriptionResult> {
  const client = await getClientForUser(userId);

  return withRetry(async () => {
    const result = await client.speechToText.convert({
      file: audio,
      modelId: "scribe_v1",           // or "scribe_v2"
      languageCode: opts.languageCode, // ISO-639-1 (en, tr, ...) — optional, auto-detected
      diarize: opts.diarize ?? false,
      timestampsGranularity: opts.timestampsGranularity ?? "word",
    });
    return result;
  });
}
```

## Response shape

```ts
{
  languageCode: string;            // detected (or echoed)
  languageProbability: number;     // 0–1
  text: string;                    // full transcript
  words: Array<{
    text: string;
    start: number;                 // seconds
    end: number;
    type: "word" | "spacing" | "audio_event";
    speakerId?: string;            // only if diarize=true
    logprob?: number;
  }>;
}
```

For VoiceLab persistence, store:
- `text` → `transcriptions.text`
- `languageCode` → `transcriptions.language`
- `audio.size` → derive `durationSec` (or compute via Web Audio on frontend before upload)
- Full `words` JSON → optional column for timestamp UI later

## Models

| Model | When |
|-------|------|
| `scribe_v1` | Default. Production stable. |
| `scribe_v2` | Newer. Better accuracy for some languages. |

Expose as dropdown only if there's a noticeable user-facing difference. Default v1.

## Input

- **Formats:** all major audio/video (mp3, wav, m4a, ogg, flac, webm, mp4, mov, ...)
- **Max size:** 3.0 GB (multipart upload) / 2 GB (`cloudStorageUrl`)
- **Min duration:** 100 ms
- **Validate on backend:** MIME + magic-byte before upload to upstream

## Async / webhook mode

For files > ~30 min, pass `webhook: true` and a callback URL. Upstream POSTs back when done. Phase 13 starts with sync only; webhook is a future addition.

## Credit metering (Free tier)

Upstream charges per minute, not character. Quote at `FreeCreditsService`:

```ts
// 1 minute = N credits — pick rate so 1000 credits ≈ 30 min
const PER_MINUTE_CREDITS = 33;

function quoteTranscribe(durationSec: number): number {
  return Math.ceil((durationSec / 60) * PER_MINUTE_CREDITS);
}
```

Charge AFTER successful transcription (read duration from response, not pre-upload estimate).

## Retry policy

- Retry on 5xx + network
- **No retry** on 422 (invalid audio), 413 (too large), 401, 402
- Same retry helper as TTS

## Errors

| Upstream | Map to | User message |
|----------|--------|--------------|
| 422 invalid format | 400 `INVALID_AUDIO` | "Audio format not supported. Try MP3 or WAV." |
| 413 too large | 413 `AUDIO_TOO_LARGE` | "File too large. Trim it under 3 GB." |
| Audio < 100ms | 400 `AUDIO_TOO_SHORT` | "Audio too short to transcribe." |
| 401 demo key bad | 503 | "Service temporarily unavailable." |

## Mock for tests

```ts
export const mockTranscribe = async (
  userId: string,
  audio: Blob,
): Promise<TranscriptionResult> => ({
  languageCode: "en",
  languageProbability: 0.98,
  text: "Mock transcription output.",
  words: [
    { text: "Mock", start: 0, end: 0.4, type: "word" },
    { text: "transcription", start: 0.5, end: 1.2, type: "word" },
  ],
});
```

## Useful links

- API ref: <https://elevenlabs.io/docs/api-reference/speech-to-text/convert>
