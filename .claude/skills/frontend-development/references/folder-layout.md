# Frontend Folder Layout

VoiceLab's `apps/web` has three route groups, each with its own layout. The middleware redirects unauthed users away from `(app)/**` and `(admin)/**`, and `unverified`/`suspended` users away from `(app)/**` (redirected to `/verify-email`).

```
apps/web/
├── app/
│   ├── (marketing)/                 # public — no auth required
│   │   ├── layout.tsx               # minimal nav + footer
│   │   ├── page.tsx                 # / landing
│   │   ├── pricing/page.tsx
│   │   ├── terms/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── register/page.tsx
│   │   ├── login/page.tsx
│   │   ├── verify-email/page.tsx    # "Check your inbox" post-register
│   │   └── verify/page.tsx          # the click target from email link
│   │
│   ├── (app)/                       # requireAuth + requireVerified
│   │   ├── layout.tsx               # sidebar + topbar (with credit balance)
│   │   ├── page.tsx                 # /app dashboard
│   │   ├── recordings/page.tsx
│   │   ├── voices/page.tsx
│   │   ├── voices/[id]/page.tsx
│   │   ├── generations/page.tsx
│   │   └── credits/page.tsx         # full ledger
│   │
│   ├── (admin)/                     # requireAuth + requireAdmin
│   │   ├── layout.tsx               # admin sidebar (amber accent), admin topbar
│   │   ├── admin/page.tsx           # overview
│   │   ├── admin/members/page.tsx
│   │   ├── admin/members/[id]/page.tsx
│   │   └── admin/audit/page.tsx
│   │
│   ├── layout.tsx                   # root: theme provider, fonts, providers
│   ├── globals.css                  # Tailwind 4 + theme tokens
│   └── middleware.ts                # route-group guards
│
├── components/
│   ├── ui/                          # shadcn primitives
│   ├── marketing/                   # hero, pricing-card, features-grid
│   ├── studio/                      # recording panels, waveform
│   ├── credits/                     # balance-badge, quote-display, ledger-table
│   ├── admin/                       # member-row, audit-row, approve-dialog
│   ├── metrics/                     # metric cards
│   └── layout/                      # sidebar variants, topbar variants
│
├── lib/
│   ├── api.ts                       # fetch wrapper (credentials: include)
│   ├── logger.ts                    # thin client logger
│   └── utils.ts                     # cn(), formatters
│
├── hooks/
│   ├── use-recorder.ts
│   ├── use-audio-player.ts
│   ├── use-auth.ts                  # session + user info
│   ├── use-credits.ts               # balance + ledger
│   ├── use-quote.ts                 # /credits/quote wrapper for UI display
│   └── use-admin-members.ts
│
├── e2e/                             # Playwright
└── tailwind.config.ts
```

## Where things go

| What | Where |
|------|-------|
| Public marketing page (landing, pricing, terms) | `app/(marketing)/<name>/page.tsx` |
| Auth screens (register, login, verify-email, verify) | `app/(marketing)/<name>/page.tsx` |
| Authenticated user page | `app/(app)/<section>/page.tsx` |
| Admin page | `app/(admin)/admin/<section>/page.tsx` |
| shadcn primitive | `components/ui/` |
| Marketing-only component | `components/marketing/<name>.tsx` |
| Credit-system component (balance, quote, ledger) | `components/credits/<name>.tsx` |
| Admin-only component | `components/admin/<name>.tsx` |
| Shared component | `components/<domain>/<name>.tsx` |
| Component test | next to the component, `<name>.test.tsx` |
| Custom hook | `hooks/use-<thing>.ts` |
| API call | through `lib/api.ts`, never `fetch` directly |
| Constants | `lib/constants.ts` if shared; otherwise co-located |
| Types | `packages/shared` if used by backend too; otherwise next to use site |

## Layout boundaries

- The **root** `app/layout.tsx` mounts the theme provider, font loader, and TanStack Query provider. Every page inherits these.
- Each route group's `layout.tsx` adds the visual chrome for that group:
  - `(marketing)/layout.tsx` → minimal nav, footer
  - `(app)/layout.tsx` → user sidebar (Dashboard, Recordings, Voices, Generations, Credits), topbar with **credit balance badge**
  - `(admin)/layout.tsx` → admin sidebar (Overview, Members, Audit), **amber accent** to distinguish from user context, "Admin" badge in topbar

A user navigating from `/app` to `/admin` sees the visual context change immediately. No accidental "am I in admin or user view?" confusion.

## Middleware

`app/middleware.ts` runs per-request before any page renders:

```ts
// Pseudocode
export default function middleware(req: NextRequest) {
  const sid = req.cookies.get("voicelab_session");
  const path = req.nextUrl.pathname;

  // (app) gate
  if (path.startsWith("/app")) {
    if (!sid) return NextResponse.redirect(new URL("/login", req.url));
    const { status, role } = await resolveSession(sid);
    if (status === "unverified") return NextResponse.redirect(new URL("/verify-email", req.url));
    if (status !== "active") return NextResponse.redirect(new URL("/login?suspended=1", req.url));
  }

  // (admin) gate
  if (path.startsWith("/admin")) {
    if (!sid) return NextResponse.redirect(new URL("/login", req.url));
    const { role } = await resolveSession(sid);
    if (role !== "admin") return NextResponse.redirect(new URL("/app", req.url));
  }

  return NextResponse.next();
}
```

The middleware calls a thin server-side helper that hits the backend for session resolution. Cache the result for the request lifecycle to avoid double-fetch.

## Naming

- Files: kebab-case (`metric-card.tsx`, `use-recorder.ts`)
- Components: PascalCase exports (`MetricCard`)
- Hooks: camelCase starting with `use` (`useRecorder`)
- Test files: `<name>.test.tsx` for components, `<name>.test.ts` for hooks
- Route group folders: lowercase in parens (`(marketing)`, `(app)`, `(admin)`)
