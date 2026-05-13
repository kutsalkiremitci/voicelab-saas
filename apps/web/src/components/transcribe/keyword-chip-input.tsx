"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  maxLength?: number;
  disabled?: boolean;
}

const KEYTERM_MAX = 1000;
const KEYTERM_MAX_LENGTH = 50;

export function KeywordChipInput({
  value,
  onChange,
  max = KEYTERM_MAX,
  maxLength = KEYTERM_MAX_LENGTH,
  disabled,
}: Props) {
  const t = useTranslations();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const items = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= maxLength);
    if (items.length === 0) return;
    const next = [...value];
    for (const item of items) {
      if (next.length >= max) break;
      if (item.split(/\s+/).filter(Boolean).length > 5) continue;
      if (!next.includes(item)) next.push(item);
    }
    onChange(next);
    setDraft("");
  };

  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      remove(value.length - 1);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{t("transcribe.keywords")}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value.length} / {max}
        </span>
      </div>
      <div
        className={cn(
          "flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm focus-within:ring-1 focus-within:ring-ring",
          disabled && "opacity-50",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((chip, i) => (
          <span
            key={`${chip}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            {chip}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(i);
              }}
              className="rounded-full text-muted-foreground hover:text-foreground"
              aria-label={t("transcribe.removeKeyword", { value: chip })}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
          onKeyDown={onKey}
          onBlur={() => draft && commit(draft)}
          placeholder={value.length === 0 ? t("transcribe.keywordsPlaceholder") : ""}
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          disabled={disabled || value.length >= max}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length > 0
          ? t("transcribe.keywordsSurcharge")
          : t("transcribe.keywordsHint")}
      </p>
    </div>
  );
}
