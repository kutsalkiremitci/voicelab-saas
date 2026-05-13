export interface TranscribedWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "audio_event";
  speakerId?: string;
  logprob?: number;
}

export interface TranscriptSegment {
  index: number;
  start: number;
  end: number;
  text: string;
  speakerId?: string;
  speakerLabel?: string;
  words: TranscribedWord[];
  wordStartIndex: number;
  wordEndIndex: number;
}

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
  opts: { maxSegmentDurationSec?: number; silenceGapSec?: number; speakerNames?: Record<string, string> } = {},
): TranscriptSegment[] {
  const maxDuration = opts.maxSegmentDurationSec ?? 12;
  const silenceGap = opts.silenceGapSec ?? 0.4;
  const fallbackMap = new Map<string, string>();

  const segments: TranscriptSegment[] = [];
  let current: TranscribedWord[] = [];
  let startIndex = 0;
  let segmentStart: number | null = null;
  let lastEnd = 0;
  let currentSpeaker: string | undefined;

  const flush = (endIndex: number) => {
    if (current.length === 0) return;
    const first = current[0]!;
    const last = current[current.length - 1]!;
    const text = current
      .map((w) => w.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 0) {
      segments.push({
        index: segments.length,
        start: segmentStart ?? first.start,
        end: last.end,
        text,
        speakerId: currentSpeaker,
        speakerLabel: speakerLabelFor(currentSpeaker, opts.speakerNames, fallbackMap),
        words: [...current],
        wordStartIndex: startIndex,
        wordEndIndex: endIndex - 1,
      });
    }
    current = [];
    segmentStart = null;
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
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
      flush(i);
      if (isSpacing) {
        lastEnd = w.end;
        startIndex = i + 1;
        continue;
      }
    }

    if (current.length === 0) {
      segmentStart = w.start;
      currentSpeaker = w.speakerId;
      startIndex = i;
    }
    current.push(w);
    lastEnd = w.end;

    if (isAudioEvent) {
      flush(i + 1);
    }
  }

  flush(words.length);
  return segments;
}

export function formatTimecode(seconds: number): string {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const cs = Math.round((total - Math.floor(total)) * 100);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs
    .toString()
    .padStart(2, "0")}`;
}

const SPEAKER_PALETTE: ReadonlyArray<string> = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
];

export function speakerColorClass(speakerId: string | undefined): string {
  if (!speakerId) return "bg-muted text-muted-foreground";
  let hash = 0;
  for (let i = 0; i < speakerId.length; i++) {
    hash = (hash * 31 + speakerId.charCodeAt(i)) >>> 0;
  }
  return SPEAKER_PALETTE[hash % SPEAKER_PALETTE.length]!;
}
