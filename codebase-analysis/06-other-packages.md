# 06 — Other Packages

Packages other than `schema`, `server`, and the layer (covered elsewhere).

## @commonpub/config

`packages/config/src/`

- `types.ts` — `FeatureFlags` (**23 boolean flags + `identity` object** with 5 sub-flags; `themeStudio` added session 192), `IdentityFeatures`, `AuthConfig`, `InstanceConfig`, `FederationConfig`, `DocsConfig`, `CookieDefinition`, `RegisteredTheme`, `CommonPubConfig`. **session 196 (0.22.x): `defaultTheme?: string`** — a thin app pins its brand theme in code; the layer's resolution chain is DB `theme.default` → `config.defaultTheme` → `'stoa'`.
- `schema.ts` — Zod with defaults
- `config.ts` — `defineCommonPubConfig()` factory; validates, fills defaults. 0.22.1: the factory's INPUT type accepts `themes` + `defaultTheme` (the zod schema always did; declaring registered themes used to TS2353).

**Defaults ON:** `content`, `social`, `hubs`, `docs`, `video`, `learning`, `explainers`, `editorial`, `contentImport`, `announceToRegistry`. **Defaults OFF:** `contests`, `events`, `federation`, `seamlessFederation`, `federateHubs`, `admin`, `emailNotifications`, `publicApi`, `publicApiMetricsFederation`, `actAsRegistry`, `layoutEngine`, `rbac`, and all 5 `identity.*` sub-flags — must be explicitly enabled. (Note: `admin` is OFF in the schema default but turned ON per-instance in production configs; `announceToRegistry` defaults ON since config 0.18.0 but only fires when `federation` is also on.)

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
- `permissions.ts` — `hasPermissionPure` (RBAC permission check, session 175)
- `identity.ts` — cross-instance identity helpers: `SCOPE_VALUES`, `SOFTWARE_KIND_VALUES`, `isScope`, `isSoftwareKind`, `makeHandle`, `parseHandle`, `hasAllScopes`, `coerceScopes`, `isUsableLinkedIdentity`
- `types.ts` — `UserRole` + `ROLE_HIERARCHY`/`getRoleLevel` helpers

## @commonpub/protocol

`packages/protocol/src/`

- `types.ts` — AP actor + activity interfaces
- `activityTypes.ts` — AP **interface/type definitions only** (`APArticle`, `APNote`, `APTombstone`, `APGroup`, `APCreate`/`APUpdate`/`APDelete`, `APObject`, …) — no mapping logic. The CommonPub→AP `cpub:type` mapping (`item.type === 'article' ? 'blog' : item.type`) lives in `contentMapper.ts`, not here.
- `contentMapper.ts` (13KB) — bidirectional BlockTuple[] ↔ AP object. `contentToArticle` + **`contentToCreateActivity`** (session 183 — wraps an Article in a Create with a DETERMINISTIC id `<object id>#create` + the content's real `published`, unlike `buildCreateActivity`'s random id + `now`; used by both the outbox projection and live delivery so they stay de-dupable).
- `federation.ts` — `createFederation({ config, version, lookupUser, getStats })` factory returning WebFinger + NodeInfo handlers; gated on `config.features.federation`
- `actorResolver.ts` — resolve + cache remote actors; refresh policy. Per-hop `isPrivateUrl` string check; callers inject a `FetchFn` for DNS-rebind protection — the concrete `createSafeActorFetchFn()` lives in `@commonpub/server` (`federation/safeFetchFn.ts`), not in protocol.
- `activities.ts` — Create/Announce/Delete/Update builders
- `inbox.ts` — inbound dispatch
- `outbox.ts` — outbound coordinator
- `sign.ts` — HTTP Signature (jose); signs `(request-target) host date digest` exactly (strict coverage policy in verify; do not change without also updating verify)
- `keypairs.ts` — RSA 2048 keypair + `verifyHttpSignature` with strict coverage policy (since 0.11.0): `(request-target)`, `host`, `date` MUST be in the signed header set; `digest` MUST be in the set AND match SHA-256 of the raw body when body is non-empty
- `sanitize.ts` — HTML sanitizer with CSP integration
- `oauth.ts` — OAuth2 token endpoints
- `webfinger.ts`, `nodeinfo.ts` — `.well-known` handlers
- `ssrf.ts` — SSRF protection (consolidated since session 148, federation-hardening Item 5):
  - `isPrivateIp(ip)` / `isPrivateUrl(url)` — sync literal-IP + hostname classifiers (IPv4, IPv6, IPv4-mapped IPv6, 6to4, NAT64; numeric-encoding bypasses)
  - `pinnedLookup(...)` — undici `connect.lookup` callback that resolves hostname once, rejects on any private/reserved address, returns the validated `LookupAddress[]` (closes DNS-rebind TOCTOU)
  - `safeFetch(url, options)` — text fetch; throws on non-2xx; 10 MB streaming cap
  - `safeFetchBinary(url, options)` — Buffer + Content-Type return; same guarantees
  - **`safeFetchResponse(url, options)` (since 0.12.0)** — Response-shape return (`{ ok, status, statusText, headers, body: Buffer, contentType, finalUrl }`); no throw on non-2xx (federation delivery needs the status); default `followRedirects: false` (signed requests must not replay); combines caller `AbortSignal` with internal deadline via `AbortSignal.any`
  - **`safeFetchSigned(signedRequest, options?)` (since 0.12.0)** — forwards a pre-signed `Request` through `safeFetchResponse`; extracts headers/body from the signed Request; forces `followRedirects: false`
  - `SafeFetchOptions`, `SafeFetchResponseResult` types exported

**cpub: namespace** — extensions preserved only between CommonPub instances. Mastodon/Lemmy see generic `Article`.

**SSRF rule**: any new server-side fetch of an attacker-influenced URL (federation, content-import, remote actor lookup, OAuth metadata discovery) MUST go through `safeFetch`/`safeFetchBinary`/`safeFetchResponse`/`safeFetchSigned` — never raw `globalThis.fetch`. Pre-session-150 federation outbound bypassed this for signed requests; the migration plugged it.

## @commonpub/ui

`packages/ui/src/`

22 headless Vue 3 components: Alert, Avatar, Badge, Button, Card, Dialog, IconButton, Input, Menu, MenuItem, Popover, ProgressBar, Select, Separator, Stack, Tabs, TagInput, Textarea, Toggle, Toolbar, Tooltip, VisuallyHidden. All accept `class` prop, WCAG 2.1 AA. Also exports `BUILT_IN_THEMES` (**7**: base, dark, generics, agora, agora-dark, **stoa, stoa-dark** — session 190) + `TOKEN_SPECS` + theme/token helpers. Ships `theme/*.css` (12 files incl. `stoa.css`/`stoa-dark.css`).

**Token registry (session 195):** `TOKEN_SPECS` gained two groups — `chrome` (the 24
`--cpub-topbar/nav-link/footer-*` tokens that base.css had carried since session 180 but the
registry never knew, so custom themes/Studio couldn't touch the nav bar or footer) and
`treatment` (`--surface-backdrop`, `--bg-image` — TRUE no-op defaults: `none`, never `blur(0)`
which creates a stacking context). `--surface-backdrop` is applied (with `-webkit-` prefix) on
`.cpub-sb-card`, shared `.cpub-card` (layouts.css), and — in the layer — ContentCard, six modal
panels, and the nav/user/mobile dropdowns. `--bg-image` feeds `body { background-image }` and
is gradient-only-guarded at BOTH the API boundary (schema `isSafeBgImageValue`) and the SSR
render sink (`sanitizeRenderTokens` in the layer's `instanceTheme.ts` — the generic admin
settings route can write the token map wholesale, so the boundary guard alone is bypassable).
Layout group also gained `sidebar-width-collapsed`, `cpub-card-min`, `cpub-card-gap`.

**Independent npm publication** but NOT bundled into the layer. The layer has its own components under `layers/base/components/`. `@commonpub/ui` is for external consumers who want just the design system without the full CommonPub stack.

## @commonpub/theme-studio

`packages/theme-studio/src/` — added session 192. **Pure TypeScript, zero Vue/DOM/Nuxt** — the brain behind the admin "Theme Studio" guided theme generator.

- `color.ts` (hex/hsl/rgb, contrast, WCAG, `readableOn`), `harmony.ts` (6 schemes), `naming.ts` (evocative swatch names), `palette.ts` (`buildPalette` → semantic ramp), `scales.ts` (type/space/radius/shadow/density/motion), `fonts.ts` (~100-family catalog + `googleHref`, URL-encoded), `presets.ts` (color/type vibes, shape/shadow/ratio), `recipe.ts` (`ThemeRecipe` + deterministic `randomizeRecipe(seed)`), **`generate.ts` — `recipeToTokens()`** (the projection onto canonical `@commonpub/ui` token keys → `{ tokens, fonts, parentTheme, fontHref }`).
- Emits only derived tokens; the rest inherit from a mode-matched `parentTheme`. Guarantees text/bg + on-accent AA for any accent. v2 adds a real `--secondary` accent ramp, scheme-driven category accents (`purple/teal/pink`), `grain` (texture), `recipeToThemePair`, and `export.ts` (`buildBrief`/`buildTokensJson`). **session 193 (0.4.0):** independent neutrals (`buildPalette` `neutralHue`/`neutralSat` decouple surfaces from the accent), `DESIGN_ARCHETYPES` (Brutalist/Editorial/Soft/Terminal/Neumorphic — structure-only ethos presets), a `neumorphic` dual-relief shadow style, and a `recipe.archetype` tag. 68 unit tests.
- **session 195 (0.6.x):** `recipe.treatment { glass 0–0.3, bgGradient }` — translucent surfaces +
  `--surface-backdrop` blur + frosted top bar (chrome tokens) + an accent-tinted page gradient;
  a Glass archetype; text AA floored against the FLATTENED composite (`blendOver`) for both the
  page bg and a modal panel over the 50% black scrim. Legacy recipes (no treatment) project
  byte-identically (regression-locked). `suggestPalettes` + HSL sliders landed in 0.5 (session 193 P4).
- **No runtime deps.** Consumed by the layer (wizard `components/admin/theme/studio/AdminThemeStudio.vue`, `AdminThemeSceneSheet.vue`, create flow, editor, SSR font `<link>` via `instanceTheme.ts`). The validation test reads `@commonpub/ui`'s pure `tokens.ts` source directly (no Vue) to assert every emitted key is canonical. Published to npm since session 192 (0.1.0; 0.6.x as of session 195).

## @commonpub/editor

`packages/editor/src/` (pure TS engine) + top-level `packages/editor/vue/` (Vue editor surface, exported via the `./vue` subpath — `@commonpub/editor/vue`; a sibling of `src/`, like explainer)

20 registered block types (`blocks/registry.ts`):

text, heading, code, image, quote, callout, gallery, video, embed, markdown, divider, sectionHeader, partsList, buildStep, toolList, downloads, quiz, interactiveSlider, checkpoint, mathNotation.

Core (`src/`):

- `blocks/types.ts` — `BlockTuple`, `TypedBlockTuple`, `BlockDefinition`
- `blocks/registry.ts` — `registerBlock()`, `lookupBlock()`, `validateBlock()`
- `blocks/schemas.ts` — Zod per block type
- `extensions/` — TipTap Node per block (**18 files** — `divider` + `sectionHeader` are registered block types but have no standalone extension file)
- `editorKit.ts` — `createCommonPubEditor({ content, onUpdate })` (the engine entry point)
- `serialization.ts` — `validateBlockTuples()`, `buildEditorSchema()`, ProseMirror ↔ BlockTuple
- `markdown/` — md import/export

Vue surface (`vue/`, opt-in via `@commonpub/editor/vue`): `EditorShell`, `BlockCanvas`, `BlockWrapper`, `BlockPicker`, `BlockInsertZone`, `EditorBlocks`, `EditorSection`, `EditorVisibility`, `EditorTagInput` + `components/blocks/*` (20 per-block Vue components) + `useBlockEditor` composable + `provide.ts`/`types.ts`/`utils.ts`. (No file named `CpubEditor.vue` lives here — that name is the **layer's** thin wrapper, `layers/base/components/CpubEditor.vue`.)

`BlockTuple = [type: string, content: Record<string, unknown>]`.

Exports: `createCommonPubEditor({ content, onUpdate })` (from `editorKit.ts`); Vue components from `@commonpub/editor/vue`.

## @commonpub/explainer

`packages/explainer/src/` (pure TS) + top-level `packages/explainer/vue/` (optional Vue renderers — a separate publish path, NOT under `src/`)

- `types.ts` — ExplainerSection (text/interactive/quiz/checkpoint), QuizQuestion, InteractiveControl
- `sections/derive.ts` — derive presentation sections from BlockTuple[]
- `progress/tracker.ts` — pure state machine: `createProgressState`, `markSectionCompleted`, `canAccessSection`, etc.
- `quiz/engine.ts` — deterministic shuffle (mulberry32 seed), scoring, gate enforcement
- `render/` — framework-agnostic renderers
- `export/` — self-contained HTML export (~6KB of vanilla JS + inlined CSS for 4 themes)

Two more **shipped** top-level dirs (both in the package's `files` array, siblings of `src/`):
- `vue/` — Vue renderers; `vue/theme/` has 4 theme CSS presets: dark-industrial, punk-zine, paper-teal, clean-light
- `modules/` — the **interactive module runtime** (CLAUDE.md "Interactive module runtime"): `registry.ts` makes **10 `modules.set()` registrations** — `hero`, `conclusion`, `text-only`, `slider`, `quiz`, `toggle`, `reveal-cards`, `compare`, `clickable-cards`, `custom-html` (one dir each = 10 dirs). Each has `meta.ts`; only 7 also have `config.ts` and only 5 have a `Viewer.vue` (`conclusion`/`hero`/`text-only` are meta-only). NOTE: `layout` is a `meta.category` value (e.g. hero/conclusion are category `layout`), **not** a registered module type.

Engine is framework-agnostic. Vue components are optional.

## @commonpub/learning

`packages/learning/src/`

- `types.ts` — LearningPath, LearningModule, Lesson, Enrollment, LessonProgress, Certificate
- `validators.ts` — Zod
- `curriculum.ts` — `flattenLessons`, `countLessons`, `calculateEstimatedDuration`, `formatDuration`, `buildCurriculumTree`, `reorderItems`
- `progress.ts` — `calculatePathProgress`, `isPathComplete`, `getNextLesson`, `getLessonStatus`, `getCompletionPercentageByModule`
- `quiz.ts` — `gradeQuiz`, `redactQuizAnswers`
- `certificate.ts` — verification code `CPUB-{timestamp_base36_uppercased}-{random_hex8}` (prefix configurable via `generateVerificationCode(prefix='CPUB')`)

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

- **storage.ts** — `LocalStorageAdapter`, `S3StorageAdapter`, `createStorageFromEnv()`; DO Spaces CDN URL derivation when `S3_CDN=true` (added in 0.7.0)
- **image.ts** — Sharp integration, `IMAGE_VARIANTS` (thumb=150, small=300, medium=600, large=1200 — widths in px); `limitInputPixels: 100_000_000` caps decoded bitmap memory
- **email.ts** — SMTP/Resend/Console adapters + `emailTemplates`: verification, passwordReset, notificationDigest, notificationInstant, contestAnnouncement, certificateIssued
- **security.ts** — `buildCspHeader()`, rate-limit store with 6 tiers (auth=5/min, upload=10/min, social=30/min, federation=60/min, api=60/min, general=120/min), nonce. Re-exports **`getClientIp(event, opts?)` (added in 0.8.0)** for XFF-spoof-resistant client IP extraction.
- **clientIp.ts** (added 0.8.0) — `getClientIp(event, opts?)` reads rightmost `X-Forwarded-For` token by default. Falls back to `x-real-ip` then socket `remoteAddress` then `'unknown'`. `CPUB_TRUSTED_PROXY_DEPTH=N` env var or `trustedProxyDepth` option for multi-proxy operators. Framework-agnostic (uses a locally-defined `ClientIpEvent` interface so infra stays `h3`-free).
- **structuredLogger.ts** — `createStructuredLogger({ component })` emits one JSON line per event to stdout
- **tokenCrypto.ts** (added 0.7.0) — ChaCha20-Poly1305 helpers for OAuth bearer tokens at rest (`encryptToken`, `decryptToken`, `isTokenKeyConfigured`)
- **redis/** — opt-in Redis-backed `RateLimitStore` (`createRateLimitStore({ redisUrl, onRedisError })`), client factory, fail-open logger
- **realtime/** — pub/sub abstractions for SSE fanout (memory + Redis backends, `createRealtimePubSub`)

Peer deps: AWS SDK + Sharp (optional).

## @commonpub/test-utils

`packages/test-utils/src/`

- `factories.ts` — `createTestUser`, `createTestSession`, `createTestFederatedAccount`, `createTestOAuthClient`, `resetFactoryCounter` (no content/hub factories)
- `mockConfig.ts` — `createTestConfig(overrides?)` factory (a function, not a pre-built constant)

## apps/reference/

Thin Nuxt 3 shell. `trustedInstances: ['deveco.io']`. Uses `@commonpub/layer` as workspace dep. Its `commonpub.config.ts` enables **13 flags** — `content`, `social`, `hubs`, `docs`, `video`, `contests`, `learning`, `explainers`, `editorial`, `federation`, `federateHubs`, `seamlessFederation`, `admin` — and leaves the rest unset, so they take schema defaults: `events`/`publicApi`/`layoutEngine`/`rbac`/`emailNotifications`/`identity.*` **OFF**, `contentImport` **ON**. (Not literally "all features on".) Contains:

- `commonpub.config.ts` — instance config (the 13-flag set above)
- `nuxt.config.ts` — minimal (extends layer)
- `components/` — branding overrides (SiteLogo)
- `server/utils/config.ts` — Nitro-side config RESOLVER (not a bare re-export): merges DB overrides > `FEATURE_*` env > build-time `commonpub.config.ts`, cached 60s (required, see gotchas)
- `public/` — static assets, favicons
- `e2e/` — Playwright
- `scripts/seed.ts` — dev seed

## apps/shell/

Starter template for new CommonPub instances. The config nearly mirrors the reference app — **12 flags** on (the same set minus `editorial`) — so it's not a minimal-features starter, just the smaller/plainer shell that create-commonpub derives from. Differences from apps/reference: no e2e/, no seed scripts, no vitest.config, tighter nuxt.config (devtools only — reference also adds app.head, nitro publicAssets, vite server.fs.allow). (Both have a drizzle config — shell `drizzle.config.ts`, reference `drizzle.config.js`.)

## tools/create-commonpub/ (Rust CLI)

- `main.rs` — clap parser
- `lib.rs` — library entry (shared between bin + tests)
- `prompts.rs` — dialoguer prompts
- `scaffold.rs` — directory creation
- `template.rs` — file templates

`cargo install create-commonpub` → `create-commonpub new <name>`.

Flags: `--defaults`, `--features`, `--content-types`, `--auth`, `--contest-creation`, `--theme`, `--domain`, `--description`, `--admin-user`, `--no-docker`.

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
- `droplet-setup.sh`, `do-one-click.sh`, `do-status.sh`, `do-destroy.sh`
- `federation-seed.ts` — multi-instance seed
- `package.json` + `vitest.config.ts` + `__tests__/` — deploy/ has its own test suite (Caddyfile/compose assertions)

(Note: there is **no** `deploy/migrations/` directory — committed SQL migrations live in `packages/schema/migrations/` and are applied at deploy time by `scripts/db-migrate.mjs` against `/app/schema/migrations` [`DRIZZLE_MIGRATIONS_FOLDER`].)

Root `docker-compose.yml` uses REMAPPED ports (5433, 6380, 7701) to avoid conflict with local tools.

## design-system-v2/

**ARCHIVE.** Figma HTML exports. Not used at runtime. Source of truth for design is `layers/base/theme/` + `packages/ui/theme/`.

## test-site/

Separate Nuxt instance with FULL UI implementation (not using the layer). Uses npm (package-lock.json) instead of pnpm. Kept as a compatibility test bed. Not actively developed.

## scripts/

- `db-migrate.mjs` — **primary schema-deploy wrapper (session 128+)**. Calls `drizzle-orm/node-postgres/migrator.migrate()` directly against `/app/schema/migrations/`. Used by CI on every deploy. No TTY prompts, fails hard on migration errors.
- `db-push.mjs` — legacy wrapper for `drizzle-kit push`. Retained for local dev iteration; no longer called by CI.
- `migrate-homepage-layout.mjs` — homepage-sections → layout-engine migration runner (layout engine)
- `smoke.mjs` — post-deploy in-container smoke check (hits `/` not just `/api/health`, session 169)
- `migrate-blog-to-article.sql` — historical one-shot migration (article/blog merge, session 116)
