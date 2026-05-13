"use client";

import { useTranslations } from "next-intl";

export function WhoWeAre() {
  const t = useTranslations();
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">{t("whoWeAre.heading")}</h2>
        <p className="mt-4 text-base text-muted-foreground">{t("whoWeAre.body")}</p>
      </div>
    </section>
  );
}
