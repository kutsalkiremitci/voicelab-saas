"use client";

import { useTranslations } from "next-intl";
import { Headphones, Languages, Mic, Sparkles } from "lucide-react";

export function FeatureGrid() {
  const t = useTranslations();
  const FEATURES = [
    { icon: Mic, title: t("features.items.cloneTitle"), body: t("features.items.cloneBody") },
    { icon: Sparkles, title: t("features.items.fidelityTitle"), body: t("features.items.fidelityBody") },
    { icon: Languages, title: t("features.items.multilingualTitle"), body: t("features.items.multilingualBody") },
    { icon: Headphones, title: t("features.items.conversionTitle"), body: t("features.items.conversionBody") },
  ];

  return (
    <section id="features" className="border-b bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            {t("features.eyebrow")}
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("features.heading")}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{t("features.sub")}</p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 text-accent transition-transform group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
