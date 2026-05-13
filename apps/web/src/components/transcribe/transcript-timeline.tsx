"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Edit3, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildSegments,
  formatTimecode,
  speakerColorClass,
  type TranscribedWord,
  type TranscriptSegment,
} from "@/lib/transcript-segments";

interface Props {
  words: TranscribedWord[];
  speakerNames: Record<string, string>;
  audio: HTMLAudioElement | null;
  currentTime: number;
  isPlaying: boolean;
  view: "segment" | "word";
  onPlaySegment: (start: number, end: number) => void;
  onSeek: (time: number) => void;
  onWordsChange: (next: TranscribedWord[]) => void;
  onSpeakerRename: (speakerId: string, name: string) => void;
}

export function TranscriptTimeline({
  words,
  speakerNames,
  currentTime,
  view,
  isPlaying,
  onPlaySegment,
  onSeek,
  onWordsChange,
  onSpeakerRename,
}: Props) {
  const t = useTranslations();
  const segments = useMemo(() => buildSegments(words, { speakerNames }), [words, speakerNames]);
  const activeSegmentIdx = useMemo(() => {
    if (!segments.length) return -1;
    let lo = 0;
    let hi = segments.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const seg = segments[mid]!;
      if (currentTime < seg.start) hi = mid - 1;
      else if (currentTime > seg.end) lo = mid + 1;
      else return mid;
    }
    return Math.max(0, hi);
  }, [segments, currentTime]);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeSegmentIdx < 0) return;
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-seg-idx="${activeSegmentIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSegmentIdx]);

  if (view === "word") {
    return (
      <div
        ref={containerRef}
        className="flex flex-wrap items-baseline gap-x-1 gap-y-1 rounded-lg border bg-card p-4"
      >
        {words.map((w, i) => (
          <WordChip
            key={`${i}-${w.start}`}
            word={w}
            active={w.start <= currentTime && currentTime < w.end}
            onClick={() => onSeek(w.start)}
            onEdit={(newText) => {
              const next = words.slice();
              next[i] = { ...next[i]!, text: newText };
              onWordsChange(next);
            }}
            speakerNames={speakerNames}
          />
        ))}
        {words.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("transcribe.viewer.empty")}</p>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-lg border bg-card">
      <ul className="divide-y">
        {segments.map((seg) => (
          <SegmentRow
            key={seg.index}
            segment={seg}
            active={seg.index === activeSegmentIdx}
            isPlaying={isPlaying}
            onPlay={() => onPlaySegment(seg.start, seg.end)}
            onSeek={() => onSeek(seg.start)}
            onTextChange={(newText) => {
              const next = words.slice();
              const segWords = next.slice(seg.wordStartIndex, seg.wordEndIndex + 1);
              if (segWords.length === 0) return;
              // Re-distribute new text across word slots proportionally; if only one word, just set it.
              const meaningful = segWords.filter((w) => w.type === "word" || w.type === "audio_event");
              if (meaningful.length === 1) {
                const idx = next.indexOf(meaningful[0]!);
                next[idx] = { ...next[idx]!, text: newText };
                onWordsChange(next);
                return;
              }
              const tokens = newText.split(/\s+/).filter(Boolean);
              for (let i = 0; i < meaningful.length; i++) {
                const idx = next.indexOf(meaningful[i]!);
                const token = tokens[i] ?? "";
                next[idx] = { ...next[idx]!, text: token };
              }
              onWordsChange(next);
            }}
            onSpeakerRename={(name) => {
              if (seg.speakerId) onSpeakerRename(seg.speakerId, name);
            }}
          />
        ))}
        {segments.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">
            {t("transcribe.viewer.empty")}
          </li>
        )}
      </ul>
    </div>
  );
}

function SegmentRow({
  segment,
  active,
  isPlaying,
  onPlay,
  onSeek,
  onTextChange,
  onSpeakerRename,
}: {
  segment: TranscriptSegment;
  active: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onSeek: () => void;
  onTextChange: (next: string) => void;
  onSpeakerRename: (name: string) => void;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(segment.text);
  const [editingSpeaker, setEditingSpeaker] = useState(false);
  const [speakerDraft, setSpeakerDraft] = useState(segment.speakerLabel ?? "");
  const isAudioEvent =
    segment.words.length === 1 && segment.words[0]?.type === "audio_event";

  useEffect(() => {
    setDraft(segment.text);
  }, [segment.text]);
  useEffect(() => {
    setSpeakerDraft(segment.speakerLabel ?? "");
  }, [segment.speakerLabel]);

  return (
    <li
      data-seg-idx={segment.index}
      className={cn(
        "flex items-start gap-3 p-3 transition-colors",
        active ? "bg-accent/5" : "hover:bg-muted/30",
      )}
    >
      <button
        type="button"
        onClick={onSeek}
        className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
        aria-label={t("transcribe.viewer.seekTo", { time: formatTimecode(segment.start) })}
      >
        {formatTimecode(segment.start)} → {formatTimecode(segment.end)}
      </button>

      <div className="min-w-0 flex-1">
        {segment.speakerId && (
          <div className="mb-1 flex items-center gap-1.5">
            {editingSpeaker ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSpeakerRename(speakerDraft.trim() || segment.speakerLabel || "");
                  setEditingSpeaker(false);
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={speakerDraft}
                  onChange={(e) => setSpeakerDraft(e.target.value)}
                  onBlur={() => {
                    onSpeakerRename(speakerDraft.trim() || segment.speakerLabel || "");
                    setEditingSpeaker(false);
                  }}
                  className="h-6 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setEditingSpeaker(true)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  speakerColorClass(segment.speakerId),
                )}
              >
                {segment.speakerLabel}
              </button>
            )}
          </div>
        )}

        {isAudioEvent ? (
          <p className="italic text-muted-foreground">{segment.text}</p>
        ) : editing ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (draft !== segment.text) onTextChange(draft);
            }}
            className="w-full resize-none bg-transparent text-sm outline-none"
            rows={Math.max(1, Math.ceil(draft.length / 80))}
          />
        ) : (
          <p
            className={cn("cursor-text whitespace-pre-wrap text-sm leading-relaxed", active && "font-medium")}
            onClick={() => setEditing(true)}
          >
            {segment.text}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setEditing(true)}
          aria-label={t("transcribe.viewer.editSegment")}
        >
          <Edit3 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onPlay}
          aria-label={t("transcribe.viewer.playSegment")}
        >
          {active && isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </li>
  );
}

function WordChip({
  word,
  active,
  onClick,
  onEdit,
  speakerNames,
}: {
  word: TranscribedWord;
  active: boolean;
  onClick: () => void;
  onEdit: (next: string) => void;
  speakerNames: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(word.text);

  if (word.type === "spacing") return <span className="text-muted-foreground/40"> </span>;

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onEdit(draft);
          setEditing(false);
        }}
        className="inline"
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onEdit(draft);
            setEditing(false);
          }}
          className="inline-block rounded-md border border-input bg-transparent px-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          size={Math.max(2, draft.length)}
        />
      </form>
    );
  }

  if (word.type === "audio_event") {
    return (
      <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 text-xs italic text-muted-foreground">
        {word.text}
      </span>
    );
  }

  const speakerLabel = word.speakerId ? speakerNames[word.speakerId] : undefined;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") setEditing(true);
      }}
      className={cn(
        "inline-block cursor-pointer rounded-md px-0.5 text-sm transition-colors hover:bg-muted",
        active && "bg-accent/15 text-foreground",
      )}
      title={speakerLabel ? `${speakerLabel} · ${word.start.toFixed(2)}s` : `${word.start.toFixed(2)}s`}
    >
      {word.text}
    </span>
  );
}

export function CheckIconStub() {
  return <Check className="h-3 w-3" />;
}
