"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { TIERS, type Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";

function MiniTierCard({
  tier,
  billing,
  isCurrent,
  onSelect,
}: {
  tier: Tier;
  billing: "monthly" | "yearly";
  isCurrent: boolean;
  onSelect: () => void;
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
        "relative flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-all",
        tier.highlighted && "border-accent/40 ring-1 ring-accent/20 shadow-md shadow-accent/10",
        isCurrent && "opacity-60",
      )}
    >
      {tier.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold text-accent-foreground shadow-md shadow-accent/20">
            <Sparkles className="h-3 w-3" />
            {t("pricing.mostPopular")}
          </span>
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold">{tier.name}</h3>
        {isCurrent && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {t("upgrade.currentPlan")}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{tagline}</p>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tabular-nums">{price}</span>
        {showCadence && (
          <span className="text-xs text-muted-foreground">{t("pricing.perMonth")}</span>
        )}
      </div>
      {showCadence && billing === "yearly" && tier.yearlyTotal && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {tier.yearlyTotal}/{t("pricing.perYear")}
        </p>
      )}

      <ul className="mt-4 flex-1 space-y-1.5 text-xs">
        {features.slice(0, 4).map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Check
              className={cn(
                "mt-0.5 h-3 w-3 shrink-0",
                tier.highlighted ? "text-accent" : "text-muted-foreground",
              )}
            />
            <span className={tier.highlighted ? "" : "text-muted-foreground"}>{f}</span>
          </li>
        ))}
      </ul>

      {isCustom ? (
        <Link
          href={tier.cta.href}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "mt-5 w-full gap-1.5",
          )}
        >
          {ctaLabel}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          disabled={isCurrent}
          className={cn(
            buttonVariants({
              size: "sm",
              variant: tier.highlighted ? "default" : "outline",
            }),
            "mt-5 w-full gap-1.5",
            tier.highlighted &&
              "bg-accent text-accent-foreground shadow-md shadow-accent/20 hover:bg-accent/90",
          )}
        >
          {isCurrent ? t("upgrade.currentPlan") : ctaLabel}
          {!isCurrent && <ArrowRight className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}

export function UpgradeDialog({ trigger }: { trigger: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const { data: auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const currentTier = auth?.user.tier ?? "free";

  function selectTier(id: string) {
    setOpen(false);
    router.push(`/checkout?plan=${id}&billing=${billing}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-xl font-semibold">{t("upgrade.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("upgrade.dialogSub")}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6 sm:px-8">
          {/* Billing toggle */}
          <div className="flex justify-center">
            <div
              role="tablist"
              aria-label="Billing period"
              className="inline-flex items-center gap-1 rounded-full border bg-card/80 p-1 shadow-sm"
            >
              <button
                type="button"
                role="tab"
                aria-selected={billing === "monthly"}
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
                type="button"
                role="tab"
                aria-selected={billing === "yearly"}
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

          {/* Tiers grid */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <MiniTierCard
                key={tier.id}
                tier={tier}
                billing={billing}
                isCurrent={tier.id === currentTier}
                onSelect={() => selectTier(tier.id)}
              />
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            {t("upgrade.stripeBadge")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
