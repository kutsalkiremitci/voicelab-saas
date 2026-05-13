"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useGenerations, useDeleteGeneration, type Generation } from "@/hooks/use-generations";
import { useVoices } from "@/hooks/use-voices";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Breadcrumbs } from "@/components/app/breadcrumbs";

export default function GenerationsPage() {
  const [voiceId, setVoiceId] = useState<string>("");
  const { data, isLoading } = useGenerations(voiceId ? { voiceId } : undefined);
  const { data: voices } = useVoices();
  const del = useDeleteGeneration();
  const [confirm, setConfirm] = useState<Generation | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Generations</h1>
        <p className="text-sm text-muted-foreground">All audio you&apos;ve generated.</p>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="filter-voice" className="text-xs text-muted-foreground">
          Filter by voice:
        </label>
        <select
          id="filter-voice"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">All voices</option>
          {voices?.voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data && data.generations.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Text</th>
                <th className="px-3 py-2 text-left">Characters</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.generations.map((g) => (
                <tr key={g.id}>
                  <td className="max-w-md truncate px-3 py-2">{g.text}</td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {g.characterCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(g.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <audio src={g.url} controls className="h-8 max-w-[180px]" />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setConfirm(g)}
                        disabled={del.isPending}
                        aria-label="Delete generation"
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
        <p className="text-sm text-muted-foreground">No generations yet.</p>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete generation?"
        description={
          confirm
            ? `The generated audio will be removed permanently. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={async () => {
          if (!confirm) return;
          await del.mutateAsync(confirm.id);
          setConfirm(null);
        }}
      />
    </div>
  );
}
