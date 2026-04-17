# Quickstart — Local Development

Get CommonPub running locally in under 5 minutes.

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | 22+ | `node -v` |
| pnpm | 10+ | `pnpm -v` |
| Docker | 20+ | `docker -v` |
| Docker Compose | v2+ | `docker compose version` |

## 1. Clone & Install

```bash
git clone https://github.com/commonpub/commonpub.git
cd commonpub
pnpm install
```

## 2. Start Infrastructure

The root `docker-compose.yml` runs PostgreSQL 16, Redis 7, and Meilisearch locally:

```bash
docker compose up -d
# Or:
pnpm dev:infra
```

Default ports (configurable via env vars):

| Service      | Host Port | Container Port |
|-------------|-----------|---------------|
| PostgreSQL  | 5433      | 5432          |
| Redis       | 6380      | 6379          |
| Meilisearch | 7701      | 7700          |

## 3. Configure Environment

```bash
cp .env.example .env
```

The defaults in `.env.example` match the Docker Compose ports. No edits needed for local dev.

## 4. Build All Packages

```bash
pnpm build
```

Turborepo builds all 12 packages plus the reference app in dependency order.

## 5. Apply Schema Migrations to Database

```bash
pnpm --filter=@commonpub/schema db:migrate
```

Applies committed migrations from `packages/schema/migrations/` to your local Postgres. Tracks state in `drizzle.__drizzle_migrations`. For quick local iteration on schema edits you can also use `pnpm --filter=@commonpub/schema db:push`, but production deploys go through `migrate`.

## 6. Start the Dev Server

```bash
pnpm dev:app
```

Visit **http://localhost:3000** — you should see the CommonPub homepage.

## One-liner

If you've already done the initial setup:

```bash
docker compose up -d && pnpm dev:app
```

## Useful Scripts

| Command | What it does |
|---------|-------------|
| `pnpm dev:infra` | Start Docker infrastructure |
| `pnpm dev:app` | Start Nuxt dev server (reference app) |
| `pnpm dev` | Start all dev servers (Turbo) |
| `pnpm build` | Build all packages |
| `pnpm --filter=@commonpub/schema db:migrate` | Apply committed migrations |
| `pnpm --filter=@commonpub/schema db:generate` | Generate a new migration from schema edits |
| `pnpm --filter=@commonpub/schema db:push` | Push schema directly (dev only — CI uses migrate) |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |

## Troubleshooting

### Port conflicts

Override default ports via environment variables before starting Docker:

```bash
POSTGRES_PORT=5434 REDIS_PORT=6381 MEILI_PORT=7702 docker compose up -d
```

Update `DATABASE_URL`, `REDIS_URL`, and `MEILI_URL` in your `.env` to match.

### Database connection refused

Make sure Postgres is healthy:

```bash
docker compose ps
```

If the container is restarting, check logs:

```bash
docker compose logs postgres
```

### Build failures

Ensure you're on Node 22+ and pnpm 10+:

```bash
node -v   # Should be v22.x+
pnpm -v   # Should be 10.x+
```

## Next Steps

- [Implementation Guide](reference/implementation-guide.md) — feature configuration, content CRUD, auth setup
- [Coding Standards](coding-standards.md) — code conventions and testing
- [Deployment Guide](deployment.md) — production deployment options
