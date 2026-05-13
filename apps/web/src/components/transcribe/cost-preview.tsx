"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/audio-duration";

interface Props {
  durationSec: number | null;
  keytermsCount: number;
  balance: number | null;
}

interface Quote {
  amount: number;
  operation: "transcribe";
  ratePerChar: number;
}

export function CostPreview({ durationSec, keytermsCount, balance }: Props) {
  const t = useTranslations();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (durationSec === null || durationSec <= 0) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .post<Quote>("/credits/quote", {
          operation: "transcribe",
          payload: { durationSec, keytermsCount },
        })
        .then((q) => setQuote(q))
        .catch((e: unknown) => {
          if (e instanceof ApiError) {
            setQuote(null);
          }
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [durationSec, keytermsCount]);

  if (!quote || durationSec === null) return null;

  const insufficient = balance !== null && quote.amount > balance;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 text-sm",
        insufficient ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          insufficient ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent",
        )}
      >
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {loading
            ? t("transcribe.costEstimating")
            : t("transcribe.costEstimate", { amount: quote.amount })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("transcribe.costBreakdown", {
            duration: formatDuration(durationSec),
            rate: quote.ratePerChar,
          })}
          {keytermsCount > 0 && ` · ${t("transcribe.surchargeKeywords")}`}
        </p>
      </div>
      {balance !== null && (
        <div className="text-right text-xs text-muted-foreground">
          <p>{t("transcribe.balance")}</p>
          <p className={cn("font-medium tabular-nums", insufficient && "text-destructive")}>
            {balance.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
