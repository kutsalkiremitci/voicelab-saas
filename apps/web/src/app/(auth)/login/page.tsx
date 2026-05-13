"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@voicelab/shared/schemas/auth";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAside } from "@/components/marketing/auth-aside";
import { LanguageSelect } from "@/components/language-select";
import { cn } from "@/lib/utils";

function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const verified = params.get("verified") === "1";
  const suspended = params.get("suspended") === "1";
  const next = params.get("next") ?? "/app";

  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(
    suspended ? t("auth.errSuspended") : null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    setErrMsg(null);
    try {
      await api.post("/auth/login", values);
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      router.push(next);
    } catch (e) {
      if (e instanceof ApiError) {
        const code = (e.payload as { error?: { code?: string } })?.error?.code;
        if (code === "ACCOUNT_UNVERIFIED") {
          router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
          return;
        }
        if (code === "ACCOUNT_SUSPENDED") {
          setErrMsg(t("auth.errSuspended"));
        } else if (code === "INVALID_CREDENTIALS") {
          setErrMsg(t("auth.errInvalidCredentials"));
        } else if (code === "RATE_LIMITED") {
          setErrMsg(t("auth.errRateLimited"));
        } else {
          setErrMsg(t("auth.errSigninGeneric"));
        }
      } else {
        setErrMsg(t("auth.errSigninGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthAside variant="signin" />

      <div className="flex flex-col">
        {/* Top utility bar: back + language */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("common.backToSite")}
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold lg:hidden">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent/70 text-accent-foreground">
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
                  <path
                    d="M12 3v18M7 6v12M17 6v12M2 9v6M22 9v6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              VoiceLab
            </Link>
            <LanguageSelect />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-sm">
            <div className="hidden justify-end lg:flex">
              <Link
                href="/register"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("auth.noAccount")}{" "}
                <span className="text-foreground font-medium">{t("common.signUp")} →</span>
              </Link>
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("auth.signinHeading")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("auth.signinSub")}
            </p>

            {verified && (
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("auth.emailVerified")}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("auth.emailPlaceholder")}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("auth.passwordPlaceholder")}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>
              {errMsg && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {errMsg}
                </div>
              )}
              <Button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20",
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("auth.submitSigninLoading")}
                  </>
                ) : (
                  <>
                    {t("auth.submitSignin")}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
              {t("auth.noAccount")}{" "}
              <Link
                href="/register"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {t("common.signUp")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
