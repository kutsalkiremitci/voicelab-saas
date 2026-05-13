"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sparkles, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useCreditBalance } from "@/hooks/use-credits";
import { LanguageSelect } from "@/components/language-select";
import { BrandMark } from "@/components/brand-mark";
import { UpgradeDialog } from "./upgrade-dialog";
import { SidebarNav } from "./sidebar-nav";

function avatarChar(email: string | undefined | null): string {
  if (!email) return "?";
  return email.charAt(0).toUpperCase();
}

function formatCredits(balance: number | null | undefined, unit: string): string {
  if (balance === null || balance === undefined) return "—";
  return `${balance.toLocaleString()} ${unit}`;
}

export function SidebarLayout({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useAuth();
  const { data: credits } = useCreditBalance();
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  const email = me?.user.email;
  const balance = credits?.balance ?? me?.balance;
  const isDark = mounted && theme === "dark";

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore — cookie cleared server-side; we still wipe client cache
    }
    qc.clear();
    router.push("/login");
  }

  return (
    <div
      className={cn(
        "grid min-h-screen",
        collapsed ? "grid-cols-[64px_1fr]" : "grid-cols-[260px_1fr]",
      )}
      style={{ transition: "grid-template-columns 200ms ease" }}
    >
      <aside className="sticky top-0 flex h-screen flex-col border-r border-border bg-card overflow-hidden">
        {/* Header: logo + collapse toggle */}
        <div
          className={cn(
            "shrink-0 border-b flex items-center",
            collapsed ? "flex-col gap-2 px-2 py-3" : "justify-between px-4 py-3",
          )}
        >
          <Link
            href="/app"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <BrandMark size={collapsed ? "sm" : "md"} />
            {!collapsed && <span className="text-base">VoiceLab</span>}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Nav */}
        <div className={cn("flex-1 overflow-y-auto py-2", collapsed ? "px-1" : "px-2")}>
          <SidebarNav collapsed={collapsed} />
        </div>

        {/* User panel */}
        <div
          className={cn(
            "shrink-0 border-t",
            collapsed ? "p-2 flex justify-center" : "px-3 py-3",
          )}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black text-sm font-semibold shadow-sm ring-2 ring-accent/30"
                title={email ?? undefined}
              >
                {avatarChar(email)}
              </div>
              <LanguageSelect compact />
              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                aria-label="Toggle theme"
                className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-accent/10 via-card to-card border border-accent/15 px-2.5 py-2 shadow-sm">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black text-sm font-semibold ring-1 ring-border"
                  aria-hidden
                >
                  {avatarChar(email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={email}>
                    {email ?? t("common.loading")}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground tabular-nums">
                    {formatCredits(balance, t("common.credits"))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                  aria-label="Toggle theme"
                  title={isDark ? "Switch to light" : "Switch to dark"}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                >
                  {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("common.language")}
                </span>
                <LanguageSelect />
              </div>
            </>
          )}
        </div>

        {/* Upgrade plan */}
        <UpgradeDialog
          trigger={
            <button
              type="button"
              className={cn(
                "shrink-0 flex items-center gap-2.5 border-t text-xs font-medium text-accent hover:bg-accent/10 transition-colors",
                collapsed ? "justify-center px-0 py-3" : "px-4 py-3",
              )}
              title={collapsed ? t("upgrade.buttonLabel") : undefined}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t("upgrade.buttonLabel")}</span>}
            </button>
          }
        />

        {/* Sign out */}
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "shrink-0 flex items-center gap-2.5 border-t text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors",
            collapsed ? "justify-center px-0 py-3" : "px-4 py-3",
          )}
          title={collapsed ? t("common.signOut") : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t("common.signOut")}</span>}
        </button>
      </aside>

      <div className="flex min-w-0 flex-col">{children}</div>
    </div>
  );
}
