# Models Listing

> Used by **Phase 11** model dropdown. Lets the frontend show which TTS / S2S models the user can pick.

## SDK call

```ts
// apps/api/src/services/voice-ai.ts
async function listModels(userId: string): Promise<UpstreamModel[]> {
  const cacheKey = `models:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const client = await getClientForUser(userId);
  const models = await client.models.list();

  await redis.set(cacheKey, JSON.stringify(models), "EX", 300); // 5 min
  return models;
}
```

**Cache per user, not globally.** Capabilities can differ by tier (some models gated to paid).

## Response shape

```ts
type UpstreamModel = {
  modelId: string;                                // "eleven_multilingual_v2"
  name: string;                                   // "Eleven Multilingual v2"
  description: string;
  canDoTextToSpeech: boolean;
  canDoVoiceConversion: boolean;                  // true = supports S2S
  canBeFinetuned: boolean;
  canUseStyle: boolean;                           // voiceSettings.style applies
  canUseSpeakerBoost: boolean;
  servesProVoices: boolean;
  requiresAlphaAccess: boolean;
  tokenCostFactor: number;
  maxCharactersRequestFreeUser: number;
  maxCharactersRequestSubscribedUser: number;
  maximumTextLengthPerRequest: number;
  languages: Array<{ languageId: string; name: string }>;
  modelRates?: Record<string, number>;
  concurrencyGroup?: string;
};
```

## Filtering for the UI

Frontend gets a filtered list per surface:

```ts
// TTS dropdown
const ttsModels = models.filter(m => m.canDoTextToSpeech && !m.requiresAlphaAccess);

// S2S dropdown
const s2sModels = models.filter(m => m.canDoVoiceConversion && !m.requiresAlphaAccess);
```

## Common TTS model IDs

| modelId | When |
|---------|------|
| `eleven_multilingual_v2` | Default. Best quality, 29+ languages. |
| `eleven_turbo_v2_5` | Faster, lower latency, slight quality drop. |
| `eleven_flash_v2_5` | Fastest, lowest latency. Real-time use. |
| `eleven_v3` | Newest if available. Verify via `list()`. |

## Common S2S model ID

| modelId | When |
|---------|------|
| `eleven_multilingual_sts_v2` | Default S2S model. |

## Route

```ts
// apps/api/src/routes/models.ts
app.get("/models", requireAuth, async (c) => {
  const user = c.get("user");
  const models = await listModels(user.id);
  return c.json({ models });
});
```

Cache header: `Cache-Control: private, max-age=300`.

## Validation on TTS/S2S routes

When a user passes `modelId` to `POST /voices/:id/generate`, validate against the cached model list. Don't trust the client.

```ts
const allowed = await listModels(userId);
if (!allowed.some(m => m.modelId === body.modelId && m.canDoTextToSpeech)) {
  throw new VoiceAIError("INVALID_MODEL", 400);
}
```

Pass `body.modelId` (validated) into `generateSpeech` instead of the hard-coded default.

## Mock

```ts
export const mockListModels = async (): Promise<UpstreamModel[]> => [
  {
    modelId: "eleven_multilingual_v2",
    name: "Eleven Multilingual v2",
    description: "Mock model",
    canDoTextToSpeech: true,
    canDoVoiceConversion: false,
    canBeFinetuned: false,
    canUseStyle: true,
    canUseSpeakerBoost: true,
    servesProVoices: false,
    requiresAlphaAccess: false,
    tokenCostFactor: 1,
    maxCharactersRequestFreeUser: 2500,
    maxCharactersRequestSubscribedUser: 5000,
    maximumTextLengthPerRequest: 5000,
    languages: [{ languageId: "en", name: "English" }],
  },
];
```

## Useful links

- API ref: <https://elevenlabs.io/docs/api-reference/models/list>
