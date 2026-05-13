"use client";

import { useTranslations } from "next-intl";
import { MinusCircle, PlusCircle, Sparkles } from "lucide-react";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FinalCta } from "@/components/marketing/final-cta";

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border bg-card p-5 shadow-sm transition-shadow open:shadow-md">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {q}
        <PlusCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-open:hidden" />
        <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent hidden group-open:block" />
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">{a}</p>
    </details>
  );
}

export default function PricingPage() {
  const t = useTranslations();
  const faq = t.raw("pricing.page.faq") as { q: string; a: string }[];

  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-accent/[0.08] blur-3xl" />
        </div>
        <div className="mx-auto max-w-3xl px-4 pt-16 pb-8 text-center sm:px-6 sm:pt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3 w-3" />
            {t("pricing.page.heroEyebrow")}
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            {t("pricing.page.heroHeading")}
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            {t("pricing.page.heroSub")}
          </p>
        </div>
      </section>

      <PricingSection withHeading={false} large />

      <section className="border-b">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="text-center">
            <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              {t("pricing.page.faqEyebrow")}
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("pricing.page.faqHeading")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("pricing.page.faqSub")}
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {faq.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
