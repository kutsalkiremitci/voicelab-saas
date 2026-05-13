import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { SidebarLayout } from "@/components/app/sidebar-layout";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages.dashboard");
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarLayout>
      <main className="flex-1 p-6">{children}</main>
    </SidebarLayout>
  );
}
