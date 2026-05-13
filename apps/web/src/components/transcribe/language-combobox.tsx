"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TRANSCRIBE_LANGUAGES, languageLabel } from "@/lib/language-codes";

interface Props {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}

export function LanguageCombobox({ value, onChange, disabled }: Props) {
  const t = useTranslations();
  const localeRaw = useLocale();
  const locale: "en" | "tr" = localeRaw === "tr" ? "tr" : "en";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TRANSCRIBE_LANGUAGES;
    return TRANSCRIBE_LANGUAGES.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        l.en.toLowerCase().includes(q) ||
        l.tr.toLowerCase().includes(q),
    );
  }, [query]);

  const currentLabel = value
    ? languageLabel(value, locale)
    : t("transcribe.languageDetect");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={t("transcribe.language")}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("transcribe.languageSearch")}
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
              setQuery("");
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
              !value ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span>{t("transcribe.languageDetect")}</span>
            {!value && <Check className="h-3.5 w-3.5 text-accent" />}
          </button>
          {filtered.map((l) => {
            const active = value === l.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  onChange(l.code);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground/70">{l.code}</span>
                  <span>{l[locale]}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {t("transcribe.languageNoMatch")}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
