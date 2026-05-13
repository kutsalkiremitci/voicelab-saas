"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileAudio, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/audio-duration";

interface Props {
  file: File | null;
  durationSec: number | null;
  decoding?: boolean;
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

export function TranscribeDropzone({
  file,
  durationSec,
  decoding,
  maxBytes,
  onSelect,
  onClear,
  disabled,
}: Props) {
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
            "group relative flex h-80 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed text-center transition-all",
            dragging
              ? "border-accent bg-accent/10 scale-[1.01]"
              : "border-border bg-muted/20 hover:border-accent/60 hover:bg-muted/40",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-sm transition-transform",
              dragging && "scale-110",
            )}
          >
            <Upload className={cn("h-7 w-7 text-muted-foreground transition-colors", dragging && "text-accent")} />
          </div>
          <div className="space-y-1 px-6">
            <p className="text-lg font-semibold">{t("transcribe.dropTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("transcribe.dropHintFormats")}</p>
            <p className="text-xs text-muted-foreground/80">
              {t("transcribe.dropHintMax", { max: Math.round(maxBytes / (1024 * 1024)) })}
            </p>
          </div>
          {tooLarge && (
            <p className="absolute bottom-4 text-xs font-medium text-destructive">
              {t("transcribe.tooLarge")}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <FileAudio className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="tabular-nums">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
              <span className="opacity-40">·</span>
              {decoding ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("transcribe.decoding")}
                </span>
              ) : durationSec !== null ? (
                <span className="tabular-nums">{formatDuration(durationSec)}</span>
              ) : (
                <span className="opacity-60">{t("transcribe.durationUnknown")}</span>
              )}
              <span className="opacity-40">·</span>
              <span className="truncate" title={file.type}>
                {file.type || t("transcribe.unknownType")}
              </span>
            </div>
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
