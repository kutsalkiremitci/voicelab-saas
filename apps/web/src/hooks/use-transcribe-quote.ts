"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

export interface TranscribeQuote {
  amount: number;
  ratePerChar: number;
  operation: "transcribe";
}

interface Args {
  durationSec: number | null;
  keytermsCount: number;
  enabled?: boolean;
}

export function useTranscribeQuote({ durationSec, keytermsCount, enabled = true }: Args) {
  return useQuery<TranscribeQuote | null>({
    queryKey: ["credits", "quote", "transcribe", durationSec, keytermsCount],
    queryFn: async () => {
      if (durationSec === null || durationSec <= 0) return null;
      try {
        return await api.post<TranscribeQuote>("/credits/quote", {
          operation: "transcribe",
          payload: { durationSec, keytermsCount },
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          // Paid tier: quote not applicable
          return null;
        }
        throw e;
      }
    },
    enabled: enabled && durationSec !== null && durationSec > 0,
    staleTime: 60_000,
  });
}
