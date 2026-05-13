"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import {
  AtSign,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Globe,
  Lock,
  Mail,
  Monitor,
  Moon,
  Shield,
  Sun,
  User,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { LanguageSelect } from "@/components/language-select";
import { ChangePasswordForm } from "@/components/app/change-password-form";
import { cn } from "@/lib/utils";

const TIER_NAMES: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        status === "active" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        status === "unverified" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        status === "suspended" && "bg-destructive/15 text-destructive",
      )}
    >
      {status === "active" && <CheckCircle2 className="h-2.5 w-2.5" />}
      {status}
    </span>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  copyable = false,
}: {
  icon: typeof User;
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
      {copyable && value !== "—" && (
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations();
  const { data } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const user = data?.user;
  const tier = user?.tier ?? "free";
  const tierLabel = TIER_NAMES[tier] ?? tier;
  const currentTheme = mounted ? theme : "light";

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs />

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.sub")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" />
            {t("settings.profile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field icon={Mail} label={t("settings.email")} value={user?.email ?? "—"} copyable />
          <Field icon={AtSign} label={t("settings.displayName")} value={user?.name ?? t("settings.nameNotSet")} />
          <Field
            icon={Calendar}
            label={t("settings.memberSince")}
            value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
          />
          <div className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("settings.accountStatus")}
              </p>
              <div className="mt-0.5">
                <StatusBadge status={user?.status} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            {t("settings.plan")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{tierLabel}</span>
              {tier === "free" && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {t("settings.trial")}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tier === "free" ? t("settings.planFreeBody") : t("settings.planPaidBody")}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/credits" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
              {t("settings.viewCredits")}
            </Link>
            {tier === "free" && (
              <Link href="/pricing" className={cn(buttonVariants({ size: "sm" }))}>
                {t("settings.upgrade")}
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            {t("settings.preferences")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t("settings.appearance")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.appearanceSub")}</p>
            </div>
            <div className="flex rounded-md border p-0.5">
              <button
                type="button"
                onClick={() => setTheme("light")}
                aria-label="Light theme"
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded transition-colors",
                  currentTheme === "light"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                aria-label="Dark theme"
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded transition-colors",
                  currentTheme === "dark"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t pt-5">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t("common.language")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.languageSub")}</p>
              </div>
            </div>
            <LanguageSelect />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-muted-foreground" />
            {t("settings.security")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
