# Commit Conventions

Conventional Commits, English, imperative mood.

## Format

```
<type>(<optional scope>): <description>

<optional body>

<optional footer>
```

## Types

| Type | When |
|------|------|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code change that doesn't alter behavior |
| `docs` | Documentation only |
| `test` | Add or update tests |
| `chore` | Build, tooling, deps, config |
| `perf` | Performance improvement |
| `style` | Formatting, missing semicolons, etc. — no logic change |
| `ci` | CI workflow changes |

## Examples

```
feat(auth): add session-based login endpoint

Implement POST /auth/login with bcrypt verification.
Sessions stored in Redis with 7-day sliding TTL.

Refs: PLAN.md phase 1
```

```
fix(recordings): prevent duplicate upload on rapid double-click

The upload button was firing twice when clicked quickly.
Added isSubmitting flag, button is now disabled during the request.
```

```
refactor(storage): extract magic-byte check into shared util

No behavior change.
```

```
test(voices): add integration test for clone endpoint

Covers happy path, missing recording, and ElevenLabs 402 path.
```

```
chore: bump drizzle-orm to 0.36.0
```

```
docs(api): document the X-RateLimit-Reset header
```

## Scope (optional)

Use a short scope to clarify which area of the code is affected:

- `auth`, `recordings`, `voices`, `generations`, `metrics`, `files`
- `api`, `web`, `db`, `shared`
- `storage`, `elevenlabs`, `session`

Skip the scope if the change is broad or obvious from the description.

## Description (the part after the colon)

- Imperative mood: "add", not "added" or "adds"
- Lowercase first letter
- No trailing period
- Under 72 characters

## Body (optional)

- Wrap at 72 characters
- Explain WHY, not WHAT (the diff shows what)
- Reference issues or PLAN phases when relevant

## Footer (optional)

- `Refs: PLAN.md phase 4` — link back to plan
- `Closes #12` — close an issue
- `BREAKING CHANGE: <description>` — for breaking API changes

## What to avoid

- "wip", "updates", "fix stuff" — too vague
- Commits in Turkish — English only
- Mixing unrelated changes — split them
- Commits with failing tests — the test-driven-development gate prevents this
