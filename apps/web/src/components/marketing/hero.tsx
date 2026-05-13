"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Waveform() {
  const bars = Array.from({ length: 32 }, (_, i) => i);
  return (
    <div className="flex items-center gap-[3px] h-12" aria-hidden>
      {bars.map((i) => {
        const base = 0.3 + Math.abs(Math.sin(i * 0.6)) * 0.7;
        const height = (base * 100).toFixed(2);
        const duration = (0.8 + (i % 5) * 0.15).toFixed(2);
        const delay = (i * 0.05).toFixed(2);
        return (
          <span
            key={i}
            className="block w-[3px] rounded-full bg-gradient-to-t from-accent/40 to-accent animate-wave"
            style={{
              height: `${height}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export function Hero() {
  const t = useTranslations();
  const rotating = useMemo(() => t.raw("hero.rotating") as string[], [t]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const intv = setInterval(() => setIdx((i) => (i + 1) % rotating.length), 2200);
    return () => clearInterval(intv);
  }, [rotating.length]);

  return (
    <section className="relative overflow-hidden border-b">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-accent/[0.08] blur-3xl" />
        <div className="absolute top-40 -left-32 h-80 w-80 rounded-full bg-indigo-400/[0.07] blur-3xl animate-float-slow" />
        <div className="absolute top-20 -right-32 h-80 w-80 rounded-full bg-sky-400/[0.06] blur-3xl animate-float-slow" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="flex justify-center animate-fade-down">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
          >
            <Sparkles className="h-3 w-3 text-accent" />
            <span>{t("hero.badge")}</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <h1 className="mt-6 text-center text-4xl font-semibold leading-[1.15] tracking-tight sm:text-6xl lg:text-7xl">
          <span className="block animate-fade-up">{t("hero.headingPrefix")}</span>
          <span className="mt-2 inline-block animate-fade-up [animation-delay:120ms]">
            <span
              key={idx}
              className="inline-block animate-fade-up bg-gradient-to-r from-accent via-accent to-sky-500 bg-clip-text pb-3 text-transparent"
            >
              {rotating[idx]}
            </span>
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-center text-base text-muted-foreground sm:text-lg animate-fade-up [animation-delay:200ms]">
          {t("hero.sub")}
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up [animation-delay:280ms]">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "gap-2 bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent/90 hover:shadow-accent/30",
            )}
          >
            {t("hero.ctaPrimary")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/#how"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "gap-2 backdrop-blur",
            )}
          >
            <Play className="h-3.5 w-3.5" />
            {t("hero.ctaSecondary")}
          </Link>
        </div>

        <div className="mt-14 flex justify-center animate-fade-up [animation-delay:360ms]">
          <div className="flex items-center gap-4 rounded-2xl border bg-card/60 px-5 py-3 shadow-sm backdrop-blur">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Play className="h-3.5 w-3.5 translate-x-px" />
            </div>
            <div className="flex-1">
              <Waveform />
            </div>
            <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
              0:42 / 1:00
            </span>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground animate-fade-up [animation-delay:440ms]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {t("hero.trustNoCard")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {t("hero.trustCancel")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {t("hero.trustYours")}
          </span>
        </div>
      </div>
    </section>
  );
}
