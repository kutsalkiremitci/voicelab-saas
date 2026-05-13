# ADR-001: Skill Granularity

**Date:** 2026-05-13
**Status:** Accepted

## Context

The first scaffold had 9-10 skills (separate `shadcn-ui`, `api-design`, `database-drizzle`, etc.). After review, several were merged into broader skills (`frontend-development`, `backend-development`). The count was 8.

When the project pivoted to a SaaS model, a 9th skill (`billing-and-credits`) was added because billing is its own domain — credit ledger, charge flow, Stripe — that doesn't fit cleanly inside backend-development without bloating it.

The trade-off is well-known:
- More, smaller skills → easier to load only what's needed; less context cost per task; cleaner expertise boundaries
- Fewer, larger skills → fewer files to navigate; matches a developer's mental model ("I'm doing frontend")

## Decision

Keep 9 skills. `frontend-development` and `backend-development` deliberately span multiple sub-domains (e.g. backend includes routes, services, schema, middleware). This is acceptable because:

1. Each broad skill uses progressive disclosure via `references/`. Loading the SKILL.md is cheap; reference files are opened only when relevant.
2. A solo developer thinks at the skill's level of abstraction ("I'm working on the backend"). Splitting into `api-design + database + middleware` produces three skills the developer would always load together.
3. The trigger phrasing in `Use when ...` is unambiguous enough that Claude picks the right skill from a short description.
4. `billing-and-credits` is split out because credits are a vertical concern crossing both backend and frontend, with its own data model and concurrency rules.

## Consequences

- If a single skill's `references/` grows past ~6 files or the SKILL.md grows past ~150 lines, revisit this decision and split.
- New cross-cutting concerns (e.g. observability, security) get their own skill rather than being absorbed into an existing broad one.

## When to revisit

- Reference count per skill consistently > 6
- A skill's SKILL.md > 150 lines of body (excluding frontmatter)
- Frequent confusion between two skills' scopes during work
