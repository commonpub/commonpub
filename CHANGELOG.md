# Changelog

All notable changes to CommonPub are documented here.

## v1.0.0 — Launch

### Token Debt, Admin Polish, Editor & Composer (2026-03-11)

- Fixed 32 non-contract tokens in `packages/ui/src/` (25 font-size→text, 7 surface-elevated→surface-alt/raised)
- Admin pages: replaced raw HTML inputs/buttons with `@commonpub/ui` Input, Textarea, Button components
- Added `name` prop to Input and Textarea components for form submission
- PostComposer: added share (content ID + comment) and poll (dynamic options, multi-select) post types
- Added `votePoll` form action with JSON-in-content poll storage
- Editor toolbar: added strikethrough, link editing (inline URL input), bullet/ordered lists
- Editor slash menu: added bullet list, numbered list, divider commands
- Serialization: added list, divider, strike support to BlockTuple ↔ ProseMirror round-trip

### CSS Token Contract Alignment (2026-03-11)

- Extended token contract with 8 new semantic tokens across all 5 themes (on-primary, on-accent, surface-hover, success/warning/error/info-bg, bg-subtle)
- Renamed ~852 non-contract token references across 73 reference app files to match contract (spacing, font-size, surface, font-weight)
- Zero remaining non-contract tokens in reference app; all themes at full parity

### QA Audit (2026-03-10)

- Fixed 23 TypeScript errors across reference app (parent() in actions, null safety, type mismatches)
- Fixed landing app build failure (missing favicon for prerender)
- Fixed `onContentLiked` missing userId argument
- Created ESLint 9 flat config (`eslint.config.js`), eliminated all lint errors
- Cleaned up 17 unused imports across reference app and auth package
- Applied Prettier formatting to 258 files, updated `.prettierignore`
- All 902 unit tests passing across 13 packages
- 0 typecheck errors, 0 lint errors, 0 format issues

### Phase 12: Polish & Launch

- Meilisearch-powered docs search with `SearchAdapter` interface and Postgres FTS fallback
- Static landing page at `apps/landing/` with adapter-static (3 routes, 5 components)
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Rate limiting: sliding window per-IP, tiered by route (auth/API/general)
- Matrix CI: Node 22/23, ubuntu/macos, Rust CI, E2E in pipeline, dependency audit
- A11y E2E tests with `@axe-core/playwright` across 4 themes
- Lighthouse CI performance budgets (perf 90, a11y 95, SEO 95)
- README, CHANGELOG, launch checklist documentation

### Phase 11: CLI & Deployment

- `create-commonpub` Rust CLI with `new` and `init` subcommands
- Multi-stage Dockerfile (node:22-alpine, non-root user)
- Production docker-compose with health checks
- DigitalOcean App Platform spec and droplet setup script
- CI/CD: build, docker push to ghcr.io, deploy on release
- E2E test scaffolds for auth, content, theme, admin flows
- Deployment documentation

### Phase 10: Theming Engine & Admin

- `data-theme` attribute switching with 4 themes (base, deepwood, hackbuild, deveco)
- Theme resolution cascade: user pref → instance default → 'base'
- SSR flash prevention via cookie + `transformPageChunk`
- Admin panel with user management, role assignments, content moderation
- Audit logging with `verb.noun` action naming
- Instance settings via key-value store
- Feature flag: `FEATURE_ADMIN`

### Phase 9: Docs Module

- `@commonpub/docs` package with markdown rendering pipeline
- CodeMirror 6 editor integration
- Versioned documentation with copy-on-create snapshots
- Hierarchical navigation (JSONB structure + fallback)
- Postgres FTS search with headline extraction
- 101 tests covering rendering, navigation, versioning, search

### Phase 8: Federation

- ActivityPub protocol integration via Fedify
- 4 schema tables: remoteActors, activities, followRelationships, actorKeypairs
- 9 activity types: Create, Update, Delete, Follow, Accept, Reject, Undo, Like, Announce
- Content mapper, actor resolver, RSA 2048 keypairs
- Inbox/outbox processing, 13 AP routes
- OAuth2 SSO for cross-instance authentication
- Federation dashboard, multi-instance dev setup
- Feature flag: `FEATURE_FEDERATION`

### Phase 7: Community System

- Community CRUD with membership and role-based permissions
- Weight-based hierarchy: owner (4) > admin (3) > mod (2) > member (1)
- Posts, replies, pinned content, content sharing, likes
- Join flows: open (instant), approval/invite (token-gated)
- Ban management with temporary and permanent options
- 12 components, 50+ new tests

### Phase 6: Learning System

- `@commonpub/learning` package with learning path engine
- Normalized modules and lessons (not nested JSON)
- Lesson content types: article, video, quiz, project, explainer
- Enrollment, progress tracking, auto-certificate at 100%
- Certificate verification with SNAP-{base36}-{hex8} codes
- 75 tests, 7 route groups, 10 components

### Phase 5: Explainer System

- `@commonpub/explainer` package with three-layer architecture
- Section types: text, code, quiz, comparison, timeline, checklist
- Quiz engine with deterministic shuffle (mulberry32 seeded PRNG)
- Progress tracker as pure state machine
- Self-contained HTML export with inlined CSS + vanilla JS
- 127 tests, 15 Svelte components, 10 routes

### Phase 4: Reference App & Content System

- SvelteKit reference app with content CRUD
- Rich block editor with 6 block types
- Social features: likes, comments, follows
- SEO: JSON-LD structured data, OpenGraph meta, sitemap
- Dashboard with content management
- Slug generation with collision handling
- 35 tests

### Phase 3: Core UI Kit & Block Editor

- `@commonpub/ui` — 15 headless Svelte 5 components
- `@commonpub/editor` — TipTap extensions with BlockTuple serialization
- 4 theme CSS files with CSS custom properties
- axe-core a11y testing on all components
- 116 UI tests, 69 editor tests

### Phase 2: Auth & Protocol

- `@commonpub/auth` — Better Auth wrapper with guards and hooks
- `@commonpub/protocol` — Fedify wrapper with AP types
- `@commonpub/test-utils` — Shared test helpers
- AP Actor SSO (Model B) design
- 42 auth tests, 42 protocol tests, 14 test-utils tests

### Phase 1: Schema & Config

- `@commonpub/schema` — 43 tests, Drizzle tables + Zod validators
- `@commonpub/config` — 17 tests, `defineCommonPubConfig()` factory
- CSS token surface — 4 themes (base, deepwood, hackbuild, deveco)
- UUID PKs, timestamps with timezone, Drizzle relations

### Phase 0: Foundation

- Monorepo scaffold with Turborepo + pnpm
- CI/CD pipeline with GitHub Actions
- Docker dev environment (Postgres, Redis, Meilisearch)
- 8 initial Architecture Decision Records
- TypeScript strict mode, ESLint 9, Prettier
