"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function MarketingFooter() {
  const t = useTranslations();
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent/70 text-accent-foreground">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
                  <path
                    d="M12 3v18M7 6v12M17 6v12M2 9v6M22 9v6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="text-base font-semibold tracking-tight">VoiceLab</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("footer.tagline")}</p>
          </div>
          <div>
            <p className="text-sm font-medium">{t("footer.product")}</p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li><Link href="/#features" className="hover:text-foreground">{t("header.features")}</Link></li>
              <li><Link href="/#how" className="hover:text-foreground">{t("header.howItWorks")}</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">{t("header.pricing")}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">{t("footer.account")}</p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li><Link href="/login" className="hover:text-foreground">{t("common.signIn")}</Link></li>
              <li><Link href="/register" className="hover:text-foreground">{t("common.signUp")}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">{t("footer.contact")}</p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="mailto:hello@voicelab.local" className="hover:text-foreground">
                  hello@voicelab.local
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} VoiceLab. {t("footer.rights")}</span>
          <span>
            {t("footer.operatedBy")}{" "}
            <a
              href="https://kutsalyazilim.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              kutsalyazilim.com
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
