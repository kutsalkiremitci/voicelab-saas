---
name: elevenlabs-integration
description: Use when calling the upstream voice AI provider for cloning (IVC or PVC), text-to-speech, speech-to-speech, speech-to-text (transcription), audio isolation (voice isolator), shared voice library browsing, model listing, or reading subscription state. Per-user managed keys (paid tiers) and a shared demo key (Free tier) resolved by a service layer. Use whenever the task mentions voice clone, IVC, PVC, TTS, generate speech, voice changer, speech-to-speech, speech-to-text, transcription, scribe, audio isolation, voice isolator, voice library, shared voices, ElevenLabsClient, xi-api-key, voice_id, model selection, plan usage, voice slots, or any backend code touching api.elevenlabs.io — even if "ElevenLabs" is not explicitly named.
---

# Voice AI Integration (Per-User Keys)

VoiceLab is a **managed reseller**: each paying user has their own upstream ElevenLabs subscription, provisioned manually by the operator. The user's API key is stored AES-encrypted in `users.elevenlabsApiKey`. Free users share one demo account via `ELEVENLABS_DEMO_API_KEY`.

All upstream calls flow through one service module that resolves the right key per user. The upstream provider's name **never** appears in user-facing UI, emails, or marketing copy.

## Symptoms (read this skill if any apply)

- Adding or modifying backend code that calls the upstream voice AI
- Designing retry, error handling, or caching
- Reading a user's subscription state (their quota / slot status)
- Choosing a model (`eleven_multilingual_v2`, `eleven_turbo_v2_5`, `eleven_flash_v2_5`)
- Listing available models for a TTS / S2S dropdown
- Wiring the SDK or migrating away from the deprecated package
- Implementing IVC (Quick Clone), PVC (Studio Clone), or Speech-to-Speech
- Implementing **Speech-to-Text** (transcription) — Phase 13
- Implementing **Audio Isolation** (voice isolator) — Phase 14
- Implementing **Shared Voice Library** (default voice catalog) — Phase 12
- Mocking the upstream provider in tests

## Red flags (resist these shortcuts)

- "Mention ElevenLabs in a tooltip / docs / email" → NEVER. Brand strategy is silent on upstream provider.
- "Pass the user's raw API key to the frontend so it can call directly" → NEVER. Key is backend-only, decrypted only at request time.
- "Cache the decrypted key in Redis for fast access" → NO. Decrypt per-request. Cached encrypted keys are pointless; cached plaintext keys are a security incident waiting.
- "Use the `elevenlabs` npm package, it's shorter" → NO. That's the deprecated v1.x. Always `@elevenlabs/elevenlabs-js`.
- "Share one client instance across users" → NO. Each user has their own key; instantiate `ElevenLabsClient` per request (cheap operation).
- "Free users can clone — they have access to upstream" → NO. Cloning gated to Basic+ by tier check at route handler, before this service is called.
- "Mix calm + angry + happy samples into one IVC clone, then control with voice_settings" → NO. IVC conditions on the sample at inference time; mixed-dynamic samples produce unpredictable output.
- "Skip the retry, it'll usually work" → NO, 3-attempt exponential backoff is mandatory on TTS and S2S.
- "Retry on 401 too, maybe it's transient" → NO, 401/402/422 skip retry.
- "Log the request body for debugging" → NO, never log audio bytes or API key. Audio is huge; key is sensitive.

## Non-negotiables

- SDK is `@elevenlabs/elevenlabs-js` (current). Never `elevenlabs` v1.x.
- Single integration point: `apps/api/src/services/voice-ai.ts`. Routes don't `import { ElevenLabsClient }` directly.
- User's key is decrypted **inline at request time**, scoped to a single SDK call, never persisted in memory beyond the request.
- Free users route through `ELEVENLABS_DEMO_API_KEY`; this is the only "shared key" surface, and only the operator's demo account.
- The upstream provider name (ElevenLabs) is never returned in any API response, never appears in any UI string, never logged in user-facing messages.
- Retry on TTS and S2S: exponential backoff (500ms / 1s / 2s), max 3 attempts. Skip retry on 401, 402, 422.
- Cache `getSubscription()` per-user for 60 seconds in Redis (`subscription:${userId}`).
- Persist `characterCount` per generation in DB (`generations.characterCount`).
- Default model: `eleven_multilingual_v2`. Other models can be enabled per-tier as config (admin-tunable rate per model).
- Errors thrown as `VoiceAIError(message, status, body?)` and mapped to `AppError` at the route boundary. Error messages NEVER include the upstream provider name.
- Test code uses mocks from `apps/api/test/mocks/voice-ai.ts`; real API never hit in CI.

## Service interface

```ts
// apps/api/src/services/voice-ai.ts

class VoiceAIService {
  // Returns a fresh ElevenLabsClient for this user, backed by their decrypted key.
  // For Free users, returns a client backed by ELEVENLABS_DEMO_API_KEY.
  // Decryption happens inline; the returned client is short-lived.
  async getClientForUser(userId: string): Promise<ElevenLabsClient>;

  async cloneVoice(
    userId: string,
    label: string,
    files: Blob[],
    kind: "ivc" | "pvc",
  ): Promise<{ voiceId: string }>;

  async generateSpeech(
    userId: string,
    voiceId: string,
    text: string,
    settings?: VoiceSettings,
  ): Promise<{ audio: ReadableStream; characterCount: number }>;

  async speechToSpeech(
    userId: string,
    voiceId: string,
    audio: Blob,
    settings?: VoiceSettings,
  ): Promise<{ audio: ReadableStream; characterCount: number }>;

  async deleteVoice(userId: string, voiceId: string): Promise<void>;

  // Cached 60s per-user
  async getSubscriptionForUser(userId: string): Promise<UpstreamSubscription>;
}
```

## Tier gates (route-level, before this service is called)

Tier gates live in the route handler, not in this service. The service trusts that the caller has verified tier access. For reference:

- Free → no cloning, no S2S, only TTS via demo voices (using `ELEVENLABS_DEMO_API_KEY`)
- Basic → IVC clone, TTS, S2S
- Pro → IVC + PVC clone, TTS, S2S
- Enterprise → everything

## Authoritative references

- `references/api-endpoints.md` — SDK usage for cloning + TTS + S2S, request/response shapes
- `references/error-handling.md` — status code → action mapping, retry policy, SDK error wrapping
- `references/credits-and-models.md` — model trade-offs, plan-tier characteristics, slot reasoning
- `references/per-user-key.md` — Key encryption/decryption, lifecycle, security guarantees
- `references/tts-settings.md` — **Phase 11** — definitive matrix for TTS/S2S knobs: model, voiceSettings (stability/similarity/style/speaker boost/speed), output format tier gates, route validation order
- `references/shared-library.md` — **Phase 12** — `voices.getShared()`, curated catalog sync, preview audio proxy
- `references/speech-to-text.md` — **Phase 13** — `speechToText.convert()`, transcription, scribe models, per-minute credit metering
- `references/audio-isolation.md` — **Phase 14** — `audioIsolation.convert()`, voice isolator, streamed output, persistence pattern
- `references/models.md` — **Phase 11 (model dropdown)** — `models.list()`, capability flags, per-user cache, validation on TTS/S2S routes

## Attribution

Some examples in `references/api-endpoints.md` are adapted from [elevenlabs/skills](https://github.com/elevenlabs/skills) (MIT). Original repo is the source of truth for SDK signatures; this skill adds VoiceLab-specific opinions (per-user key resolution, retry policy, brand-silence rules).

## Skill handoffs

- This client is invoked from a route or service? Switch to `backend-development` for where to wire it.
- Need to charge Free credits or check upstream balance? Switch to `billing-and-credits`.
- Generated audio needs to be saved? Switch to `storage-adapter`.
- UI for selecting a voice / configuring generation? Switch to `frontend-development`.
- Service done? Hand off to `test-driven-development` before any git action.
