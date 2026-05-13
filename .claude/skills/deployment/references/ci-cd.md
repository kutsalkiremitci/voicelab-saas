# CI / CD

GitHub Actions for lint, test, build, deploy.

## CI workflow

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]

jobs:
  lint-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: vcs
          POSTGRES_PASSWORD: vcs
          POSTGRES_DB: vcs_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]

    env:
      DATABASE_URL: postgresql://vcs:vcs@localhost:5432/vcs_test
      REDIS_URL: redis://localhost:6379
      SESSION_SECRET: ci-secret-must-be-at-least-32-characters
      WEB_ORIGIN: http://localhost:3000
      ELEVENLABS_API_KEY: ci-mock-key

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun lint
      - run: bun typecheck
      - run: bun db:migrate
      - run: bun test
```

## Deploy workflow

`.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & push API
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/vcs-api:sha-${{ github.sha }}
            ghcr.io/${{ github.repository }}/vcs-api:latest

      - name: Build & push Web
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/vcs-web:sha-${{ github.sha }}
            ghcr.io/${{ github.repository }}/vcs-web:latest

      - name: SSH deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /app
            export IMAGE_TAG=sha-${{ github.sha }}
            docker compose pull
            docker compose run --rm api bun db:migrate
            docker compose up -d
            sleep 5
            curl -fsS https://${{ secrets.PROD_HOST }}/api/v1/health
```

Note the explicit `db:migrate` step between pull and up. Migrations are deliberate.

## Secrets needed

- `PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY` — SSH to the server
- `GITHUB_TOKEN` — auto-provided, for GHCR push

Everything else (DATABASE_URL, ELEVENLABS_API_KEY, ...) lives in the prod server's `.env`, populated by a secret manager.

## Rollback workflow

`.github/workflows/rollback.yml`:

```yaml
name: Rollback
on:
  workflow_dispatch:
    inputs:
      sha:
        description: "Commit SHA to roll back to"
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /app
            export IMAGE_TAG=sha-${{ inputs.sha }}
            docker compose pull
            docker compose up -d
```

Manual trigger only. No auto-rollback.
