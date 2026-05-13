# Pages

Specs for each screen. The Next.js app has three route groups:

- `(marketing)/` — public, unauthed-friendly (landing, pricing, legal, register, login, verify)
- `(app)/` — authenticated + verified users (the product)
- `(admin)/` — admins only

Middleware enforces the gates. Unverified users are redirected to `/verify-email` from any `(app)/**` route.

**Brand rule:** the upstream provider's name (ElevenLabs) appears NOWHERE in any user-facing string. "Voice service," "voice technology," or specific VoiceLab feature names only.

## Marketing routes

### `/` Landing

Single-page layout, sections from top to bottom.

- **Hero:** headline (e.g. "Your voice. Anywhere."), subline, CTA "Get started free" → `/register`
- **Features grid** (4 cards): "Clone your voice", "Multiple tones", "Studio-grade quality", "Sounds like you in any language"
- **How it works** (3 numbered steps): record, clone, generate
- **Pricing** section (compact version of `/pricing`): four tier cards — **Free $0**, **Basic $15**, **Pro $59** (highlighted "Most popular"), **Enterprise Custom** — each with credit allowance, key features, and a primary CTA. Link to `/pricing` for the full FAQ.
- **Who we are** section: short paragraph + photo / illustration
- **Footer:** product links, legal, contact

SEO meta + OpenGraph image. Mobile-first.

### `/pricing`

Standalone deep-link page. Same pricing section as on landing but with FAQ below.

Four tier cards from `docs/decisions/006-pricing-tiers.md`:

- **Free — $0**: 1,000 credits (one-time), default voice catalog, "Start free"
- **Basic — $15/mo**: 30,000 credits / month, Quick Voice Clone, Voice Conversion, multi-language dubbing, "Get started"
- **Pro — $59/mo**: 121,000 credits / month, Quick + Studio Voice Clone, 192 kbps audio, "Most popular" highlight, "Go Pro"
- **Enterprise — Custom**: tailored allowance, studio-grade output (44.1 kHz PCM), dedicated support, "Contact sales" (mailto link)

Each card: tier name, price (large), credit allowance, "what you get" bullet list (4-6 items), CTA.

CTAs in MVP:
- Free / Basic / Pro → `/register` (operator manually provisions Basic/Pro upon first signin, see Phase 12 admin flow)
- Enterprise → `mailto:sales@voicelab.com` with subject "Enterprise inquiry"

Tooltip on paid tier CTAs (until Stripe lands): "Sign up free, then request an upgrade in your dashboard."

When Stripe lands (Phase 16): Basic / Pro CTAs go to Checkout for the selected tier.

Below cards:
- Headline numbers: "1,000 credits ≈ 1 minute of speech"
- FAQ accordion: "How do credits work?", "What's the difference between Quick and Studio cloning?", "Can I cancel?", "Is my voice data safe?", "Why do I need to verify my email?"
- Free trial note: "Sign up free; verify your email to receive 1,000 credits to try the product."

### `/terms`, `/privacy`

Basic legal pages. Static content. Stubs in MVP, real text before launch.

## Auth routes

### `/register`

- Centered card, `max-w-sm`
- Form: email, password, confirm password, optional display name
- zod validation client + server-mirrored
- Submit → on success show "Check your email" screen (NOT a redirect — keep state for resend button visibility) → user clicks email link
- Error states: email already exists (409 EMAIL_TAKEN), validation (422)

### `/verify-email`

Friendly post-signup screen, NOT a confirmation page.

- Headline: "Check your inbox"
- Body: "We sent a verification link to **{email}**. Click it to activate your account and claim 1,000 free credits."
- "Resend email" button — calls `POST /auth/resend-verification`
  - Button disabled for 60 seconds after click (cooldown)
  - On rate-limit (429): "Please wait before requesting another email"
- Footer note: "Wrong email? [Sign out and register again]"

### `/verify` (the click target from the email)

This is a quick transition page that runs `GET /auth/verify?token=...` and shows result:

- Loading state (~200ms)
- Success: "Email verified! Logging you in..." → redirect to `/app` (session auto-created OR redirect to `/login?verified=1`)
- Expired token: "This verification link has expired. [Request a new one]" → `/verify-email`
- Invalid token: "Verification link invalid. [Sign up again]" → `/register`

### `/login`

- Centered card, `max-w-sm`
- Form: email, password
- On 200 → redirect to `/app`
- On 403 `ACCOUNT_UNVERIFIED` → redirect to `/verify-email?email={email}`
- On 403 `ACCOUNT_SUSPENDED` → inline error "Your account is suspended. Contact support."
- Banner if `?verified=1` query: "Email verified successfully. You can now log in."

## App routes (authenticated + verified)

### `/app` Dashboard

12-col grid, `gap-6`.

```
┌────────────────────────────────────────────────────────┐
│ Credits │ Voices │ Generations │ Storage      span-3   │
├────────────────────────────────────────────────────────┤
│  Credit ledger (last 10)              span-6           │
│  Activity (30-day chart)             span-6            │
├────────────────────────────────────────────────────────┤
│  Recent Generations (compact table)  span-12           │
└────────────────────────────────────────────────────────┘
```

- 4 metric cards: credit balance, voices, generations, storage used
- Credit ledger card: last 10 entries (date · reason · amount), link to `/app/credits`
- Activity chart: 30-day generations, recharts
- Recent generations: last 10 rows, inline player

### `/app/credits`

Full ledger view.

- Table with columns: date, reason, amount, balance after, metadata expand
- Filters above: reason (multi-select), date range
- Cursor pagination
- Empty state: "No credit activity yet"

### `/app/recordings`

Same as the recording studio specified earlier in this file — multi-panel recording, table, inline player. SaaS additions: each clone action shows the credit quote before charging, and "New voice" is disabled when the tier voice-slot limit is hit.

### `/app/voices`

Same as original (list, label per tone, dialog with credit quote). Add:
- Tier limit hint: "5 / 5 voice slots used (Pro tier)"
- When at limit, "New voice" button is disabled with upgrade tooltip

### `/app/voices/:id` (drawer or page)

Generate panel:
- Prompt textarea (max 1000 chars)
- Voice settings sliders (stability, similarity boost, style)
- **Credit quote display:** "This will cost ~6 credits" (re-queries on prompt change)
- Generate button — disabled if quote > balance, shows "Insufficient credits" tooltip
- On 402 → toast "Not enough credits. You need X more." with CTA "Top up" (links to billing once Stripe is live, otherwise contact admin)
- Inline player + download on success

### `/app/generations`

Same as original (table, filters, regenerate). Tone column emphasized.

## Admin routes

### `/admin` overview

- Cards: total users, signups today, active Free users, paid users by tier
- Demo account quota meter: shared Free demo usage (X / Y characters this month, alert if > 80%)
- Quick links: "Recent signups", "Recent audit log"
- Sparkline: registrations last 30 days

### `/admin/members`

List view (table, not cards — admins scan, they don't browse).

- Filters above: status (chips: All, Unverified, Active, Suspended), tier (chips: All, Free, Basic, Pro, Enterprise), search by email
- Columns: email, status, role, tier, balance (Free: credits / Paid: "Active on Pro"), created, actions
- Row actions: View, Activate (Free users), Suspend / Reactivate
- Pagination (cursor)

### `/admin/members/:id`

Full detail page.

- Header: email, status badge, role badge, tier badge
- **Activate Account wizard** (visible for Free users; available as "Rotate Key" for paid users):
  - Step 1: helper text — "Open the voice service dashboard in another tab. Create an account with email alias `operator+vlu{id}@example.com`. Subscribe to the appropriate plan. Copy the API key."
  - Step 2: form
    - Plan dropdown: Starter (→ VoiceLab Basic) / Creator (→ VoiceLab Pro) / Pro (→ Enterprise) / Scale (→ Enterprise)
    - API Key input (password-style, masked, paste-friendly)
  - Step 3: submit → PUT /admin/users/:id/api-key → success toast "User activated on {tier}" → user detail refreshes
  - After activation: api-key field shows `sk_•••••••• (set on YYYY-MM-DD)`, never the raw value
  - "Remove key" button → DELETE /admin/users/:id/api-key (returns user to Free, does NOT regrant Free credits)
- Actions row: Suspend / Reactivate, Promote / Demote, Add Free credits (Free users only)
- Sections:
  - **Profile:** email, name, status, tier, plan (if paid), activated date, created, last login
  - **Balance:** Free users show app-level credits ledger; Paid users show upstream-derived "X of Y credits this month, renews {date}"
  - **Activity:** recent voices, recent generations
  - **Audit:** every admin action ever taken against this user

Add Free credits modal: amount input + reason text + submit. Only enabled for `tier === "free"` users (button disabled with tooltip "Credit grants only apply to Free users" otherwise).

### `/admin/audit`

Global audit log.

- Filters: admin (dropdown), action type, date range
- Table: timestamp, admin, action, target (link to member), summary
- Action types: ACTIVATE_USER, SUSPEND_USER, SET_API_KEY, REMOVE_API_KEY, GRANT_FREE_CREDITS, MANUAL_VERIFY, PROMOTE_TO_ADMIN, DEMOTE_FROM_ADMIN
- API keys never appear in any audit row, regardless of action
- Pagination

## Layout (sidebar + topbar)

### Marketing layout
- Top nav: logo, "Pricing", "Login", "Get started" CTA
- Minimal footer

### App layout
- Sidebar: 240px desktop, drawer on mobile
  - Nav: Dashboard, Recordings, Voices, Generations, Billing (Phase 16)
  - Active item: `bg-muted` + left accent border
  - Footer: user email + logout
- Topbar: page title + **credits remaining badge** (Free: "X credits left" / Paid: "X of Y this month") + theme toggle + user menu

### Admin layout
- Same sidebar pattern, different items
  - Nav: Overview, Members, Audit log
  - Visual distinction: subtle "Admin" badge in topbar, amber accent to make admin context obvious
- Topbar: "Admin" prefix on page title

## Cross-cutting

- All async surfaces have skeleton loaders
- Empty states with CTAs everywhere
- Error states (network down, 5xx) show a retry banner
- Mobile responsive across all three layouts; admin layout is desktop-first but doesn't break on mobile
- Dark mode default, light mode parity verified before each phase exit
- **No mention of upstream provider** in any user-facing string (admin UI can be slightly more technical but still says "voice service" not the provider name)
