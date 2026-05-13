---
name: audio-recording
description: Use when implementing in-browser audio capture, playback, waveform rendering, parallel recording, or microphone UX. Use whenever the task mentions MediaRecorder, microphone, getUserMedia, AudioContext, AnalyserNode, waveform, audio player, recording panel, simultaneous recordings, blob upload, or audio progress — even if "audio" is not explicitly said.
---

# Audio Recording

## Symptoms (read this skill if any apply)

- Writing or modifying the `useRecorder` hook
- Building a recording panel UI
- Rendering a live waveform from a stream
- Coordinating multiple concurrent recordings on one page
- Handling microphone permission flow
- Uploading a recorded blob to the backend

## Red flags (resist these shortcuts)

- "I'll request mic permission on every recorder mount" → NO, request once and reuse the stream
- "setInterval is fine for the waveform" → NO, `requestAnimationFrame`
- "Forget about AudioContext cleanup" → NO, `audioContext.close()` on unmount
- "Don't worry about Safari, Chrome works" → NO, Safari needs `audio/mp4` fallback
- "Skip the beforeunload warning" → NO, mid-recording tab close loses data silently
- "All panels can share one MediaRecorder instance" → NO, each panel owns its own
- "fftSize 2048 looks smoother" → NO, 256 for mobile performance

## Non-negotiables

- Each recorder instance is independent. Multiple panels record in parallel without shared state.
- Default MIME: `audio/webm;codecs=opus`. Safari fallback: `audio/mp4`.
- Hard max: 5 minutes per recording. Auto-stop at limit with a visible warning.
- Cleanup is mandatory on unmount:
  - `stream.getTracks().forEach(t => t.stop())`
  - `audioContext.close()`
  - `URL.revokeObjectURL(blobUrl)` after preview consumption
- `beforeunload` warning while any recorder is in `recording` state.
- Waveform via `<canvas>` + `requestAnimationFrame` driving `AnalyserNode.getByteFrequencyData`. Never `setInterval`.
- `AnalyserNode.fftSize = 256`.

## Failure modes

- Mic permission denied → friendly error, no retry loop
- Tab backgrounded → recording continues, UI shows live state on return
- Mobile browser quirks → tested on iOS Safari and Chrome Android before merge

## Authoritative references

- `references/use-recorder.md` — hook contract, state machine, parallel-safety notes
- `references/waveform.md` — canvas rendering, AudioContext lifecycle
- `references/upload-flow.md` — blob → multipart → progress UI

## Skill handoffs

- The recording panel sits inside a page? Switch to `frontend-development` for the page-level composition once the hook is wired.
- Uploading the recorded blob? The endpoint and its contract live in `backend-development`.
- Hook complete and panel works? Hand off to `test-driven-development` before any git action.
