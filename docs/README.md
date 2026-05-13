# docs/

Cross-cutting documentation. Anything that does not belong inside a single skill's `references/` lives here.

## What goes here

- **System-wide architecture** — diagrams, principles, contracts that span multiple skills (`system-architecture.md`).
- **Operating economics** — pricing, unit economics, decision rules for raising prices or moving upstream tiers (`profitability.md`).
- **Decision records (ADRs)** — process or architecture decisions whose rationale future-you needs to recover. One file per decision under `decisions/`, numbered (`001-`, `002-`...).
- **Operational runbooks** — incident response, on-call procedures, post-mortems. Add when needed; none yet.

## What does NOT go here

- Skill-specific detail. Goes inside `.claude/skills/<skill>/references/`.
- Code-level documentation (function comments, type docs). Lives next to the code.
- API contracts, schemas, design tokens, etc. — these are skill references, not cross-cutting.

If a new doc would be useful to more than one skill, it belongs here. If only one skill cares about it, push it down into that skill's `references/`.

## Current contents

| File | Purpose |
|------|---------|
| `system-architecture.md` | High-level system overview, principles, data flow, scaling roadmap |
| `profitability.md` | Unit economics, cohort scenarios, when to raise prices or upstream tier |
| `decisions/001-skill-granularity.md` | Why 9 skills, when to revisit |
| `decisions/002-elevenlabs-skill-source.md` | Why we keep our own ElevenLabs skill instead of installing upstream; SDK choice |
| `decisions/003-multi-tone-clones.md` | Why one IVC clone per tone instead of style sliders or PVC |
| `decisions/004-per-user-managed-api-key.md` | One upstream account per paying user, operator-provisioned; brand strategy |
| `decisions/005-credit-system-design.md` | Free-tier credit accounting; paid users use upstream metering |
| `decisions/006-pricing-tiers.md` | 4 tiers (Free/Basic/Pro/Enterprise), rebrand table, abuse gate |
| `decisions/007-email-verification.md` | Mandatory email verification, token flow, abuse layers |

## Naming

- ADRs: `decisions/NNN-short-title.md`, three-digit zero-padded numbers, kebab-case title
- Other docs: kebab-case, descriptive (`incident-response.md`, not `ops.md`)
