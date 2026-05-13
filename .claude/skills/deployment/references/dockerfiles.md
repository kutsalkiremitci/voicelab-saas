# Dockerfiles

Multi-stage builds. Final image is runtime-only.

## `apps/api/Dockerfile`

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile --production

FROM base AS build
COPY . .
RUN bun install --frozen-lockfile
RUN bun --cwd apps/api build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages ./packages
EXPOSE 3001
CMD ["bun", "apps/api/dist/index.js"]
```

## `apps/web/Dockerfile`

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb ./
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile

FROM base AS build
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN bun --cwd apps/web run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "--cwd", "apps/web", "start"]
```

## Local Compose for development

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: vcs
      POSTGRES_PASSWORD: vcs
      POSTGRES_DB: vcs
    ports: ["5432:5432"]
    volumes:
      - postgres:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  postgres:
```

App processes run on the host (`bun dev`) against these. Production runs the full Compose stack.

## .dockerignore

```
node_modules
.next
dist
.env
.env.*
storage
*.log
```
