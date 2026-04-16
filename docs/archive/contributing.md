# Contributing to CommonPub

Thank you for your interest in contributing to CommonPub! This guide covers everything you need to get started.

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

See [quickstart.md](quickstart.md) for the detailed local setup guide.

## Development Workflow

1. **Create a feature branch**: `git checkout -b feat/description`
2. **Write tests first** (TDD) — see [Testing](#testing) below
3. **Implement the feature**
4. **Verify**: `pnpm typecheck && pnpm lint && pnpm test`
5. **Commit** with [conventional commits](https://www.conventionalcommits.org/): `feat(schema): add new table`
6. **Open a PR** with summary and test plan

## Coding Standards

### TypeScript

- **Strict mode**: `strict: true`, `noUncheckedIndexedAccess: true`
- **No `any`**: Use `unknown` and narrow, or define proper types
- **Explicit return types** on all exported functions
- **Prefer `const`** over `let`, never use `var`
- **Use Drizzle query builder** — no raw SQL unless necessary

### Vue 3

- **Composition API** with `<script setup lang="ts">` — no Options API
- **Components accept `class` prop** for external styling
- **Nuxt auto-imports**: `ref`, `computed`, `watch`, `useRoute`, `useFetch`, etc.

### CSS

- **CSS custom properties only** — `var(--*)` for all colors, fonts, spacing, shadows
- **No hardcoded values** in component styles
- **Token contract** defined in `packages/ui/theme/base.css`
- **Class prefix**: `cpub-` for component-scoped styles

### File Naming

| Type               | Convention  | Example              |
| ------------------ | ----------- | -------------------- |
| Vue components     | PascalCase  | `ProjectCard.vue`    |
| TypeScript modules | camelCase   | `contentService.ts`  |
| Schema files       | camelCase   | `learningPath.ts`    |
| CSS files          | kebab-case  | `base-tokens.css`    |
| Test files         | \*.test.ts  | `config.test.ts`     |
| ADRs               | NNN-kebab   | `025-nuxt-switch.md` |

See [coding-standards.md](coding-standards.md) for the complete reference.

## Testing

- **Write tests first** (TDD)
- **One assertion per test** when practical
- **Descriptive test names**: "should reject invalid email format"
- **Use test factories** from `@commonpub/test-utils`
- **Component tests** with `@testing-library/vue` + axe-core
- **Accessibility tests** on all interactive components

```bash
pnpm test                    # Run all unit/integration tests
pnpm exec playwright test    # Run E2E tests
pnpm stryker                 # Run mutation testing
```

## Git Conventions

- **Conventional commits**: `type(scope): description`
  - Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`
  - Scopes: `schema`, `auth`, `editor`, `federation`, `ui`, etc.
- **Atomic commits**: one logical change per commit
- **Branch naming**: `feat/description`, `fix/description`, `test/description`
- **Squash merge** to main

## Accessibility

All contributions must meet **WCAG 2.1 AA** minimum:

- Keyboard navigable: all interactive elements reachable via Tab
- ARIA labels on all interactive elements without visible text
- Focus indicators visible and high-contrast
- Color not sole indicator — always pair with text/icon
- Reduced motion respected via `prefers-reduced-motion`

## Feature Flags

Every new feature must be gated behind a feature flag in `@commonpub/config`. See [reference/guides/feature-flags.md](reference/guides/feature-flags.md) for the current flag list and how to add new ones.

## Session Logging

After each work session, create or update a session log in `docs/sessions/`:

```
docs/sessions/NNN-description.md
```

Include:
- What was done
- Decisions made
- Open questions
- Next steps

## Project Structure

```
commonpub/
  packages/           12 framework-agnostic TypeScript packages
  layers/base/        Shared Nuxt layer (published as @commonpub/layer)
  apps/reference/     Nuxt 3 reference app
  apps/shell/         Starter template app
  tools/              CLI scaffolder (Rust) + federation monitoring
  deploy/             Docker, compose, deploy scripts
  docs/               Documentation, ADRs, session logs
```

## Useful Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev:infra` | Start Docker infrastructure |
| `pnpm dev:app` | Start Nuxt dev server |
| `pnpm build` | Build all packages |
| `pnpm db:push` | Push Drizzle schema to database |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |

## Questions?

- Check existing [Architecture Decision Records](adr/) for design rationale
- Read the [LLM Contributor Guide](llm-contributor-guide.md) for AI-assisted development practices
- Open an issue for questions or proposals
