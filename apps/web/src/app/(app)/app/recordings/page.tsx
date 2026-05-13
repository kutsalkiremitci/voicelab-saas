"use client";

import { Trash2 } from "lucide-react";
import { useRecordings, useDeleteRecording } from "@/hooks/use-recordings";
import { RecordingPanel } from "@/components/studio/recording-panel";
import { Button } from "@/components/ui/button";

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

export default function RecordingsPage() {
  const { data, isLoading } = useRecordings();
  const del = useDeleteRecording();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recording studio</h1>
        <p className="text-sm text-muted-foreground">
          Capture a clean minute of your voice. Use it to clone or convert speech.
        </p>
      </div>

      <RecordingPanel />

      <section>
        <h2 className="mb-3 text-lg font-medium">Your recordings</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data && data.recordings.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Duration</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recordings.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {formatDuration(r.durationSec)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatBytes(r.sizeBytes)}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <audio src={r.url} controls className="h-8 max-w-[180px]" />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => del.mutate(r.id)}
                          disabled={del.isPending}
                          aria-label="Delete recording"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recordings yet.</p>
        )}
      </section>
    </div>
  );
}
