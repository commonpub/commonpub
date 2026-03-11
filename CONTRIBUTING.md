# Contributing to Snaplify

Thank you for your interest in contributing! See the full guide at [docs/contributing.md](docs/contributing.md).

## Quick Start

```bash
git clone https://github.com/snaplify/snaplify.git
cd snaplify
pnpm install
docker compose -f deploy/docker-compose.yml up -d
cp .env.example .env
pnpm build
pnpm test
pnpm dev
```

## Workflow

1. Create a feature branch: `git checkout -b feat/description`
2. Write tests first (TDD)
3. Implement the feature
4. Run `pnpm typecheck && pnpm lint && pnpm test`
5. Commit with [conventional commits](https://www.conventionalcommits.org/): `feat(schema): add new table`
6. Open a PR with summary and test plan

## Key Standards

- TypeScript strict mode, no `any`
- Svelte 5 runes syntax
- CSS custom properties only (`var(--*)`)
- WCAG 2.1 AA accessibility minimum
- Feature flags for all new features

See [docs/coding-standards.md](docs/coding-standards.md) for the complete guide.
