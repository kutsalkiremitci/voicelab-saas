import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages.pricing");
  return { title: t("title"), description: t("description") };
}

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
