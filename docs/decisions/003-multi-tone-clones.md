# ADR-003: One IVC Clone Per Tone

**Date:** 2026-05-13
**Status:** Accepted

## Context

The user wants to generate TTS in their own voice across multiple emotional tones — calm, angry, happy, etc. — and select which tone to use per generation.

ElevenLabs offers several voice technologies:
1. **Instant Voice Cloning (IVC)** — clones from ≥ 1 minute of audio, available on Starter plan
2. **Professional Voice Cloning (PVC)** — fine-tunes the model on 30+ minutes, available on Creator plan ($22/mo)
3. **Voice Settings** — `stability`, `similarityBoost`, `style` sliders on every TTS call
4. **Voice Design** — prompt-based synthetic voice creation (not based on a real recording)

We had to decide how to model "same person, different tones."

## Decision

**Create one IVC clone per tone. Each clone has its own `voice_id` and a user-defined `label`.**

The data model: `voices` table gains a `label` column (text, not null, unique per user). Each row represents one tone clone. The user picks a row from the UI to generate against.

## Why not alternatives

**Why not "one clone + voice_settings.style to manufacture emotion"?**

ElevenLabs documentation is explicit: IVC conditions on the sample at inference time. *"A voice cloned from calm narration may sound different when asked to express strong emotion."* The `style` parameter exaggerates traits already present in the sample; it cannot synthesize an emotion that isn't there. Mixed-dynamic samples (calm + angry in one clone) produce *"less predictable results."*

In short: the AI replicates the performance it hears. To get angry output, the clone must hear angry input.

**Why not Professional Voice Cloning?**

PVC produces higher consistency across speech styles because it fine-tunes the model rather than conditioning at inference. However:
- Requires 30+ minutes of high-quality audio per voice
- Requires Creator plan ($22/mo) vs Starter ($5/mo)
- Significantly higher production effort for an MVP

PVC is the right answer if and when the user complains about tone consistency despite well-recorded IVC samples. Until then, IVC per tone is cheaper, faster to set up, and sufficient.

**Why not Voice Design?**

Voice Design generates a synthetic voice from a text description. The user wants *their own voice* in different tones — Voice Design doesn't satisfy that. Not applicable.

## Consequences

- The user must record themselves separately for each tone. UX must make this explicit (label per recording, clear "this clone represents *this* tone" framing).
- Voice slot budget matters. Starter has 10 slots; expected 3-5 tones leaves margin. The dashboard surfaces `voiceUsed / voiceLimit`.
- Generations carry the `voiceId` they were produced with → the history shows which tone produced what.
- Deleting a voice frees an upstream slot but breaks regenerate-with-same-tone for past generations of that voice. Acceptable trade-off; UI warns on delete.

## When to revisit

- User complains about tone consistency despite well-recorded IVC samples → evaluate PVC for the affected tone
- User wants more than 10 tones → upgrade to Creator (30 slots)
- ElevenLabs adds a native "emotion" axis on TTS that works without re-cloning → re-evaluate this entire decision
