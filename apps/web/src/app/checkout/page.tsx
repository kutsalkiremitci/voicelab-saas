"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Mail, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

function CheckoutInner() {
  const t = useTranslations();
  const params = useSearchParams();
  const plan = (params.get("plan") ?? "Basic").charAt(0).toUpperCase() + (params.get("plan") ?? "Basic").slice(1);
  const billing = params.get("billing") === "yearly" ? t("checkout.yearly") : t("checkout.monthly");

  return (
    <div className="relative min-h-screen bg-background">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-accent/[0.08] blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-80 w-80 rounded-full bg-indigo-400/[0.07] blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-80 w-80 rounded-full bg-sky-400/[0.07] blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <BrandMark size="md" />
            <span>VoiceLab</span>
          </Link>
          <Link
            href="/app"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5",
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("checkout.backCta")}
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card p-8 shadow-md sm:p-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <Sparkles className="h-3 w-3" />
              {t("checkout.soonBadge")}
            </span>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("checkout.headingPrefix")}{" "}
              <span className="bg-gradient-to-r from-accent to-sky-500 bg-clip-text pb-1 text-transparent">
                {plan}
              </span>{" "}
              {t("checkout.headingSuffix")}
            </h1>

            <p className="mt-3 text-sm text-muted-foreground">{t("checkout.body")}</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-card/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("checkout.selected")}
                </p>
                <p className="mt-1 text-base font-semibold">{plan}</p>
              </div>
              <div className="rounded-xl border bg-card/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("checkout.billing")}
                </p>
                <p className="mt-1 text-base font-semibold">{billing}</p>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <Link
                href={`mailto:hello@voicelab.local?subject=Upgrade%20to%20${plan}%20(${billing})`}
                className={cn(
                  buttonVariants(),
                  "w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20",
                )}
              >
                <Mail className="h-4 w-4" />
                {t("checkout.contactCta")}
              </Link>
              <Link
                href="/app"
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              >
                {t("checkout.backCta")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  );
}
