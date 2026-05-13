---
name: test-driven-development
description: Use when finishing a phase, feature, or any code change, or before any git action. Mandatory gate enforcing unit → integration → lint → typecheck → smoke test. Use this whenever the user says "test", "verify", "run tests", "is it working", "ready to commit", or asks to push or merge — even if the words "TDD" or "smoke test" are not mentioned. Also use when fixing a bug (failing test first).
---

# Test-Driven Development

## Symptoms (read this skill if any apply)

- A phase's code is written and the next step is "are we done?"
- The user said "test", "verify", "check it works", "run tests"
- About to call `git add` or `git commit`
- A bug was found and needs a failing test before the fix
- A new endpoint, service, or component just landed

## Red flags (resist these shortcuts)

- "Tests pass on my machine, let's just commit" → NO, the test runner output must be in the conversation
- "This is a tiny change, skip tests" → NO, every change runs the cycle
- "I'll add tests later" → NO, no later. Add now or revert.
- "Lint errors are noise, ignore" → NO, lint must be green
- "Smoke test is overkill for this" → NO, the human verifies. Always.
- "Skip integration tests, unit is enough" → NO, both run
- "I'll use `git push --no-verify` just this once" → NO, the pre-push hook is mandatory

## The cycle (in this exact order)

1. **Unit tests** — `bun test`
2. **Integration tests** — `bun test` (covers Hono routes against test DB/Redis)
3. **Lint** — `bun lint`
4. **Type check** — `bun typecheck`
5. **Smoke test** — see `references/smoke-test-template.md`. Present a numbered, concrete checklist to the user. Wait for their explicit "passed" or "failed: <what>".
6. Only after the user confirms smoke test passed: hand off to `git-workflow` skill.

If any step fails:
- Stop.
- Fix the cause (not the symptom — see `references/red-green-refactor.md`).
- Re-run the entire cycle from step 1. Partial reruns are forbidden.

## Test writing rules

- New endpoint → integration test BEFORE marking task done
- New service method → unit test BEFORE marking task done
- New component with logic (hooks, conditionals) → component test
- Pure presentational components → optional but encouraged
- Bug fix → failing test FIRST, then the fix. The test commit and fix commit can be one commit.

## Enforced in code (not just docs)

The pre-push git hook runs `bun test && bun lint && bun typecheck`. A failing hook blocks the push. This is the real enforcement; everything above is the discipline that keeps the hook green.

- `git push --no-verify` is forbidden. It bypasses the hook.
- If the hook is slow (> 30 s), fix the test suite — don't disable the hook.
- The hook lives in `package.json` `simple-git-hooks` config and is installed by `bun install`.

## Authoritative references

- `references/red-green-refactor.md` — the loop and why fixing symptoms is forbidden
- `references/smoke-test-template.md` — what a good smoke test checklist looks like
- `references/test-locations.md` — where each kind of test lives in the repo

## Skill handoffs

- Tests green and smoke test approved by the user? Hand off to `git-workflow`.
- Tests failing because the API contract changed? Pause and run `backend-development` to fix the contract first, then return.
- Component test fails on a hook behavior? Run `frontend-development` for the hook contract; come back and rerun.
