"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Recording = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export function useRecordings() {
  return useQuery({
    queryKey: ["recordings"],
    queryFn: () =>
      api.get<{ recordings: Recording[]; nextCursor: string | null }>("/recordings"),
  });
}

export function useDeleteRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/recordings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recordings"] }),
  });
}

export function useRenameRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put<{ recording: Recording }>(`/recordings/${id}`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recordings"] }),
  });
}
