"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, ListTree, LayoutList, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { TranscriptTimeline } from "@/components/transcribe/transcript-timeline";
import { ExportMenu } from "@/components/transcribe/export-menu";
import {
  useTranscription,
  useUpdateTranscription,
  useDeleteTranscription,
  type TranscribedWord,
} from "@/hooks/use-transcriptions";
import { formatDuration } from "@/lib/audio-duration";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export default function TranscriptionViewerPage({ params }: { params: Params }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { data, isLoading } = useTranscription(id);
  const update = useUpdateTranscription(id);
  const del = useDeleteTranscription();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [view, setView] = useState<"segment" | "word">("segment");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [text, setText] = useState<string>("");
  const [words, setWords] = useState<TranscribedWord[]>([]);
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setText(data.transcription.text);
    setWords(data.transcription.words);
    setSpeakerNames(data.transcription.options.speakerNames ?? {});
  }, [data]);

  // Autosave: when words/text/speakerNames change vs the server snapshot, debounce 2s and PATCH.
  useEffect(() => {
    if (!data) return;
    const snap = data.transcription;
    const wordsChanged = JSON.stringify(words) !== JSON.stringify(snap.words);
    const textChanged = text !== snap.text;
    const speakersChanged =
      JSON.stringify(speakerNames) !== JSON.stringify(snap.options.speakerNames ?? {});
    if (!wordsChanged && !textChanged && !speakersChanged) return;

    const timer = setTimeout(() => {
      const body: { text?: string; words?: TranscribedWord[]; speakerNames?: Record<string, string> } = {};
      if (textChanged) body.text = text;
      if (wordsChanged) body.words = words;
      if (speakersChanged) body.speakerNames = speakerNames;
      update.mutate(body, {
        onSuccess: () => setSavedAt(Date.now()),
        onError: () => toast.error(t("transcribe.viewer.saveFailed")),
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [text, words, speakerNames, data, update, t]);

  // Re-derive text whenever words change (so transcript text stays consistent with edited words).
  useEffect(() => {
    if (words.length === 0) return;
    const derived = words
      .map((w) => w.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (derived !== text) setText(derived);
  }, [words]); // eslint-disable-line react-hooks/exhaustive-deps

  // audio time tracking + stop-at logic
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrentTime(el.currentTime);
      if (stopAtRef.current !== null && el.currentTime >= stopAtRef.current) {
        el.pause();
        stopAtRef.current = null;
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
    };
  }, [data]);

  const handleSeek = (time: number) => {
    const el = audioRef.current;
    if (!el) return;
    stopAtRef.current = null;
    el.currentTime = time;
  };

  const handlePlaySegment = (start: number, end: number) => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying && Math.abs(el.currentTime - start) < 0.5 && stopAtRef.current === end) {
      el.pause();
      return;
    }
    el.currentTime = start;
    stopAtRef.current = end;
    void el.play();
  };

  const handleResetEdits = () => {
    if (!data) return;
    setWords(data.transcription.wordsOriginal);
    setText(data.transcription.textOriginal);
    setSpeakerNames({});
  };

  const handleDelete = async () => {
    if (!data) return;
    if (!window.confirm(t("transcribe.viewer.confirmDelete"))) return;
    try {
      await del.mutateAsync(data.transcription.id);
      toast.success(t("transcribe.viewer.deleted"));
      router.push("/app/transcriptions");
    } catch {
      toast.error(t("transcribe.viewer.deleteFailed"));
    }
  };

  const baseName = useMemo(() => {
    if (!data) return "transcript";
    return data.transcription.fileName.replace(/\.[^.]+$/, "");
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const t13n = data.transcription;
  const audioSrc = t13n.audioUrl;
  const edited = JSON.stringify(words) !== JSON.stringify(t13n.wordsOriginal);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs />
        <Link
          href="/app/transcriptions"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("transcribe.viewer.allTranscriptions")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{t13n.fileName}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDuration(t13n.durationSec)} · {t13n.language.toUpperCase()}
            {t13n.languageProbability > 0 &&
              ` (${Math.round(t13n.languageProbability * 100)}%)`}{" "}
            · {new Date(t13n.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-muted-foreground">
              {t("transcribe.viewer.saved")} · {new Date(savedAt).toLocaleTimeString()}
            </span>
          )}
          <ExportMenu transcriptionId={t13n.id} baseName={baseName} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDelete}
            aria-label={t("transcribe.viewer.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <audio ref={audioRef} src={audioSrc} controls className="w-full" preload="metadata" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => setView("segment")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
              view === "segment" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ListTree className="h-3.5 w-3.5" />
            {t("transcribe.viewer.segmentView")}
          </button>
          <button
            type="button"
            onClick={() => setView("word")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
              view === "word" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            {t("transcribe.viewer.wordView")}
          </button>
        </div>
        {edited && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleResetEdits}>
            <RotateCcw className="h-3 w-3" />
            {t("transcribe.viewer.resetEdits")}
          </Button>
        )}
      </div>

      <TranscriptTimeline
        words={words}
        speakerNames={speakerNames}
        audio={audioRef.current}
        currentTime={currentTime}
        isPlaying={isPlaying}
        view={view}
        onPlaySegment={handlePlaySegment}
        onSeek={handleSeek}
        onWordsChange={setWords}
        onSpeakerRename={(speakerId, name) => {
          setSpeakerNames((prev) => ({ ...prev, [speakerId]: name }));
        }}
      />
    </div>
  );
}
