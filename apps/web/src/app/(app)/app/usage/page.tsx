"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  ChevronDown,
  Filter,
  Loader2,
  Mic,
  Plus,
  Volume2,
  Wand2,
  X,
  ShieldCheck,
} from "lucide-react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreditTransactions, type CreditTxOperation, type CreditTxType } from "@/hooks/use-credit-transactions";
import { cn } from "@/lib/utils";

const OPERATIONS: { value: CreditTxOperation; labelKey: string; icon: typeof Mic; tone: string }[] = [
  { value: "transcribe", labelKey: "usage.ops.transcribe", icon: Mic, tone: "text-sky-600 dark:text-sky-400" },
  { value: "tts", labelKey: "usage.ops.tts", icon: Volume2, tone: "text-violet-600 dark:text-violet-400" },
  { value: "s2s", labelKey: "usage.ops.s2s", icon: Wand2, tone: "text-amber-600 dark:text-amber-400" },
  { value: "admin_grant", labelKey: "usage.ops.adminGrant", icon: ShieldCheck, tone: "text-emerald-600 dark:text-emerald-400" },
  { value: "admin_refund", labelKey: "usage.ops.adminRefund", icon: Plus, tone: "text-emerald-600 dark:text-emerald-400" },
];

function opMeta(op: CreditTxOperation) {
  return OPERATIONS.find((o) => o.value === op) ?? OPERATIONS[0]!;
}

export default function UsagePage() {
  const t = useTranslations();
  const localeRaw = useLocale();
  const locale: "en" | "tr" = localeRaw === "tr" ? "tr" : "en";
  const [opFilter, setOpFilter] = useState<CreditTxOperation[]>([]);
  const [typeFilter, setTypeFilter] = useState<CreditTxType | undefined>(undefined);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filters = useMemo(() => {
    const f: { operation?: CreditTxOperation[]; type?: CreditTxType; from?: string; to?: string } = {};
    if (opFilter.length > 0) f.operation = opFilter;
    if (typeFilter) f.type = typeFilter;
    if (from) f.from = new Date(from).toISOString();
    if (to) f.to = new Date(`${to}T23:59:59`).toISOString();
    return f;
  }, [opFilter, typeFilter, from, to]);

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useCreditTransactions(filters);

  const rows = data?.pages.flatMap((p) => p.transactions) ?? [];

  function toggleOp(op: CreditTxOperation) {
    setOpFilter((prev) => (prev.includes(op) ? prev.filter((p) => p !== op) : [...prev, op]));
  }

  function clearFilters() {
    setOpFilter([]);
    setTypeFilter(undefined);
    setFrom("");
    setTo("");
  }

  const hasFilter = opFilter.length > 0 || typeFilter || from || to;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs />

      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("usage.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("usage.sub")}</p>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                opFilter.length > 0
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              <Filter className="h-3 w-3" />
              {t("usage.filters.operation")}
              {opFilter.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {opFilter.length}
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            {OPERATIONS.map((op) => {
              const selected = opFilter.includes(op.value);
              const Icon = op.icon;
              return (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => toggleOp(op.value)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    selected ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", op.tone)} />
                  <span className="flex-1 text-left">{t(op.labelKey)}</span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                typeFilter
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {typeFilter ? t(`usage.types.${typeFilter}`) : t("usage.filters.type")}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            <button
              type="button"
              onClick={() => setTypeFilter(undefined)}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t("usage.filters.allTypes")}
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("charge")}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t("usage.types.charge")}
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("grant")}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t("usage.types.grant")}
            </button>
          </PopoverContent>
        </Popover>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t("usage.filters.from")}</span>
          <DatePicker
            value={from}
            onChange={setFrom}
            placeholder={t("usage.filters.from")}
            max={to || undefined}
            locale={locale}
          />
          <span>{t("usage.filters.to")}</span>
          <DatePicker
            value={to}
            onChange={setTo}
            placeholder={t("usage.filters.to")}
            min={from || undefined}
            locale={locale}
          />
        </div>

        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            {t("usage.filters.clear")}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t("usage.col.when")}</th>
              <th className="px-3 py-2 font-medium">{t("usage.col.operation")}</th>
              <th className="px-3 py-2 font-medium">{t("usage.col.description")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("usage.col.amount")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("usage.col.balance")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((tx) => {
              const meta = opMeta(tx.operation);
              const Icon = meta.icon;
              const isGrant = tx.type === "grant";
              return (
                <tr key={tx.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                    {new Date(tx.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className={cn("h-3.5 w-3.5", meta.tone)} />
                      <span className="text-sm">{t(meta.labelKey)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block max-w-[420px] truncate text-xs text-muted-foreground">
                      {tx.description ?? t("usage.noDescription")}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums",
                      isGrant ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                    )}
                  >
                    {isGrant ? "+" : "−"}
                    {tx.amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                    {tx.balanceAfter.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {!isFetching && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {t("usage.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(isFetching || hasNextPage) && (
        <div className="flex justify-center">
          {hasNextPage ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="gap-1.5"
            >
              {isFetchingNextPage && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("usage.loadMore")}
            </Button>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
