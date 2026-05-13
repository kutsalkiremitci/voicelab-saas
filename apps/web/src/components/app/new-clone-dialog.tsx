"use client";

import { useState } from "react";
import { toast } from "sonner";
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
  const [open, setOpen] = useState(false);
  const [recordingId, setRecordingId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: recs } = useRecordings();
  const create = useCreateVoice();

  async function handleSubmit() {
    if (!recordingId) {
      toast.error("Pick a recording first.");
      return;
    }
    if (label.trim().length === 0) {
      toast.error("Give the voice a label.");
      return;
    }
    setSubmitting(true);
    try {
      await create.mutateAsync({
        recordingId,
        label: label.trim(),
        kind,
      });
      toast.success("Voice created.");
      setOpen(false);
      setLabel("");
      setRecordingId("");
    } catch (e) {
      const code =
        e instanceof ApiError
          ? (e.payload as { error?: { code?: string } })?.error?.code
          : null;
      if (code === "TIER_LIMIT") {
        toast.error("Upgrade your tier to use this clone type.");
      } else if (code === "LABEL_TAKEN") {
        toast.error("You already have a voice with this label.");
      } else {
        toast.error("Could not create voice.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const title = kind === "ivc" ? "New Quick Clone" : "New Studio Clone";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {kind === "ivc"
              ? "Pick a 1-5 minute recording. Same tone throughout works best."
              : "Pick a longer studio-grade recording (30+ minutes optimal)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rec">Source recording</Label>
            {recs && recs.recordings.length > 0 ? (
              <select
                id="rec"
                value={recordingId}
                onChange={(e) => setRecordingId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose…</option>
                {recs.recordings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({Math.round(r.durationSec)}s)
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted-foreground">
                No recordings yet. Record one in the studio first.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              placeholder="Calm, Storyteller, Energetic…"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !recs?.recordings.length}>
            {submitting ? "Creating…" : "Create voice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
