import type { ReactNode } from "react";
import { AppTopbar } from "@/components/app/topbar";
import { SidebarLayout } from "@/components/app/sidebar-layout";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarLayout>
      <AppTopbar />
      <main className="flex-1 p-6">{children}</main>
    </SidebarLayout>
  );
}
