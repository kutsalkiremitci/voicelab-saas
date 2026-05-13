import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages.checkout");
  return { title: t("title"), description: t("description"), robots: { index: false } };
}

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
