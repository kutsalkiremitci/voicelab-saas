"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FinalCta() {
  const t = useTranslations();
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/15 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-32 -left-32 h-[26rem] w-[26rem] rounded-full bg-sky-500/15 blur-3xl animate-float-slow [animation-delay:1.5s]" />
        <div className="absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 sm:py-16">
        <span className="inline-flex animate-fade-down items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium backdrop-blur">
          <Sparkles className="h-3 w-3" />
          {t("finalCta.badge")}
        </span>

        <h2 className="mt-6 animate-fade-up text-4xl font-semibold leading-[1.15] tracking-tight sm:text-6xl">
          {t("finalCta.headingPrefix")}{" "}
          <span className="inline-block bg-gradient-to-r from-white via-sky-200 to-indigo-200 bg-clip-text pb-2 text-transparent">
            {t("finalCta.headingHighlight")}
          </span>
        </h2>

        <p className="mx-auto mt-4 max-w-xl animate-fade-up text-base text-white/70 sm:text-lg [animation-delay:120ms]">
          {t("finalCta.sub")}
        </p>

        <div className="mt-6 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row [animation-delay:200ms]">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "group gap-2 bg-white text-slate-900 shadow-xl shadow-black/20 hover:bg-white/95",
            )}
          >
            {t("finalCta.ctaPrimary")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "border-white/20 bg-white/[0.04] text-white backdrop-blur hover:bg-white/[0.1] hover:text-white",
            )}
          >
            {t("finalCta.ctaSecondary")}
          </Link>
        </div>

        <div className="mt-8 flex animate-fade-up flex-wrap items-center justify-center gap-x-7 gap-y-2 text-xs text-white/60 [animation-delay:280ms]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t("hero.trustNoCard")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t("hero.trustCancel")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t("hero.trustYours")}
          </span>
        </div>
      </div>
    </section>
  );
}
