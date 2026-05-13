"use client";

import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FORMATS = [
  { format: "txt", label: "TXT" },
  { format: "json", label: "JSON" },
  { format: "srt", label: "SRT" },
  { format: "vtt", label: "VTT" },
  { format: "html", label: "HTML" },
  { format: "pdf", label: "PDF" },
  { format: "docx", label: "DOCX" },
] as const;

type Format = (typeof FORMATS)[number]["format"];

interface Props {
  transcriptionId: string;
  baseName: string;
}

export function ExportMenu({ transcriptionId, baseName }: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<Format | null>(null);

  const download = async (format: Format) => {
    setDownloading(format);
    try {
      const res = await fetch(
        `/api/v1/transcriptions/${transcriptionId}/export?format=${format}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (e) {
      toast.error(t("transcribe.viewer.exportFailed"));
      console.error(e);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          {t("transcribe.viewer.exportMenu")}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="end">
        {FORMATS.map((f) => (
          <button
            key={f.format}
            type="button"
            onClick={() => download(f.format)}
            disabled={downloading !== null}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            <span>{f.label}</span>
            {downloading === f.format && (
              <span className="text-xs text-muted-foreground">…</span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
