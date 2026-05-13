# Waveform Rendering

Canvas + `AnalyserNode` + `requestAnimationFrame`.

## Why not a library

Libraries like wavesurfer.js are great for full-file visualization. For LIVE waveforms during recording, a 30-line canvas component is simpler, faster, and avoids dependency weight.

## Component

```tsx
// components/studio/waveform.tsx
"use client";

import { useEffect, useRef } from "react";

interface WaveformProps {
  analyser: AnalyserNode | null;
  active: boolean;
  height?: number;
}

export function Waveform({ analyser, active, height = 64 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser || !active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent")
      .trim();

    const tick = () => {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.clientWidth, height);

      const barWidth = (canvas.clientWidth / data.length) * 2;
      let x = 0;
      ctx.fillStyle = `hsl(${accent})`;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 255;
        const barHeight = v * height;
        ctx.fillRect(x, (height - barHeight) / 2, barWidth - 1, barHeight);
        x += barWidth;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, active, height]);

  return <canvas ref={canvasRef} className="w-full" style={{ height }} />;
}
```

## AudioContext lifecycle

Browsers cap AudioContext instances per tab (~6 in Chrome). For parallel recording panels:

- Each panel creates one AudioContext on `start()`.
- Each panel closes its AudioContext on `stop()` AND on component unmount.
- If a user opens > 6 panels and starts all of them, the 7th `start()` will fail. Document this limit in the UI.

## Performance

- `fftSize: 256` — enough resolution for the bar chart, cheap enough for mobile.
- Always `cancelAnimationFrame` on cleanup.
- Don't update React state for every frame from the canvas component (it would cause re-renders). Read `analyser` directly inside the canvas effect.
