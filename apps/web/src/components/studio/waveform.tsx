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
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent")
      .trim() || "hsl(220 90% 56%)";

    const tick = () => {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.clientWidth, height);
      const barCount = data.length;
      const barWidth = (canvas.clientWidth / barCount) * 1.5;
      let x = 0;
      ctx.fillStyle = accent;
      for (let i = 0; i < barCount; i++) {
        const v = (data[i] ?? 0) / 255;
        const barHeight = Math.max(2, v * height);
        ctx.fillRect(x, (height - barHeight) / 2, Math.max(1, barWidth - 1), barHeight);
        x += barWidth;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, active, height]);

  return <canvas ref={canvasRef} className="w-full rounded-md bg-muted" style={{ height }} />;
}
