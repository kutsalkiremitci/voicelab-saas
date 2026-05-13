import Link from "next/link";
import type { ReactNode } from "react";
import { AppTopbar } from "@/components/app/topbar";
import { SidebarNav } from "@/components/app/sidebar-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="border-r border-border bg-card p-4">
        <Link href="/app" className="block px-2 py-2 text-base font-semibold tracking-tight">
          VoiceLab
        </Link>
        <SidebarNav />
      </aside>
      <div className="flex flex-col">
        <AppTopbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
