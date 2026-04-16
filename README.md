# CommonPub

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-yellow.svg)](LICENSE)
[![ActivityPub](https://img.shields.io/badge/protocol-ActivityPub-purple.svg)](https://www.w3.org/TR/activitypub/)
[![Packages](https://img.shields.io/badge/packages-12-green.svg)](#packages)
[![Tests](https://img.shields.io/badge/tests-1939+-brightgreen.svg)](#testing)

**An open ActivityPub federation protocol and package suite for self-hosted maker communities.**

CommonPub gives you everything you need to run a community you own: a rich
block editor, hubs with feeds and moderation, contests with judging and
community voting, events with RSVP and waitlists, learning paths with
certificates, versioned docs sites, interactive explainers, product catalogs
with BOM linking, and full cross-instance federation via ActivityPub.
Self-hosted, open source, AGPL-3.0-or-later.

---

## Table of contents

- [Why CommonPub](#why-commonpub)
- [Features](#features)
- [Quick start](#quick-start)
- [Create a new instance](#create-a-new-instance)
- [Architecture](#architecture)
- [Packages](#packages)
- [Tech stack](#tech-stack)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

---

## Why CommonPub

Maker communities are scattered across platforms that don't talk to each
other. CommonPub changes that:

- **Federated by design.** Your instance federates with others via ActivityPub.
  Users on `hack.build` follow projects on `circuits.community`. Content flows
  between instances while each community stays independent.
- **Structured content, not just posts.** This isn't microblogging. CommonPub
  federates full articles, project build logs with bills of materials,
  learning paths, and product catalogs. Mastodon users see a readable
  article; another CommonPub instance gets the full structured experience.
- **Twelve composable packages + a shared Nuxt layer.** Use the full stack or
  pick the pieces you need. Every package is framework-agnostic TypeScript
  published to npm. The Nuxt layer gives you a complete app; the packages
  give you building blocks.
- **Self-hosted, your data.** PostgreSQL, no proprietary services. Deploy on
  a $6 VPS or scale to a cluster.

---

## Features

| Feature | Description |
|---|---|
| **Block editor** | 20 block types including code, galleries, parts lists, build steps, quizzes. TipTap-based with BlockTuple serialization. |
| **Hubs** | Three hub types (community, product, company). Moderated feeds, roles, invites, resources, shared products. Federate as AP Group actors (FEP-1b12). |
| **Contests** | Full lifecycle (upcoming → active → judging → completed), judge permissions (lead/judge/guest) with invite+accept workflow, judging visibility controls, community voting on entries. |
| **Events** | In-person, online, or hybrid. RSVP with **auto-waitlist** when at capacity; automatic promotion when someone cancels. Event filters, pagination, hub-scoped events. |
| **Voting & polls** | Up/down votes on hub posts with transaction-safe score adjustment. Poll-type posts with single-choice voting. Community voting on contest entries. |
| **Learning paths** | Modules → lessons (article/video/quiz/project/explainer). Enrollment and progress tracking. **Auto-certificates** at 100% with a public verification code. |
| **Documentation sites** | Versioned docs with hierarchical nav, BlockTuple editor, Meilisearch (Postgres FTS fallback). |
| **Interactive explainers** | Scroll-driven sections with quizzes, progress tracking, gating, self-contained HTML export. |
| **Federation** | Full ActivityPub: follows, content delivery, hub federation, content mirroring, signed backfill, OAuth2 SSO across trusted instances. |
| **Products + BOM** | Hub-scoped product catalog. Projects auto-link via parts lists — your project shows up on the product's page across instances. |
| **Theming** | 4 built-in themes (base, dark, generics, agora), CSS custom property system, runtime switching, SSR-safe with zero FOUC. |
| **Admin** | User management, role hierarchy, content moderation, audit logs, instance settings, runtime feature-flag overrides, **configurable navigation**, **configurable homepage sections**, federation controls. |

**15 feature flags** let you enable only what you need. See
[`codebase-analysis/08-feature-flags-inventory.md`](./codebase-analysis/08-feature-flags-inventory.md)
for the full list with defaults.

---

## Quick start

Prerequisites: Node 22+, pnpm 10+, Docker.

```bash
git clone https://github.com/commonpub/commonpub.git
cd commonpub

# Infrastructure (Postgres 16, Redis 7, Meilisearch — remapped ports to avoid conflicts)
docker compose up -d

pnpm install
pnpm build
cp .env.example .env
pnpm db:push
pnpm dev:app
```

Visit **http://localhost:3000**. The first registered user is auto-promoted
to admin.

See [docs/quickstart.md](docs/quickstart.md) for troubleshooting.

---

## Create a new instance

Fastest path — Rust CLI:

```bash
cargo install create-commonpub
create-commonpub new my-community
```

Interactive: asks for instance name, domain, features, auth methods, theme,
Docker setup. Generates a **thin Nuxt app** that extends `@commonpub/layer`.

Non-interactive:

```bash
create-commonpub new my-community --defaults
create-commonpub new my-community --features content,social,hubs --auth email-password,github --theme agora
```

See [tools/create-commonpub/README.md](tools/create-commonpub/README.md).

### The thin-app pattern

A deployed CommonPub instance is ~4 files + `.env`:

```
my-site/
├── nuxt.config.ts            # extends: ['@commonpub/layer']
├── commonpub.config.ts       # feature flags + instance config
├── server/utils/config.ts    # Nitro-side config resolver (env + DB override layers)
└── components/SiteLogo.vue   # branded logo
```

Real example: [`deveco.io`](https://deveco.io) — ~18 branded files over the layer.

Details in [docs/guides/developers.md](docs/guides/developers.md#the-thin-app-pattern).

---

## Architecture

```
commonpub/
├── packages/           12 framework-agnostic TypeScript packages (published to npm)
├── layers/base/        Shared Nuxt layer (@commonpub/layer) — 85 pages, 106 components, 257 API routes
├── apps/
│   ├── reference/      Fully featured Nuxt 3 reference app (all features on)
│   └── shell/          Minimal starter template
├── tools/
│   ├── create-commonpub/  Rust CLI scaffolder (published to crates.io)
│   └── worker/            Activity delivery monitoring utilities
├── deploy/             Docker, compose configs, Caddyfile, DO app-spec, deploy scripts
├── docs/               Guides, ADRs, reference, session logs
│   ├── guides/         Human docs (users.md, developers.md)
│   ├── llm/            AI-coding-agent context (facts, conventions, gotchas, task-recipes)
│   ├── reference/      Per-package + per-module reference
│   ├── adr/            Architecture decision records
│   ├── sessions/       Chronological session logs (source of truth)
│   └── archive/        Historical docs
└── codebase-analysis/  Exhaustive inventory — every table, route, component, flag, gotcha
```

- **77 tables, 41 enums** in the schema across 15 domains
- **257 API routes** in the layer
- **85 pages, 106 components, 21 composables** in the layer
- **15 feature flags** gating every non-core feature

Full analysis: [`codebase-analysis/`](./codebase-analysis/).

### Dependency graph

```
apps/{reference,shell}  →  layers/base (@commonpub/layer)  →  packages/*
```

`@commonpub/schema` + `@commonpub/config` are foundational. Everything else
depends on them. `@commonpub/ui` is an independent design system published
to npm but not bundled into the layer (the layer has its own components).

See [`codebase-analysis/01-monorepo-topology.md`](./codebase-analysis/01-monorepo-topology.md).

---

## Packages

All 12 published to npm as `@commonpub/*`. Latest versions as of 2026-04-16:

| Package | Version | Purpose |
|---|---|---|
| [`@commonpub/schema`](packages/schema/README.md) | 0.13.0 | 77 Drizzle tables, 41 enums, 50+ Zod validators |
| [`@commonpub/config`](packages/config/README.md) | 0.10.0 | `defineCommonPubConfig()` factory, 15 feature flags |
| [`@commonpub/server`](packages/server/README.md) | 2.43.0 | Framework-agnostic business logic (20+ modules, transactions, lifecycle hooks) |
| [`@commonpub/protocol`](packages/protocol/README.md) | 0.9.9 | ActivityPub types, HTTP signatures, WebFinger, NodeInfo, OAuth2 |
| [`@commonpub/auth`](packages/auth/README.md) | 0.5.1 | Better Auth wrapper, guards, AP Actor SSO (Model B) |
| [`@commonpub/ui`](packages/ui/README.md) | 0.8.5 | 22 headless Vue 3 components, 4 themes, CSS token system |
| [`@commonpub/editor`](packages/editor/README.md) | 0.7.9 | TipTap extensions, 20 block types, BlockTuple serialization |
| [`@commonpub/docs`](packages/docs/README.md) | 0.6.2 | Markdown pipeline, versioning, navigation, search adapters |
| [`@commonpub/explainer`](packages/explainer/README.md) | 0.7.11 | Interactive sections, quiz engine, progress tracking, HTML export |
| [`@commonpub/learning`](packages/learning/README.md) | 0.5.0 | Learning path engine, progress calculation, certificates |
| [`@commonpub/infra`](packages/infra/README.md) | 0.5.1 | S3/local storage, image processing, email adapters, security |
| [`@commonpub/test-utils`](packages/test-utils/README.md) | 0.5.3 | Test factories and mock configuration |

Plus the layer itself:

| Package | Version | Purpose |
|---|---|---|
| `@commonpub/layer` | 0.15.3 | Shared Nuxt layer — pages, components, API routes, middleware, theme |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Nuxt 3 + Vue 3 (Composition API, `<script setup lang="ts">`) |
| Language | TypeScript strict |
| Auth | Better Auth + AP Actor SSO (Model B, OAuth2) |
| Federation | Fedify (wrapped by `@commonpub/protocol`) |
| Database | PostgreSQL 16 + Drizzle ORM |
| Editor | TipTap (content), CodeMirror 6 (docs) |
| Search | Meilisearch (primary), Postgres FTS (fallback) |
| Queue | Redis / Valkey (via Fedify) |
| Monorepo | Turborepo + pnpm |
| Testing | Vitest + Playwright + Stryker |

---

## Development

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (turbo)
pnpm dev              # Start dev servers
pnpm dev:app          # Reference app only
pnpm dev:infra        # Docker infra only
pnpm db:push          # Push schema to database
pnpm db:generate      # Generate SQL migration files
pnpm test             # All vitest suites
pnpm test:e2e         # Playwright
pnpm typecheck        # Type-check all packages
pnpm lint             # Lint all packages
pnpm format           # Prettier
pnpm publish:check    # build + typecheck + test
pnpm stryker          # Full-repo mutation testing (slow)
pnpm stryker:server   # Per-package mutation
```

See [docs/guides/developers.md](docs/guides/developers.md) for the full
development workflow.

---

## Testing

| Layer | Tool | Scope |
|---|---|---|
| Unit / integration | Vitest | 1,939+ tests across 12 packages |
| Components | @testing-library/vue + axe-core | WCAG 2.1 AA on all UI components |
| E2E | Playwright | Auth, content, theming, admin, accessibility |
| Mutation | Stryker | Per-package mutation score |
| Interop | Custom fixtures | Federation payloads from Mastodon, Lemmy, GoToSocial, Misskey |

Three integration tests are skipped for PGlite incompatibility (advisory
locks, certain extension types). Running against a real Postgres unskips
them.

```bash
pnpm test                    # Unit + integration
pnpm exec playwright test    # E2E
pnpm stryker                 # Mutation testing
```

---

## Deployment

Four supported deployment paths:

1. **Docker Compose on a VPS** — `deploy/docker-compose.prod.yml` + Caddy
   reverse proxy (`deploy/Caddyfile`, auto-TLS via Let's Encrypt)
2. **DigitalOcean App Platform** — `deploy/app-spec.yaml` ready to go
3. **App Platform + managed Postgres** — DO or Supabase
4. **Any Docker host** — multi-stage `Dockerfile` at repo root

Production examples:
- [`commonpub.io`](https://commonpub.io) — DO, Docker+Caddy, self-hosted Postgres
- [`deveco.io`](https://deveco.io) — DO, Docker+Caddy, managed DO Postgres, thin-app

> **⚠ Schema deploy caveat:** `drizzle-kit push` fails in CI when introducing
> new enums (no TTY). Apply enum SQL manually to deployed DBs before pushing.
> See [`codebase-analysis/09-gotchas-and-invariants.md`](./codebase-analysis/09-gotchas-and-invariants.md).

Step-by-step: [docs/deployment.md](docs/deployment.md).

---

## Documentation

Start here:

| Document | Audience |
|---|---|
| [docs/guides/users.md](docs/guides/users.md) | Members, admins, anyone using the product |
| [docs/guides/developers.md](docs/guides/developers.md) | Setup, architecture, customizing, contributing |
| [docs/llm/](docs/llm/) | AI coding agents (Claude Code, Cursor, etc.) |
| [codebase-analysis/](codebase-analysis/) | Exhaustive inventory — every table, route, component |

Operational:

| Document | Description |
|---|---|
| [docs/quickstart.md](docs/quickstart.md) | 5-minute local dev setup |
| [docs/deployment.md](docs/deployment.md) | Production setup and operations |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow, PR process |
| [docs/coding-standards.md](docs/coding-standards.md) | TypeScript, Vue 3, CSS, testing conventions |
| [docs/federation.md](docs/federation.md) | Federation guide with diagrams |
| [docs/building-with-commonpub.md](docs/building-with-commonpub.md) | Guide for building with the published packages |

Reference:

- [docs/adr/](docs/adr/) — 24+ architecture decision records
- [docs/sessions/](docs/sessions/) — chronological session logs (source of truth for recent changes)
- [docs/archive/](docs/archive/) — historical docs preserved for context
- [CHANGELOG.md](CHANGELOG.md) — release history

---

## Requirements

- Node.js **≥ 22**
- pnpm **≥ 10**
- Docker (for Postgres 16, Redis 7, Meilisearch)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[full contributing guide](docs/contributing.md). Key rules:

- **The schema is the work** — features start with the right tables.
- **No feature without a flag** in `commonpub.config.ts`.
- **No hardcoded colors or fonts** — always `var(--*)`.
- **Accessibility-first** — WCAG 2.1 AA minimum.
- **Test-driven** — tests first.
- **Session logging** — update `docs/sessions/NNN-description.md` after each session.
- **`pnpm publish`**, never `npm publish`.
- **Never add AI co-author attribution** in commits.

Full conventions: [`docs/llm/conventions.md`](docs/llm/conventions.md).

---

## License

[AGPL-3.0-or-later](LICENSE)
