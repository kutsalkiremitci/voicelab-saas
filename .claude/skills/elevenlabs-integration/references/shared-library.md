# Shared Voice Library

> Used by **Phase 12 — Default Voice Library**. Lets all users (especially Free, who can't clone) pick a ready-made voice and generate speech.

## SDK call

```ts
// apps/api/src/services/library-voices.ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_DEMO_API_KEY });

const result = await client.voices.getShared({
  pageSize: 100,
  category: "professional",  // "professional" | "famous" | "high_quality" | "generated"
  gender: "female",          // "male" | "female" | "neutral"
  age: "young",              // "young" | "middle_aged" | "old"
  accent: "american",        // free-form string
  language: "en",            // ISO-639-1
  search: "warm",            // free-text search
  featured: true,
  sort: "trending",          // "trending" | "latest" | "most_used"
});
```

**Use the operator demo key for sync** — sync is a backend cron / admin action, not a per-user request. Library voices are global, so caching by user key is wrong.

## Response shape

```ts
{
  voices: Array<{
    voiceId: string;
    name: string;
    description?: string;
    previewUrl: string;
    category: "professional" | "famous" | "high_quality" | "generated";
    gender?: string;
    age?: string;
    accent?: string;
    language?: string;
    labels?: Record<string, string>;
    usageCharacterCountOneY?: number;
    clonedByCount?: number;
    rate?: number;
    freeUsersAllowed?: boolean;
  }>;
  hasMore: boolean;
  lastSortId?: string;
}
```

## Curated catalog pattern

Don't expose the entire shared library. Sync a curated subset to local DB.

```ts
// Curated picks: array of upstream voiceIds chosen by operator
const CURATED = [
  "21m00Tcm4TlvDq8ikWAM",  // Rachel
  "AZnzlk1XvdvUeBnXmlld",  // Domi
  // ... ~20–30 voices
];

async function syncFromUpstream(): Promise<void> {
  const result = await client.voices.getShared({ pageSize: 100 });
  const filtered = result.voices.filter(v => CURATED.includes(v.voiceId));

  for (const v of filtered) {
    await db.insert(libraryVoices).values({
      upstreamVoiceId: v.voiceId,
      name: v.name,
      description: v.description,
      previewUrl: v.previewUrl,
      gender: v.gender,
      age: v.age,
      accent: v.accent,
      language: v.language,
      category: v.category,
      isActive: true,
    }).onConflictDoUpdate({
      target: libraryVoices.upstreamVoiceId,
      set: {
        name: v.name,
        previewUrl: v.previewUrl,
        // ...
      },
    });
  }
}
```

## Generating from a library voice

A library voice's `upstreamVoiceId` is a regular ElevenLabs voiceId. The TTS call is identical:

```ts
await client.textToSpeech.convert(libraryVoice.upstreamVoiceId, {
  text,
  modelId: "eleven_multilingual_v2",
  voiceSettings: { stability: 0.5, similarityBoost: 0.75 },
});
```

Free users use the demo key (already in `getClientForUser`). Paid users use their own key — library voices work the same.

## Preview audio

The `previewUrl` is a public ElevenLabs CDN URL. Two options:

1. **Pass through** — return `previewUrl` to frontend, browser fetches directly. Simple, exposes upstream domain.
2. **Proxy** — `GET /library/voices/:id/preview` fetches and streams the audio. Hides upstream, costs bandwidth.

Choose proxy for brand-silent policy (Hard Rule: upstream provider never visible).

## Cache

- Curated catalog rarely changes → cache the `list()` query result in Redis for 5 minutes
- Trigger re-sync via `POST /admin/library/sync` (admin only)
- Optionally: cron job every 24 hours

## Error handling

- 401/403 on demo key → operator misconfigured key, surface as 503 to user
- No retry — library reads are not the hot path
- Free user gating: `freeUsersAllowed` flag from upstream may filter — respect it

## Useful links

- SDK source: <https://github.com/elevenlabs/elevenlabs-js>
- API ref: <https://elevenlabs.io/docs/api-reference/voices/get-shared>
