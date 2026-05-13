"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TIERS } from "@/lib/tiers";
import { PricingCard } from "./pricing-card";
import { cn } from "@/lib/utils";

export function PricingSection({
  large = false,
  withHeading = true,
}: {
  large?: boolean;
  withHeading?: boolean;
}) {
  const t = useTranslations();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <section id="pricing" className="relative overflow-hidden border-b">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-50"
        aria-hidden
      >
        <div className="absolute left-1/2 top-1/3 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-accent/[0.05] blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        {withHeading && (
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              {t("pricing.eyebrow")}
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("pricing.heading")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">{t("pricing.sub")}</p>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-2">
          <div
            role="tablist"
            aria-label="Billing period"
            className="inline-flex items-center gap-1 rounded-full border bg-card/80 p-1 shadow-sm backdrop-blur"
          >
            <button
              role="tab"
              aria-selected={billing === "monthly"}
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                billing === "monthly"
                  ? "bg-accent text-accent-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("pricing.monthly")}
            </button>
            <button
              role="tab"
              aria-selected={billing === "yearly"}
              type="button"
              onClick={() => setBilling("yearly")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                billing === "yearly"
                  ? "bg-accent text-accent-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("pricing.yearly")}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                  billing === "yearly"
                    ? "bg-accent-foreground/20 text-accent-foreground"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                )}
              >
                {t("pricing.save")}
              </span>
            </button>
          </div>
        </div>

        <div className={cn("mt-10 grid gap-4 lg:grid-cols-4", large && "lg:gap-6")}>
          {TIERS.map((tier) => (
            <PricingCard key={tier.id} tier={tier} billing={billing} large={large} />
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {t("pricing.footnote")}{" "}
          <Link
            href="mailto:hello@voicelab.local"
            className="text-foreground underline-offset-4 hover:underline"
          >
            {t("pricing.talkToUs")}
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
