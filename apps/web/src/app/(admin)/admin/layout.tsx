import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside
        className="border-r border-border bg-card p-4"
        style={{ borderLeft: "3px solid var(--color-admin-accent)" }}
      >
        <Link href="/admin" className="block px-2 py-2 text-base font-semibold tracking-tight">
          VoiceLab
        </Link>
        <span className="ml-2 inline-flex items-center rounded-md bg-[color:var(--color-admin-accent)]/15 px-2 py-0.5 text-xs font-medium text-[color:var(--color-admin-accent)]">
          Admin
        </span>
        <nav className="mt-4 flex flex-col gap-1 text-sm">
          {(
            [
              ["/admin", "Overview"],
              ["/admin/members", "Members"],
              ["/admin/audit", "Audit"],
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
        <header
          className="flex h-14 items-center justify-between border-b border-border px-4"
          style={{ borderBottom: "1px solid var(--color-admin-accent)" }}
        >
          <span className="rounded-md bg-[color:var(--color-admin-accent)]/15 px-2 py-0.5 text-xs font-medium text-[color:var(--color-admin-accent)]">
            ADMIN CONTEXT
          </span>
          <Link href="/app" className="text-sm text-muted-foreground hover:text-foreground">
            Switch to user view
          </Link>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
