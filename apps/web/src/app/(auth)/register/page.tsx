"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { registerSchema, type RegisterInput } from "@voicelab/shared/schemas/auth";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAside } from "@/components/marketing/auth-aside";
import { LanguageSelect } from "@/components/language-select";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setSubmitting(true);
    try {
      await api.post("/auth/register", values);
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (e) {
      if (e instanceof ApiError) {
        const code = (e.payload as { error?: { code?: string } })?.error?.code;
        if (code === "EMAIL_TAKEN") {
          toast.error(t("auth.errEmailTaken"));
        } else if (code === "RATE_LIMITED") {
          toast.error(t("auth.errSignupRateLimited"));
        } else if (code === "VALIDATION_ERROR") {
          toast.error(t("auth.errValidation"));
        } else {
          toast.error(t("auth.errSignupGeneric"));
        }
      } else {
        toast.error(t("auth.errSignupGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthAside variant="signup" />

      <div className="flex flex-col">
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
                href="/login"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("auth.hasAccount")}{" "}
                <span className="text-foreground font-medium">{t("common.signIn")} →</span>
              </Link>
            </div>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("auth.signupHeading")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("auth.signupSub")}</p>

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
                  autoComplete="new-password"
                  placeholder={t("auth.passwordSignupPlaceholder")}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">
                  {t("auth.name")} <span className="text-muted-foreground">({t("auth.nameOptional")})</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder={t("auth.namePlaceholder")}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20",
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("auth.submitSignupLoading")}
                  </>
                ) : (
                  <>
                    {t("auth.submitSignup")}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-[11px] text-muted-foreground">{t("auth.termsNotice")}</p>

            <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
              {t("auth.hasAccount")}{" "}
              <Link
                href="/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {t("common.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
