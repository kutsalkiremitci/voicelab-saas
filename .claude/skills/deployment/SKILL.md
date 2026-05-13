---
name: deployment
description: Use when working with Dockerfiles, docker-compose, GitHub Actions, production env, reverse proxy, SSL, monitoring, backups, or rollback. Use whenever the task mentions Docker, container, CI, CD, pipeline, Caddy, Nginx, SSL, secrets, Sentry, uptime, pg_dump, deploy, release, rollback, or production — even if "deployment" is not explicitly said.
---

# Deployment

## Symptoms (read this skill if any apply)

- Editing or creating a Dockerfile
- Changing `docker-compose.prod.yml` or adding a service
- Modifying GitHub Actions workflows
- Setting or rotating a production environment variable
- Configuring reverse proxy, SSL, DNS
- Wiring monitoring (Sentry, uptime) or backup jobs
- Deploying or rolling back a release

## Red flags (resist these shortcuts)

- "SSH in and edit the .env on prod, faster" → NO, all changes via PR + redeploy
- "Run `drizzle-kit push` on prod" → NO, only `migrate` with versioned SQL
- "Put the prod API key in a `.env.production` committed to git" → ABSOLUTELY NOT, secret manager only
- "Image tag `:latest` for prod" → NO, immutable `:sha-<short>` per commit
- "Skip the backup tonight, nothing's changed" → NO, backup runs every night unattended
- "I'll auto-migrate on container boot" → NO, migrations are a deliberate step in the deploy script
- "Quick `chmod -R 777` to fix the permissions" → NO, fix the right user/group

## Non-negotiables

- Multi-stage Docker builds. Final image contains runtime artifacts only.
- Secrets never live in the repo. Production secrets come from a secret manager (GitHub Actions Secrets, Doppler, or 1Password CLI).
- No auto-migrate on boot. Migrations are a deliberate, manual deploy step.
- Every service exposes `/health`; the proxy relies on it.
- Image tags are immutable per commit (`:sha-<short>`). Rollback = re-pin previous tag.
- Daily `pg_dump`, 30-day retention, offsite copy.
- No SSH-and-edit on production. All changes go through PR → CI → deploy.

## Standard deploy sequence

1. CI green on `main`
2. Build and push images tagged with commit SHA
3. Remote command (SSH or workflow): pull images, run migrations, restart services
4. Verify `/health` for each service
5. Watch Sentry for 5 minutes after rollout

## Authoritative references

- `references/dockerfiles.md` — `apps/api` and `apps/web` Dockerfiles
- `references/compose.md` — `docker-compose.prod.yml`, Caddy reverse proxy
- `references/ci-cd.md` — GitHub Actions workflows for CI and deploy
- `references/monitoring-and-backups.md` — Sentry, uptime, pg_dump cron, rollback playbook

## Skill handoffs

- A push to `main` just triggered a deploy? `git-workflow` handed it over; this skill takes from here.
- Changing the storage backend (local → S3)? Cross-check with `storage-adapter` migration playbook.
- Migration step in the deploy script? The migration itself is defined under `backend-development`.
