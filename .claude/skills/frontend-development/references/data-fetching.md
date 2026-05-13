# State & Data Fetching

## State split

| Kind | Tool | Why |
|------|------|-----|
| Server state | TanStack Query | caching, refetch, mutations |
| Local UI state | `useState` / `useReducer` | scoped to a component |
| Global UI state | Zustand | theme, sidebar collapsed — minimal |
| Form state | react-hook-form + zod | validation parity with backend |

No other state library. Don't add Redux, Jotai, Recoil, Context-based mega-stores.

## API client

```ts
// lib/api.ts
class ApiError extends Error {
  constructor(public payload: unknown, public status: number) {
    super("api error");
  }
}

class ApiClient {
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`/api/v1${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
    if (!res.ok) throw new ApiError(await res.json().catch(() => ({})), res.status);
    return res.json();
  }
  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }
  put<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  }
  del<T>(path: string) { return this.request<T>(path, { method: "DELETE" }); }
}

export const api = new ApiClient();
```

## TanStack Query setup

```ts
// app/providers.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

## Query example

```ts
// hooks/use-recordings.ts
export function useRecordings() {
  return useQuery({
    queryKey: ["recordings"],
    queryFn: () => api.get<{ recordings: Recording[]; nextCursor: string | null }>("/recordings"),
  });
}
```

## Mutation example

```ts
export function useCloneVoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { recordingId: string; label: string }) =>
      api.post<{ voice: Voice }>("/voices", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voices"] });
      qc.invalidateQueries({ queryKey: ["credits", "balance"] });  // balance changed
    },
  });
}
```

## Credit hooks

Credits are server-truth. Never cache the balance longer than 10 seconds, and always invalidate on any credit-consuming mutation.

```ts
// hooks/use-credits.ts
export function useCreditBalance() {
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => api.get<{ balance: number; recentLedger: LedgerEntry[] }>("/credits/balance"),
    staleTime: 10_000,
  });
}

export function useCreditLedger(filters?: { reason?: string; cursor?: string }) {
  return useQuery({
    queryKey: ["credits", "ledger", filters],
    queryFn: () => api.get(`/credits/ledger?${new URLSearchParams(filters as any)}`),
  });
}
```

## Quote hook (for UI display before submit)

The quote is **display-only**. The server re-quotes at submit time; do not trust the client value for charging.

```ts
// hooks/use-quote.ts
export function useTtsQuote(text: string) {
  return useQuery({
    queryKey: ["quote", "tts", text],
    queryFn: () => api.post<{ amount: number; ratePerChar: number }>("/credits/quote", {
      operation: "tts",
      payload: { text },
    }),
    enabled: text.length > 0,
    staleTime: 30_000,
  });
}
```

Usage in a component:

```tsx
const { data: quote } = useTtsQuote(text);
const { data: credits } = useCreditBalance();

const canAfford = quote && credits ? credits.balance >= quote.amount : true;

<Button disabled={!canAfford} onClick={handleGenerate}>
  {quote ? `Generate (${quote.amount} credits)` : "Generate"}
</Button>
{!canAfford && (
  <p className="text-destructive text-xs">
    Not enough credits — need {quote!.amount - credits!.balance} more
  </p>
)}
```

## Forms

```ts
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@voicelab/shared/schemas";

const form = useForm<LoginInput>({
  resolver: zodResolver(loginSchema),
});
```

The same `loginSchema` is imported by the backend; one source of truth.

## Auth state

- httpOnly cookie carries the session. Frontend never sees it.
- `useAuth()` hook calls `GET /auth/me` and caches via TanStack Query.
- Returned shape: `{ user: { id, email, name, role, status, tier }, balance }`.
- Logout clears the query cache: `queryClient.clear()`.
- `status` and `role` from `useAuth()` are used by client components for conditional rendering, but the middleware is the source of truth for access (server-enforced).
