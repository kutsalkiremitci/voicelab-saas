"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  labelKey: string;
  Icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/app", labelKey: "nav.dashboard", Icon: LayoutDashboard },
  { href: "/app/text-to-speech", labelKey: "nav.textToSpeech", Icon: Volume2 },
  { href: "/app/transcribe", labelKey: "nav.speechToText", Icon: Mic },
  { href: "/app/voices", labelKey: "nav.voiceClone", Icon: Layers },
  { href: "/app/recordings", labelKey: "nav.recordings", Icon: Folder },
  { href: "/app/generations", labelKey: "nav.generations", Icon: AudioLines },
  { href: "/app/credits", labelKey: "nav.credits", Icon: CreditCard },
  { href: "/app/settings", labelKey: "nav.settings", Icon: Settings },
];

export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav className="mt-2 flex flex-col gap-0.5 text-sm">
      {NAV_ITEMS.map(({ href, labelKey, Icon }) => {
        const active =
          href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        const label = t(labelKey);
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
