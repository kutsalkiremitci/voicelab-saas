"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const LOCALE_COOKIE = "NEXT_LOCALE";

type LangOption = {
  code: "en" | "tr";
  label: string;
  short: string;
  Flag: () => React.ReactElement;
};

function FlagUS() {
  return (
    <svg viewBox="0 0 60 30" className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm">
      <rect width="60" height="30" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((row) => (
        <rect key={row} y={row * (30 / 13)} width="60" height={30 / 13} fill="#fff" />
      ))}
      <rect width="24" height={30 * (7 / 13)} fill="#3C3B6E" />
    </svg>
  );
}

function FlagTR() {
  return (
    <svg viewBox="0 0 30 20" className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm">
      <rect width="30" height="20" fill="#E30A17" />
      <circle cx="11" cy="10" r="5" fill="#fff" />
      <circle cx="12.5" cy="10" r="4" fill="#E30A17" />
      <polygon
        fill="#fff"
        points="19,7.3 19.62,9.2 21.62,9.2 20,10.4 20.62,12.3 19,11.13 17.38,12.3 18,10.4 16.38,9.2 18.38,9.2"
      />
    </svg>
  );
}

const LANGS: LangOption[] = [
  { code: "en", label: "English", short: "EN", Flag: FlagUS },
  { code: "tr", label: "Türkçe", short: "TR", Flag: FlagTR },
];

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = LANGS.find((l) => l.code === locale) ?? LANGS[0]!;

  function selectLocale(code: "en" | "tr") {
    if (code === locale) {
      setOpen(false);
      return;
    }
    document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Change language"
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            compact ? "h-7 w-7 justify-center px-0" : "h-8 px-2.5",
          )}
        >
          <current.Flag />
          {!compact && <span className="text-xs font-medium">{current.short}</span>}
          {!compact && <ChevronDown className="h-3 w-3 opacity-60" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="end">
        {LANGS.map((l) => {
          const active = l.code === locale;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => selectLocale(l.code)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <l.Flag />
              <span className="flex-1 text-left">{l.label}</span>
              {active && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
