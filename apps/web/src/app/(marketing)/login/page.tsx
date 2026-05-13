"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@voicelab/shared/schemas/auth";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const verified = params.get("verified") === "1";
  const suspended = params.get("suspended") === "1";
  const next = params.get("next") ?? "/app";

  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(
    suspended ? "Your account is suspended. Contact support." : null,
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
          setErrMsg("Your account is suspended. Contact support.");
        } else if (code === "INVALID_CREDENTIALS") {
          setErrMsg("Invalid email or password.");
        } else if (code === "RATE_LIMITED") {
          setErrMsg("Too many sign-in attempts. Try again in a moment.");
        } else {
          setErrMsg("Sign-in failed. Please try again.");
        }
      } else {
        setErrMsg("Sign-in failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      {verified && (
        <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Email verified — you can sign in.
        </p>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
        {errMsg && <p className="text-xs text-destructive">{errMsg}</p>}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-foreground underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
