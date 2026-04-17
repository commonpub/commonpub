# Contributing to CommonPub

Thank you for your interest in contributing! See the full guide at [docs/guides/developers.md](docs/guides/developers.md).

## Quick Start

```bash
git clone https://github.com/commonpub/commonpub.git
cd commonpub
docker compose up -d
cp .env.example .env
pnpm install
pnpm build
pnpm test
pnpm dev:app
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
- Vue 3 Composition API with `<script setup lang="ts">`
- Nuxt conventions: auto-imports, file-based routing, Nitro server routes
- CSS custom properties only (`var(--*)`)
- WCAG 2.1 AA accessibility minimum
- Feature flags for all new features
- Component tests with @testing-library/vue + axe-core

See [docs/coding-standards.md](docs/coding-standards.md) for the complete guide.
