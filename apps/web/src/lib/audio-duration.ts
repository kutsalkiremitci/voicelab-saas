/**
 * Decode an audio/video file's duration in the browser.
 *
 * Strategy:
 * 1. For small files (< 30 MB) try AudioContext.decodeAudioData for accuracy.
 * 2. Fall back to a hidden <audio> element + loadedmetadata for everything else
 *    (works for video files too, e.g. mp4/mov).
 */
export async function decodeMediaDuration(file: File): Promise<number> {
  const ACCURATE_THRESHOLD = 30 * 1024 * 1024;
  if (file.size <= ACCURATE_THRESHOLD && typeof window !== "undefined" && "AudioContext" in window) {
    try {
      return await decodeWithAudioContext(file);
    } catch {
      // fall through
    }
  }
  return decodeWithMetadata(file);
}

async function decodeWithAudioContext(file: File): Promise<number> {
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("AudioContext unavailable");
  const ctx = new Ctor();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buf = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return buf.duration;
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

async function decodeWithMetadata(file: File): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
    el.preload = "metadata";
    el.muted = true;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      el.remove();
    };
    el.onloadedmetadata = () => {
      const d = el.duration;
      cleanup();
      if (!Number.isFinite(d) || d <= 0) {
        reject(new Error("Could not determine duration"));
        return;
      }
      resolve(d);
    };
    el.onerror = () => {
      cleanup();
      reject(new Error("Failed to load media metadata"));
    };
    el.src = url;
  });
}

export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDurationPrecise(sec: number): string {
  const total = Math.max(0, sec);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  const whole = Math.floor(s);
  const cs = Math.round((s - whole) * 100);
  return `${m.toString().padStart(2, "0")}:${whole.toString().padStart(2, "0")}.${cs
    .toString()
    .padStart(2, "0")}`;
}
