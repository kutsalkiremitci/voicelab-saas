"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "voicelab-cookie-consent";

export function CookieBanner() {
  const t = useTranslations();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        const tt = setTimeout(() => setVisible(true), 400);
        return () => clearTimeout(tt);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function persist(value: "accepted" | "declined") {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:p-5 animate-fade-up"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Cookie className="h-5 w-5" />
        </div>
        <div className="flex-1 text-sm">
          <p className="font-medium">{t("cookie.title")}</p>
          <p className="text-xs text-muted-foreground">
            {t("cookie.body")}{" "}
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              {t("cookie.learnMore")}
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => persist("declined")}>
            {t("cookie.decline")}
          </Button>
          <Button
            size="sm"
            onClick={() => persist("accepted")}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {t("cookie.accept")}
          </Button>
          <button
            type="button"
            onClick={() => persist("declined")}
            aria-label="Dismiss"
            className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors sm:flex"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
