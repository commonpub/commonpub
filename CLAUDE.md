# CLAUDE.md — Snaplify Project Rules

## Project Overview

Snaplify is an open ActivityPub federation protocol and package suite for self-hosted maker communities. This is a pnpm + Turborepo monorepo with SvelteKit apps and shared TypeScript packages.

## Master Plan

The full implementation plan is at `docs/plan.md`. Always consult it before starting work on any phase.

## Standing Rules — MUST FOLLOW

1. **The schema is the work** — everything else follows from it
2. **No feature without a flag** in `snaplify.config.ts`
3. **No hardcoded color or font** in any `@snaplify/ui` or `@snaplify/docs` component — always `var(--*)`
4. **Docs stored as raw markdown** — never TipTap JSON
5. **Communities local-only in v1** — AP Group only after real moderation experience
6. **"Hub" is retired** — the concept is Community
7. **Convex is not self-hostable** — the answer is Postgres
8. **Better Auth is a library** — no separate auth service
9. **AP actor SSO = Model B** — shared auth DB = Model C (operator opt-in only)
10. **No federation before two instances exist with real content**
11. **Test-driven development** — tests first, then implementation
12. **Accessibility-first** — WCAG 2.1 AA minimum
13. **Session logging** — after each work session, update `docs/sessions/` with what was done, decisions made, open questions
14. **Research before building** — web research for each major system before implementation

## Code Conventions

### File Naming
- Components: `PascalCase.svelte`
- TypeScript modules: `camelCase.ts`
- Schema files: `camelCase.ts`
- CSS files: `kebab-case.css`
- Tests: `*.test.ts`
- ADRs: `NNN-kebab.md`

### Code Style
- TypeScript strict mode — no `any`
- Svelte 5 runes syntax
- Explicit return types on all exports
- Drizzle query builder (no raw SQL unless necessary)
- `var(--*)` only in component styles — zero hardcoded colors/fonts
- Feature flags checked via `@snaplify/config` before enabling any feature

### Git Conventions
- Conventional commits: `feat(schema):`, `fix(auth):`, `test(editor):`, `docs(adr):`, `chore(deps):`
- Atomic commits — one logical change per commit
- PRs with summary + test plan
- Squash merge to main

### Component Standards
- Headless: structure + behavior, no visual opinions beyond CSS custom properties
- Always accept `class` prop for external styling
- Keyboard navigable — all interactive elements
- ARIA labels on all interactive elements
- WCAG 2.1 AA minimum contrast and sizing

## Architecture

### Packages (all under `packages/`)
| Package | npm Name | Purpose |
|---------|----------|---------|
| `schema` | `@snaplify/schema` | Drizzle tables + Zod validators |
| `protocol` | `@snaplify/snaplify` | Fedify wrapper + AP types |
| `auth` | `@snaplify/auth` | Better Auth wrapper + AP SSO |
| `ui` | `@snaplify/ui` | Headless Svelte 5 components + theme CSS |
| `config` | `@snaplify/config` | `defineSnaplifyConfig()` factory |
| `docs` | `@snaplify/docs` | Pluggable docs site module |
| `editor` | `@snaplify/editor` | TipTap extensions + block types |
| `explainer` | `@snaplify/explainer` | Interactive module runtime |
| `learning` | `@snaplify/learning` | Learning path engine |
| `test-utils` | `@snaplify/test-utils` | Shared test helpers |

### Tech Stack (Locked)
- Framework: SvelteKit
- Auth: Better Auth
- Federation: Fedify
- Database: PostgreSQL 16 + Drizzle ORM
- Editor: TipTap (content), CodeMirror 6 (docs)
- Search: Meilisearch (primary), Postgres FTS (fallback)
- Queue: Redis/Valkey
- Monorepo: Turborepo + pnpm

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

- **Unit tests**: Vitest — validators, config, business logic
- **Component tests**: @testing-library/svelte + axe-core
- **Integration tests**: Vitest + test Postgres
- **E2E tests**: Playwright
- Test DB: Docker Postgres per suite, migrations run, torn down after

## Reference Implementations

Two existing apps serve as reference only (schemas, logic, UX — not framework code):
- `hack-build/` — Vue 3 + Convex (25-table schema, block editor, learning system)
- `deveco-io/` — Nuxt 3 + Drizzle + tRPC (Drizzle patterns, Better Auth config, monorepo structure)

## Session Logging

After each work session, create/update `docs/sessions/NNN-description.md` with:
- What was done
- Decisions made
- Open questions
- Next steps
