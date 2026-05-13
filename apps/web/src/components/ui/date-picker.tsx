"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  value: string; // ISO date YYYY-MM-DD or ""
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  locale?: "en" | "tr";
  className?: string;
}

const WEEK_LABELS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEEK_LABELS_TR = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseISODate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildCalendar(month: Date): Date[] {
  const first = startOfMonth(month);
  // Monday-first offset (JS getDay: Sun=0). We want Mon=0.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  min,
  max,
  locale = "en",
  className,
}: Props) {
  const selected = useMemo(() => parseISODate(value), [value]);
  const minDate = useMemo(() => (min ? parseISODate(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseISODate(max) : null), [max]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(selected ?? new Date());

  const weeks = useMemo(() => buildCalendar(view), [view]);
  const months = locale === "tr" ? MONTHS_TR : MONTHS_EN;
  const weekLabels = locale === "tr" ? WEEK_LABELS_TR : WEEK_LABELS_EN;
  const todayKey = toISODate(new Date());

  function pick(d: Date) {
    if (minDate && d < minDate) return;
    if (maxDate && d > maxDate) return;
    onChange(toISODate(d));
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setView((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const display = selected
    ? selected.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : placeholder ?? "Select date";

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-8 min-w-[10rem] items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm transition-colors hover:border-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="flex-1 text-left">{display}</span>
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear date"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-2" align="start">
        <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-semibold tabular-nums">
            {months[view.getMonth()]} {view.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-0.5 text-center">
          {weekLabels.map((l) => (
            <div key={l} className="text-[10px] font-medium uppercase text-muted-foreground/70">
              {l}
            </div>
          ))}
          {weeks.map((d, i) => {
            const key = toISODate(d);
            const inMonth = d.getMonth() === view.getMonth();
            const isToday = key === todayKey;
            const isSelected = selected ? toISODate(selected) === key : false;
            const disabledDay =
              (minDate && d < minDate) || (maxDate && d > maxDate);
            return (
              <button
                key={`${key}-${i}`}
                type="button"
                onClick={() => !disabledDay && pick(d)}
                disabled={!!disabledDay}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md text-[11px] tabular-nums transition-colors",
                  inMonth ? "text-foreground" : "text-muted-foreground/40",
                  isSelected
                    ? "bg-accent text-accent-foreground font-semibold"
                    : isToday
                      ? "border border-accent/40 text-accent"
                      : "hover:bg-muted",
                  disabledDay && "opacity-30",
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
