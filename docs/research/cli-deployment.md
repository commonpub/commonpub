# CLI & Deployment — Research

## Prior Art: CLI Scaffolding

### create-svelte

- Prompts: template (skeleton/demo/library), TypeScript (yes/no), additions (ESLint, Prettier, Playwright, Vitest)
- Uses `@clack/prompts` for styled terminal UI
- Templates are directories copied verbatim, then conditionally patched
- Output: writes files, runs `pnpm install`, prints next steps
- No config file generation — relies on framework defaults

### create-next-app

- Prompts: name, TypeScript, ESLint, Tailwind, src/ directory, App Router, import alias
- Uses `prompts` package for interactive selection
- Templates fetched from GitHub (--example) or embedded locally
- Generates `next.config.js`, `tsconfig.json`, `.eslintrc.json` based on answers
- Supports `--use-pnpm`, `--use-yarn` flags

### create-t3-app

- Prompts: name, packages (NextAuth, Prisma, tRPC, Tailwind), import alias, git init
- Uses `@clack/prompts` (migrated from inquirer)
- Template is a base scaffold + "installers" that patch in each optional package
- Generates `.env.example` with required vars based on selected packages
- Supports `--noInstall`, `--default` (skip prompts) flags

### Common Patterns

- Interactive prompts with sensible defaults
- `--yes` / `--default` flag to skip all prompts
- Template directory copied then patched (not string interpolation)
- Post-scaffold: install deps, init git, print next steps
- Config generation based on selections

### Rust CLI Tooling (clap + dialoguer)

- `clap` for arg parsing (derive macro for struct-based definitions)
- `dialoguer` for interactive prompts (Select, Input, Confirm, MultiSelect)
- `indicatif` for progress bars and spinners
- `include_dir` macro embeds template directory into binary at compile time
- `console` crate for colored terminal output
- Single binary distribution — no runtime deps, cross-compile via `cross`

## Prior Art: Docker Multi-Stage Node.js Builds

### Best Practice: Three-Stage Build

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build
RUN pnpm prune --prod

# Stage 3: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S sveltekit -u 1001
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
USER sveltekit
EXPOSE 3000
CMD ["node", "build"]
```

### Key Practices

- **Alpine base**: ~50MB vs ~350MB for debian-based, sufficient for Node apps
- **Layer caching**: Copy `package.json` + lockfile first, install deps, then copy source — deps layer cached when only source changes
- **Non-root user**: Create dedicated user in runtime stage, never run as root
- **`--frozen-lockfile`**: Ensures reproducible installs, fails if lockfile is outdated
- **`pnpm prune --prod`**: Remove devDependencies after build to shrink runtime image
- **Monorepo consideration**: Use `pnpm deploy --filter` to extract a single app with its deps into a clean directory

### SvelteKit-Specific

- `adapter-node` outputs to `build/` directory
- Set `ORIGIN` env var for proper URL resolution behind reverse proxy
- Set `PORT` env var (default 3000)
- Health check: `HEALTHCHECK CMD wget -q --spider http://localhost:3000/health || exit 1`

## Prior Art: DigitalOcean Deployment

### App Platform (Managed PaaS)

- `app-spec.yaml` defines entire stack declaratively
- Auto-deploy from GitHub on push to branch
- Managed databases (Postgres, Redis) available as components
- Built-in TLS, load balancing, horizontal scaling
- Pricing: ~$5/mo for basic, ~$12/mo for pro (1 vCPU, 1GB RAM)
- Limitations: no persistent disk (use managed DB/S3), no custom Nginx config, cold starts on basic tier

```yaml
# .do/app.yaml
name: commonpub
services:
  - name: app
    dockerfile_path: deploy/Dockerfile
    source_dir: /
    envs:
      - key: DATABASE_URL
        scope: RUN_TIME
        value: ${db.DATABASE_URL}
    http_port: 3000
    instance_size_slug: professional-xs
    instance_count: 1
databases:
  - name: db
    engine: PG
    version: '16'
```

### Droplet (Self-Managed VPS)

- Full control: custom Nginx, cron jobs, persistent disk
- Deploy via SSH + Docker Compose or systemd
- Requires manual TLS (Certbot), firewall (ufw), updates
- Pricing: $6/mo for 1 vCPU, 1GB RAM, 25GB SSD
- Better for: self-hosters who want full control, persistent storage

### Droplet Deploy Script Pattern

```bash
#!/bin/bash
set -euo pipefail
# Pull latest images, run migrations, restart services
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm app pnpm db:migrate
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker system prune -f
```

### Nginx Reverse Proxy

- Proxy pass to `http://127.0.0.1:3000`
- WebSocket upgrade headers for any real-time features
- Certbot for auto-renewing Let's Encrypt TLS
- Rate limiting on API routes

## Prior Art: GitHub Actions CI/CD

### Docker Build + Push to GHCR

```yaml
name: Deploy
on:
  push:
    tags: ['v*']

jobs:
  build-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Deploy-on-Tag Pattern

- Tag `v1.0.0` triggers build → push → deploy
- Semantic versioning for releases
- GHA cache (`type=gha`) for Docker layer caching — avoids rebuilding unchanged layers
- Deploy step: SSH to droplet and run deploy script, or trigger DO App Platform redeploy via API

### Existing CI Considerations

- CommonPub already has Turborepo — `turbo run build test lint typecheck` in CI
- Docker build should reuse Turborepo cache where possible
- Matrix strategy unnecessary — single SvelteKit app target

## Decisions for CommonPub

1. **Rust CLI via clap** — single binary, `dialoguer` for prompts, `include_dir` for templates
2. **Three-stage Docker build** — deps → build → runtime on node:22-alpine
3. **Production compose** — app + Postgres + Redis + Meilisearch with healthchecks
4. **DO App Platform** — `app-spec.yaml` for managed deploy path
5. **Droplet deploy** — shell script + Nginx + Certbot for self-hosted path
6. **GitHub Actions** — build + push to ghcr.io on tag, deploy-on-tag
