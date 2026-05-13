"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, FileAudio, Mic, Wand2 } from "lucide-react";

export function HowItWorks() {
  const t = useTranslations();
  const STEPS = [
    { n: "01", icon: CheckCircle2, title: t("how.step1Title"), body: t("how.step1Body") },
    { n: "02", icon: Mic, title: t("how.step2Title"), body: t("how.step2Body") },
    { n: "03", icon: Wand2, title: t("how.step3Title"), body: t("how.step3Body") },
  ];

  return (
    <section id="how" className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            {t("how.eyebrow")}
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("how.heading")}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{t("how.sub")}</p>
        </div>

        <ol className="mt-14 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className="relative rounded-2xl border bg-card p-6 shadow-sm"
            >
              <span className="pointer-events-none absolute right-4 top-2 text-5xl font-semibold text-accent/10">
                {s.n}
              </span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-md shadow-accent/20">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              {i < STEPS.length - 1 && (
                <div className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background sm:flex">
                  <span className="block h-1 w-3 rounded-full bg-accent" />
                </div>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-16 grid gap-6 rounded-2xl border bg-gradient-to-br from-accent/5 to-card p-6 sm:grid-cols-3 sm:p-8">
          <div>
            <div className="text-3xl font-semibold tabular-nums">
              {"<5"}
              <span className="text-base font-normal text-muted-foreground"> sec</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("how.statAvgTime")}</p>
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums">
              30+
              <span className="text-base font-normal text-muted-foreground"> </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("how.statLangs")}</p>
          </div>
          <div>
            <div className="text-3xl font-semibold tabular-nums">
              1,000
              <span className="text-base font-normal text-muted-foreground"> </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("how.statFreeCredits")}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
            <FileAudio className="h-3 w-3 text-accent" />
            MP3 128 / 192 kbps
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
            <FileAudio className="h-3 w-3 text-accent" />
            PCM 44.1 kHz (Enterprise)
          </span>
        </div>
      </div>
    </section>
  );
}
