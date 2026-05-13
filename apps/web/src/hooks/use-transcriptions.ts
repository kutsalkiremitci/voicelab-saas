"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface TranscribedWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "audio_event";
  speakerId?: string;
  logprob?: number;
}

export interface TranscribeOptions {
  languageCode?: string;
  tagAudioEvents: boolean;
  noVerbatim: boolean;
  keyterms: string[];
  includeSubtitles: boolean;
  diarize: boolean;
  numSpeakers?: number;
  model: "scribe_v1" | "scribe_v2";
  speakerNames?: Record<string, string>;
}

export interface Transcription {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSec: number;
  language: string;
  languageProbability: number;
  model: string;
  text: string;
  textOriginal: string;
  words: TranscribedWord[];
  wordsOriginal: TranscribedWord[];
  options: TranscribeOptions;
  creditsCharged: number | null;
  editVersion: number;
  edited: boolean;
  audioUrl: string;
  createdAt: string;
  updatedAt: string;
}

export function useTranscriptions() {
  return useQuery({
    queryKey: ["transcriptions"],
    queryFn: () =>
      api.get<{ transcriptions: Transcription[]; nextCursor: string | null }>(
        "/transcriptions",
      ),
  });
}

export function useTranscription(id: string | undefined) {
  return useQuery({
    queryKey: ["transcriptions", id],
    queryFn: () =>
      api.get<{ transcription: Transcription }>(`/transcriptions/${id}`),
    enabled: !!id,
  });
}

export function useDeleteTranscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/transcriptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transcriptions"] });
      qc.invalidateQueries({ queryKey: ["credits", "balance"] });
    },
  });
}

export function useUpdateTranscription(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      text?: string;
      words?: TranscribedWord[];
      speakerNames?: Record<string, string>;
    }) =>
      api.patch<{ transcription: Transcription }>(`/transcriptions/${id}`, body),
    onSuccess: (res) => {
      qc.setQueryData(["transcriptions", id], res);
      qc.invalidateQueries({ queryKey: ["transcriptions"] });
    },
  });
}
