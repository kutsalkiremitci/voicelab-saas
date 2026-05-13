"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, Download, FileAudio, HardDrive, Mic, Trash2, Upload } from "lucide-react";
import { useRecordings, useDeleteRecording, type Recording } from "@/hooks/use-recordings";
import { RecordingPanel } from "@/components/studio/recording-panel";
import { RecordingUploadCard } from "@/components/studio/recording-upload-card";
import { AudioPlayer } from "@/components/ui/audio-player";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { cn } from "@/lib/utils";

type Source = "record" | "upload";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString();
}

function extForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp3") || mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("flac")) return "flac";
  if (mime.includes("opus")) return "opus";
  if (mime.includes("aac")) return "aac";
  return "audio";
}

export default function RecordingsPage() {
  const t = useTranslations();
  const { data, isLoading } = useRecordings();
  const del = useDeleteRecording();
  const [confirm, setConfirm] = useState<Recording | null>(null);
  const [source, setSource] = useState<Source>("record");

  const recordings = data?.recordings ?? [];

  async function doDelete() {
    if (!confirm) return;
    await del.mutateAsync(confirm.id);
    setConfirm(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs />

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("recordings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("recordings.sub")}</p>
      </div>

      <div className="inline-flex self-start rounded-lg border bg-muted/30 p-0.5">
        <button
          type="button"
          onClick={() => setSource("record")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            source === "record"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Mic className="h-3.5 w-3.5" />
          {t("recordings.source.record")}
        </button>
        <button
          type="button"
          onClick={() => setSource("upload")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            source === "upload"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Upload className="h-3.5 w-3.5" />
          {t("recordings.source.upload")}
        </button>
      </div>

      {source === "record" ? <RecordingPanel /> : <RecordingUploadCard />}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">{t("recordings.yours")}</h2>
          {recordings.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {recordings.length}{" "}
              {recordings.length === 1 ? t("recordings.countOne") : t("recordings.countMany")}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border bg-muted/30" />
            ))}
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-gradient-to-br from-accent/[0.04] to-transparent py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Mic className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">{t("recordings.emptyTitle")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("recordings.emptyBody")}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recordings.map((r) => (
              <div
                key={r.id}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                <div
                  className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-accent/[0.08] blur-2xl opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />

                <div className="relative flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <FileAudio className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={r.name}>
                        {r.name}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {r.mimeType.replace(/^audio\//, "")}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={r.url}
                      download={`${r.name.replace(/[^\w.-]/g, "_")}.${extForMime(r.mimeType)}`}
                      title={t("recordings.download")}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setConfirm(r)}
                      title={t("recordings.delete")}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <AudioPlayer src={r.url} initialDuration={r.durationSec} />

                <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(r.durationSec)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {formatBytes(r.sizeBytes)}
                  </span>
                  <span className="ml-auto">{formatRelative(r.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t("recordings.confirmTitle")}
        description={
          confirm ? t("recordings.confirmBody", { name: confirm.name }) : undefined
        }
        confirmLabel={t("recordings.delete")}
        loading={del.isPending}
        onConfirm={doDelete}
      />
    </div>
  );
}
