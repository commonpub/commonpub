# CLAUDE.md — CommonPub Project Rules

## Project Overview

CommonPub is an open ActivityPub federation protocol and package suite for self-hosted maker communities. This is a pnpm + Turborepo monorepo with a Nuxt 3 reference app and shared TypeScript packages.

## Master Plan

The implementation plan is at `docs/plan-v2.md`. Reference documentation is at `docs/reference/`. Session logs are in `docs/sessions/`.

## Standing Rules — MUST FOLLOW

1. **The schema is the work** — everything else follows from it
2. **No feature without a flag** in `commonpub.config.ts`
3. **No hardcoded color or font** in any `@commonpub/ui` or `@commonpub/docs` component — always `var(--*)`
4. **Docs use BlockTuple[] format** — new pages store content as BlockTuple[] (same as articles/projects). Legacy markdown pages are converted to blocks on edit. Viewer supports both formats. Migration: `POST /api/docs/migrate-content` then `ALTER TABLE docs_pages ALTER COLUMN content TYPE jsonb USING content::jsonb`
5. **Hubs local-only in v1** — AP Group only after real moderation experience
6. **"Hub" is the umbrella concept** — three types: community, product, company. Products are normalized entities in the `products` table, not JSONB blobs. No `guide` content type — use article or explainer.
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

- Components: `PascalCase.vue`
- TypeScript modules: `camelCase.ts`
- Schema files: `camelCase.ts`
- CSS files: `kebab-case.css`
- Tests: `*.test.ts`
- ADRs: `NNN-kebab.md`

### Code Style

- TypeScript strict mode — no `any`
- Vue 3 Composition API with `<script setup lang="ts">` — no Options API
- Nuxt conventions: auto-imports, file-based routing, Nitro server routes
- Explicit return types on all exports
- Drizzle query builder (no raw SQL unless necessary)
- `var(--*)` only in component styles — zero hardcoded colors/fonts
- Feature flags checked via `@commonpub/config` before enabling any feature
- CSS class prefix: `cpub-`

### Git Conventions

- Conventional commits: `feat(schema):`, `fix(auth):`, `test(editor):`, `docs(adr):`, `chore(deps):`
- Atomic commits — one logical change per commit
- PRs with summary + test plan
- Squash merge to main

### Component Standards

- Headless: structure + behavior, no visual opinions beyond CSS custom properties
- Always accept `class` prop for external styling (via `$attrs` or explicit prop)
- Keyboard navigable — all interactive elements
- ARIA labels on all interactive elements
- WCAG 2.1 AA minimum contrast and sizing

### Design System

- Sharp corners (`--radius: 0px`), 2px borders, offset shadows (no blur)
- JetBrains Mono for UI labels (uppercase, letter-spaced)
- Blue accent (`#5b9cf6`), cool neutral palette
- Base font 16px, line-height 1.7
- Design source of truth: `packages/ui/theme/` (base.css, dark.css, components.css)

## Architecture

### Packages (all under `packages/`)

| Package      | npm Name               | Purpose                                  |
| ------------ | ---------------------- | ---------------------------------------- |
| `schema`     | `@commonpub/schema`    | Drizzle tables + Zod validators          |
| `protocol`   | `@commonpub/protocol`  | Fedify wrapper + AP types                |
| `auth`       | `@commonpub/auth`      | Better Auth wrapper + AP SSO             |
| `ui`         | `@commonpub/ui`        | Vue 3 components + theme CSS             |
| `config`     | `@commonpub/config`    | `defineCommonPubConfig()` factory        |
| `server`     | `@commonpub/server`    | Framework-agnostic business logic        |
| `docs`       | `@commonpub/docs`      | Pluggable docs site module               |
| `editor`     | `@commonpub/editor`    | TipTap extensions + block types          |
| `explainer`  | `@commonpub/explainer` | Interactive module runtime               |
| `learning`   | `@commonpub/learning`  | Learning path engine                     |
| `infra`      | `@commonpub/infra`     | Storage, image processing, email, security |
| `test-utils` | `@commonpub/test-utils`| Shared test helpers                      |

### Apps

| App          | npm Name               | Purpose                                  |
| ------------ | ---------------------- | ---------------------------------------- |
| `reference`  | `@commonpub/reference` | Nuxt 3 reference app (thin shell)        |

### Tech Stack (Locked)

- Framework: Nuxt 3 (reference app) + Vue 3 (UI components)
- Auth: Better Auth
- Federation: Fedify
- Database: PostgreSQL 16 + Drizzle ORM
- Editor: TipTap (content), CodeMirror 6 (docs)
- Search: Meilisearch (primary), Postgres FTS (fallback)
- Queue: Redis/Valkey
- Monorepo: Turborepo + pnpm

### Federation Scope

What federates via ActivityPub and what stays instance-local:

| Feature | Federates | AP Type | Notes |
|---------|-----------|---------|-------|
| Projects | Yes | Article + `cpub:type=project` | Full content + cover image + attachments |
| Articles | Yes | Article + `cpub:type=article` | Full content + cover image |
| Blogs | Yes | Article + `cpub:type=blog` | Full content + cover image |
| Explainers | Yes | Article + `cpub:type=explainer` | Full content + cover image |
| Hubs | Partial | Group actor | Behind `features.federateHubs`; hub posts as Announce |
| Docs | No | — | Instance-local; versioned site content |
| Learning Paths | No | — | Instance-local; enrollment/progress tracking |
| Contests | No | — | Instance-local; judging workflow |
| Videos | No | — | Instance-local; category management |
| Messages | No | — | Instance-local; DMs stay on-instance |

Content type protection: federated feeds filter by `config.instance.contentTypes` so unsupported types don't leak into an instance's UI. The `cpub:type` extension preserves type identity across CommonPub instances. Non-CommonPub instances (Mastodon, Lemmy) see all content as generic Article.

## Development

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm dev              # Start dev servers

# Local infrastructure
docker compose up -d
```

## Testing

- **Unit tests**: Vitest — validators, config, business logic
- **Component tests**: @testing-library/vue + axe-core
- **Integration tests**: Vitest + test Postgres
- **E2E tests**: Playwright
- Test DB: Docker Postgres per suite, migrations run, torn down after

## Session Logging

After each work session, create/update `docs/sessions/NNN-description.md` with:

- What was done
- Decisions made
- Open questions
- Next steps
