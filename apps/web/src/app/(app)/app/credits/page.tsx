"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  Sparkles,
  Zap,
} from "lucide-react";
import { useCreditBalance } from "@/hooks/use-credits";
import { useAuth } from "@/hooks/use-auth";
import { useGenerations } from "@/hooks/use-generations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { cn } from "@/lib/utils";

const FREE_GRANT = 1000;
const TIER_NAMES: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

export default function CreditsPage() {
  const t = useTranslations();
  const { data } = useCreditBalance();
  const { data: auth } = useAuth();
  const generations = useGenerations();

  const tier = auth?.user.tier ?? "free";
  const tierLabel = TIER_NAMES[tier] ?? tier;
  const isFree = tier === "free";
  const balance = data?.balance ?? null;

  const consumed = isFree && balance !== null ? Math.max(0, FREE_GRANT - balance) : null;
  const pctUsed =
    isFree && balance !== null ? Math.min(100, (consumed! / FREE_GRANT) * 100) : null;

  const totalChars =
    generations.data?.generations.reduce((s, g) => s + (g.characterCount ?? 0), 0) ?? 0;

  const PLANS = [
    {
      name: "Basic",
      price: "$10",
      credits: "30,000",
      perks: [t("pricing.tiers.basic.features.0"), t("pricing.tiers.basic.features.1"), t("pricing.tiers.basic.features.4")],
      cta: t("pricing.tiers.basic.cta"),
      highlight: false,
    },
    {
      name: "Pro",
      price: "$30",
      credits: "100,000",
      perks: [t("pricing.tiers.pro.features.1"), t("pricing.tiers.pro.features.4"), t("pricing.tiers.pro.features.5")],
      cta: t("pricing.tiers.pro.cta"),
      highlight: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs />

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("credits.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("credits.sub")}</p>
      </div>

      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-accent/15 via-card to-card shadow-md shadow-accent/5 ring-1 ring-border rounded-2xl">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("credits.available")}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold tabular-nums">
                  {balance !== null ? balance.toLocaleString() : "—"}
                </span>
                <span className="text-sm text-muted-foreground">{t("common.credits")}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {data?.source === "upstream"
                  ? t("credits.resetsMonthly")
                  : t("credits.freeGrantSub")}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  isFree
                    ? "bg-muted text-muted-foreground"
                    : "bg-accent/20 text-accent-foreground",
                )}
              >
                <CreditCard className="h-3 w-3" />
                {t("credits.planLabel", { tier: tierLabel })}
              </span>
              {data?.resetAt && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {t("credits.renewsOn", { date: new Date(data.resetAt).toLocaleDateString() })}
                </span>
              )}
            </div>
          </div>

          {isFree && pctUsed !== null && (
            <div className="mt-6">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("credits.freeUsage")}</span>
                <span className="tabular-nums text-foreground">
                  {consumed!.toLocaleString()} / {FREE_GRANT.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/[0.08] blur-2xl" aria-hidden />
          <div className="relative flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("credits.stats.generations")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="relative mt-3 text-3xl font-semibold tabular-nums">
            {generations.data?.generations.length ?? 0}
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-500/[0.08] blur-2xl" aria-hidden />
          <div className="relative flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("credits.stats.characters")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="relative mt-3 text-3xl font-semibold tabular-nums">
            {totalChars.toLocaleString()}
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/[0.08] blur-2xl" aria-hidden />
          <div className="relative flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("credits.stats.average")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="relative mt-3 text-3xl font-semibold tabular-nums">
            {generations.data?.generations.length
              ? Math.round(totalChars / generations.data.generations.length).toLocaleString()
              : "—"}
          </div>
        </div>
      </div>

      {isFree && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {t("credits.upgradeHeading")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {PLANS.map((p) => (
              <Card
                key={p.name}
                className={cn(
                  "relative overflow-hidden",
                  p.highlight && "border-accent/40 ring-1 ring-accent/20",
                )}
              >
                {p.highlight && (
                  <div className="absolute right-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                    {t("credits.popular")}
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold tabular-nums">{p.price}</span>
                    <span className="text-xs text-muted-foreground">{t("credits.perMonth")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("credits.creditsPerMonth", { n: p.credits })}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1.5 text-xs">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/pricing"
                    className={cn(
                      buttonVariants({ size: "sm", variant: p.highlight ? "default" : "outline" }),
                      "w-full gap-1.5",
                    )}
                  >
                    {p.cta}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!isFree && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("credits.manageHeading")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/pricing">
              <Button variant="outline" size="sm">
                {t("credits.changePlan")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
