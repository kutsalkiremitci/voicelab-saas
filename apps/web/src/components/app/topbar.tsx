"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppTopbar() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useAuth();

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore — cookie cleared server-side; we still wipe client cache
    }
    qc.clear();
    router.push("/login");
  }

  const balanceLabel =
    data?.balance !== null && data?.balance !== undefined
      ? `${data.balance.toLocaleString()} credits`
      : data?.balanceSource === "upstream"
        ? "Plan quota"
        : "—";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 text-sm">
      <div className="text-muted-foreground">
        <span>Credits: </span>
        <span className="font-medium text-foreground">{balanceLabel}</span>
      </div>
      <div className="flex items-center gap-3">
        {data?.user.email && (
          <span className="text-xs text-muted-foreground">{data.user.email}</span>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
