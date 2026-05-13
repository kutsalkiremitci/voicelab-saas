"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Generation = {
  id: string;
  voiceId: string;
  text: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  characterCount: number;
  settings: unknown;
  url: string;
  createdAt: string;
};

export function useGenerations(filter?: { voiceId?: string; cursor?: string }) {
  return useQuery({
    queryKey: ["generations", filter ?? {}],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (filter?.voiceId) sp.set("voiceId", filter.voiceId);
      if (filter?.cursor) sp.set("cursor", filter.cursor);
      const qs = sp.toString();
      return api.get<{ generations: Generation[]; nextCursor: string | null }>(
        `/generations${qs ? `?${qs}` : ""}`,
      );
    },
  });
}

export function useGenerate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      voiceId,
      text,
      settings,
    }: {
      voiceId: string;
      text: string;
      settings?: Record<string, unknown>;
    }) =>
      api.post<{ generation: Generation }>(`/voices/${voiceId}/generate`, {
        text,
        settings,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["generations"] });
      qc.invalidateQueries({ queryKey: ["credits", "balance"] });
    },
  });
}

export function useDeleteGeneration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/generations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["generations"] }),
  });
}
