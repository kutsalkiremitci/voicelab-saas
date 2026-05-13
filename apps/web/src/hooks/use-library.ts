import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type LibraryVoice = {
  voiceId: string;
  name: string;
  description: string | null;
  gender: string;
  age: string;
  accent: string;
  category: string;
  useCase: string;
  previewUrl: string | null;
  language: string | null;
};

export type LibraryPage = {
  voices: LibraryVoice[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalCount: number | null;
};

export type LibraryFilters = {
  gender?: string;
  age?: string;
  accent?: string;
  language?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export function useLibraryVoices(filters: LibraryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.gender) params.set("gender", filters.gender);
  if (filters.age) params.set("age", filters.age);
  if (filters.accent) params.set("accent", filters.accent);
  if (filters.language) params.set("language", filters.language);
  if (filters.category) params.set("category", filters.category);
  if (filters.search) params.set("search", filters.search);
  if (filters.page != null) params.set("page", String(filters.page));
  if (filters.pageSize != null) params.set("pageSize", String(filters.pageSize));

  const qs = params.toString();
  return useQuery({
    queryKey: ["library", "voices", filters],
    queryFn: () => api.get<LibraryPage>(`/library/voices${qs ? `?${qs}` : ""}`),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useLibraryVoice(voiceId: string) {
  return useQuery({
    queryKey: ["library", "voice", voiceId],
    queryFn: () => api.get<{ voice: LibraryVoice }>(`/library/voices/${voiceId}`),
    enabled: Boolean(voiceId),
    staleTime: 5 * 60_000,
  });
}
