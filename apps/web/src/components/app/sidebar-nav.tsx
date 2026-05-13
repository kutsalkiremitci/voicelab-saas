"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  ["/app", "Dashboard"],
  ["/app/library", "Text to Speech"],
  ["/app/transcribe", "Speech to Text"],
  ["/app/voices", "Voice Clone"],
  ["/app/recordings", "Recordings"],
  ["/app/generations", "Generations"],
  ["/app/credits", "Credits"],
  ["/app/settings", "Settings"],
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex flex-col gap-1 text-sm">
      {NAV_ITEMS.map(([href, label]) => {
        const active =
          href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-2 py-1.5 hover:bg-muted hover:text-foreground",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
