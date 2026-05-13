"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRecordings } from "@/hooks/use-recordings";
import { useCreateVoice } from "@/hooks/use-voices";
import { ApiError } from "@/lib/api";

export function NewCloneDialog({
  kind,
  trigger,
}: {
  kind: "ivc" | "pvc";
  trigger: React.ReactNode;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [recordingId, setRecordingId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: recs } = useRecordings();
  const create = useCreateVoice();

  async function handleSubmit() {
    if (!recordingId) {
      toast.error(t("voices.dialog.errPickRecording"));
      return;
    }
    if (label.trim().length === 0) {
      toast.error(t("voices.dialog.errPickLabel"));
      return;
    }
    setSubmitting(true);
    try {
      await create.mutateAsync({
        recordingId,
        label: label.trim(),
        kind,
      });
      toast.success(t("voices.dialog.voiceCreated"));
      setOpen(false);
      setLabel("");
      setRecordingId("");
    } catch (e) {
      const code =
        e instanceof ApiError
          ? (e.payload as { error?: { code?: string } })?.error?.code
          : null;
      if (code === "TIER_LIMIT") {
        toast.error(t("voices.dialog.errTierLimit"));
      } else if (code === "LABEL_TAKEN") {
        toast.error(t("voices.dialog.errLabelTaken"));
      } else {
        toast.error(t("voices.dialog.errGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const title = kind === "ivc" ? t("voices.dialog.titleIvc") : t("voices.dialog.titlePvc");
  const desc = kind === "ivc" ? t("voices.dialog.descIvc") : t("voices.dialog.descPvc");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rec">{t("voices.dialog.sourceLabel")}</Label>
            {recs && recs.recordings.length > 0 ? (
              <select
                id="rec"
                value={recordingId}
                onChange={(e) => setRecordingId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t("voices.dialog.choose")}</option>
                {recs.recordings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({Math.round(r.durationSec)}s)
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted-foreground">{t("voices.dialog.noRecordings")}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label">{t("voices.dialog.label")}</Label>
            <Input
              id="label"
              placeholder={t("voices.dialog.labelPlaceholder")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            {t("voices.dialog.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !recs?.recordings.length}>
            {submitting ? t("voices.dialog.creating") : t("voices.dialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
