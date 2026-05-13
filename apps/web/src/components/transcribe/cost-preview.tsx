"use client";

import { useTranslations } from "next-intl";
import { Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/audio-duration";
import type { TranscribeQuote } from "@/hooks/use-transcribe-quote";

interface Props {
  quote: TranscribeQuote | null | undefined;
  loading: boolean;
  durationSec: number | null;
  keytermsCount: number;
  balance: number | null;
}

export function CostPreview({ quote, loading, durationSec, keytermsCount, balance }: Props) {
  const t = useTranslations();

  if (durationSec === null || durationSec <= 0) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>{t("transcribe.costEmpty")}</span>
        </div>
      </div>
    );
  }

  const insufficient = quote !== null && quote !== undefined && balance !== null && quote.amount > balance;
  const deficit = insufficient && quote && balance !== null ? quote.amount - balance : 0;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-colors",
        insufficient ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Sparkles className={cn("h-3.5 w-3.5", !insufficient && "text-accent")} />
        {t("transcribe.costTitle")}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={cn(
            "text-4xl font-semibold tabular-nums",
            insufficient && "text-destructive",
          )}
        >
          {loading ? "…" : quote?.amount.toLocaleString() ?? "—"}
        </span>
        <span className="text-sm text-muted-foreground">{t("transcribe.creditsUnit")}</span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {t("transcribe.costBreakdown", {
          duration: formatDuration(durationSec),
          rate: quote?.ratePerChar ?? 0,
        })}
        {keytermsCount > 0 && ` · ${t("transcribe.surchargeKeywords")}`}
      </p>

      {balance !== null && (
        <div className="mt-4 flex items-center justify-between border-t border-dashed pt-3 text-xs">
          <span className="text-muted-foreground">{t("transcribe.balanceLabel")}</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              insufficient ? "text-destructive" : "text-foreground",
            )}
          >
            {balance.toLocaleString()} {t("transcribe.creditsUnit")}
          </span>
        </div>
      )}

      {insufficient && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{t("transcribe.notEnoughCredits")}</p>
            <p className="mt-0.5 text-destructive/80">
              {t("transcribe.deficitLine", { deficit: deficit.toLocaleString() })}
            </p>
            <Button asChild size="sm" variant="destructive" className="mt-2 h-7 gap-1 text-xs">
              <Link href="/app/credits">
                {t("transcribe.upgradeCredits")}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
