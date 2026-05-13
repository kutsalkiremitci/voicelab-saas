"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TranscribeDropzone } from "@/components/transcribe/transcribe-dropzone";
import { decodeMediaDuration } from "@/lib/audio-duration";
import { uploadRecording } from "@/lib/upload";

const MAX_BYTES = 25 * 1024 * 1024; // backend MAX_AUDIO_BYTES
const MAX_DURATION_SEC = 600; // backend cap

export function RecordingUploadCard() {
  const t = useTranslations();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleSelect(f: File) {
    setFile(f);
    setDurationSec(null);
    setDecoding(true);
    if (!name) {
      // suggest a name from filename
      setName(f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Upload");
    }
    try {
      const d = await decodeMediaDuration(f);
      setDurationSec(d);
    } catch {
      setDurationSec(null);
    } finally {
      setDecoding(false);
    }
  }

  function handleClear() {
    setFile(null);
    setDurationSec(null);
    setProgress(0);
  }

  const overDuration =
    durationSec !== null && durationSec > MAX_DURATION_SEC;
  const trimmedName = name.trim();
  const submitReady =
    !!file && !decoding && !uploading && !overDuration && trimmedName.length > 0;

  async function handleSubmit() {
    if (!file || !submitReady) return;
    const fallbackMime = file.type || "audio/webm";
    setUploading(true);
    setProgress(0);
    const form = new FormData();
    form.append("audio", file);
    form.append("name", trimmedName);
    form.append("duration", String(durationSec ?? 0));
    try {
      await uploadRecording("/api/v1/recordings", form, {
        onProgress: (p) => setProgress(Math.round(p * 100)),
      });
      toast.success(t("recordings.upload.success"));
      await qc.invalidateQueries({ queryKey: ["recordings"] });
      setFile(null);
      setDurationSec(null);
      setName("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/Disallowed content type|Magic bytes/.test(msg)) {
        toast.error(t("recordings.upload.formatUnsupported"));
      } else if (/FILE_TOO_LARGE|too large/i.test(msg)) {
        toast.error(t("recordings.upload.tooLarge"));
      } else if (/INVALID_DURATION/.test(msg)) {
        toast.error(t("recordings.upload.tooLong"));
      } else {
        toast.error(t("recordings.upload.failed"));
      }
    } finally {
      setUploading(false);
      void fallbackMime;
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <TranscribeDropzone
        file={file}
        durationSec={durationSec}
        decoding={decoding}
        maxBytes={MAX_BYTES}
        onSelect={handleSelect}
        onClear={handleClear}
        disabled={uploading}
      />

      {overDuration && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
          {t("recordings.upload.tooLongInline", { max: MAX_DURATION_SEC / 60 })}
        </p>
      )}

      {file && (
        <div className="space-y-1.5">
          <Label htmlFor="upload-name">{t("recordings.upload.nameLabel")}</Label>
          <Input
            id="upload-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder={t("recordings.upload.namePlaceholder")}
            disabled={uploading}
          />
        </div>
      )}

      {uploading && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span>{t("recordings.upload.uploading")}</span>
            <span className="tabular-nums text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!submitReady}
          className="gap-2"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? t("recordings.upload.uploading") : t("recordings.upload.submit")}
        </Button>
      </div>
    </div>
  );
}
