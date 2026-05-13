"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  AudioLines,
  Coins,
  Folder,
  Layers,
  Mic,
  Sparkles,
  Volume2,
  Wand2,
} from "lucide-react";
import { useCreditBalance } from "@/hooks/use-credits";
import { useRecordings } from "@/hooks/use-recordings";
import { useVoices } from "@/hooks/use-voices";
import { useGenerations } from "@/hooks/use-generations";
import { useAuth } from "@/hooks/use-auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { AudioPlayer } from "@/components/ui/audio-player";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { cn } from "@/lib/utils";

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-50 transition-opacity group-hover:opacity-80",
          accent,
        )}
        aria-hidden
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent)}>
          <Icon className="h-4 w-4 text-accent-foreground" />
        </div>
      </div>
      <div className="relative mt-3 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <p className="relative mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AppDashboardPage() {
  const t = useTranslations();
  const auth = useAuth();
  const credits = useCreditBalance();
  const recordings = useRecordings();
  const voices = useVoices();
  const generations = useGenerations();

  function greeting(): string {
    const h = new Date().getHours();
    if (h < 5) return t("dashboard.greetingNight");
    if (h < 12) return t("dashboard.greetingMorning");
    if (h < 18) return t("dashboard.greetingAfternoon");
    return t("dashboard.greetingEvening");
  }

  const balance = credits.data?.balance ?? null;
  const balanceText = balance === null ? "—" : balance.toLocaleString();
  const displayName = auth.data?.user.email?.split("@")[0] ?? "there";

  const showFreeUpgrade =
    auth.data?.user.tier === "free" && (balance === null || balance < 200);

  const QUICK_ACTIONS = [
    {
      href: "/app/text-to-speech",
      title: t("dashboard.actions.generateTitle"),
      description: t("dashboard.actions.generateBody"),
      icon: Volume2,
      gradient: "from-accent/15 to-accent/[0.03]",
      iconClass: "bg-accent/15 text-accent",
    },
    {
      href: "/app/recordings",
      title: t("dashboard.actions.recordTitle"),
      description: t("dashboard.actions.recordBody"),
      icon: Mic,
      gradient: "from-amber-500/15 to-amber-500/[0.03]",
      iconClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    {
      href: "/app/voices",
      title: t("dashboard.actions.cloneTitle"),
      description: t("dashboard.actions.cloneBody"),
      icon: Layers,
      gradient: "from-sky-500/15 to-sky-500/[0.03]",
      iconClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      href: "/app/generations",
      title: t("dashboard.actions.pastTitle"),
      description: t("dashboard.actions.pastBody"),
      icon: AudioLines,
      gradient: "from-emerald-500/15 to-emerald-500/[0.03]",
      iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="relative">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-96 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/4 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-3xl" />
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-indigo-400/[0.06] blur-3xl" />
      </div>

      <div className="flex flex-col gap-6">
        <Breadcrumbs />

        {/* Hero greeting */}
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
            <Sparkles className="h-3 w-3" />
            VoiceLab
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting()},{" "}
            <span className="bg-gradient-to-r from-accent to-sky-500 bg-clip-text pb-1 text-transparent">
              {displayName}
            </span>
            .
          </h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={Coins}
            label={t("dashboard.metrics.credits")}
            value={balanceText}
            hint={
              credits.data?.resetAt
                ? t("dashboard.metrics.renews", {
                    date: new Date(credits.data.resetAt).toLocaleDateString(),
                  })
                : credits.data?.source === "free"
                  ? t("dashboard.metrics.freeGrantHint")
                  : undefined
            }
            accent="bg-accent text-accent-foreground"
          />
          <StatTile
            icon={Mic}
            label={t("dashboard.metrics.recordings")}
            value={recordings.data?.recordings.length.toString() ?? "—"}
            accent="bg-amber-500 text-white"
          />
          <StatTile
            icon={Sparkles}
            label={t("dashboard.metrics.voices")}
            value={voices.data?.voices.length.toString() ?? "—"}
            accent="bg-sky-500 text-white"
          />
          <StatTile
            icon={Wand2}
            label={t("dashboard.metrics.generations")}
            value={generations.data?.generations.length.toString() ?? "—"}
            accent="bg-emerald-500 text-white"
          />
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t("dashboard.quickStart")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-gradient-to-br",
                    q.gradient,
                  )}
                  aria-hidden
                />
                <div className="relative flex flex-col gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      q.iconClass,
                    )}
                  >
                    <q.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{q.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{q.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Upgrade callout */}
        {showFreeUpgrade && (
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-accent/[0.08] via-card to-card p-5 shadow-sm sm:p-6">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  {balance === 0 ? t("dashboard.upgradeOut") : t("dashboard.upgradeLow")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.upgradeBody")}</p>
              </div>
              <Link
                href="/pricing"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20",
                )}
              >
                {t("dashboard.seePlans")}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Recent generations */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between pb-4">
            <h3 className="text-base font-semibold">{t("dashboard.recentTitle")}</h3>
            {generations.data && generations.data.generations.length > 0 && (
              <Link
                href="/app/generations"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("dashboard.viewAll")}
              </Link>
            )}
          </div>
          {generations.data && generations.data.generations.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {generations.data.generations.slice(0, 5).map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="truncate pr-3 text-foreground">{g.text}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <AudioPlayer src={g.url} className="w-64" />
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {new Date(g.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Folder className="h-5 w-5" />
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("dashboard.emptyTitle")} {t("dashboard.emptyBodyPrefix")}{" "}
                <Link
                  href="/app/text-to-speech"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {t("nav.textToSpeech")}
                </Link>{" "}
                {t("dashboard.emptyBodySuffix")}
              </p>
              <Link href="/app/text-to-speech">
                <Button
                  size="sm"
                  className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  {t("dashboard.startNow")}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
