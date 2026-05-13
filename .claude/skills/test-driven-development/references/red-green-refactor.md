# RED-GREEN-REFACTOR

The discipline that makes TDD actually work.

## The loop

1. **RED** — Write a test that fails for the right reason. Run it. Confirm it fails.
2. **GREEN** — Write the minimum code that makes the test pass. Nothing more.
3. **REFACTOR** — Clean the code without changing behavior. Tests stay green.

Each phase serves a purpose. Skipping any phase produces worse code than no tests at all.

## Why each step matters

### RED — Write the failing test first

If the test doesn't fail before the code is written, the test doesn't prove anything. A test that passes against any implementation is not a test, it's an opinion.

Common failure modes:
- Test passes immediately → the assertion is too weak or the test isn't actually exercising the code
- Test fails for the wrong reason (e.g. missing import) → fix the test, not the code

### GREEN — Minimum code to pass

Resist the urge to "while I'm here, also add X." The smallest change that turns the test green is the right change. Anything else is untested code sneaking in.

If you find yourself wanting to add untested code, write another test first.

### REFACTOR — Clean only when green

Refactor with confidence because the test suite tells you when you broke something. Refactor without tests and you're guessing.

Refactoring is NOT "add features." Refactoring is "same behavior, better shape."

## Fixing causes, not symptoms

When a test fails, find the root cause. Do not patch the symptom.

Examples:

| Symptom | Wrong fix | Right fix |
|---------|-----------|-----------|
| Test expects 200, got 401 | Change test to expect 401 | Find why auth middleware is missing |
| Flaky test sometimes fails | Add `sleep(100)` | Find the race condition |
| Type error in test | `as any` | Fix the type model |
| Test fails after refactor | Comment it out | Understand what behavior you broke |

The fastest way to a green bar is also the fastest way to a corrupt codebase. Slow down at the moment of failure.

## When you find a bug

1. Write a test that reproduces the bug. Watch it fail.
2. Now you have a failing test for the right reason.
3. Fix the bug. Watch the test pass.
4. Run the whole suite. Confirm nothing else broke.
5. Commit (the test commit and fix commit can be one commit).

This produces a regression test for free.

## When to break the loop

Almost never. Two legitimate exceptions:

1. **Exploratory spikes.** Throwaway code to learn an API. The spike branch is never merged; the lessons go into a proper TDD cycle on a fresh branch.
2. **UI exploration in Storybook / a sandbox.** Visual experimentation. Once a shape is chosen, the component lands with tests.

If the answer is "this code is special, it doesn't need tests" — the code is not special. The author is tired.
