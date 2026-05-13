"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Mic,
  Loader2,
  Sparkles,
  Upload as UploadIcon,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Square,
  Trash2,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { TranscribeDropzone } from "@/components/transcribe/transcribe-dropzone";
import {
  TranscribeSettings,
  DEFAULT_TRANSCRIBE_SETTINGS,
  type TranscribeSettingsValue,
} from "@/components/transcribe/transcribe-settings";
import { CostPreview } from "@/components/transcribe/cost-preview";
import { Waveform } from "@/components/studio/waveform";
import { decodeMediaDuration, formatDuration } from "@/lib/audio-duration";
import { uploadRecording } from "@/lib/upload";
import { useCreditBalance } from "@/hooks/use-credits";
import { useTranscribeQuote } from "@/hooks/use-transcribe-quote";
import { useRecorder } from "@/hooks/use-recorder";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GiB
const RECORD_MAX_SEC = 60 * 60; // 1 hour
const MIN_PANEL_W = 300;
const MAX_PANEL_W = 520;

type Source = "upload" | "record";

function blobExt(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

export default function TranscribeCreatePage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: credits } = useCreditBalance();
  const [source, setSource] = useState<Source>("upload");

  // Uploaded file path
  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [decoding, setDecoding] = useState(false);

  // Recorder path
  const recorder = useRecorder({
    maxDurationSec: RECORD_MAX_SEC,
    onError: (err) => {
      if (err.name === "NotAllowedError") {
        toast.error(t("transcribe.recorder.permissionDenied"));
      } else {
        toast.error(t("transcribe.recorder.failed", { msg: err.message }));
      }
    },
  });

  // Shared form state
  const [settings, setSettings] = useState<TranscribeSettingsValue>(DEFAULT_TRANSCRIBE_SETTINGS);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Right panel (collapsible like TTS Explore)
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(MAX_PANEL_W);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;
    function onMove(e: MouseEvent) {
      setPanelWidth(Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, window.innerWidth - e.clientX)));
    }
    function onUp() {
      setIsDragging(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  // Effective audio source for submission
  const effectiveBlob: Blob | null =
    source === "upload" ? file : (recorder.state === "stopped" ? recorder.blob : null);
  const effectiveDuration: number | null =
    source === "upload"
      ? durationSec
      : recorder.state === "stopped"
        ? recorder.duration
        : null;
  const effectiveFileName: string | null =
    source === "upload"
      ? file?.name ?? null
      : recorder.state === "stopped" && recorder.blob
        ? `recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${blobExt(recorder.blob.type || "audio/webm")}`
        : null;

  // STT bills every tier from the same `credits` pool. The TTS-side
  // `balance` field still reflects the free / upstream split — we read
  // the dedicated `transcribeBalance` field here.
  const balance = credits?.transcribeBalance ?? null;

  const { data: quote, isFetching: quoteLoading } = useTranscribeQuote({
    durationSec: effectiveDuration,
    keytermsCount: settings.keyterms.length,
    enabled: true,
  });

  const insufficient =
    quote !== null && quote !== undefined && balance !== null && quote.amount > balance;

  async function handleSelect(f: File) {
    setFile(f);
    setDurationSec(null);
    setDecoding(true);
    try {
      const d = await decodeMediaDuration(f);
      setDurationSec(d);
    } catch {
      setDurationSec(null);
    } finally {
      setDecoding(false);
    }
  }

  async function handleSubmit() {
    if (!effectiveBlob || insufficient || uploading) return;
    setUploading(true);
    setProgress(0);
    const form = new FormData();
    const mime = effectiveBlob.type || (source === "record" ? "audio/webm" : "application/octet-stream");
    const fileForUpload =
      effectiveBlob instanceof File
        ? effectiveBlob
        : new File([effectiveBlob], effectiveFileName ?? "audio", { type: mime });
    form.append("file", fileForUpload);
    if (effectiveDuration !== null) form.append("durationSec", String(effectiveDuration));
    if (settings.languageCode) form.append("languageCode", settings.languageCode);
    form.append("tagAudioEvents", String(settings.tagAudioEvents));
    form.append("noVerbatim", String(settings.noVerbatim));
    form.append("includeSubtitles", String(settings.includeSubtitles));
    form.append("diarize", String(settings.diarize));
    if (settings.numSpeakers !== undefined) form.append("numSpeakers", String(settings.numSpeakers));
    form.append("keyterms", JSON.stringify(settings.keyterms));
    form.append("model", "scribe_v2");

    try {
      const res = await uploadRecording<{ transcription: { id: string } }>(
        "/api/v1/transcriptions",
        form,
        { onProgress: (p) => setProgress(Math.round(p * 100)) },
      );
      toast.success(t("transcribe.uploadSuccess"));
      router.push(`/app/transcribe/${res.transcription.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        toast.error(t("transcribe.notEnoughCredits"));
      } else if (e instanceof Error) {
        toast.error(e.message.length > 80 ? t("transcribe.uploadFailed") : e.message);
      } else {
        toast.error(t("transcribe.uploadFailed"));
      }
    } finally {
      setUploading(false);
    }
  }

  function handleClearUpload() {
    setFile(null);
    setDurationSec(null);
  }

  const submitReady = !!effectiveBlob && !insufficient && !uploading && !decoding;
  const submitReason = insufficient
    ? t("transcribe.notEnoughCredits")
    : decoding
      ? t("transcribe.decoding")
      : !effectiveBlob
        ? source === "upload"
          ? t("transcribe.pickFile")
          : t("transcribe.recorder.startHint")
        : null;

  return (
    <div className="-m-6 flex h-[calc(100vh-1rem)] overflow-hidden">
      {/* LEFT — main interaction */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-3">
          <Breadcrumbs />
          {!panelOpen && (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t("transcribe.settingsOpen")}
              <PanelRightOpen className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t("transcribe.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("transcribe.sub")}</p>
            </div>
          </div>
          {balance !== null && (
            <div className="hidden rounded-lg border bg-card px-3 py-2 text-right md:block">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("transcribe.balanceLabel")}
              </p>
              <p className="text-base font-semibold tabular-nums">
                {balance.toLocaleString()}{" "}
                <span className="text-xs text-muted-foreground">{t("transcribe.creditsUnit")}</span>
              </p>
            </div>
          )}
        </header>

        {/* Source tabs */}
        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5 self-start">
          <button
            type="button"
            onClick={() => setSource("upload")}
            disabled={uploading || recorder.state === "recording"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
              source === "upload"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <UploadIcon className="h-3.5 w-3.5" />
            {t("transcribe.source.upload")}
          </button>
          <button
            type="button"
            onClick={() => setSource("record")}
            disabled={uploading}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
              source === "record"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Mic className="h-3.5 w-3.5" />
            {t("transcribe.source.record")}
          </button>
        </div>

        {/* Source content */}
        {source === "upload" ? (
          <TranscribeDropzone
            file={file}
            durationSec={durationSec}
            decoding={decoding}
            maxBytes={MAX_BYTES}
            onSelect={handleSelect}
            onClear={handleClearUpload}
            disabled={uploading}
          />
        ) : (
          <RecorderCard recorder={recorder} disabled={uploading} />
        )}

        {/* Cost + submit (always shown once we have an effective source) */}
        <div className="grid gap-4 md:grid-cols-2">
          <CostPreview
            quote={quote ?? null}
            loading={quoteLoading}
            durationSec={effectiveDuration}
            keytermsCount={settings.keyterms.length}
            balance={balance}
          />

          <div className="space-y-3 rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              {t("transcribe.actionTitle")}
            </div>
            <Button
              type="button"
              size="lg"
              disabled={!submitReady}
              onClick={handleSubmit}
              className="w-full gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              {uploading ? t("transcribe.uploading") : t("transcribe.submit")}
            </Button>
            {submitReason && !uploading && (
              <p
                className={cn(
                  "text-xs",
                  insufficient ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {submitReason}
              </p>
            )}
            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span>{t("transcribe.uploading")}</span>
                  <span className="tabular-nums text-muted-foreground">{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {progress >= 100 && (
                  <p className="text-[11px] text-muted-foreground">{t("transcribe.processing")}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT — collapsible settings panel */}
      {panelOpen && (
        <div
          className="relative flex shrink-0 flex-col overflow-hidden border-l bg-background"
          style={{ width: panelWidth }}
        >
          <div
            className={cn(
              "group absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize",
              isDragging && "bg-primary/20",
            )}
            onMouseDown={() => setIsDragging(true)}
          >
            <div className="absolute left-0 top-1/2 h-10 w-full -translate-y-1/2 rounded bg-border opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{t("transcribe.settingsTitle")}</span>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("transcribe.settingsClose")}
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <TranscribeSettings
              value={settings}
              onChange={setSettings}
              disabled={uploading}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RecorderCard({
  recorder,
  disabled,
}: {
  recorder: ReturnType<typeof useRecorder>;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const isRec = recorder.state === "recording";
  const isPaused = recorder.state === "paused";
  const isDone = recorder.state === "stopped";

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="relative overflow-hidden rounded-xl bg-muted/40">
        <Waveform analyser={recorder.analyser} active={isRec} height={96} />
        {!isRec && !isPaused && !isDone && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            {t("transcribe.recorder.idleHint")}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-2 w-2 rounded-full",
              isRec ? "animate-pulse bg-destructive" : isPaused ? "bg-amber-500" : isDone ? "bg-emerald-500" : "bg-muted-foreground/40",
            )}
          />
          <span className="font-medium">
            {isRec
              ? t("transcribe.recorder.statusRecording")
              : isPaused
                ? t("transcribe.recorder.statusPaused")
                : isDone
                  ? t("transcribe.recorder.statusDone")
                  : t("transcribe.recorder.statusIdle")}
          </span>
        </div>
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatDuration(recorder.duration)} / {formatDuration(RECORD_MAX_SEC)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {recorder.state === "idle" && (
          <Button onClick={() => void recorder.start()} disabled={disabled} className="gap-1.5">
            <Mic className="h-4 w-4" />
            {t("transcribe.recorder.start")}
          </Button>
        )}
        {isRec && (
          <>
            <Button onClick={recorder.pause} variant="outline" className="gap-1.5">
              <Pause className="h-4 w-4" />
              {t("transcribe.recorder.pause")}
            </Button>
            <Button onClick={() => void recorder.stop()} variant="destructive" className="gap-1.5">
              <Square className="h-4 w-4" />
              {t("transcribe.recorder.stop")}
            </Button>
          </>
        )}
        {isPaused && (
          <>
            <Button onClick={recorder.resume} className="gap-1.5">
              <Play className="h-4 w-4" />
              {t("transcribe.recorder.resume")}
            </Button>
            <Button onClick={() => void recorder.stop()} variant="outline" className="gap-1.5">
              <Square className="h-4 w-4" />
              {t("transcribe.recorder.stop")}
            </Button>
          </>
        )}
        {isDone && (
          <Button
            onClick={recorder.reset}
            variant="ghost"
            className="gap-1.5"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
            {t("transcribe.recorder.discard")}
          </Button>
        )}
      </div>

      {isDone && recorder.blobUrl && (
        <audio src={recorder.blobUrl} controls className="w-full" />
      )}
    </div>
  );
}
