# CommonPub

[![Tests](https://github.com/commonpub/commonpub/actions/workflows/test.yml/badge.svg)](https://github.com/commonpub/commonpub/actions/workflows/test.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-yellow.svg)](LICENSE)
[![ActivityPub](https://img.shields.io/badge/protocol-ActivityPub-purple.svg)](https://www.w3.org/TR/activitypub/)
[![Packages](https://img.shields.io/badge/packages-12-green.svg)](#architecture)
[![Tests](https://img.shields.io/badge/tests-1939+-brightgreen.svg)](#testing)

An open ActivityPub federation protocol and package suite for self-hosted maker communities.

## What is CommonPub?

CommonPub is everything you need to run a maker community: a rich content system, learning paths, documentation sites, interactive explainers, moderated communities, and cross-instance federation via ActivityPub. Self-hosted and open source.

## Features

- **Content System**: Rich block editor with articles, tutorials, and project showcases
- **Learning Paths**: Structured courses with modules, lessons, quizzes, and certificates
- **Documentation**: Versioned docs with CodeMirror editor, Meilisearch-powered search
- **Interactive Explainers**: Scroll-driven interactive explanations with HTML export
- **Communities**: Moderated spaces with feeds, roles, and content sharing
- **ActivityPub Federation**: Full cross-instance content federation ([details below](#federation))
- **Theming**: 4 built-in themes with CSS custom property switching
- **Admin Panel**: User management, moderation, audit logs, instance settings

## Federation

CommonPub instances federate with each other and the wider fediverse via [ActivityPub](https://www.w3.org/TR/activitypub/). This isn't just status updates — CommonPub federates **structured maker content**.

```
  hack.build                          circuits.community
 ┌──────────────────┐                ┌──────────────────┐
 │                  │   ActivityPub  │                  │
 │  Alice's Project │◄──────────────►│  Arduino Nano    │
 │  (Article + BOM) │   federation   │  (Product)       │
 │                  │                │                  │
 │  Robotics Hub    │◄──────────────►│  Bob follows     │
 │  (Group actor)   │   hub members  │  the hub         │
 └──────────────────┘                └──────────────────┘
```

**What federates:**

- **Users** — Follow users on other instances, see their content in your feed
- **Hubs** — Communities are Group actors ([FEP-1b12](https://codeberg.org/fediverse/fep/src/branch/main/fep/1b12/fep-1b12.md)). Members on any instance can post and participate.
- **Projects & Articles** — Published as AP Articles. Other CommonPub instances get the full experience (BOM, specs, difficulty). Mastodon/Lemmy see a standard readable article.
- **Products** — Federated product catalogs. When a project's BOM references a product on another instance, the product gallery updates automatically.
- **Content Mirroring** — Instance admins can mirror content from other instances, with per-content-type filtering and optional media caching.
- **SSO** — OAuth2 login across trusted instances

**Interoperability:** Every CommonPub object degrades gracefully to standard AP types. Mastodon users see articles. Lemmy communities can interact with CommonPub hubs. The `cpub:` namespace extensions are only used between CommonPub instances for full fidelity.

**Admin controls:** Selective federation per content type, per hub, per domain. Blocklist, allowlist, or open mode.

See [docs/federation.md](docs/federation.md) for the full guide with diagrams, or [docs/federation-plan.md](docs/federation-plan.md) for the implementation roadmap.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/commonpub/commonpub.git
cd commonpub

# Start local infrastructure (Postgres 16, Redis 7, Meilisearch)
docker compose up -d

# Install dependencies and build
pnpm install
pnpm build

# Push schema to database
pnpm db:push

# Copy environment template
cp .env.example .env

# Start the dev server
pnpm dev:app
```

Visit `http://localhost:3000` to see your instance.

See [docs/quickstart.md](docs/quickstart.md) for the full local dev guide.

## Architecture

```
commonpub/
  packages/
    schema/        @commonpub/schema      Drizzle tables + Zod validators
    protocol/      @commonpub/protocol    Fedify wrapper + AP types
    auth/          @commonpub/auth        Better Auth wrapper + AP SSO
    ui/            @commonpub/ui          Headless Vue 3 components + theme CSS
    config/        @commonpub/config      defineCommonPubConfig() factory
    server/        @commonpub/server      Framework-agnostic business logic
    infra/         @commonpub/infra       Storage, image processing, email, security
    docs/          @commonpub/docs        Pluggable docs module
    editor/        @commonpub/editor      TipTap extensions + block types
    explainer/     @commonpub/explainer   Interactive module runtime
    learning/      @commonpub/learning    Learning path engine
    test-utils/    @commonpub/test-utils  Shared test helpers
  apps/
    reference/     Nuxt 3 reference app
  deploy/          Docker, compose, deploy scripts
```

## Tech Stack

| Layer      | Technology                                     |
| ---------- | ---------------------------------------------- |
| Framework  | Nuxt 3 (reference app) + Vue 3 (UI components) |
| Auth       | Better Auth                                    |
| Federation | Fedify                                         |
| Database   | PostgreSQL 16 + Drizzle ORM                    |
| Editor     | TipTap (content), CodeMirror 6 (docs)          |
| Search     | Meilisearch (primary), Postgres FTS (fallback) |
| Queue      | Redis/Valkey                                   |
| Monorepo   | Turborepo + pnpm                               |

## Development

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm dev:infra        # Start Docker infrastructure
pnpm dev:app          # Start Nuxt dev server
pnpm db:push          # Push schema to database
```

## Testing

- **Unit tests** across 12 packages + reference app (Vitest)
- **Component tests** with @testing-library/vue + axe-core
- **E2E tests** with Playwright (auth, content, theme, admin, a11y)
- **Accessibility**: axe-core on all UI components, WCAG 2.1 AA

```bash
pnpm test                    # Unit tests
pnpm exec playwright test    # E2E tests
```

## Deployment

See [docs/deployment.md](docs/deployment.md) for detailed instructions.

Supports Docker Compose on a VPS, DigitalOcean App Platform, App Platform + managed Supabase, and any Docker-compatible host.

## Package Documentation

Each package has its own README with API docs, usage examples, and architecture details:

| Package | Docs |
| ------- | ---- |
| `@commonpub/schema` | [packages/schema/README.md](packages/schema/README.md) |
| `@commonpub/config` | [packages/config/README.md](packages/config/README.md) |
| `@commonpub/auth` | [packages/auth/README.md](packages/auth/README.md) |
| `@commonpub/protocol` | [packages/protocol/README.md](packages/protocol/README.md) |
| `@commonpub/server` | [packages/server/README.md](packages/server/README.md) |
| `@commonpub/ui` | [packages/ui/README.md](packages/ui/README.md) |
| `@commonpub/editor` | [packages/editor/README.md](packages/editor/README.md) |
| `@commonpub/explainer` | [packages/explainer/README.md](packages/explainer/README.md) |
| `@commonpub/learning` | [packages/learning/README.md](packages/learning/README.md) |
| `@commonpub/docs` | [packages/docs/README.md](packages/docs/README.md) |
| `@commonpub/infra` | [packages/infra/README.md](packages/infra/README.md) |
| `@commonpub/test-utils` | [packages/test-utils/README.md](packages/test-utils/README.md) |
| Deploy | [deploy/README.md](deploy/README.md) |

## Project Documentation

- [Federation Guide](docs/federation.md): How federation works, with diagrams
- [Federation Plan](docs/federation-plan.md): 10-phase implementation roadmap
- [Master Plan](docs/plan-v2.md): Implementation phases and architecture
- [Architecture Decision Records](docs/adr/): 24 ADRs documenting key decisions
- [Contributing Guide](docs/contributing.md): Development workflow, coding standards, and PR process
- [Coding Standards](docs/coding-standards.md): TypeScript, Vue 3, CSS, testing conventions
- [Building with CommonPub](docs/building-with-commonpub.md): Guide for building a site using published packages
- [Deployment Guide](docs/deployment.md): Production setup and operations
- [Quickstart](docs/quickstart.md): Local development setup (monorepo)
- [LLM Contributor Guide](docs/llm-contributor-guide.md): Best practices for AI-assisted development
- [A11y Audit](docs/a11y-audit.md): Accessibility compliance report
- [CHANGELOG](CHANGELOG.md): Release history

## Requirements

- Node.js >= 22
- pnpm >= 10
- Docker (for Postgres, Redis, Meilisearch)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/contributing.md](docs/contributing.md) for the full guide.

```bash
git clone https://github.com/commonpub/commonpub.git
cd commonpub
docker compose up -d
cp .env.example .env
pnpm install
pnpm build && pnpm test
```

## License

AGPL-3.0-or-later
