"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";

export function SidebarLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "grid min-h-screen",
        collapsed ? "grid-cols-[56px_1fr]" : "grid-cols-[240px_1fr]",
      )}
      style={{ transition: "grid-template-columns 200ms ease" }}
    >
      <aside className="flex flex-col border-r border-border bg-card overflow-hidden">
        <div className={cn("shrink-0 px-4 py-4", collapsed && "px-0 flex justify-center")}>
          <Link
            href="/app"
            className={cn(
              "block font-semibold tracking-tight",
              collapsed ? "text-sm text-center px-0 py-2" : "text-base px-2 py-2",
            )}
          >
            {collapsed ? "VL" : "VoiceLab"}
          </Link>
        </div>

        <div className={cn("flex-1 overflow-y-auto", collapsed ? "px-1" : "px-2")}>
          <SidebarNav collapsed={collapsed} />
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex shrink-0 items-center gap-2 border-t px-3 py-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
            collapsed && "justify-center",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </aside>

      <div className="flex min-w-0 flex-col">{children}</div>
    </div>
  );
}
