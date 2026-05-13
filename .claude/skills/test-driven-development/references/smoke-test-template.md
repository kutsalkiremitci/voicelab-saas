# Smoke Test Template

A smoke test is the manual verification the human runs AFTER automated tests are green and BEFORE git actions. The human is the last reviewer.

## When to request a smoke test

After every phase or feature, regardless of how small. Even one-line changes get a smoke test.

## How to present a smoke test to the user

Print a numbered checklist with concrete actions. Each item must be observable — the user does it and reports a clear pass or fail.

Bad:
- "Test that login works"

Good:
- "Open http://localhost:3000/login. Enter the seeded admin credentials. Click Sign in. Expected: redirected to `/` (dashboard) with username visible in topbar."

## Template

```
Smoke test for Phase <N> — <title>

Prerequisites:
  - Backend running on :3001
  - Frontend running on :3000
  - Database seeded (`bun db:seed`)
  - Redis running on :6379

Steps:
  1. <Concrete action>. Expected: <observable outcome>.
  2. <Concrete action>. Expected: <observable outcome>.
  3. <Concrete action>. Expected: <observable outcome>.

Please report each step as PASS or FAIL: <reason>.
```

## Smoke-test scope by phase type

### Backend-only phase (no UI yet)
- One curl example per new endpoint
- One example of 401 without cookie
- One example of validation error (422)

### Frontend-only phase
- Page renders without console error
- Primary interaction works (form submit, button click)
- Dark/light theme toggle works
- Responsive: desktop and mobile width

### Full-stack feature
- Combine both lists, plus end-to-end happy path
- One unhappy path (server error surfaces as toast)

## What counts as PASS

- The expected outcome occurs.
- No new errors in browser console.
- No new warnings in server logs.

Anything else is FAIL. The user reports what they saw and the cycle resumes.

## What NOT to do

- Don't list 20 items. 4–7 is the sweet spot. If a phase needs more, the phase was too big.
- Don't ask the user to inspect code or read logs to verify. Smoke test is black-box, behavior-only.
- Don't proceed to git on partial confirmation. All steps must be explicit PASS.
