"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type CreditTxOperation =
  | "transcribe"
  | "tts"
  | "s2s"
  | "admin_grant"
  | "admin_refund";

export type CreditTxType = "charge" | "grant";

export interface CreditTransaction {
  id: string;
  operation: CreditTxOperation;
  type: CreditTxType;
  amount: number;
  balanceAfter: number;
  description: string | null;
  refType: string | null;
  refId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CreditTxFilters {
  operation?: CreditTxOperation[];
  type?: CreditTxType;
  from?: string;
  to?: string;
  limit?: number;
}

interface Page {
  transactions: CreditTransaction[];
  nextCursor: string | null;
}

export function useCreditTransactions(filters: CreditTxFilters = {}) {
  const limit = filters.limit ?? 25;
  return useInfiniteQuery<Page>({
    queryKey: ["credits", "transactions", filters],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (pageParam) params.set("cursor", String(pageParam));
      if (filters.operation && filters.operation.length > 0) {
        params.set("operation", filters.operation.join(","));
      }
      if (filters.type) params.set("type", filters.type);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      return api.get<Page>(`/credits/transactions?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
