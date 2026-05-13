"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileAudio, Mic, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { useTranscriptions, useDeleteTranscription } from "@/hooks/use-transcriptions";
import { formatDuration } from "@/lib/audio-duration";

export default function TranscriptionsHistoryPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data, isLoading } = useTranscriptions();
  const del = useDeleteTranscription();

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("transcribe.history.confirmDelete"))) return;
    try {
      await del.mutateAsync(id);
      toast.success(t("transcribe.history.deleted"));
    } catch {
      toast.error(t("transcribe.history.deleteFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("transcribe.history.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("transcribe.history.sub")}</p>
        </div>
        <Button onClick={() => router.push("/app/transcribe")} className="gap-2">
          <Mic className="h-4 w-4" />
          {t("transcribe.history.newTranscription")}
        </Button>
      </header>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.transcriptions.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileAudio className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t("transcribe.history.empty")}</p>
          <Button size="sm" onClick={() => router.push("/app/transcribe")}>
            {t("transcribe.history.createFirst")}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t("transcribe.history.thFile")}</th>
                <th className="px-3 py-2 font-medium">{t("transcribe.history.thLanguage")}</th>
                <th className="px-3 py-2 font-medium">{t("transcribe.history.thDuration")}</th>
                <th className="px-3 py-2 font-medium">{t("transcribe.history.thWords")}</th>
                <th className="px-3 py-2 font-medium">{t("transcribe.history.thCreated")}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.transcriptions.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <Link
                      href={`/app/transcribe/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      <span className="block max-w-[280px] truncate">{row.fileName}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs uppercase text-muted-foreground">
                    {row.language}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatDuration(row.durationSec)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {row.words.length}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDelete(row.id)}
                      aria-label={t("transcribe.history.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
