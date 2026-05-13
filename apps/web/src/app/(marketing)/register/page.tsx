"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { registerSchema, type RegisterInput } from "@voicelab/shared/schemas/auth";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
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
          toast.error("That email is already registered. Try signing in.");
        } else if (code === "RATE_LIMITED") {
          toast.error("Too many sign-up attempts. Try again later.");
        } else if (code === "VALIDATION_ERROR") {
          toast.error("Please double-check the form.");
        } else {
          toast.error("Sign-up failed. Please try again.");
        }
      } else {
        toast.error("Sign-up failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Verified email gets you 1,000 free credits.
      </p>
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
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Name (optional)</Label>
          <Input id="name" type="text" autoComplete="name" {...register("name")} />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
