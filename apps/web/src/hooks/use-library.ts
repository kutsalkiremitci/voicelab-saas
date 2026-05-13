import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type LibraryVoice = {
  id: string;
  upstreamVoiceId: string;
  name: string;
  description: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  category: string | null;
  previewUrl: string | null;
  language: string | null;
  sortOrder: number;
};

export type LibraryFilters = {
  gender?: string;
  accent?: string;
  language?: string;
  category?: string;
  search?: string;
};

export function useLibraryVoices(filters: LibraryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.gender) params.set("gender", filters.gender);
  if (filters.accent) params.set("accent", filters.accent);
  if (filters.language) params.set("language", filters.language);
  if (filters.category) params.set("category", filters.category);
  if (filters.search) params.set("search", filters.search);

  const qs = params.toString();
  return useQuery({
    queryKey: ["library", "voices", filters],
    queryFn: () =>
      api.get<{ voices: LibraryVoice[] }>(`/library/voices${qs ? `?${qs}` : ""}`),
    staleTime: 5 * 60_000,
  });
}

export function useLibraryVoice(id: string) {
  return useQuery({
    queryKey: ["library", "voices", id],
    queryFn: () => api.get<{ voice: LibraryVoice }>(`/library/voices/${id}`),
    enabled: Boolean(id),
  });
}
