"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type CreditBalance = {
  balance: number;
  source: "free" | "upstream";
  plan: "free" | "basic" | "pro" | "enterprise";
  resetAt?: string | null;
  /**
   * Universal app credit balance used by Speech-to-Text on every tier.
   * Separate from `balance` so paid plans can keep showing their upstream
   * TTS allowance there while STT bills against this pool.
   */
  transcribeBalance: number;
};

export function useCreditBalance() {
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => api.get<CreditBalance>("/credits/balance"),
    staleTime: 10_000,
  });
}
