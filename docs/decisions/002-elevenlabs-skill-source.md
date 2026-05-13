# ADR-002: ElevenLabs Skill Source & SDK Choice

**Date:** 2026-05-13
**Status:** Accepted

## Context

ElevenLabs publishes an official skills repository at <https://github.com/elevenlabs/skills> (MIT licensed, 196+ stars at time of decision). The collection contains skills for text-to-speech, speech-to-text, agents, sound-effects, music, voice-changer, voice-isolator, and API key setup.

Two related questions arose:

1. Should we install `elevenlabs/skills` directly (via `npx skills add elevenlabs/skills`) or maintain our own `elevenlabs-integration` skill?
2. Which JavaScript SDK should we use?

## Decisions

**1. Keep our own `elevenlabs-integration` skill. Do not install elevenlabs/skills wholesale.**

Reasons:
- **Scope mismatch.** Our Package A use case needs voice cloning + TTS only. The repo has 8 skills; 6 are irrelevant (speech-to-text, agents, sfx, music, voice-changer, voice-isolator). Installing all would pollute the skill map and risk false triggers.
- **Voice cloning is missing.** The customer's core flow is *"record once → clone my voice → TTS forever."* The repo's text-to-speech skill assumes a `voice_id` already exists. Voice cloning is not a separate skill in the repo — it's a single SDK method call (`voices.ivc.create()`), so the repo doesn't cover the front half of our flow.
- **Opinion ownership.** Our retry policy (3-attempt backoff, skip 401/402/422), 60s Redis cache for subscription, `x-character-count` persistence, and key-backend-only stance are project decisions, not generic ElevenLabs guidance. Putting them in our own skill keeps them visible and revisable.

We do borrow SDK signatures and code patterns from `elevenlabs/skills/text-to-speech` (MIT, attributed in `references/api-endpoints.md`).

**2. Use `@elevenlabs/elevenlabs-js` (current). Never `elevenlabs` (deprecated v1.x).**

The official repo explicitly warns against the legacy `elevenlabs` npm package. The current line is `@elevenlabs/*`:
- `@elevenlabs/elevenlabs-js` — server / Node / Bun
- `@elevenlabs/client` — browser
- `@elevenlabs/react` — React hooks

For our backend, only `@elevenlabs/elevenlabs-js` is needed.

## Consequences

- The skill remains small (3 reference files, ~600 lines total) and project-specific.
- SDK upgrades are isolated to the service module + error-handling wrapper; routes don't see ElevenLabs types directly.
- If ElevenLabs ships a `voice-cloning` skill in their repo, we revisit; until then, our coverage is more complete than theirs for our use case.

## When to revisit

- ElevenLabs adds a `voice-cloning` skill upstream → compare and possibly adopt their reference material
- We expand scope beyond Package A (multi-voice, multi-user) → re-evaluate granularity of the skill
- The SDK has a breaking change → bump pin, refresh `references/api-endpoints.md` from latest upstream skill version
- Quarterly: spot-check `elevenlabs/skills` for relevant updates and refresh attributed sections

## Attribution

Code examples in `.claude/skills/elevenlabs-integration/references/api-endpoints.md` adapted from `elevenlabs/skills/text-to-speech` (MIT, © ElevenLabs). Local additions: retry wrapper, error wrapping pattern, character-count persistence, Redis cache.
