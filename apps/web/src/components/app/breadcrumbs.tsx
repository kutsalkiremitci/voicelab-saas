"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const LABEL_KEYS: Record<string, string> = {
  app: "nav.dashboard",
  "text-to-speech": "nav.textToSpeech",
  transcribe: "nav.speechToText",
  transcriptions: "nav.transcriptions",
  voices: "nav.voiceClone",
  recordings: "nav.recordings",
  generations: "nav.generations",
  credits: "nav.credits",
  usage: "nav.usage",
  settings: "nav.settings",
};

export function Breadcrumbs({ className }: { className?: string }) {
  const t = useTranslations();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => ({
    label: LABEL_KEYS[seg] ? t(LABEL_KEYS[seg]!) : seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isApp: i === 0 && seg === "app",
  }));

  if (crumbs.length === 0) return null;

  return (
    <nav
      className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}
      aria-label="Breadcrumb"
    >
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={c.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
            {isLast ? (
              <span className="flex items-center gap-1 font-medium text-foreground">
                {c.isApp && <Home className="h-3 w-3" />}
                {c.label}
              </span>
            ) : (
              <Link
                href={c.href}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {c.isApp && <Home className="h-3 w-3" />}
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
