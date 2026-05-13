"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { celebrate } from "@/lib/success-feedback";

const SILENT_MUTATION_KEYS = new Set<string>(["session", "auth"]);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            // Each useMutation can opt out by setting meta.silent: true.
            // Otherwise every successful mutation fires the global confetti +
            // toast feedback so the user always knows when an API call worked.
          },
        },
        mutationCache: new MutationCache({
          onSuccess: (_data, _vars, _ctx, mutation) => {
            const meta = mutation.options.meta as
              | { silent?: boolean; successMessage?: string; successDescription?: string }
              | undefined;
            if (meta?.silent) return;
            const key = (mutation.options.mutationKey ?? [])[0];
            if (typeof key === "string" && SILENT_MUTATION_KEYS.has(key)) return;
            celebrate({
              message: meta?.successMessage,
              description: meta?.successDescription,
            });
          },
        }),
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
