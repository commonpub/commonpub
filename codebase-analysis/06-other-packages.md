# 06 — Other Packages

Packages other than `schema`, `server`, and the layer (covered elsewhere).

## @commonpub/config

`packages/config/src/`

- `types.ts` — `FeatureFlags` (15 flags), `AuthConfig`, `InstanceConfig`, `FederationConfig`, `DocsConfig`, `CookieDefinition`, `CommonPubConfig`
- `schema.ts` — Zod with defaults
- `config.ts` — `defineCommonPubConfig()` factory; validates, fills defaults

**Defaults:** `content`, `social`, `hubs`, `docs`, `video`, `learning`, `explainers`, `editorial` default to ON. Everything else (including `federation`, `admin`, `contests`, `events`) defaults to OFF — must be explicitly enabled.

Feature flags are **runtime** (environment via `nuxt.config` `runtimeConfig.public.features.*`), not compile-time. They gate server endpoints, page renders, and nav items.

## @commonpub/auth

`packages/auth/src/`

- `createAuth.ts` — Better Auth factory with CommonPub schema mapping (`user→users`, `name→displayName`, `image→avatarUrl`)
- `guards.ts` — `authGuard()`, `adminGuard()`, `roleGuard(minRole)` with hierarchy
- `sso.ts` — AP Actor SSO (Model B):
  - `createSSOProviderConfig()` — exposes OAuth endpoints for this instance
  - `discoverOAuthEndpoint()` — WebFinger lookup for remote `oauth_endpoint` link
  - `isTrustedInstance()` — checks `config.auth.trustedInstances`
- `hooks.ts` — after-auth hooks (profile sync, role defaults)
- `types.ts` — `UserRole` + hierarchy helpers

## @commonpub/protocol

`packages/protocol/src/`

- `types.ts` — AP actor + activity interfaces
- `activityTypes.ts` — CommonPub → AP type mapping (`Article` + `cpub:type` extension for project/blog/explainer)
- `contentMapper.ts` (13KB) — bidirectional BlockTuple[] ↔ AP object
- `federation.ts` — `createFederation({ config, version, lookupUser, getStats })` factory returning WebFinger + NodeInfo handlers; gated on `config.features.federation`
- `actorResolver.ts` — resolve + cache remote actors; refresh policy
- `activities.ts` — Create/Announce/Delete/Update builders
- `inbox.ts` — inbound dispatch
- `outbox.ts` — outbound coordinator
- `sign.ts` — HTTP Signature (jose)
- `keypairs.ts` — RSA 2048
- `sanitize.ts` — HTML sanitizer with CSP integration
- `oauth.ts` — OAuth2 token endpoints
- `webfinger.ts`, `nodeinfo.ts` — `.well-known` handlers

**cpub: namespace** — extensions preserved only between CommonPub instances. Mastodon/Lemmy see generic `Article`.

## @commonpub/ui

`packages/ui/src/`

22 headless Vue 3 components: Input, Textarea, Select, Checkbox, Radio, Button, Dialog, Dropdown, Tabs, Popover, Card, Badge, Loading, etc. All accept `class` prop, WCAG 2.1 AA.

**Independent npm publication** but NOT bundled into the layer. The layer has its own components under `layers/base/components/`. `@commonpub/ui` is for external consumers who want just the design system without the full CommonPub stack.

## @commonpub/editor

`packages/editor/src/` + `vue/`

20 block types:

text, heading, code, image, quote, callout, gallery, video, embed, markdown, divider, sectionHeader, partsList, buildStep, toolList, downloads, quiz, interactiveSlider, checkpoint, mathNotation.

Core:

- `blocks/types.ts` — `BlockTuple`, `TypedBlockTuple`, `BlockDefinition`
- `blocks/registry.ts` — `registerBlock()`, `lookupBlock()`, `validateBlock()`
- `blocks/schemas.ts` — Zod per block type
- `extensions/` — TipTap Node per block (20 files)
- `serialization.ts` — `validateBlockTuples()`, `buildEditorSchema()`, ProseMirror ↔ BlockTuple
- `markdown/` — md import/export
- `vue/` — CpubEditor.vue

`BlockTuple = [type: string, content: Record<string, unknown>]`.

Exports: `createCommonPubEditor({ content, onUpdate })`.

## @commonpub/explainer

`packages/explainer/src/` (pure TS) + `vue/` (optional)

- `types.ts` — ExplainerSection (text/interactive/quiz/checkpoint), QuizQuestion, InteractiveControl
- `sections/derive.ts` — derive presentation sections from BlockTuple[]
- `progress/tracker.ts` — pure state machine: `createProgressState`, `markSectionCompleted`, `canAccessSection`, etc.
- `quiz/engine.ts` — deterministic shuffle (mulberry32 seed), scoring, gate enforcement
- `render/` — framework-agnostic renderers
- `export/` — self-contained HTML export (~6KB of vanilla JS + inlined CSS for 4 themes)
- `vue/theme/` — 4 theme CSS presets: dark-industrial, punk-zine, paper-teal, clean-light

Engine is framework-agnostic. Vue components are optional.

## @commonpub/learning

`packages/learning/src/`

- `types.ts` — LearningPath, LearningModule, Lesson, Enrollment, LessonProgress, Certificate
- `validators.ts` — Zod
- `curriculum.ts` — `computePathCompletion`, `getNextLesson`, `isEligibleForCertificate`
- `progress.ts` — progress calculation
- `certificate.ts` — verification code `CPUB-{timestamp_base36}-{random_hex8}` (prefix configurable via `generateVerificationCode(prefix)`)

Paths use `status: 'archived'` (soft delete) to preserve enrollment/certificate data.

## @commonpub/docs

`packages/docs/src/`

Markdown rendering pipeline:
`remark-parse → remark-gfm → remark-frontmatter → remark-rehype → rehype-slug → @shikijs/rehype → rehype-sanitize → rehype-stringify`

- `types.ts` — PageTreeNode, TocEntry, RenderResult, SearchDocument, VersionInfo, DocsPage, DocsSite
- `render/` — md pipeline
- `navigation/` — breadcrumb, prev/next, tree construction
- `search/` — Meilisearch adapter + Postgres FTS fallback; `createSearchAdapter({ meiliClient? })`
- `versioning/` — copy-on-create

New pages store content as BlockTuple[]. Legacy md supported on read; converted on edit.

## @commonpub/infra

`packages/infra/src/`

Pure utility adapters — no domain coupling:

- **storage.ts** (8.5KB) — `LocalStorageAdapter`, `S3StorageAdapter`, `createStorageFromEnv()`
- **image.ts** (3.4KB) — Sharp integration, `IMAGE_VARIANTS` (thumb=150, small=300, medium=600, large=1200 — widths in px)
- **email.ts** (9.9KB) — SMTP/Resend/Console adapters + `emailTemplates`: verification, passwordReset, notificationDigest, notificationInstant, contestAnnouncement, certificateIssued
- **security.ts** (6.8KB) — `buildCspHeader()`, rate-limit store with 6 tiers (auth=5/min, upload=10/min, social=30/min, federation=60/min, api=60/min, general=120/min), nonce

Peer deps: AWS SDK + Sharp (optional).

## @commonpub/test-utils

`packages/test-utils/src/`

- `factories.ts` — builders for users, content, hubs, etc.
- `mockConfig.ts` — pre-built `CommonPubConfig` for tests

## apps/reference/

Thin Nuxt 3 shell. All features ON, `trustedInstances: ['deveco.io']`. Uses `@commonpub/layer` as workspace dep. Contains:

- `commonpub.config.ts` — instance config with all features ON
- `nuxt.config.ts` — minimal (extends layer)
- `components/` — branding overrides (SiteLogo)
- `server/utils/config.ts` — Nitro-dedup workaround: re-exports the config (required, see gotchas)
- `public/` — static assets, favicons
- `e2e/` — Playwright
- `scripts/seed.ts` — dev seed

## apps/shell/

Starter template for new CommonPub instances. The config currently mirrors the reference app (all content + community features on) — it's not a minimal-features starter, just the smaller/plainer shell that create-commonpub derives from. Differences from apps/reference: no drizzle.config, no e2e/, no seed scripts, no vitest.config, tighter nuxt.config (devtools only — reference also adds app.head, nitro publicAssets, vite server.fs.allow).

## tools/create-commonpub/ (Rust CLI)

- `main.rs` — clap parser
- `prompts.rs` — dialoguer prompts
- `scaffold.rs` — directory creation
- `template.rs` — file templates

`cargo install create-commonpub` → `create-commonpub new <name>`.

Flags: `--defaults`, `--features`, `--content-types`, `--auth`, `--contest-creation`, `--theme`, `--domain`, `--description`, `--no-docker`.

## tools/worker/

Activity delivery monitoring utilities. Single file (`src/index.ts`, ~2.2KB). Exports:

- `ActivityDeliveryStatus`, `DeliveryStats`, `ActivityLogEntry`
- `calculateDeliveryStats()`, `shouldRetry()`, `getRetryDelay()` (exponential: 1m, 5m, 30m)
- `formatActivityLog()`

Not a standalone worker — the layer's `federation-delivery.ts` server plugin is the actual worker.

## deploy/

- `docker-compose.yml` — local dev with **default ports** (Postgres 5432, Redis 6379, Meilisearch 7700) — used by CI
- `docker-compose.prod.yml` — production with app container
- `docker-compose.federation.yml` — multi-instance federation testing
- `app-spec.yaml` — DigitalOcean App Platform
- `Caddyfile` — reverse proxy, auto-TLS
- `nginx.conf` — alternative reverse proxy
- `droplet-setup.sh`, `do-one-click.sh` (21.5KB), `do-status.sh`, `do-destroy.sh`
- `federation-seed.ts` — multi-instance seed
- `migrations/` — SQL migration files

Root `docker-compose.yml` uses REMAPPED ports (5433, 6380, 7701) to avoid conflict with local tools.

## design-system-v2/

**ARCHIVE.** Figma HTML exports. Not used at runtime. Source of truth for design is `layers/base/theme/` + `packages/ui/theme/`.

## test-site/

Separate Nuxt instance with FULL UI implementation (not using the layer). Uses npm (package-lock.json) instead of pnpm. Kept as a compatibility test bed. Not actively developed.

## scripts/

- `db-push.mjs` — wrapper for drizzle-kit push
- `db-migrate.mjs` — wrapper for drizzle-kit migrate
- `migrate-blog-to-article.sql` — historical one-shot migration (article/blog merge, session 116)
