"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  ListTree,
  LayoutList,
  RotateCcw,
  Trash2,
  Loader2,
  Languages,
  Clock,
  Users,
  CheckCircle2,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const [saving, setSaving] = useState(false);
  const [audioMissing, setAudioMissing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      setSaving(true);
      update.mutate(body, {
        onSuccess: () => {
          setSaving(false);
          setSavedAt(Date.now());
        },
        onError: () => {
          setSaving(false);
          toast.error(t("transcribe.viewer.saveFailed"));
        },
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [text, words, speakerNames, data, update, t]);

  // Re-derive text whenever words change.
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
    const onError = () => setAudioMissing(true);
    const onLoaded = () => setAudioMissing(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    el.addEventListener("error", onError);
    el.addEventListener("loadedmetadata", onLoaded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
      el.removeEventListener("error", onError);
      el.removeEventListener("loadedmetadata", onLoaded);
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

  const speakerCount = useMemo(() => {
    const ids = new Set<string>();
    for (const w of words) if (w.speakerId) ids.add(w.speakerId);
    return ids.size;
  }, [words]);

  const wordCount = useMemo(
    () => words.filter((w) => w.type === "word").length,
    [words],
  );

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

      <header className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{t13n.fileName}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(t13n.createdAt).toLocaleString()} ·{" "}
              {t("transcribe.viewer.modelLine", { model: t13n.model })}
              {edited && ` · ${t("transcribe.viewer.editedTag", { v: t13n.editVersion })}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SaveBadge saving={saving} savedAt={savedAt} edited={edited} />
            <ExportMenu transcriptionId={t13n.id} baseName={baseName} />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label={t("transcribe.viewer.delete")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <StatCell
            icon={Clock}
            label={t("transcribe.viewer.statDuration")}
            value={formatDuration(t13n.durationSec)}
          />
          <StatCell
            icon={Languages}
            label={t("transcribe.viewer.statLanguage")}
            value={`${t13n.language.toUpperCase()}${
              t13n.languageProbability > 0
                ? ` · ${Math.round(t13n.languageProbability * 100)}%`
                : ""
            }`}
          />
          <StatCell
            icon={Edit3}
            label={t("transcribe.viewer.statWords")}
            value={wordCount.toLocaleString()}
          />
          <StatCell
            icon={Users}
            label={t("transcribe.viewer.statSpeakers")}
            value={speakerCount > 0 ? String(speakerCount) : "—"}
          />
        </div>
      </header>

      <div className="sticky top-0 z-10 rounded-2xl border bg-card/95 p-3 shadow-sm backdrop-blur">
        <audio ref={audioRef} src={audioSrc} controls className="w-full" preload="metadata" />
        {audioMissing && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <div>
              <p className="font-medium">{t("transcribe.viewer.audioMissingTitle")}</p>
              <p className="text-destructive/80">{t("transcribe.viewer.audioMissingBody")}</p>
            </div>
            <Button variant="destructive" size="sm" className="h-8 gap-1.5" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3 w-3" />
              {t("transcribe.viewer.delete")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => setView("segment")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "segment"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ListTree className="h-3.5 w-3.5" />
            {t("transcribe.viewer.segmentView")}
          </button>
          <button
            type="button"
            onClick={() => setView("word")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "word"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
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

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("transcribe.viewer.confirmTitle")}
        description={t("transcribe.viewer.confirmDelete")}
        confirmLabel={t("transcribe.viewer.delete")}
        loading={del.isPending}
        onConfirm={async () => {
          await handleDelete();
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SaveBadge({
  saving,
  savedAt,
  edited,
}: {
  saving: boolean;
  savedAt: number | null;
  edited: boolean;
}) {
  const t = useTranslations();
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("transcribe.viewer.saving")}
      </span>
    );
  }
  if (savedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {t("transcribe.viewer.saved")}
      </span>
    );
  }
  if (edited) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <Edit3 className="h-3 w-3" />
        {t("transcribe.viewer.unsaved")}
      </span>
    );
  }
  return null;
}
