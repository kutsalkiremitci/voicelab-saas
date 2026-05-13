"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

function VerifyEmailInner() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const error = params.get("error");
  const [resending, setResending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  async function handleResend() {
    if (!email) {
      toast.error("Add ?email= to the URL or sign in first.");
      return;
    }
    setResending(true);
    try {
      await api.post("/auth/resend-verification", { email });
      toast.success("If that email is unverified, a fresh link is on its way.");
      setCooldownUntil(Date.now() + 60_000);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        toast.error("Too many resend attempts. Wait a minute and try again.");
        setCooldownUntil(Date.now() + 60_000);
      } else {
        toast.error("Resend failed. Please try again later.");
      }
    } finally {
      setResending(false);
    }
  }

  const onCooldown = cooldownUntil !== null && cooldownUntil > Date.now();

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a verification link to <span className="font-medium text-foreground">{email || "your email"}</span>.
        Click it to activate your account and claim 1,000 free credits.
      </p>
      {error === "invalid-or-expired" && (
        <p className="mt-4 text-sm text-destructive">
          That link is invalid or expired. Resend a fresh one below.
        </p>
      )}
      {error === "missing-token" && (
        <p className="mt-4 text-sm text-destructive">No token in the link. Try the resend button.</p>
      )}
      <div className="mt-8 flex flex-col gap-3">
        <Button onClick={handleResend} disabled={resending || onCooldown} variant="outline">
          {onCooldown ? "Wait 60s…" : resending ? "Sending…" : "Resend verification email"}
        </Button>
        <Link href="/login" className="text-center text-xs text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </div>
    </section>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
