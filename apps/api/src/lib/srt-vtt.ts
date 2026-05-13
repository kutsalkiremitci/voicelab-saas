import type { TranscribedWord } from "@voicelab/db/schema";

export interface SegmentBuildOptions {
  maxSegmentDurationSec?: number;
  silenceGapSec?: number;
  speakerNames?: Record<string, string>;
}

export interface TranscriptSegment {
  index: number;
  start: number;
  end: number;
  text: string;
  speakerId?: string;
  speakerLabel?: string;
  words: TranscribedWord[];
}

const DEFAULT_MAX_SEGMENT_DURATION = 12;
const DEFAULT_SILENCE_GAP = 0.4;

function speakerLabelFor(
  speakerId: string | undefined,
  speakerNames: Record<string, string> | undefined,
  fallbackMap: Map<string, string>,
): string | undefined {
  if (!speakerId) return undefined;
  const named = speakerNames?.[speakerId];
  if (named && named.trim().length > 0) return named;
  let fallback = fallbackMap.get(speakerId);
  if (!fallback) {
    fallback = `Speaker ${fallbackMap.size + 1}`;
    fallbackMap.set(speakerId, fallback);
  }
  return fallback;
}

export function buildSegments(
  words: TranscribedWord[],
  opts: SegmentBuildOptions = {},
): TranscriptSegment[] {
  const maxDuration = opts.maxSegmentDurationSec ?? DEFAULT_MAX_SEGMENT_DURATION;
  const silenceGap = opts.silenceGapSec ?? DEFAULT_SILENCE_GAP;
  const fallbackMap = new Map<string, string>();

  const segments: TranscriptSegment[] = [];
  let current: TranscribedWord[] = [];
  let segmentStart: number | null = null;
  let lastEnd = 0;
  let currentSpeaker: string | undefined;

  const flush = () => {
    if (current.length === 0) return;
    const first = current[0]!;
    const last = current[current.length - 1]!;
    const start = segmentStart ?? first.start;
    const end = last.end;
    const text = current
      .map((w) => w.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 0) {
      segments.push({
        index: segments.length,
        start,
        end,
        text,
        speakerId: currentSpeaker,
        speakerLabel: speakerLabelFor(currentSpeaker, opts.speakerNames, fallbackMap),
        words: [...current],
      });
    }
    current = [];
    segmentStart = null;
  };

  for (const w of words) {
    const isSpacing = w.type === "spacing";
    const isAudioEvent = w.type === "audio_event";
    const spacingExceedsGap = isSpacing && current.length > 0 && w.end - w.start >= silenceGap;
    const wordGap = segmentStart === null ? 0 : w.start - lastEnd;
    const duration = segmentStart === null ? 0 : w.end - segmentStart;
    const speakerChanged =
      w.speakerId !== undefined && currentSpeaker !== undefined && w.speakerId !== currentSpeaker;

    if (
      current.length > 0 &&
      (spacingExceedsGap || wordGap >= silenceGap || duration >= maxDuration || speakerChanged || isAudioEvent)
    ) {
      flush();
      if (isSpacing) {
        // Spacing that triggered a flush should not start the next segment
        lastEnd = w.end;
        continue;
      }
    }

    if (current.length === 0) {
      segmentStart = w.start;
      currentSpeaker = w.speakerId;
    }
    current.push(w);
    lastEnd = w.end;

    if (isAudioEvent) {
      flush();
    }
  }

  flush();
  return segments;
}

function pad(value: number, width: number): string {
  return value.toString().padStart(width, "0");
}

export function formatSrtTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const millis = Math.round((total - Math.floor(total)) * 1000);
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(millis, 3)}`;
}

export function formatVttTime(seconds: number): string {
  return formatSrtTime(seconds).replace(",", ".");
}

export function renderSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, i) => {
      const cue = `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}`;
      const body = seg.speakerLabel ? `${seg.speakerLabel}: ${seg.text}` : seg.text;
      return `${cue}\n${body}`;
    })
    .join("\n\n")
    .concat("\n");
}

export function renderVtt(segments: TranscriptSegment[]): string {
  const body = segments
    .map((seg, i) => {
      const cue = `${i + 1}\n${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}`;
      const line = seg.speakerLabel ? `<v ${seg.speakerLabel}>${seg.text}</v>` : seg.text;
      return `${cue}\n${line}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

export function srtToVtt(srt: string): string {
  const normalized = srt.replace(/\r\n/g, "\n").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${normalized.trim()}\n`;
}

export function renderTxt(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => (seg.speakerLabel ? `${seg.speakerLabel}: ${seg.text}` : seg.text))
    .join("\n")
    .concat("\n");
}

export interface SegmentedJsonExport {
  segments: Array<{
    index: number;
    start: number;
    end: number;
    text: string;
    speakerId?: string;
    speaker?: string;
  }>;
}

export function renderSegmentedJson(segments: TranscriptSegment[]): SegmentedJsonExport {
  return {
    segments: segments.map((s) => ({
      index: s.index,
      start: s.start,
      end: s.end,
      text: s.text,
      speakerId: s.speakerId,
      speaker: s.speakerLabel,
    })),
  };
}

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch] ?? ch);
}

export function renderHtml(segments: TranscriptSegment[], title: string): string {
  const rows = segments
    .map((seg) => {
      const cue = `${formatSrtTime(seg.start)} → ${formatSrtTime(seg.end)}`;
      const speaker = seg.speakerLabel ? `<strong>${escapeHtml(seg.speakerLabel)}:</strong> ` : "";
      return `<tr><td class="t">${cue}</td><td>${speaker}${escapeHtml(seg.text)}</td></tr>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;color:#111}
h1{font-size:1.25rem;margin-bottom:1.5rem}
table{width:100%;border-collapse:collapse}
td{padding:.4rem .5rem;border-top:1px solid #eee;vertical-align:top}
td.t{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#666;white-space:nowrap;width:14ch}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<table>${rows}</table>
</body></html>
`;
}
