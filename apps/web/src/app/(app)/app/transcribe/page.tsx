"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { TranscribeDropzone } from "@/components/transcribe/transcribe-dropzone";
import {
  TranscribeSettings,
  DEFAULT_TRANSCRIBE_SETTINGS,
  type TranscribeSettingsValue,
} from "@/components/transcribe/transcribe-settings";
import { CostPreview } from "@/components/transcribe/cost-preview";
import { decodeMediaDuration } from "@/lib/audio-duration";
import { uploadRecording } from "@/lib/upload";
import { useCreditBalance } from "@/hooks/use-credits";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GiB matches backend TRANSCRIBE_MAX_FILE_SIZE_BYTES default

export default function TranscribeCreatePage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: credits } = useCreditBalance();
  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [settings, setSettings] = useState<TranscribeSettingsValue>(DEFAULT_TRANSCRIBE_SETTINGS);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const isFree = credits?.source === "free";
  const balance = isFree ? credits?.balance ?? 0 : null;

  async function handleSelect(f: File) {
    setFile(f);
    setDurationSec(null);
    try {
      const d = await decodeMediaDuration(f);
      setDurationSec(d);
    } catch {
      setDurationSec(null);
    }
  }

  async function handleSubmit() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    const form = new FormData();
    form.append("file", file);
    if (durationSec !== null) form.append("durationSec", String(durationSec));
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

  const submitDisabled = !file || uploading;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs />
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Mic className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("transcribe.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("transcribe.sub")}</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <TranscribeDropzone
            file={file}
            durationSec={durationSec}
            maxBytes={MAX_BYTES}
            onSelect={handleSelect}
            onClear={() => {
              setFile(null);
              setDurationSec(null);
            }}
            disabled={uploading}
          />

          {isFree && (
            <CostPreview
              durationSec={durationSec}
              keytermsCount={settings.keyterms.length}
              balance={balance}
            />
          )}

          {uploading && (
            <div className="space-y-2 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t("transcribe.uploading")}</span>
                <span className="tabular-nums text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {progress >= 100 && (
                <p className="text-xs text-muted-foreground">
                  {t("transcribe.processing")}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end">
            <Button
              type="button"
              size="lg"
              disabled={submitDisabled}
              onClick={handleSubmit}
              className={cn("gap-2", submitDisabled && "opacity-60")}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {t("transcribe.submit")}
            </Button>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <TranscribeSettings
            value={settings}
            onChange={setSettings}
            disabled={uploading}
          />
        </aside>
      </div>
    </div>
  );
}
