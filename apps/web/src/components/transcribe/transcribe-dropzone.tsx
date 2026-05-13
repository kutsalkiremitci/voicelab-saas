"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileAudio } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/audio-duration";

interface Props {
  file: File | null;
  durationSec: number | null;
  maxBytes: number;
  onSelect: (file: File) => void | Promise<void>;
  onClear: () => void;
  disabled?: boolean;
}

const ACCEPT = [
  "audio/*",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
  ".flac",
  ".webm",
  ".mp4",
  ".mov",
].join(",");

export function TranscribeDropzone({ file, durationSec, maxBytes, onSelect, onClear, disabled }: Props) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [tooLarge, setTooLarge] = useState(false);

  const handleFile = useCallback(
    async (f: File | undefined | null) => {
      if (!f) return;
      if (f.size > maxBytes) {
        setTooLarge(true);
        return;
      }
      setTooLarge(false);
      await onSelect(f);
    },
    [maxBytes, onSelect],
  );

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={disabled}
      />

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (disabled) return;
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={cn(
            "flex h-80 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/30 text-center transition-colors",
            dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/60 hover:bg-muted/50",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-sm">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1 px-6">
            <p className="text-base font-medium">{t("transcribe.dropTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("transcribe.dropHintFormats")}</p>
            <p className="text-xs text-muted-foreground">
              {t("transcribe.dropHintMax", { max: Math.round(maxBytes / (1024 * 1024)) })}
            </p>
          </div>
          {tooLarge && (
            <p className="text-xs text-destructive">{t("transcribe.tooLarge")}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
            <FileAudio className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / (1024 * 1024)).toFixed(1)} MB
              {durationSec !== null ? ` · ${formatDuration(durationSec)}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClear}
            aria-label={t("transcribe.clear")}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
