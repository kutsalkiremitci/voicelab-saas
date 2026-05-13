# Voice AI Integration — References

Map of files in this directory. Read only what the current task needs.

| File | Read when |
|------|-----------|
| `per-user-key.md` | Encrypting / decrypting per-user API keys; resolving the right client per user; stripping keys from responses |
| `api-endpoints.md` | Wiring the SDK, calling cloning (IVC/PVC) / TTS / S2S / subscription via `@elevenlabs/elevenlabs-js`; request/response shapes |
| `error-handling.md` | Designing retry, status-code mapping, wrapping SDK errors, brand-silent error messages |
| `credits-and-models.md` | Picking a model, surfacing plan info, deciding tier limits for cloning slots |
| `tts-settings.md` | **Phase 11** — full TTS/S2S settings matrix: model, voiceSettings (stability/similarity/style/speaker boost/speed), outputFormat tier gates, route validation order |
| `shared-library.md` | **Phase 12** — `voices.getShared()`, curated catalog sync, preview audio proxy |
| `speech-to-text.md` | **Phase 13** — `speechToText.convert()`, transcription, scribe models, per-minute credit metering |
| `audio-isolation.md` | **Phase 14** — `audioIsolation.convert()`, voice isolator, streamed output, persistence pattern |
| `models.md` | **Phase 11 (model dropdown)** — `models.list()`, capability flags, per-user cache, validation on TTS/S2S routes |
