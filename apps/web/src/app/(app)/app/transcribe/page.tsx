"use client";

import { useTranslations } from "next-intl";
import { Mic } from "lucide-react";
import { Breadcrumbs } from "@/components/app/breadcrumbs";

export default function TranscribePage() {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs />
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Mic className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("transcribe.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("transcribe.comingSoon")}</p>
        </div>
      </div>
    </div>
  );
}
