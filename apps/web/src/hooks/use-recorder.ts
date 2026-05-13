"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

export interface UseRecorderOptions {
  maxDurationSec?: number;
  mimeType?: string;
  onStop?: (blob: Blob, durationSec: number, mime: string) => void;
  onError?: (err: Error) => void;
}

export interface UseRecorderReturn {
  state: RecorderState;
  duration: number;
  audioLevel: number;
  blob: Blob | null;
  blobUrl: string | null;
  analyser: AnalyserNode | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
  reset: () => void;
}

function pickSupportedMime(preferred?: string): string {
  const candidates = [preferred, "audio/webm;codecs=opus", "audio/webm", "audio/mp4"].filter(
    Boolean,
  ) as string[];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "audio/webm";
}

export function useRecorder(opts: UseRecorderOptions = {}): UseRecorderReturn {
  const maxDuration = opts.maxDurationSec ?? 300;
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);
  const mimeRef = useRef<string>("audio/webm");
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const stopAudioGraph = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setAnalyser(null);
  }, []);

  const tickLoop = useCallback(() => {
    const an = audioCtxRef.current?.createAnalyser ? null : null;
    void an;
    const node = (audioCtxRef.current as unknown as { _analyser?: AnalyserNode })?._analyser;
    if (!node) return;
    const data = new Uint8Array(node.frequencyBinCount);
    node.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] ?? 0;
    setAudioLevel(sum / (data.length * 255));

    const sec = accumulatedRef.current + (performance.now() - startTimeRef.current) / 1000;
    setDuration(sec);
    if (sec >= maxDuration) {
      void stopInternal();
      return;
    }
    rafRef.current = requestAnimationFrame(tickLoop);
  }, [maxDuration]);

  const stopInternal = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    const finalDuration =
      accumulatedRef.current + (performance.now() - startTimeRef.current) / 1000;
    const finalBlob = new Blob(chunksRef.current, { type: mimeRef.current });
    const url = URL.createObjectURL(finalBlob);
    setBlob(finalBlob);
    setBlobUrl(url);
    setDuration(finalDuration);
    setState("stopped");
    stopAudioGraph();
    optsRef.current.onStop?.(finalBlob, finalDuration, mimeRef.current);
  }, [stopAudioGraph]);

  const start = useCallback(async () => {
    try {
      chunksRef.current = [];
      accumulatedRef.current = 0;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickSupportedMime(opts.mimeType);
      mimeRef.current = mime;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      audioCtxRef.current = ctx;
      (audioCtxRef.current as unknown as { _analyser?: AnalyserNode })._analyser = an;
      setAnalyser(an);

      rec.start(250);
      startTimeRef.current = performance.now();
      setState("recording");
      rafRef.current = requestAnimationFrame(tickLoop);
    } catch (e) {
      stopAudioGraph();
      setState("idle");
      optsRef.current.onError?.(e as Error);
    }
  }, [opts.mimeType, stopAudioGraph, tickLoop]);

  const pause = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    accumulatedRef.current += (performance.now() - startTimeRef.current) / 1000;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "paused") return;
    rec.resume();
    startTimeRef.current = performance.now();
    setState("recording");
    rafRef.current = requestAnimationFrame(tickLoop);
  }, [tickLoop]);

  const stop = useCallback(async () => {
    await stopInternal();
  }, [stopInternal]);

  const reset = useCallback(() => {
    stopAudioGraph();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    chunksRef.current = [];
    accumulatedRef.current = 0;
    setBlob(null);
    setBlobUrl(null);
    setDuration(0);
    setAudioLevel(0);
    setState("idle");
  }, [blobUrl, stopAudioGraph]);

  useEffect(
    () => () => {
      stopAudioGraph();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    },
    [blobUrl, stopAudioGraph],
  );

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (state === "recording") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  return { state, duration, audioLevel, blob, blobUrl, analyser, start, pause, resume, stop, reset };
}
