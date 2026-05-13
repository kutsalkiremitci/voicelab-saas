---
name: frontend-development
description: Use when working in apps/web — Next.js pages, App Router routes, React components, hooks, forms, layouts, or data fetching across the marketing site, the authenticated app, and the admin panel. Use whenever the task mentions page, screen, route, component, hook, form, design, Tailwind, shadcn, theme, dark mode, color, typography, spacing, layout, sidebar, dashboard UI, landing, pricing, register, login, admin, credits display, tier, or any visual or interactive work — even if "frontend" is not explicitly named.
---

# Frontend Development

VoiceLab's `apps/web` is a single Next.js app with **three route groups**: `(marketing)/` (public — landing, pricing, register, login), `(app)/` (authenticated and approved users), `(admin)/` (admins only). Middleware enforces the gates. Tier limits and credit balances surface in the UI but are always re-validated server-side.

## Symptoms (read this skill if any apply)

- Creating or editing a file under `apps/web/**`
- Adding a route, page, or layout (in any of the three groups)
- Writing a custom hook or wiring TanStack Query
- Adding a shadcn primitive (`bunx shadcn@latest add ...`)
- Composing a custom component on top of primitives
- Touching theme, tokens, typography, spacing, radius, motion, or dark-mode behavior
- Building a form with react-hook-form + zod (register, login, admin actions)
- Implementing an audio player or waveform surface
- Displaying credit balance, quote, ledger, or tier badge
- Building admin views (member list, member detail, audit log)
- Wiring the landing page or pricing section

## Red flags (resist these shortcuts)

- "I'll use localStorage for auth" → NO, httpOnly cookie only
- "Cache the balance in Zustand for offline display" → NO, balance is server-truth; always fetch fresh
- "Trust the quote the client computed for the UI display" → NO, the server re-quotes at submit
- "Quick CSS-in-JS for this one component" → NO, Tailwind only
- "Add `'use client'` to the layout so I can use useState anywhere" → NO, server component by default; client only where strictly needed
- "I'll skip the loading skeleton, it's fast enough" → NO, every async surface gets a skeleton
- "A bit of gradient will make it pop" → NO, single accent, neutral elsewhere
- "Bigger shadow looks more premium" → NO, `shadow-sm` / `shadow-md` only
- "I'll inline a hex color, it's just one place" → NO, tokens via CSS variables
- "The admin layout can reuse the user sidebar component as-is" → NO, the admin context needs a visual distinction (e.g. amber accent) so the operator never confuses contexts

## Non-negotiables

- Three route groups: `(marketing)/`, `(app)/`, `(admin)/`. Each has its own layout. No cross-group component leakage.
- Middleware guards: unauthed redirected from `(app)/**` and `(admin)/**`; `unverified` users redirected to `/verify-email`; suspended users redirected to `/login?suspended=1`; non-admins blocked from `(admin)/**`.
- Server components by default. `'use client'` only when event handlers, state, or browser APIs are needed.
- State split: TanStack Query (server), `useState`/`useReducer` (local), Zustand (global UI only, minimal). No other state library.
- Forms: react-hook-form + zod, schemas imported from `packages/shared/schemas`.
- Styling: Tailwind 4 only. CSS lives in `globals.css` for tokens, nowhere else.
- File names kebab-case. Component names PascalCase. Hooks `useXxx`.
- Images via `next/image`. Fonts via `next/font` self-host.
- `cn()` from `lib/utils` is the only class-merge helper.
- Variants use `cva`.
- Focus rings visible on every interactive (`focus-visible:ring-2 ring-ring`).
- Credit balance is fetched from `/credits/balance` via TanStack Query, `staleTime: 10s`. Never cached longer.
- TTS / clone forms always call `POST /credits/quote` to display expected cost, but the server re-quotes at submit.
- 402 responses surface as a clear "Not enough credits" UI with the `details` payload visible (required, balance, deficit).
- Admin pages get a visual context cue (amber accent, "Admin" badge in topbar) so the operator never thinks they are in the user app.
- No `console.log`; use the thin logger wrapper.

## Order of operations when building a screen

1. Decide which route group it belongs to: `(marketing)/`, `(app)/`, or `(admin)/`.
2. Decide server vs client component (default server).
3. Define zod schema if there's a form.
4. Add or import shadcn primitives.
5. Compose layout with Tailwind utility classes only.
6. Wire data with TanStack Query + the API client.
7. Add loading and empty states.
8. If it consumes credits: display the quote, handle 402, surface deficit.
9. If it's an admin action: confirm dialog, then call the admin endpoint.
10. Add component tests (co-located).
11. Verify dark mode parity.

## Authoritative references

- `references/design-tokens.md` — color tokens, typography, spacing, radius, motion, anti-patterns
- `references/folder-layout.md` — where pages, components, hooks, lib files live (three route groups)
- `references/data-fetching.md` — TanStack Query, API client, forms, credit balance hook
- `references/page-specs.md` — page-by-page specs across marketing, app, and admin

## Skill handoffs

- Building a recording UI? Pause and run `audio-recording` for the hook contract, then return to compose the page here.
- The endpoint you need doesn't exist yet? Stop here and run `backend-development` first; come back when the contract is published in `api-contract.md`.
- Displaying or charging credits? Coordinate with `billing-and-credits` for the quote/charge contract.
- Finished writing the component? Hand off to `test-driven-development` before any git action.
