"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Quote, Sparkles } from "lucide-react";

export function AuthAside({ variant }: { variant: "signin" | "signup" }) {
  const t = useTranslations();
  const heading =
    variant === "signin"
      ? t("auth.aside.signinHeading")
      : t("auth.aside.signupHeading");
  const sub =
    variant === "signin" ? t("auth.aside.signinSub") : t("auth.aside.signupSub");
  const badge =
    variant === "signin" ? t("auth.aside.signinBadge") : t("auth.aside.signupBadge");
  const perks = t.raw("auth.aside.perks") as string[];

  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 -left-20 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/4 h-64 w-64 rounded-full bg-slate-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <Link href="/" className="relative flex items-center gap-2 text-base font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
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

      <div className="relative max-w-md">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
          <Sparkles className="h-3 w-3" />
          {badge}
        </span>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {heading}
        </h2>
        <p className="mt-3 text-sm opacity-90">{sub}</p>

        <ul className="mt-8 space-y-2.5">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="opacity-90">{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <figure className="relative max-w-md rounded-2xl bg-white/10 p-5 backdrop-blur">
        <Quote className="h-5 w-5 opacity-70" />
        <blockquote className="mt-3 text-sm leading-relaxed opacity-95">
          “{t("auth.aside.testimonial")}”
        </blockquote>
        <figcaption className="mt-3 text-xs opacity-80">
          {t("auth.aside.testimonialAuthor")}
        </figcaption>
      </figure>
    </aside>
  );
}
