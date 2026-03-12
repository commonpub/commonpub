# CommonPub: Master Implementation Plan

## Context

CommonPub is an open ActivityPub federation protocol and package suite for self-hosted maker communities. Two existing apps (hack-build in Vue 3/Convex, deveco-io in Nuxt 3/tRPC/Drizzle) serve as **reference implementations** — their value is in schemas, business logic, editors, styling patterns, and UX, not in framework code. Everything gets rebuilt in SvelteKit as the plan specifies, but we extract and port the best of both.

The user wants this done with extreme care: test-driven, well-documented, accessible, secure, SEO-strong, deployable at any scale, easy to maintain and contribute to. No technical debt. No rushing.

---

## Standing Rules (from plan v4.5 + user instructions)

1. **The schema is the work** — everything else follows from it
2. **No feature without a flag** in `commonpub.config.ts`
3. **No hardcoded color or font** in any `@commonpub/ui` or `@commonpub/docs` component — always `var(--*)`
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

---

## Tech Stack (Locked per plan v4.5)

| Layer          | Technology                                                         |
| -------------- | ------------------------------------------------------------------ |
| Framework      | SvelteKit (adapter-node for apps, adapter-static for commonpub.com) |
| Auth           | Better Auth via `@commonpub/auth`                                   |
| Federation     | Fedify (`@fedify/sveltekit`, `@fedify/postgres`, `@fedify/redis`)  |
| Database       | PostgreSQL 16 + Drizzle ORM                                        |
| Editor         | TipTap (content blocks), CodeMirror 6 (docs)                       |
| Docs Rendering | unified + remark + rehype + shiki + mermaid-isomorphic             |
| Search         | Meilisearch (primary), Postgres FTS (fallback)                     |
| Animation      | GSAP + ScrollTrigger (explainer snap sections)                     |
| Email          | Resend                                                             |
| Analytics      | Plausible (self-hosted)                                            |
| Storage        | DO Spaces (S3-compatible)                                          |
| Queue          | Redis/Valkey                                                       |
| CLI            | Rust (`create-commonpub`)                                           |
| Worker         | TypeScript v1, Rust v2                                             |
| Monorepo       | Turborepo + pnpm                                                   |

---

## Monorepo Structure

```
commonpub/
  packages/
    schema/                         @commonpub/schema — Drizzle tables + Zod validators
    protocol/                       @commonpub/protocol — Fedify wrapper + AP types
    auth/                           @commonpub/auth — Better Auth wrapper + AP SSO
    ui/                             @commonpub/ui — headless Svelte 5 components + theme CSS
    config/                         @commonpub/config — defineCommonPubConfig() factory
    docs/                           @commonpub/docs — pluggable docs site module
    editor/                         @commonpub/editor — TipTap extensions + block types
    explainer/                      @commonpub/explainer — interactive module runtime
    learning/                       @commonpub/learning — learning path engine
    test-utils/                     @commonpub/test-utils — shared test helpers
  tools/
    create-commonpub/                Rust CLI
    worker/                         AP queue worker (TS v1)
  apps/
    reference/                      Reference SvelteKit app (becomes template for CLI)
  deploy/
    docker-compose.yml              Local dev: Postgres + Redis + Meilisearch
    docker-compose.prod.yml         Production compose
    app-spec.yaml                   DO App Platform spec
    droplet-setup.sh                Meilisearch / Hocuspocus / Plausible / worker
  docs/
    adr/                            Architecture Decision Records
    architecture/                   Architecture diagrams (Mermaid)
    sessions/                       Session logs (timestamped)
    research/                       Web research notes per topic
    contributing.md
    coding-standards.md
  .github/workflows/                CI/CD
  turbo.json
  pnpm-workspace.yaml
  vitest.workspace.ts
  playwright.config.ts
  CLAUDE.md
```

---

## Phased Implementation

### Phase 0: Foundation (Week 1)

**Goal**: Monorepo scaffolding, CI/CD, dev environment, docs skeleton. Zero features, but `pnpm install && pnpm build && pnpm test` passes.

### Phase 1: Schema + Config + Token Surface (Weeks 2-3)

**Goal**: `@commonpub/schema`, `@commonpub/config`, and CSS token surface are locked and tested.

### Phase 2: Auth + Protocol (Weeks 4-5)

**Goal**: `@commonpub/auth` and `@commonpub/protocol` functional. Two local instances exchange AP Actor SSO logins.

### Phase 3: Core UI Kit + Block Editor (Weeks 6-8)

**Goal**: `@commonpub/ui` component library + `@commonpub/editor` with all block types.

### Phase 4: Reference App + Content System (Weeks 9-11)

**Goal**: Working SvelteKit app with content CRUD, views, social features, SEO.

### Phase 5: Explainer System (Weeks 12-14)

**Goal**: Full interactive explainer runtime, editor integration, single-file HTML export.

### Phase 6: Learning System (Weeks 15-17)

**Goal**: Learning paths with modules, lessons, enrollment, progress, certificates.

### Phase 7: Community System (Weeks 18-20)

**Goal**: Communities with feeds, membership, roles, moderation.

### Phase 8: Federation (Weeks 21-24)

**Goal**: Two instances federate content via ActivityPub.

### Phase 9: Docs Module (Weeks 25-26)

**Goal**: `@commonpub/docs` with CodeMirror editor, markdown rendering, versioning, search.

### Phase 10: Theming Engine + Admin (Weeks 27-28)

### Phase 11: CLI + Deployment (Weeks 29-31)

### Phase 12: Polish + Hardening (Weeks 32-34) ✅

**Goal**: Launch-ready v1 with Meilisearch search, static landing page, security hardening, and documentation.

- Meilisearch `SearchAdapter` interface with Postgres FTS fallback
- Static landing page (`apps/landing/`, adapter-static, 3 routes, 5 components)
- Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- Rate limiting (sliding window, tiered by route)
- Matrix CI (Node 22/23, ubuntu/macos, Rust, E2E, dependency audit)
- A11y E2E tests with `@axe-core/playwright`
- Lighthouse CI performance budgets
- README.md, CHANGELOG.md, launch checklist, ADR 023

---

## What to Extract from Existing Apps

### From hack-build (Vue 3 + Convex)

| Source                             | Extract                                                                                                                                                 | Target                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `convex/schema.ts`                 | Full data model: users, projects, posts, comments, likes, follows, hubs, contests, learning paths, enrollments, certificates, explainers, blogs, videos | `@commonpub/schema` Drizzle tables            |
| `app/src/assets/styles/tokens.css` | Design token surface: paper/ink palette, fonts, spacing, shadows, z-index                                                                               | `@commonpub/ui/theme/base.css` token contract |
| `app/src/components/editor/`       | 13 block types + editor infrastructure                                                                                                                  | `@commonpub/editor` TipTap extensions         |
| `convex/learn.ts`                  | Learning path CRUD, enrollment, progress tracking, certificate generation                                                                               | `@commonpub/learning` business logic          |
| `app/src/stores/editor.store.ts`   | Block CRUD operations, selection, dirty tracking                                                                                                        | `@commonpub/editor` state management          |
| `convex/__tests__/`                | Test patterns and coverage map                                                                                                                          | Test strategy reference                      |
| `app/src/composables/`             | `useUpload`, `useDragReorder`, `useMediaQuery`, `useClipboard`, `useDebounce`, `useInfiniteScroll`                                                      | Svelte equivalents                           |

### From deveco-io (Nuxt 3 + Drizzle + tRPC)

| Source                               | Extract                                                   | Target                                     |
| ------------------------------------ | --------------------------------------------------------- | ------------------------------------------ |
| `packages/db/src/schema/`            | Drizzle ORM syntax and patterns                           | `@commonpub/schema` implementation patterns |
| `packages/auth/src/config.ts`        | Better Auth config with graceful social provider handling | `@commonpub/auth`                           |
| `turbo.json` + `pnpm-workspace.yaml` | Turborepo pipeline config                                 | Monorepo setup                             |
| `apps/web/assets/css/main.css`       | Color palette, typography, dark/light mode tokens         | `@commonpub/ui/theme/deveco.css`            |

---

## Testing Strategy

| Level       | Tool                               | Scope                                                                      |
| ----------- | ---------------------------------- | -------------------------------------------------------------------------- |
| Unit        | Vitest                             | Zod validators, config validation, auth flows, AP handlers, business logic |
| Component   | @testing-library/svelte + axe-core | All `@commonpub/ui` components                                              |
| Integration | Vitest + test Postgres             | API routes, content lifecycle, auth flows                                  |
| E2E         | Playwright                         | Critical user journeys, cross-instance federation                          |

---

## Conventions

- **File naming**: Components `PascalCase.svelte`, modules `camelCase.ts`, schemas `camelCase.ts`, CSS `kebab-case.css`, tests `*.test.ts`, ADRs `NNN-kebab.md`
- **Code style**: TypeScript strict, Svelte 5 runes, no `any`, explicit return types on exports, Drizzle query builder, `var(--*)` only in components
- **Git**: Conventional commits (`feat(schema):`, `fix(auth):`, `test(editor):`), atomic commits, PRs with summary + test plan, squash merge
- **Components**: Headless (structure + behavior, no visual opinions beyond tokens), `class` prop for external styling, keyboard navigable, aria labels

---

## Open Questions

1. hack.build `/magazine` — dedicated route or homepage toggle?
2. Shared Meilisearch vs separate indexes per instance?
3. Learning module completion — badge, PDF certificate, or skip v1?
4. deveco blog posts — federate into hack.build by default, or only on explicit follow?
5. AP Group FEP for communities v2 — which spec?
6. Docs versioning UI — dropdown vs URL prefix?
7. Community hot-sort algorithm — Reddit-style decay or simpler?
8. AP actor SSO — does home instance notify user when foreign instance requests session?

---

## Key Decisions Made

- **Build order**: Reference app first (generic), then configure for deveco.io and hack.build
- **Rust CLI**: Deferred to Phase 11
- **Explainers as lesson type**: Yes — tight integration between learning and explainer systems
- **Repo location**: `/Users/obsidian/Projects/ossuary-projects/commonpub`
