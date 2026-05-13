"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

export type Me = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: "user" | "admin";
    status: "unverified" | "active" | "suspended";
    tier: "free" | "basic" | "pro" | "enterprise";
    activatedAt: string | null;
    createdAt: string;
  };
  balance: number | null;
  balanceSource: "free" | "upstream";
};

export function useAuth() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await api.get<Me>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}
