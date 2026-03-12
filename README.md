# CommonPub

An open ActivityPub federation protocol and package suite for self-hosted maker communities.

## What is CommonPub?

CommonPub is everything you need to run a maker community: a rich content system, learning paths, documentation sites, interactive explainers, moderated communities, and cross-instance federation via ActivityPub. Self-hosted and open source.

## Features

- **Content System**: Rich block editor with articles, tutorials, and project showcases
- **Learning Paths**: Structured courses with modules, lessons, quizzes, and certificates
- **Documentation**: Versioned docs with CodeMirror editor, Meilisearch-powered search
- **Interactive Explainers**: Scroll-driven interactive explanations with HTML export
- **Communities**: Moderated spaces with feeds, roles, and content sharing
- **ActivityPub Federation**: Cross-instance content sharing and actor SSO
- **Theming**: 4 built-in themes with CSS custom property switching
- **Admin Panel**: User management, moderation, audit logs, instance settings

## Quick Start

```bash
# Install the CLI
cargo install create-commonpub

# Create a new instance
create-commonpub new my-community
cd my-community

# Start infrastructure (Postgres, Redis, Meilisearch)
docker compose up -d

# Install and run
pnpm install
pnpm dev
```

Visit `http://localhost:5173` to see your instance.

## Architecture

```
commonpub/
  packages/
    schema/        @commonpub/schema      Drizzle tables + Zod validators
    protocol/      @commonpub/protocol    Fedify wrapper + AP types
    auth/          @commonpub/auth        Better Auth wrapper + AP SSO
    ui/            @commonpub/ui          Headless Svelte 5 components + theme CSS
    config/        @commonpub/config      defineCommonPubConfig() factory
    docs/          @commonpub/docs        Pluggable docs module
    editor/        @commonpub/editor      TipTap extensions + block types
    explainer/     @commonpub/explainer   Interactive module runtime
    learning/      @commonpub/learning    Learning path engine
    test-utils/    @commonpub/test-utils  Shared test helpers
  apps/
    reference/     Reference SvelteKit app
    landing/       Static marketing site
  tools/
    create-commonpub/   Rust CLI
    worker/            AP queue worker
  deploy/          Docker, compose, deploy scripts
```

## Tech Stack

| Layer      | Technology                                     |
| ---------- | ---------------------------------------------- |
| Framework  | SvelteKit                                      |
| Auth       | Better Auth                                    |
| Federation | Fedify                                         |
| Database   | PostgreSQL 16 + Drizzle ORM                    |
| Editor     | TipTap (content), CodeMirror 6 (docs)          |
| Search     | Meilisearch (primary), Postgres FTS (fallback) |
| Queue      | Redis/Valkey                                   |
| CLI        | Rust (`create-commonpub`)                       |
| Monorepo   | Turborepo + pnpm                               |

## Development

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm dev              # Start dev servers

# Local infrastructure
docker compose -f deploy/docker-compose.yml up -d
```

## Testing

- **902 unit tests** across 13 packages + reference app
- **17 Rust tests** for the CLI
- **E2E tests** with Playwright (auth, content, theme, admin, a11y)
- **Accessibility**: axe-core on all UI components, WCAG 2.1 AA

```bash
pnpm test                    # Unit tests
pnpm exec playwright test    # E2E tests
cargo test                   # Rust CLI tests (in tools/create-commonpub/)
```

## Deployment

See [docs/deployment.md](docs/deployment.md) for detailed instructions.

```bash
# Build Docker image
docker build -t commonpub .

# Production deploy
docker compose -f deploy/docker-compose.prod.yml up -d
```

Supports DigitalOcean App Platform, Droplet/VPS, and any Docker-compatible host.

## Package Documentation

Each package has its own README with API docs, usage examples, and architecture details:

| Package | Docs |
| ------- | ---- |
| `@commonpub/schema` | [packages/schema/README.md](packages/schema/README.md) |
| `@commonpub/config` | [packages/config/README.md](packages/config/README.md) |
| `@commonpub/auth` | [packages/auth/README.md](packages/auth/README.md) |
| `@commonpub/protocol` | [packages/protocol/README.md](packages/protocol/README.md) |
| `@commonpub/ui` | [packages/ui/README.md](packages/ui/README.md) |
| `@commonpub/editor` | [packages/editor/README.md](packages/editor/README.md) |
| `@commonpub/explainer` | [packages/explainer/README.md](packages/explainer/README.md) |
| `@commonpub/learning` | [packages/learning/README.md](packages/learning/README.md) |
| `@commonpub/docs` | [packages/docs/README.md](packages/docs/README.md) |
| `@commonpub/test-utils` | [packages/test-utils/README.md](packages/test-utils/README.md) |
| Reference App | [apps/reference/README.md](apps/reference/README.md) |
| Landing Page | [apps/landing/README.md](apps/landing/README.md) |
| `create-commonpub` CLI | [tools/create-commonpub/README.md](tools/create-commonpub/README.md) |
| AP Worker | [tools/worker/README.md](tools/worker/README.md) |
| Deploy | [deploy/README.md](deploy/README.md) |

## Project Documentation

- [Master Plan](docs/plan.md): Implementation phases and architecture
- [Architecture Decision Records](docs/adr/): 23 ADRs documenting key decisions
- [Contributing Guide](docs/contributing.md): Development workflow and standards
- [Coding Standards](docs/coding-standards.md): TypeScript, Svelte, CSS, testing conventions
- [Deployment Guide](docs/deployment.md): Production setup and operations
- [Launch Checklist](docs/launch-checklist.md): v1 verification status
- [A11y Audit](docs/a11y-audit.md): Accessibility compliance report
- [CHANGELOG](CHANGELOG.md): Release history

## Requirements

- Node.js >= 22
- pnpm >= 10
- Docker (for Postgres, Redis, Meilisearch)
- Rust (optional, for `create-commonpub` CLI)

## Contributing

See [docs/contributing.md](docs/contributing.md) for the full guide.

```bash
git clone https://github.com/commonpub/commonpub.git
cd commonpub
pnpm install
docker compose -f deploy/docker-compose.yml up -d
cp .env.example .env
pnpm build && pnpm test
```

## License

MIT
