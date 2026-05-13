---
name: git-workflow
description: Use when staging, committing, branching, pushing, or merging. Runs only after test-driven-development is green and the user approves the smoke test. Use whenever the task mentions git, commit, branch, push, merge, rebase, tag, release, end of phase, or "ready to ship" — even if git is not explicitly named.
---

# Git Workflow

## Symptoms (read this skill if any apply)

- `test-driven-development` returned green and the user approved the smoke test
- A branch needs to be created, switched, or merged
- A commit message needs to be written
- Anything is about to be pushed to `origin`
- A feature branch needs to be deleted

## Red flags (resist these shortcuts)

- "Smoke test passed, just commit and push together" → NO, ask separately for each git action
- "Force push to main to fix that bad commit" → NO, never `--force` on main
- "Commit a `.env` so the deploy works" → NO, secrets never in git
- "Squash all 12 commits of this phase into one giant feat" → NO, scope commits by intent, not by phase boundary
- "Skip the conventional commit prefix, the message is clear enough" → NO, always `feat:` / `fix:` / etc.
- "Commit in Turkish because that's what we were chatting in" → NO, all git messages in English
- "Tests are flaky, commit anyway" → NO, test-driven-development gate is mandatory; fix the flake first

## Non-negotiables

- Nothing is committed, pushed, or merged without explicit user approval, asked SEPARATELY per action.
- `test-driven-development` MUST have returned green AND the user MUST have approved the smoke test before this skill runs.
- Commits follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`.
- Commit messages and PR descriptions are in English. Always.
- Scope commits by intent. One logical change per commit. Avoid end-of-phase mega-commits.
- `.env` files never committed. `.gitignore` covers them.
- `git push --force` is acceptable only on a feature branch the user owns. Never on `main`.
- Release tags follow `vMAJOR.MINOR.PATCH`.

## Repository model (solo developer)

- Single long-lived branch: `main`.
- Short-lived feature branches off `main`, named `feat/<phase-or-feature>` or `fix/<issue>`.
- Feature branches merge back to `main` via fast-forward or squash, then are deleted.
- No long-running develop / staging branches.

## Authoritative references

- `references/end-of-phase-template.md` — the exact report shown to the user
- `references/commit-conventions.md` — examples by change type

## Skill handoffs

- Tests not green or smoke test not approved? Stop. Go back to `test-driven-development` and complete that gate first.
- Push to `main` triggered a failing deploy? Switch to `deployment` for the rollback playbook.
