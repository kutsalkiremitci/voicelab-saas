import Link from "next/link";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="border-r border-border bg-card p-4">
        <Link href="/app" className="block px-2 py-2 text-base font-semibold tracking-tight">
          VoiceLab
        </Link>
        <nav className="mt-4 flex flex-col gap-1 text-sm">
          {(
            [
              ["/app", "Dashboard"],
              ["/app/recordings", "Recordings"],
              ["/app/voices", "Voices"],
              ["/app/generations", "Generations"],
              ["/app/credits", "Credits"],
              ["/app/settings", "Settings"],
            ] as const
          ).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-col">
        <header className="flex h-14 items-center justify-end border-b border-border px-4 text-sm text-muted-foreground">
          <span>Credits: —</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
