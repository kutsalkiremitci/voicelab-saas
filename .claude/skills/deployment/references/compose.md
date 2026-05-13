# Production Compose & Caddy

## `docker-compose.prod.yml`

```yaml
services:
  api:
    image: ghcr.io/<org>/vcs-api:${IMAGE_TAG}
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      ELEVENLABS_API_KEY: ${ELEVENLABS_API_KEY}
      SESSION_SECRET: ${SESSION_SECRET}
      WEB_ORIGIN: ${WEB_ORIGIN}
      STORAGE_DRIVER: ${STORAGE_DRIVER:-local}
      STORAGE_LOCAL_PATH: /data/storage
    volumes:
      - storage:/data/storage
    depends_on: [postgres, redis]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  web:
    image: ghcr.io/<org>/vcs-web:${IMAGE_TAG}
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: vcs
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: vcs
    volumes:
      - postgres:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis:/data
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    restart: unless-stopped

volumes:
  postgres:
  redis:
  storage:
  caddy-data:
  caddy-config:
```

## Caddyfile

```caddy
vcs.example.com {
  # API
  reverse_proxy /api/* api:3001 {
    health_uri /health
    health_interval 30s
  }
  # Web
  reverse_proxy * web:3000

  encode gzip
  log {
    output file /var/log/caddy/access.log
  }
}
```

Automatic SSL via Let's Encrypt. No manual cert management.

## Managed alternatives

| Service | Why |
|---------|-----|
| Fly.io | Bun support, multi-region, simple env management |
| Railway | Quick deploys, clean env UI |
| Render | Auto-deploy + Postgres add-on |
| Vercel (web) + Fly/Railway (api) | Optimal for Next.js |
| Hetzner VPS + this Compose stack | Cheapest, full control |

Recommended start: Hetzner CX22 (~€4.5/mo) with this Compose.

## Database in production

Prefer managed:
- Neon (Postgres serverless, free tier)
- Supabase (PG, free tier)
- Hetzner managed PG

## Redis in production

- Upstash (serverless, free tier)
- Or keep in Compose for solo dev simplicity

## Storage in production

- Through Phase 14: local FS via the `storage` volume above
- Phase 15: Cloudflare R2 (free 10 GB, no egress fee) via `S3Adapter`
