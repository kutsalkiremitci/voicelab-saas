# End-of-Phase Template

The exact report printed after `test-driven-development` returns green AND the user has approved the smoke test.

## Template

```
Phase <N> — <title> complete.

Skills triggered:
  - <skill-a>: <one-line reason>
  - <skill-b>: <one-line reason>
  - test-driven-development: full cycle, all green
  - git-workflow: ready

Reference files read:
  - <skill>/references/<file>.md — took <what>
  - <skill>/references/<file>.md — took <what>
Inspired by (briefly):
  - <prior art or pattern note, if any — otherwise omit this line>

Cross-cutting docs read:
  - docs/<file>.md — took <what>     (or "none")

Files changed:
  - <path>
  - <path>
  - ...

Tests run:
  - unit:        <count> passed
  - integration: <count> passed
  - lint:        green
  - typecheck:   green

Smoke test: APPROVED by user.

Suggested commit (you can edit before I run it):
  <type>: <short description, imperative mood, English>

  <optional body>

  <optional footer, e.g. "Refs: PLAN.md phase N">

Actions to confirm (yes/no each — I will wait for explicit answers):
  1. Stage and commit?                 [y/n]
  2. Push current branch to origin?    [y/n]
  3. Merge into main (if on a feature branch)? [y/n]
  4. Delete the feature branch?        [y/n]
```

Wait for each yes/no. Do not assume "yes to all" from one answer.

## What if the user says "no" to commit

- Ask: "What would you like to change?"
- Common follow-ups:
  - "Split into separate commits" → propose the split before staging
  - "Different commit message" → propose alternatives
  - "Revert and rework" → discuss what to revert; the smoke-test approval is invalidated; the loop restarts from `test-driven-development`

## What if the user says "yes" to commit but "no" to push

- Commit locally. Print the new HEAD SHA.
- Don't push until the user says so. The branch can stay local indefinitely.

## What if the user says "yes" to merge

- If on a feature branch:
  - Switch to `main`
  - Fast-forward merge (or squash if the user asked)
  - Push `main`
  - Offer to delete the feature branch
- If already on `main`:
  - Skip; nothing to merge

## Never

- Never run multiple git actions without separate confirmations
- Never push to `main` with `--force`
- Never delete a feature branch that hasn't been merged or explicitly abandoned
