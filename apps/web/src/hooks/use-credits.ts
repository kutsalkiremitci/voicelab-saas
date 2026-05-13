"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type CreditBalance = {
  balance: number;
  source: "free" | "upstream";
  plan: "free" | "basic" | "pro" | "enterprise";
  resetAt?: string | null;
};

export function useCreditBalance() {
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => api.get<CreditBalance>("/credits/balance"),
    staleTime: 10_000,
  });
}
