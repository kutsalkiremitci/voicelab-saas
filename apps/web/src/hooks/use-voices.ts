"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Voice = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  status: "pending" | "ready" | "failed";
  error: string | null;
  elevenLabsVoiceId: string;
  createdAt: string;
  updatedAt: string;
};

export function useVoices() {
  return useQuery({
    queryKey: ["voices"],
    queryFn: () => api.get<{ voices: Voice[]; nextCursor: string | null }>("/voices"),
  });
}

export function useCreateVoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      recordingId: string;
      label: string;
      kind: "ivc" | "pvc";
      description?: string;
    }) => api.post<{ voice: Voice }>("/voices", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voices"] });
      qc.invalidateQueries({ queryKey: ["credits", "balance"] });
    },
  });
}

export function useDeleteVoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/voices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voices"] });
      qc.invalidateQueries({ queryKey: ["generations"] });
    },
  });
}
