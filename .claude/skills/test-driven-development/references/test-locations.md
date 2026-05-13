# Test Locations

Where each kind of test lives.

## Layout

```
apps/api/
├── src/
│   ├── routes/
│   │   └── voices.ts
│   ├── services/
│   │   └── elevenlabs.ts
│   └── ...
└── test/
    ├── unit/                   # service / utility tests
    │   └── elevenlabs.test.ts
    ├── integration/            # Hono route tests against test DB/Redis
    │   └── voices.test.ts
    ├── mocks/
    │   └── elevenlabs.ts
    └── setup.ts                # test DB migration + Redis flush

apps/web/
├── components/
│   └── studio/
│       ├── recording-panel.tsx
│       └── recording-panel.test.tsx     # co-located component test
├── hooks/
│   ├── use-recorder.ts
│   └── use-recorder.test.ts             # co-located hook test
└── e2e/                                 # Playwright
    ├── login.spec.ts
    └── record-clone-generate.spec.ts

packages/
├── db/
│   └── test/
│       └── migrations.test.ts           # smoke test: fresh DB → migrations → seed
└── shared/
    └── schemas/
        └── *.test.ts                    # zod schema tests
```

## Conventions

- Filename: `<unit>.test.ts` or `<unit>.spec.ts` (component / E2E uses `.spec.ts`)
- One test file per source file when practical
- Integration tests reset DB and Redis state in `beforeEach`
- E2E tests run against a fully booted local stack (compose up)

## Commands

```bash
bun test                          # all unit + integration
bun test apps/api                 # backend only
bun test apps/web                 # frontend only
bun --cwd apps/web e2e            # Playwright
bun typecheck                     # tsc --noEmit across workspaces
bun lint                          # eslint
```

## Test database

Integration tests use a separate Postgres database (`vcs_test`) configured in `.env.test`. The setup file (`apps/api/test/setup.ts`) runs migrations against the test DB before the suite, and truncates tables between tests.

Redis uses DB index 1 in test mode (production uses 0).

## Speed targets

- Unit suite: < 5 seconds
- Integration suite: < 30 seconds
- E2E suite: < 2 minutes per spec

If a suite gets slower than this, split or optimize before adding more tests.
