import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages.voiceClone");
  return { title: t("title"), description: t("description") };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
