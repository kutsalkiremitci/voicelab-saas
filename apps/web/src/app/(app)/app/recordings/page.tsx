"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, FileAudio, HardDrive, Mic, Trash2, Upload } from "lucide-react";
import { useRecordings, useDeleteRecording } from "@/hooks/use-recordings";
import { RecordingPanel } from "@/components/studio/recording-panel";
import { RecordingUploadCard } from "@/components/studio/recording-upload-card";
import { Button } from "@/components/ui/button";
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

export default function RecordingsPage() {
  const t = useTranslations();
  const { data, isLoading } = useRecordings();
  const del = useDeleteRecording();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("record");

  const recordings = data?.recordings ?? [];

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl border bg-muted/30" />
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recordings.map((r) => {
              const isPendingDelete = pendingDelete === r.id;
              return (
                <div
                  key={r.id}
                  className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/[0.06] blur-2xl opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <FileAudio className="h-4 w-4" />
                      </div>
                      <p className="truncate text-sm font-medium" title={r.name}>
                        {r.name}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (isPendingDelete) {
                          del.mutate(r.id);
                          setPendingDelete(null);
                        } else {
                          setPendingDelete(r.id);
                          setTimeout(() => setPendingDelete((id) => (id === r.id ? null : id)), 3000);
                        }
                      }}
                      disabled={del.isPending}
                      aria-label={isPendingDelete ? "Confirm delete" : "Delete recording"}
                      className={cn(
                        "h-7 w-7 shrink-0",
                        isPendingDelete && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <audio src={r.url} controls className="h-8 w-full" />

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(r.durationSec)}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {formatBytes(r.sizeBytes)}
                    </span>
                    <span className="ml-auto">{formatRelative(r.createdAt)}</span>
                  </div>

                  {isPendingDelete && (
                    <p className="text-[10px] text-destructive">{t("recordings.confirmDelete")}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
