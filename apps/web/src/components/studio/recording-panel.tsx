"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, Pause, Play, Square, Trash2, Upload } from "lucide-react";
import { useRecorder } from "@/hooks/use-recorder";
import { Waveform } from "@/components/studio/waveform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildRecordingForm, uploadRecording } from "@/lib/upload";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function RecordingPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("Sample take");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const recorder = useRecorder({
    onError: (err) => {
      if (err.name === "NotAllowedError") {
        toast.error("Microphone permission denied. Allow access to record.");
      } else {
        toast.error(`Could not start recording: ${err.message}`);
      }
    },
  });

  async function handleUpload() {
    if (!recorder.blob) return;
    if (name.trim().length === 0) {
      toast.error("Give the recording a name.");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const form = buildRecordingForm(
        recorder.blob,
        name.trim(),
        recorder.duration,
        recorder.blob.type || "audio/webm",
      );
      await uploadRecording("/api/v1/recordings", form, {
        onProgress: (p) => setProgress(p),
      });
      toast.success("Recording uploaded.");
      await qc.invalidateQueries({ queryKey: ["recordings"] });
      recorder.reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="space-y-1.5">
        <Label htmlFor="rec-name">Recording name</Label>
        <Input
          id="rec-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={recorder.state === "recording"}
          maxLength={120}
        />
      </div>

      <div className="mt-6">
        <Waveform
          analyser={recorder.analyser}
          active={recorder.state === "recording"}
          height={72}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {recorder.state === "recording"
              ? "Recording…"
              : recorder.state === "paused"
                ? "Paused"
                : recorder.state === "stopped"
                  ? "Ready to upload"
                  : "Ready"}
          </span>
          <span className="tabular-nums">{formatTime(recorder.duration)} / 5:00</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {recorder.state === "idle" && (
          <Button onClick={() => void recorder.start()} className="gap-1.5">
            <Mic className="h-4 w-4" />
            Start
          </Button>
        )}
        {recorder.state === "recording" && (
          <>
            <Button onClick={recorder.pause} variant="outline" className="gap-1.5">
              <Pause className="h-4 w-4" />
              Pause
            </Button>
            <Button onClick={() => void recorder.stop()} variant="destructive" className="gap-1.5">
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </>
        )}
        {recorder.state === "paused" && (
          <>
            <Button onClick={recorder.resume} className="gap-1.5">
              <Play className="h-4 w-4" />
              Resume
            </Button>
            <Button onClick={() => void recorder.stop()} variant="outline" className="gap-1.5">
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </>
        )}
        {recorder.state === "stopped" && (
          <>
            <Button onClick={handleUpload} disabled={uploading} className="gap-1.5">
              <Upload className="h-4 w-4" />
              {uploading ? `Uploading ${Math.round(progress * 100)}%` : "Upload"}
            </Button>
            <Button onClick={recorder.reset} variant="ghost" className="gap-1.5" disabled={uploading}>
              <Trash2 className="h-4 w-4" />
              Discard
            </Button>
          </>
        )}
      </div>

      {recorder.blobUrl && recorder.state === "stopped" && (
        <audio
          src={recorder.blobUrl}
          controls
          className="mt-4 w-full"
        />
      )}
    </div>
  );
}
