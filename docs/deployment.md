# CommonPub Deployment Guide

## Local Development

See [quickstart.md](quickstart.md) for the full local dev setup. TL;DR:

```bash
docker compose up -d                              # Start Postgres, Redis, Meilisearch
pnpm install && pnpm build                        # Build all packages
pnpm --filter=@commonpub/schema db:migrate        # Apply committed schema migrations
pnpm dev:app                                      # Start Nuxt dev server → http://localhost:3000
```

---

## Production Deployment Options

### Option 1: Single Droplet (Docker Compose)

Best for: single-server deployments, small-to-medium communities.

**Requirements**: Ubuntu 22.04+, 2GB+ RAM, Docker installed.

1. **Run the setup script**:
   ```bash
   curl -sSL https://raw.githubusercontent.com/commonpub/commonpub/main/deploy/droplet-setup.sh | sudo bash
   ```

2. **Configure environment**:
   ```bash
   cd /opt/commonpub
   cp deploy/.env.prod.example deploy/.env
   # Edit deploy/.env — set AUTH_SECRET, ORIGIN, POSTGRES_PASSWORD, etc.
   ```

3. **Start all services**:
   ```bash
   docker compose -f deploy/docker-compose.prod.yml up -d
   ```

4. **Configure SSL** (production instances use Caddy with auto-TLS):
   ```bash
   # Caddy handles TLS automatically via docker-compose.prod.yml
   # Edit deploy/Caddyfile — replace YOUR_DOMAIN
   # If using nginx instead:
   sudo cp deploy/nginx.conf /etc/nginx/sites-available/commonpub
   sudo certbot --nginx -d your-domain.com
   ```

**Files**: `deploy/docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/droplet-setup.sh`
**Note**: The live commonpub.io and deveco.io instances use Caddy (not nginx) for reverse proxy with automatic HTTPS.

#### Reverse-proxy contract (X-Forwarded-For)

CommonPub trusts the **rightmost** `X-Forwarded-For` token by default (the
address appended by the last trusted proxy). This is the rate-limit key
and the address recorded on session audit rows. If the proxy passes
client-supplied XFF through unchanged, an attacker can rotate
`X-Forwarded-For: <random>` for a fresh rate-limit bucket per request,
defeating the auth-route brute-force tier. So the proxy MUST either:

- **Overwrite XFF** (preferred — matches the bundled Caddyfile and
  the live deployments):
  ```
  reverse_proxy app:3000 {
      header_up X-Forwarded-For {remote_host}
      header_up X-Real-IP {remote_host}
      header_up X-Forwarded-Proto {scheme}
  }
  ```
- **Append exactly one token** (nginx default — also safe at depth=1):
  ```
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  ```

If you front the app with **N trusted proxies in series** (e.g.
Cloudflare → nginx → app), set `CPUB_TRUSTED_PROXY_DEPTH=N` so the
helper reads the token at index `length - N`. Default is `1`.

The `deploy/nginx.conf` example uses `$proxy_add_x_forwarded_for`
(append). With depth=1 (default) the rightmost token is the nginx-set
client IP, so this is safe — but make sure no third party in front of
nginx is stripping or rewriting the header.

---

### Option 2: DigitalOcean App Platform

Best for: managed deployment with zero server maintenance.

1. Fork the repository to your GitHub account
2. Create a new App on [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
3. Import the app spec: `deploy/app-spec.yaml`
4. Configure environment variables (AUTH_SECRET, ORIGIN, etc.)
5. Deploy

Or via CLI:

```bash
doctl apps create --spec deploy/app-spec.yaml
```

**File**: `deploy/app-spec.yaml`

---

### Option 3: App Platform + Managed Supabase

Best for: teams who want managed Postgres without self-hosting.

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy the connection string from Supabase → Settings → Database
3. Deploy to App Platform as in Option 2, but set `DATABASE_URL` to your Supabase connection string
4. Optionally run Redis on App Platform or use Upstash for managed Redis

This gives you managed Postgres with automatic backups, connection pooling (via Supavisor), and a web dashboard — while still deploying the app via App Platform.

**Note**: Set `DATABASE_URL` with `?sslmode=require` for Supabase connections.

---

### Option 4: Generic Docker

Best for: any Docker-compatible host (AWS ECS, Fly.io, Railway, self-hosted k8s, etc.)

**Build the image**:
```bash
docker build -t commonpub .
```

**Run standalone**:
```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/commonpub \
  -e AUTH_SECRET=your-secret-min-32-chars \
  -e NUXT_PUBLIC_SITE_URL=https://your-domain.com \
  commonpub
# Add -e NUXT_REDIS_URL=redis://:password@host:6379 only if running
# multiple app instances — see Environment Variables Reference below.
```

**Or use the production compose file** which includes Postgres, Redis, and Meilisearch:
```bash
docker compose -f deploy/docker-compose.prod.yml up -d
```

**Pre-built image** (when published):
```bash
docker pull ghcr.io/commonpub/commonpub:latest
```

**File**: `Dockerfile` (root)

---

## Deploying a Scaffolded Site

Sites generated by `create-commonpub` are standalone Nuxt 3 apps with all `@commonpub/*` packages as dependencies. Deployment follows the same patterns as the reference app.

### Quick Start

```bash
# 1. Generate a site
create-commonpub new my-site --defaults

# 2. Install dependencies
cd my-site
npm install   # or pnpm install

# 3. Start local infrastructure
docker compose up -d   # Postgres + Redis + Meilisearch

# 4. Apply database migrations (committed SQL from @commonpub/schema)
npx drizzle-kit migrate

# 5. Configure environment (edit .env)
#    Required: DATABASE_URL, AUTH_SECRET, NUXT_PUBLIC_SITE_URL

# 6. Build and start
npm run build
node .output/server/index.mjs
```

### Environment Variables

Scaffolded sites use the same env vars as the reference app. Key additions:

- **Feature flags**: `FEATURE_CONTENT=true`, `FEATURE_HUBS=false`, etc. — toggle features without rebuilding
- **Content types**: `NUXT_PUBLIC_CONTENT_TYPES=project,blog,explainer` — comma-separated enabled types (`article` is a deprecated alias that normalizes to `blog` — use `blog`)
- **Contest creation**: `NUXT_PUBLIC_CONTEST_CREATION=staff` — who can create contests (open/staff/admin)

### Storage

- **Local (default)**: Files stored in `./uploads/`, served via Nitro static assets. **Not
  recommended for the Docker single-droplet deploy**: the `/app/uploads` volume is root-owned while
  the container runs as a non-root user (EACCES on write), and Nitro's `publicAssets` are baked at
  build time so runtime-written files aren't served back. Use object storage in production.
- **S3/Spaces/MinIO (recommended for prod)**: Set `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`,
  `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`. For **DigitalOcean Spaces** (e.g. region
  `sfo3`): `S3_ENDPOINT=https://sfo3.digitaloceanspaces.com`, `S3_REGION=us-east-1` (Spaces accepts
  it with path-style), `S3_PUBLIC_URL=https://<bucket>.sfo3.digitaloceanspaces.com`. Objects are
  written with `public-read` ACL. The reference `deploy.yml` writes these into the droplet `.env`
  from GitHub repo secrets on each deploy.

> ⚠️ **Runtime native/optional deps (Docker image).** `sharp` (image processing),
> `@aws-sdk/client-s3` (S3 uploads) and `ioredis` (Redis) are *optional peer deps* of
> `@commonpub/infra`, loaded at runtime via dynamic `import()`. Nitro externalises them, and the
> Dockerfile runtime stage's `npm install` reconcile **prunes** the pnpm-installed copies — so they
> must be installed **explicitly** in that `npm install` line (lockfile-pinned) or the corresponding
> feature 500s in prod with `Cannot find module`. If you add any new runtime-`import()`ed
> optional-peer dependency, add it there too.

### Email

- **Development**: `EMAIL_ADAPTER=console` — logs emails to server console
- **SMTP**: Set `EMAIL_ADAPTER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- **Resend**: Set `EMAIL_ADAPTER=resend`, `RESEND_API_KEY`, `RESEND_FROM`

### Production Docker

Scaffolded sites include a `docker-compose.yml` (unless `--no-docker` was used):

```bash
# Build and run all services
docker compose up -d

# Or build a standalone Docker image
docker build -t my-site .
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e AUTH_SECRET=... \
  -e NUXT_PUBLIC_SITE_URL=https://my-site.com \
  my-site
```

---

## Environment Variables Reference

### Required

| Variable       | Description                           | Example                               |
| -------------- | ------------------------------------- | ------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string          | `postgresql://user:pass@host:5432/db` |
| `AUTH_SECRET`  | Session signing secret (min 32 chars) | `openssl rand -base64 32`             |
| `NUXT_PUBLIC_SITE_URL` | Public URL of the instance     | `https://your-domain.com`             |

### Optional — horizontal scaling

| Variable          | Description                                                                 | Example                                      |
| ----------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| `NUXT_REDIS_URL`  | Opt into Redis-backed rate limits + SSE fanout. Unset = in-process defaults (fine for single-instance). See [`codebase-analysis/12-scaling-and-infrastructure.md`](../codebase-analysis/12-scaling-and-infrastructure.md). | `redis://:$REDIS_PASSWORD@redis:6379`        |
| `REDIS_PASSWORD`  | Password for the bundled Redis container (`deploy/docker-compose.prod.yml`). Only used when the `redis` service is present. | `openssl rand -base64 24`                    |

### Instance Identity

| Variable               | Description                     | Default |
| ---------------------- | ------------------------------- | ------- |
| `INSTANCE_DOMAIN`      | Domain for federation/WebFinger | —       |
| `INSTANCE_NAME`        | Display name                    | —       |
| `INSTANCE_DESCRIPTION` | Short description               | —       |

### Feature Flags

The reference app's config resolver (`apps/reference/server/utils/config.ts`) maps these 19 `FEATURE_*`
env vars onto `FeatureFlags` (set `=true`/`=false`). Defaults are the `@commonpub/config` schema
defaults. Three boolean flags (`publicApi`, `layoutEngine`, `rbac`) and the `identity.*` sub-flags have
**no env key** — set them in `commonpub.config.ts` or via the admin runtime override.

| Variable              | Description                   | Default |
| --------------------- | ----------------------------- | ------- |
| `FEATURE_CONTENT`     | Content CRUD + editor         | `true`  |
| `FEATURE_SOCIAL`      | Likes, follows, comments, bookmarks, reports | `true`  |
| `FEATURE_HUBS`        | Hub features (community/product/company) | `true`  |
| `FEATURE_DOCS`        | Docs module                   | `true`  |
| `FEATURE_VIDEO`       | Videos                        | `true`  |
| `FEATURE_LEARNING`    | Learning paths                | `true`  |
| `FEATURE_EXPLAINERS`  | Interactive explainers        | `true`  |
| `FEATURE_EDITORIAL`   | Staff picks / editorial / categories admin | `true`  |
| `FEATURE_CONTENT_IMPORT` | URL → content import       | `true`  |
| `FEATURE_CONTESTS`    | Contests + judging            | `false` |
| `FEATURE_EVENTS`      | Events + RSVP                 | `false` |
| `FEATURE_ADMIN`       | Admin panel + admin API       | `false` |
| `FEATURE_EMAIL_NOTIFICATIONS` | Outbound email notifications | `false` |
| `FEATURE_FEDERATION`  | ActivityPub federation        | `false` |
| `FEATURE_FEDERATE_HUBS` | Hub Group-actor federation (needs `FEATURE_FEDERATION`) | `false` |
| `FEATURE_SEAMLESS_FEDERATION` | Merge federated content into local browse/feed | `false` |
| `FEATURE_ACT_AS_REGISTRY` | This instance acts as a discovery registry | `false` |
| `FEATURE_ANNOUNCE_TO_REGISTRY` | Announce this instance to a registry (needs `FEATURE_FEDERATION`) | `true`  |
| `FEATURE_PUBLIC_API_METRICS_FEDERATION` | Expose cross-instance metrics on the public API | `false` |

### Optional Services

| Variable               | Description                    |
| ---------------------- | ------------------------------ |
| `MEILI_URL`            | Meilisearch URL                |
| `MEILI_MASTER_KEY`     | Meilisearch API key            |
| `GITHUB_CLIENT_ID`     | GitHub OAuth app ID            |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret            |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID         |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret            |
| `RESEND_API_KEY`       | Resend email API key           |
| `S3_ENDPOINT`          | S3-compatible storage endpoint |
| `S3_REGION`            | S3 region                      |
| `S3_BUCKET`            | S3 bucket name                 |
| `S3_ACCESS_KEY`        | S3 access key                  |
| `S3_SECRET_KEY`        | S3 secret key                  |
| `PLAUSIBLE_URL`        | Plausible analytics URL        |
| `PLAUSIBLE_DOMAIN`     | Plausible domain               |

## SSL/TLS Setup

### With Certbot (recommended)

```bash
sudo certbot --nginx -d your-domain.com
```

Certbot auto-renews via systemd timer. Verify:

```bash
sudo certbot renew --dry-run
```

### With custom certificates

Edit `deploy/nginx.conf` and update the `ssl_certificate` and `ssl_certificate_key` paths.

## Backup Strategy

### Database

```bash
# Manual backup
docker exec cpub-postgres-1 pg_dump -U commonpub commonpub > backup-$(date +%Y%m%d).sql

# Restore
docker exec -i cpub-postgres-1 psql -U commonpub commonpub < backup-20240101.sql
```

### Automated backups (cron)

```bash
# Add to crontab (daily at 2 AM)
0 2 * * * docker exec cpub-postgres-1 pg_dump -U commonpub commonpub | gzip > /backups/cpub-$(date +\%Y\%m\%d).sql.gz
```

### Volumes

Back up Docker volumes for Redis and Meilisearch data:

```bash
docker run --rm -v commonpub_postgres_data:/data -v /backups:/backups alpine tar czf /backups/postgres-data.tar.gz /data
docker run --rm -v commonpub_redis_data:/data -v /backups:/backups alpine tar czf /backups/redis-data.tar.gz /data
```

## Upgrading

```bash
cd /opt/commonpub

# Pull latest image
docker compose -f deploy/docker-compose.prod.yml pull app

# Restart with new image
docker compose -f deploy/docker-compose.prod.yml up -d app

# Verify health
curl http://localhost:3000
```
