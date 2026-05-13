# TTS Settings — Definitive Matrix

> Used by **Phase 11**. All user-tunable knobs on a TTS / S2S generation, how they map to the SDK, what validation runs server-side, and how the UI presents them.

## All settings the UI exposes

| UI control | SDK field | Type / range | Default | Notes |
|------------|-----------|--------------|---------|-------|
| Text input | `text` | string | — | TTS only. Length capped by `model.maximumTextLengthPerRequest`. |
| Audio input | `audio` | Blob | — | S2S only. MIME + duration validated. |
| Voice selector | `voiceId` | string | — | From user's clones OR `library_voices.upstreamVoiceId`. |
| Model | `modelId` | string | `eleven_multilingual_v2` | Filtered by `canDoTextToSpeech` / `canDoVoiceConversion`. |
| Stability | `voiceSettings.stability` | 0–1 | 0.5 | Low = expressive, high = monotone. |
| Similarity | `voiceSettings.similarityBoost` | 0–1 | 0.75 | Fidelity to source voice (too high = artifacts). |
| Style | `voiceSettings.style` | 0–1 | 0 | Disabled when `model.canUseStyle === false`. |
| Speaker boost | `voiceSettings.useSpeakerBoost` | bool | true | Disabled when `model.canUseSpeakerBoost === false`. |
| Speed | `voiceSettings.speed` | 0.7–1.2 | 1.0 | Verify SDK key — sent inside `voiceSettings`. |
| Output format | `outputFormat` | enum | `mp3_44100_128` | Tier-gated, see table below. |

## Model dropdown population

```ts
// GET /models → frontend filters by surface
const ttsModels = response.models.filter(
  m => m.canDoTextToSpeech && !m.requiresAlphaAccess,
);
const s2sModels = response.models.filter(
  m => m.canDoVoiceConversion && !m.requiresAlphaAccess,
);
```

| Model ID | Speed | Quality | When to pick |
|----------|-------|---------|--------------|
| `eleven_multilingual_v2` | Slow | Highest | Default. 29+ languages. |
| `eleven_turbo_v2_5` | Mid | High | Latency-sensitive UX. |
| `eleven_flash_v2_5` | Fast | Decent | Real-time / streaming. |
| `eleven_v3` | varies | varies | Newest if `list()` returns it. |
| `eleven_multilingual_sts_v2` | — | High | S2S only. |

The dropdown shows the model `name`; we send `modelId`.

## Voice settings (`voiceSettings` object)

The SDK accepts an object with these fields:

```ts
type VoiceSettings = {
  stability?: number;          // 0–1
  similarityBoost?: number;    // 0–1
  style?: number;              // 0–1, v2+ models
  useSpeakerBoost?: boolean;
  speed?: number;              // 0.7–1.2
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  speed: 1.0,
};
```

### Per-knob guidance

- **`stability`** — drop to 0.2–0.4 for expressive narration, 0.6–0.8 for consistent corporate read.
- **`similarityBoost`** — 0.75 default. Push to 0.9+ only if the voice sounds drifty; over 0.9 introduces artifacts.
- **`style`** — leave at 0 unless the source clone has strong stylistic traits to exaggerate. Not an "emotion knob."
- **`useSpeakerBoost`** — almost always true for clones; turn off for raw waveform debugging.
- **`speed`** — 1.0 default. Below 0.85 sounds drunk; above 1.15 sounds clipped. Tune in 0.05 steps.

### S2S note

`speechToSpeech.convert` accepts `voiceSettings` as a JSON string (per current SDK signature):

```ts
voiceSettings: JSON.stringify(settings),
```

Not a typo — TTS takes the object; S2S takes the stringified JSON. Keep these wrappers consistent in `voice-ai.ts`.

## Output format — tier-gated

| Format | Bitrate / kind | Tier allowed |
|--------|---------------|--------------|
| `mp3_44100_128` | 128 kbps | Free, Basic, Pro, Enterprise |
| `mp3_44100_192` | 192 kbps | Pro, Enterprise |
| `mp3_44100_64` | 64 kbps | (legacy; not exposed) |
| `pcm_44100` | uncompressed 44.1 kHz | Enterprise |
| `pcm_22050` | uncompressed 22 kHz | (not exposed) |
| `ulaw_8000` | telephony codec | (not exposed) |

### Validation pattern

```ts
const TIER_FORMATS: Record<Tier, OutputFormat[]> = {
  free:        ["mp3_44100_128"],
  basic:       ["mp3_44100_128"],
  pro:         ["mp3_44100_128", "mp3_44100_192"],
  enterprise:  ["mp3_44100_128", "mp3_44100_192", "pcm_44100"],
};

function assertFormatAllowed(tier: Tier, fmt: OutputFormat): void {
  if (!TIER_FORMATS[tier].includes(fmt)) {
    throw new AppError("OUTPUT_FORMAT_NOT_ALLOWED", 403);
  }
}
```

Frontend pre-filters the dropdown; backend re-validates (defense in depth).

## Putting it all together — TTS call

```ts
// apps/api/src/services/voice-ai.ts
export async function generateSpeech(
  userId: string,
  voiceId: string,
  text: string,
  opts: {
    modelId?: string;
    settings?: VoiceSettings;
    outputFormat?: OutputFormat;
  } = {},
): Promise<{ audio: ReadableStream; characterCount: number }> {
  const client = await getClientForUser(userId);
  const modelId = opts.modelId ?? "eleven_multilingual_v2";
  const settings = { ...DEFAULT_VOICE_SETTINGS, ...opts.settings };
  const outputFormat = opts.outputFormat ?? "mp3_44100_128";

  return withRetry(async () => {
    const { data, rawResponse } = await client.textToSpeech
      .convert(voiceId, {
        text,
        modelId,
        voiceSettings: settings,
        outputFormat,
      })
      .withRawResponse();

    const characterCount =
      Number(rawResponse.headers?.get("x-character-count") ?? text.length) ||
      text.length;
    if (!data) throw new VoiceAIError("UNKNOWN_UPSTREAM_FAILURE", 500);
    return { audio: data as unknown as ReadableStream, characterCount };
  });
}
```

## Route handler — validation order

```ts
// POST /voices/:id/generate
1. requireAuth + requireVerified
2. Body schema (zod): { text, modelId?, settings?, outputFormat? }
3. Ownership: voice belongs to user OR is a library voice
4. Tier gate: format allowed for user's tier
5. Model gate: modelId exists, canDoTextToSpeech, !requiresAlphaAccess
6. Length gate: text.length <= model.maximumTextLengthPerRequest
7. Free credit quote (if tier === free): balance >= quote(text.length)
8. Call service
9. On success — Free: charge credits (using x-character-count); Paid: no local charge
10. Persist `generations` row with all settings + characterCount
```

## Mocking for tests

```ts
export const mockGenerateSpeech = async (
  userId: string,
  voiceId: string,
  text: string,
  opts: { modelId?: string; settings?: VoiceSettings; outputFormat?: OutputFormat } = {},
): Promise<{ audio: ReadableStream; characterCount: number }> => ({
  audio: new Response(new Uint8Array([0xff, 0xfb])).body!,
  characterCount: text.length,
});
```

Tests should cover:
- Default settings fill in missing knobs
- modelId outside allowed list → 400
- outputFormat outside tier → 403
- text length > model limit → 400
- Free user with insufficient credits → 402
- Per-knob persistence in `generations` row

## Useful links

- API ref: <https://elevenlabs.io/docs/api-reference/text-to-speech>
- Voice settings ref: <https://elevenlabs.io/docs/api-reference/voices/settings>
- Models ref: <https://elevenlabs.io/docs/api-reference/models/list>
