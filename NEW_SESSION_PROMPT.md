# NEW_SESSION_PROMPT.md

We're working on VoiceLab — a managed AI voice generation product. Public registration with email verification, Free tier with one-time 1,000 credits, per-user upstream account model for paid tiers (operator-provisioned, hidden from users), brand-silent on the upstream provider. Run this protocol before answering anything else.

## Step 1 — Skill Map

For each directory under `.claude/skills/`:
  - Read the YAML frontmatter of its SKILL.md (name + description ONLY).
  - List the filenames inside its references/ directory. DO NOT open them.

Then output:

"Skill map loaded: <N> skills.
Skills: <comma-separated names>.
Reference files visible (not yet read):
  - <skill-a>/references/: <file1>, <file2>, ...
  - ..."

Reference content is opened only when a phase actively needs it (Step 5).

## Step 2 — Docs

List files under `docs/`. State which ones exist. The only cross-cutting doc is `docs/system-architecture.md`; everything else lives inside skill references/.

## Step 3 — Plan & Rules

Read `PLAN.md` and `CLAUDE.md` in full. Report:
  - Current phase
  - Completed task count (ticked [x])
  - Next unchecked task
  - Skills the next phase's "Skills:" line points to

## Step 4 — Wait

Do not start any work. Wait for the user to pick a phase or task.

## Step 5 — Before Starting a Phase

When the user picks a phase:
  1. Read each skill's full SKILL.md (body, not just frontmatter).
  2. For each skill, read `references/README.md` first to decide which reference files matter, then open only those.
  3. Read `docs/system-architecture.md` if cross-cutting concerns are touched.
  4. Print:
     - "Skills to use: <list> — because <one-line reason each>"
     - "Reference files read: <list>"
     - "Docs read: <list or 'none'>"
  5. Begin writing code.

## Step 6 — After Code

Run the `test-driven-development` skill's cycle. The full procedure is in that skill — don't restate it here. End state: tests green + smoke test approved by the user.

## Step 7 — Git

Hand off to the `git-workflow` skill. The end-of-phase report format and the per-action confirmation flow are in `git-workflow/references/end-of-phase-template.md` — follow it exactly.

## Stack

Bun · Hono · Drizzle · PostgreSQL · Redis · Next.js 16 · Tailwind 4 · shadcn/ui · ElevenLabs.

## Language

Code, commits, docs, UI: English. User chat: Turkish.

Begin Step 1 now.