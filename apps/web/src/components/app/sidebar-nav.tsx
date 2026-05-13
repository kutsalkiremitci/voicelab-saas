"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AudioLines,
  CreditCard,
  Folder,
  Layers,
  LayoutDashboard,
  Mic,
  Settings,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/app/text-to-speech", label: "Text to Speech", Icon: Volume2 },
  { href: "/app/transcribe", label: "Speech to Text", Icon: Mic },
  { href: "/app/voices", label: "Voice Clone", Icon: Layers },
  { href: "/app/recordings", label: "Recordings", Icon: Folder },
  { href: "/app/generations", label: "Generations", Icon: AudioLines },
  { href: "/app/credits", label: "Credits", Icon: CreditCard },
  { href: "/app/settings", label: "Settings", Icon: Settings },
];

export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="mt-2 flex flex-col gap-0.5 text-sm">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active =
          href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted hover:text-foreground",
              active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
              collapsed && "justify-center px-0 py-2",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );
}
