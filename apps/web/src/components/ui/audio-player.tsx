"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src: string;
  /** Show duration if known up-front; otherwise the player will read it from metadata. */
  initialDuration?: number;
  className?: string;
}

function format(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, initialDuration, className }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(initialDuration ?? 0);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onLoaded = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    };
    const onTime = () => setCurrent(el.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else void el.play();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = pct * duration;
    setCurrent(pct * duration);
  };

  const trackHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHover(pct * duration);
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const hoverPct = hover !== null && duration > 0 ? (hover / duration) * 100 : null;

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-muted/20 px-3 py-2",
        className,
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
          playing
            ? "bg-accent text-accent-foreground"
            : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          aria-valuenow={Math.round(current)}
          aria-valuemax={Math.round(duration)}
          aria-valuemin={0}
          tabIndex={0}
          onClick={seek}
          onMouseMove={trackHover}
          onMouseLeave={() => setHover(null)}
          className="group relative h-1.5 cursor-pointer rounded-full bg-border"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
          {hoverPct !== null && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-foreground/10"
              style={{ width: `${hoverPct}%` }}
            />
          )}
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{format(current)}</span>
          <span>{format(duration)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
