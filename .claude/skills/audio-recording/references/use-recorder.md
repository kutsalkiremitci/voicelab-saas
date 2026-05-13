# useRecorder

The hook every recording panel uses. Multiple instances run independently.

## Contract

```ts
type RecorderState = "idle" | "recording" | "paused" | "stopped";

interface UseRecorderOptions {
  maxDurationSec?: number;        // default 300
  mimeType?: string;              // default "audio/webm;codecs=opus"
  onStop?: (blob: Blob, durationSec: number) => void;
  onError?: (err: Error) => void;
}

interface UseRecorderReturn {
  state: RecorderState;
  duration: number;               // live seconds
  audioLevel: number;              // 0..1, for waveform / VU meter
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
  reset: () => void;
}

function useRecorder(opts?: UseRecorderOptions): UseRecorderReturn;
```

## State machine

```
       start()                                 stop()
idle ─────────► recording ──────────────────────► stopped
                  │  ▲
            pause │  │ resume
                  ▼  │
                paused
```

`reset()` returns any state → `idle` and disposes the current blob.

## Implementation sketch

```ts
export function useRecorder(opts: UseRecorderOptions = {}): UseRecorderReturn {
  const maxDuration = opts.maxDurationSec ?? 300;
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickSupportedMime(opts.mimeType);
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        opts.onStop?.(blob, duration);
        setState("stopped");
      };

      // Audio level analyser
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      audioCtxRef.current = ctx;
      analyserRef.current = an;

      rec.start(250);
      startTimeRef.current = performance.now();
      setState("recording");
      tickLoop();
    } catch (e) {
      opts.onError?.(e as Error);
    }
  }, [opts, duration]);

  const tickLoop = () => {
    const an = analyserRef.current;
    if (!an) return;
    const data = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(data);
    const sum = data.reduce((a, b) => a + b, 0);
    setAudioLevel(sum / (data.length * 255));

    const sec = (performance.now() - startTimeRef.current) / 1000;
    setDuration(sec);
    if (sec >= maxDuration) {
      stop();
      return;
    }
    rafRef.current = requestAnimationFrame(tickLoop);
  };

  // cleanup
  useEffect(() => () => {
    rafRef.current && cancelAnimationFrame(rafRef.current);
    recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
  }, []);

  // ... pause, resume, stop, reset
  return { state, duration, audioLevel, start, pause, resume, stop, reset };
}
```

## Safari fallback

```ts
function pickSupportedMime(preferred?: string): string {
  const candidates = [preferred, "audio/webm;codecs=opus", "audio/mp4"].filter(Boolean) as string[];
  for (const m of candidates) if (MediaRecorder.isTypeSupported(m)) return m;
  return ""; // browser picks
}
```

## Parallel-safety

Each call to `useRecorder` produces fully independent refs. Two panels with their own hook instances:
- Acquire separate `MediaStream` (or share via global if optimized later)
- Hold separate `MediaRecorder` instances
- Maintain separate `AudioContext` (Chrome limits to 6 contexts per tab; design with this ceiling)
