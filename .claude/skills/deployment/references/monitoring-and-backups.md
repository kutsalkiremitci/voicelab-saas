# Monitoring & Backups

## Monitoring

| Tool | Use |
|------|-----|
| Sentry | Error tracking on both apps |
| Better Stack / Grafana Cloud | Logs + uptime |
| Plausible / Umami | Privacy-friendly analytics |
| External uptime poller | Polls `/health` from outside the server |

### Sentry wiring

```ts
// apps/api/src/index.ts
import * as Sentry from "@sentry/bun";
Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  release: process.env.IMAGE_TAG, // sha-<short>
  tracesSampleRate: 0.1,
});
```

```ts
// apps/web/instrumentation.ts
import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.IMAGE_TAG,
  tracesSampleRate: 0.1,
});
```

## Backups

### Database

Nightly cron on the production server:

```bash
#!/usr/bin/env bash
set -euo pipefail
DATE=$(date +%F)
docker exec postgres pg_dump -U vcs vcs | gzip > /backups/vcs-$DATE.sql.gz

# Offsite copy
aws s3 cp /backups/vcs-$DATE.sql.gz s3://vcs-backups/

# Prune older than 30 days
find /backups -name "*.sql.gz" -mtime +30 -delete
```

Crontab:

```
30 3 * * * /usr/local/bin/vcs-backup.sh >> /var/log/vcs-backup.log 2>&1
```

### Storage

- While on local FS: nightly rsync of `./storage/` to offsite
- After S3 migration: bucket versioning + cross-region replication

## Rollback playbook

When something goes wrong on production:

1. **Identify the bad release** in Sentry / logs (look up commit SHA).
2. **Roll back the app**: run the `Rollback` workflow with the previous good SHA.
3. **If DB schema changed**, you may need to roll back migrations too:
   - Check what migrations the bad release added.
   - Write a reverse-migration if not auto-generated.
   - Apply it manually after rollback.
4. **If data is corrupted**, restore from the latest `pg_dump`:
   - Stop the app
   - `docker exec -i postgres psql -U vcs vcs < <(gunzip -c /backups/vcs-LATEST.sql.gz)`
   - Start the app
   - Document data loss window
5. **Post-mortem**: write a short doc in `docs/` describing what happened, why, and what changed to prevent recurrence.

## Health check expectations

`GET /health` returns:

```json
{ "status": "ok", "db": "ok", "redis": "ok", "elevenlabs": "ok" }
```

- `status: ok` requires all subchecks ok
- Caddy uses this for upstream health
- External poller pings every 30s; alerts after 3 failures
