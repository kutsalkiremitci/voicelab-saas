"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { Tier } from "@/lib/tiers";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PricingCard({
  tier,
  billing,
  large = false,
}: {
  tier: Tier;
  billing: "monthly" | "yearly";
  large?: boolean;
}) {
  const t = useTranslations();
  const isCustom = tier.monthlyPrice === "Custom";
  const price = billing === "yearly" ? tier.yearlyPrice : tier.monthlyPrice;
  const showCadence = !isCustom && tier.id !== "free";

  const tagline = t(`pricing.tiers.${tier.id}.tagline`);
  const features = t.raw(`pricing.tiers.${tier.id}.features`) as string[];
  const ctaLabel = t(`pricing.tiers.${tier.id}.cta`);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all",
        tier.highlighted &&
          "border-accent/40 shadow-lg shadow-accent/10 ring-1 ring-accent/20 sm:scale-[1.02]",
      )}
    >
      {tier.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground shadow-md shadow-accent/20">
            <Sparkles className="h-3 w-3" />
            {t("pricing.mostPopular")}
          </span>
        </div>
      )}

      {tier.highlighted && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-2xl bg-gradient-to-b from-accent/10 to-transparent"
          aria-hidden
        />
      )}

      <div className="relative">
        <h3 className={cn("font-semibold", large ? "text-xl" : "text-lg")}>{tier.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{tagline}</p>

        <div className="mt-5 flex items-baseline gap-1">
          <span className={cn("font-semibold tracking-tight", large ? "text-5xl" : "text-4xl")}>
            {price}
          </span>
          {showCadence && (
            <span className="text-sm text-muted-foreground">{t("pricing.perMonth")}</span>
          )}
        </div>
        {showCadence && billing === "yearly" && tier.yearlyTotal && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("pricing.billedAnnually")} · {tier.yearlyTotal}/{t("pricing.perYear")}
          </p>
        )}
        {tier.id === "free" && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("pricing.oneTimeGrant")}
          </p>
        )}
        {isCustom && (
          <p className="mt-1 text-[11px] text-muted-foreground">{t("pricing.talkVolume")}</p>
        )}

        <ul className="mt-6 space-y-2.5 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  tier.highlighted ? "text-accent" : "text-muted-foreground",
                )}
              />
              <span className={tier.highlighted ? "" : "text-muted-foreground"}>{f}</span>
            </li>
          ))}
        </ul>

        <Link
          href={tier.cta.href}
          className={cn(
            buttonVariants({
              variant: tier.highlighted ? "default" : "outline",
              size: large ? "lg" : "default",
            }),
            "mt-8 w-full gap-1.5",
            tier.highlighted &&
              "bg-accent text-accent-foreground shadow-md shadow-accent/20 hover:bg-accent/90",
          )}
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
