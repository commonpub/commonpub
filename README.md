# CommonPub

[![Tests](https://github.com/commonpub/commonpub/actions/workflows/test.yml/badge.svg)](https://github.com/commonpub/commonpub/actions/workflows/test.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-yellow.svg)](LICENSE)
[![ActivityPub](https://img.shields.io/badge/protocol-ActivityPub-purple.svg)](https://www.w3.org/TR/activitypub/)
[![Packages](https://img.shields.io/badge/packages-12-green.svg)](#packages)
[![Tests](https://img.shields.io/badge/tests-1939+-brightgreen.svg)](#testing)

**An open ActivityPub federation protocol and package suite for self-hosted maker communities.**

CommonPub gives you everything you need to run a maker community that you own: a rich block editor, learning paths with certificates, versioned documentation sites, interactive explainers, moderated hubs, product catalogs with BOM linking, and full cross-instance federation via ActivityPub. Self-hosted, open source, AGPL-3.0.

---

## Why CommonPub?

Maker communities are scattered across platforms that don't talk to each other. CommonPub changes that:

- **Federated by design** -- Your instance federates with others via ActivityPub. Users on `hack.build` follow projects on `circuits.community`. Content flows between instances while each community stays independent.
- **Structured content, not just posts** -- This isn't microblogging. CommonPub federates full articles, project build logs with bills of materials, learning paths, and product catalogs. Mastodon sees a readable article; another CommonPub instance gets the full structured experience.
- **12 composable packages** -- Use the full stack or pick the pieces you need. Every package is framework-agnostic TypeScript published to npm. The Nuxt layer gives you a complete app; the packages give you building blocks.
- **Self-hosted, your data** -- PostgreSQL, no proprietary services. Deploy on a $6 VPS or scale to a cluster.

---

## Features

| Feature | Description |
|---------|-------------|
| **Block Editor** | 20 block types including code, galleries, parts lists, build steps, quizzes. TipTap-based with BlockTuple serialization. |
| **Hubs** | Three hub types (community, product, company). Moderated feeds, roles, invites, content sharing. Federate as AP Group actors. |
| **Learning Paths** | Structured courses with modules, lessons (article, video, quiz, project, explainer), enrollment tracking, and auto-certificates. |
| **Documentation** | Versioned doc sites with CodeMirror editor, hierarchical navigation, and Meilisearch-powered search (Postgres FTS fallback). |
| **Interactive Explainers** | Scroll-driven interactive explanations with quiz engine, progress tracking, and self-contained HTML export. |
| **Federation** | Full ActivityPub: follows, content delivery, hub federation (FEP-1b12), content mirroring, OAuth2 SSO across instances. |
| **Products** | Product catalog with specs, purchase links. Projects auto-link via BOM -- your project appears on the product's page. |
| **Theming** | 4 built-in themes, CSS custom property system, runtime switching, dark mode. Zero hardcoded colors. |
| **Admin** | User management, role hierarchy, content moderation, audit logs, instance settings, federation controls. |
| **22 UI Components** | Headless, accessible (WCAG 2.1 AA), keyboard-navigable Vue 3 components. |

---

## Federation

CommonPub instances federate with each other and the wider fediverse. This isn't just status updates -- CommonPub federates **structured maker content**.

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

- **Users** -- Follow across instances, see content in your feed
- **Hubs** -- Group actors via [FEP-1b12](https://codeberg.org/fediverse/fep/src/branch/main/fep/1b12/fep-1b12.md). Cross-instance membership and posting.
- **Content** -- Articles, projects, blogs, explainers. Full fidelity between CommonPub instances; graceful degradation to standard AP Article for Mastodon/Lemmy.
- **Products** -- Federated catalogs. BOM references across instances update product galleries automatically.
- **Content Mirroring** -- Admins mirror content from other instances with per-type filtering and optional media caching.
- **SSO** -- OAuth2 cross-instance login for trusted instances

**Interoperability:** Every object degrades to standard AP types. Mastodon users see articles. Lemmy communities interact with hubs. The `cpub:` namespace extensions are only used between CommonPub instances for full fidelity.

**Admin controls:** Selective federation per content type, per hub, per domain. Blocklist, allowlist, or open.

See [docs/federation.md](docs/federation.md) for the full guide or [docs/federation-plan.md](docs/federation-plan.md) for the implementation roadmap.

---

## Create a New Instance

The fastest way to start a new CommonPub site:

```bash
cargo install create-commonpub
create-commonpub new my-community
```

The CLI walks you through instance name, domain, feature selection, auth methods, theme, and Docker setup. It generates a minimal Nuxt project that extends `@commonpub/layer` — all pages, components, and API routes come from the layer.

```bash
# Or skip prompts with defaults
create-commonpub new my-community --defaults

# Or cherry-pick features
create-commonpub new my-community --features content,social,hubs --auth email-password,github --theme deepwood
```

See [tools/create-commonpub/README.md](tools/create-commonpub/README.md) for all CLI flags and options.

## Quick Start (Monorepo Development)

```bash
git clone https://github.com/commonpub/commonpub.git
cd commonpub

# Infrastructure (Postgres 16, Redis 7, Meilisearch)
docker compose up -d

# Install, build, push schema, start
pnpm install
pnpm build
cp .env.example .env
pnpm db:push
pnpm dev:app
```

Visit **http://localhost:3000**.

See [docs/quickstart.md](docs/quickstart.md) for the full guide with troubleshooting.

---

## Architecture

```
commonpub/
  packages/           12 framework-agnostic TypeScript packages (published to npm)
  layers/base/        Shared Nuxt layer (@commonpub/layer) — 70 pages, 108 components
  apps/
    reference/        Full-featured Nuxt 3 reference app
    shell/            Starter template for new instances
  tools/
    create-commonpub/ Rust CLI scaffolder for new sites
    worker/           Federation delivery monitoring utilities
  deploy/             Docker, compose configs, deploy scripts
```

### Packages

| Package | Purpose |
|---------|---------|
| [`@commonpub/schema`](packages/schema/README.md) | 63 Drizzle tables, 32 enums, 74 Zod validators |
| [`@commonpub/config`](packages/config/README.md) | `defineCommonPubConfig()` factory, 13 feature flags |
| [`@commonpub/server`](packages/server/README.md) | Framework-agnostic business logic (15 modules, 200+ functions) |
| [`@commonpub/protocol`](packages/protocol/README.md) | ActivityPub types, HTTP signatures, WebFinger, NodeInfo, OAuth2 |
| [`@commonpub/auth`](packages/auth/README.md) | Better Auth wrapper, guards, AP Actor SSO |
| [`@commonpub/ui`](packages/ui/README.md) | 22 headless Vue 3 components, 4 themes, CSS token system |
| [`@commonpub/editor`](packages/editor/README.md) | TipTap extensions, 20 block types, BlockTuple serialization |
| [`@commonpub/docs`](packages/docs/README.md) | Markdown rendering, versioning, navigation, search adapters |
| [`@commonpub/explainer`](packages/explainer/README.md) | Interactive sections, quiz engine, progress tracking, HTML export |
| [`@commonpub/learning`](packages/learning/README.md) | Learning path engine, progress calculation, certificates |
| [`@commonpub/infra`](packages/infra/README.md) | S3/local storage, image processing, email adapters, security |
| [`@commonpub/test-utils`](packages/test-utils/README.md) | Test factories and mock configuration |

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Nuxt 3 + Vue 3 |
| Auth | Better Auth |
| Federation | Fedify |
| Database | PostgreSQL 16 + Drizzle ORM |
| Editor | TipTap (content), CodeMirror 6 (docs) |
| Search | Meilisearch (primary), Postgres FTS (fallback) |
| Queue | Redis / Valkey |
| Monorepo | Turborepo + pnpm |

---

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

### Testing

| Layer | Tool | Scope |
|-------|------|-------|
| Unit / Integration | Vitest | 1,939+ tests across 12 packages |
| Components | @testing-library/vue + axe-core | WCAG 2.1 AA on all UI components |
| E2E | Playwright | Auth, content, theming, admin, accessibility |
| Mutation | Stryker | Per-package mutation score tracking |
| Interop | Custom | Federation payloads from Mastodon, Lemmy, GoToSocial, Misskey |

```bash
pnpm test                    # Unit + integration
pnpm exec playwright test    # E2E
pnpm stryker                 # Mutation testing
```

---

## Deployment

Four deployment options documented:

1. **Docker Compose on VPS** -- `docker-compose.prod.yml` with Nginx reverse proxy
2. **DigitalOcean App Platform** -- `deploy/app-spec.yaml` ready to go
3. **App Platform + Supabase** -- Managed Postgres, App Platform for compute
4. **Any Docker host** -- Multi-stage `Dockerfile` at repo root

See [docs/deployment.md](docs/deployment.md) for step-by-step instructions, environment variables, and backup strategy.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Quickstart](docs/quickstart.md) | Local dev setup in 5 minutes |
| [Contributing](docs/contributing.md) | Development workflow, coding standards, PR process |
| [Coding Standards](docs/coding-standards.md) | TypeScript, Vue 3, CSS, testing conventions |
| [Architecture](docs/architecture.md) | System diagrams, page map, route map |
| [Federation Guide](docs/federation.md) | How federation works, with diagrams |
| [Federation Plan](docs/federation-plan.md) | Implementation roadmap |
| [Building with CommonPub](docs/building-with-commonpub.md) | Guide for building a site using published packages |
| [Deployment](docs/deployment.md) | Production setup and operations |
| [ADRs](docs/adr/) | 24 Architecture Decision Records |
| [Known Limitations](docs/reference/guides/v1-limitations.md) | What's done, what's deferred, honest status |
| [CHANGELOG](CHANGELOG.md) | Release history |

---

## Requirements

- Node.js >= 22
- pnpm >= 10
- Docker (for Postgres, Redis, Meilisearch)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [full contributing guide](docs/contributing.md).

## License

[AGPL-3.0-or-later](LICENSE)
