"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ChangePasswordForm() {
  const t = useTranslations();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const mutation = useMutation({
    mutationKey: ["auth", "change-password"],
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      api.post<{ ok: boolean }>("/auth/change-password", { currentPassword, newPassword }),
    meta: {
      successMessage: t("settings.password.toastSuccess"),
    },
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const code = (err.payload as { error?: { code?: string } })?.error?.code;
        if (code === "INVALID_CURRENT_PASSWORD") {
          toast.error(t("settings.password.errorCurrent"));
          return;
        }
        if (code === "WEAK_PASSWORD") {
          toast.error(t("settings.password.errorWeak"));
          return;
        }
        if (code === "SAME_PASSWORD") {
          toast.error(t("settings.password.errorSame"));
          return;
        }
      }
      toast.error(t("settings.password.errorGeneric"));
    },
  });

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;
  const canSubmit =
    current.length >= 1 &&
    next.length >= 8 &&
    confirm === next &&
    !mutation.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate({ currentPassword: current, newPassword: next });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cp-current" className="text-xs">
          {t("settings.password.current")}
        </Label>
        <div className="relative">
          <Input
            id="cp-current"
            type={showCurrent ? "text" : "password"}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="pr-8"
            disabled={mutation.isPending}
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showCurrent ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cp-next" className="text-xs">
            {t("settings.password.new")}
          </Label>
          <div className="relative">
            <Input
              id="cp-next"
              type={showNext ? "text" : "password"}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={cn("pr-8", tooShort && "border-destructive/60")}
              disabled={mutation.isPending}
            />
            <button
              type="button"
              onClick={() => setShowNext((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showNext ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showNext ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-confirm" className="text-xs">
            {t("settings.password.confirm")}
          </Label>
          <Input
            id="cp-confirm"
            type={showNext ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={cn(mismatch && "border-destructive/60")}
            disabled={mutation.isPending}
          />
        </div>
      </div>

      {(tooShort || mismatch) && (
        <p className="text-xs text-destructive">
          {tooShort ? t("settings.password.errorWeak") : t("settings.password.errorMismatch")}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-muted-foreground">{t("settings.password.hint")}</p>
        <Button type="submit" size="sm" disabled={!canSubmit} className="gap-1.5">
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          {t("settings.password.submit")}
        </Button>
      </div>
    </form>
  );
}
