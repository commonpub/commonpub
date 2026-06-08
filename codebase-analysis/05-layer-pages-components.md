# 05 — Layer: Pages, Components, Composables, Middleware

`layers/base/` — published as `@commonpub/layer`. The distribution unit.
Instances extend it via `extends: ['@commonpub/layer']` in their nuxt.config.

Re-verified session 191 (2026-06-07): **90 pages, 139 components,
34 composables (non-test; +12 `__tests__/` files), 10 server plugins,
3 route middleware, 11 server (Nitro) middleware, 327 `server/api/` route
files + 22 ActivityPub/site routes.** The directory layout below is
shape-stable; counts are current.

## Directory layout (depth 3)

```
layers/base/
├── app.vue                    root with NuxtLayout / NuxtPage / skip-link
├── error.vue                  404 / error page — re-applies data-theme for SSR
├── nuxt.config.ts             modules, CSS bundle, runtime config, features
├── components/                139 Vue components (grouped below; +LayoutSlot/Row/Section + PageFrame + admin/layouts editor + admin/theme + ContestStagesEditor)
├── composables/               34 useX helpers (non-test) + __tests__/
├── layouts/                   default, admin (collapsible sidebar, session 161), auth, editor
├── middleware/                3 route guards: auth.ts, feature-gate.global.ts, admin-layouts.ts
├── pages/                     90 routes (Nuxt file-based)
├── plugins/                   theme.ts + auth.ts (client)
├── sections/                  builtin/ section registry (17 registered) + registry.ts (Stage E: points component: at existing Block*/Homepage*)
├── server/
│   ├── api/                   327 Nitro route files (REST; +public/v1/metrics/*)
│   ├── routes/                22 ActivityPub + site routes (inbox/outbox/.well-known/nodeinfo/feed.xml/sitemap/robots)
│   ├── middleware/            11: auth, theme, features, security, content-ap, content-redirect, blog-redirect, hub-ap, hub-post-ap, mastodon-alias-redirect, public-api-auth
│   ├── plugins/               10: auto-admin, federation-delivery, federation-hub-sync, migrate-article-to-blog, notification-email, search-index, feature-flags-prime, identity-startup, metrics-rollup, registry-heartbeat
│   └── utils/                 config, db, session, hooks wiring, layoutCache, validateSectionConfigs, requirePermission, resolveContentQuery
├── theme/                     CSS tokens + component/prose/forms/layouts/editor-panels CSS
├── types/                     hub.ts + meilisearch.d.ts + theme.ts
└── utils/                     themeConfig.ts + themeIds/themeDiscovery/themeIO
```

## Pages (90)

Grouped by section.

### Public

| Route | Purpose |
|---|---|
| `/` | Homepage (configurable sections from instanceSettings) |
| `/about`, `/privacy`, `/terms`, `/cookies` | Static |
| `/explore` | Curated browse |
| `/search` | Full-text across local + federated |
| `/feed` | User activity feed (authed) |
| `/dashboard` | Authed user's dashboard — drafts, published, bookmarks, learning enrollments |
| `/notifications` | Inbox |
| `/tags`, `/tags/:slug` | Tag directory + filtered |
| `/[type]` | Browse by content type |

### Auth

`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/oauth/authorize`.

### User profile

`/u/:username`, `/u/:username/followers`, `/u/:username/following`, `/u/:username/:type/:slug`, `/u/:username/:type/:slug/edit`.

URL restructure landed in session 108: canonical content lives at `/u/{username}/{type}/{slug}`.

### Hubs

`/hubs`, `/hubs/create`, `/hubs/:slug`, `/hubs/:slug/members`, `/hubs/:slug/settings`, `/hubs/:slug/posts/:postId`.

### Contests

`/contests`, `/contests/create`, `/contests/:slug`, `/contests/:slug/edit`, `/contests/:slug/judge`, `/contests/:slug/results`.

### Events (session 124)

`/events`, `/events/create`, `/events/:slug`, `/events/:slug/edit`.

### Learning

`/learn`, `/learn/create`, `/learn/:slug`, `/learn/:slug/edit`, `/learn/:slug/:lessonSlug`, `/learn/:slug/:lessonSlug/edit`.

### Docs sites

`/docs`, `/docs/create`, `/docs/:siteSlug`, `/docs/:siteSlug/:...pagePath`, `/docs/:siteSlug/edit`.

### Videos / products

`/videos`, `/videos/:id`, `/videos/submit`, `/products`, `/products/:slug`.

### Federated

`/federation`, `/federation/search`, `/federation/users/:handle`, `/federated-hubs/:id`, `/federated-hubs/:id/posts/:postId`.

### Messages

`/messages`, `/messages/:conversationId`.

### Settings

`/settings` (redirect), `/settings/profile`, `/settings/account`, `/settings/appearance`, `/settings/notifications`.

### Admin (flag: `admin`)

`/admin`, `/admin/users`, `/admin/content`, `/admin/categories`, `/admin/reports`, `/admin/audit`, `/admin/theme`, **`/admin/theme/edit/:id` (session 154)**, `/admin/homepage`, **`/admin/layouts` (list) + `/admin/layouts/:id` (the drag-drop layout editor — Phase 3a shell / 3b dnd / 3c resize, sessions 160–169, flag: `layoutEngine`)**, **`/admin/navigation` (session 124)**, `/admin/features`, `/admin/federation`, `/admin/settings`, `/admin/api-keys`.

**Theme admin (session 154)** — `/admin/theme` lists every theme across three sources (built-in / code-registered / DB-stored custom), with capture-from-`:root` detection for thin layer apps that ship their own CSS. `/admin/theme/edit/:id` is the split-pane editor; the special id `__new` reads a seed from sessionStorage (used by create / duplicate / capture / import flows). See [`docs/reference/guides/theme-editor.md`](../docs/reference/guides/theme-editor.md) for the full architecture.

**Admin chrome (session 161)** — `layouts/admin.vue` left sidebar is collapsible on desktop via a topbar chevron button (200px ↔ 56px icons-only). State + persistence in `composables/useAdminSidebar.ts`. Editor routes (`/admin/layouts/:id` + `/admin/theme/edit/:id`) auto-collapse for canvas room; user preference is persisted to `cookie[cpub-admin-sidebar-collapsed]` (switched from localStorage in an audit-polish round to kill the SSR/CSR hydration flash) on all other admin routes; in-editor toggle is a session-only override (resets on route change). Mobile drawer behavior unchanged. `cursor:grab`-style "UI lies" check: every toggle has a wired handler before the button renders.

### Misc

`/create` (content-type starter chooser), `/authorize_interaction`, `/cert/:code`, `/mirror/:id`, **`/[...customPath]` (session 159+, custom-page catch-all — renders a layout-engine `custom-page`-scoped layout via `<LayoutSlot>` when one matches the route; gated by `layoutEngine`)**.

## Components (139) — grouped

### Block renderers (`components/blocks/`, 21)

BlockBuildStepView, BlockCalloutView, BlockCheckpointView, BlockCodeView, BlockContentRenderer (dispatcher), BlockDividerView, BlockDownloadsView, BlockEmbedView, BlockGalleryView, BlockHeadingView, BlockImageView, BlockMarkdownView, BlockMathView, BlockPartsListView, BlockQuizView, BlockQuoteView, BlockSectionHeaderView, BlockSliderView, BlockTextView, BlockToolListView, BlockVideoView.

### Content editors (`components/editors/`, 6)

ArticleEditor, BlogEditor, ExplainerEditor, ProjectEditor, DocsPageTree, MarkdownImportDialog.

### Content views (`components/views/`, 3)

ArticleView, ExplainerView, ProjectView.

### Contest (10)

ContestEntries, ContestHero, **ContestJudgeManager** (session 124), ContestJudges, **ContestJudgingCriteria**, ContestPrizes, ContestRules, ContestSidebar, **ContestStakeholderManager** (session 174), **ContestStagesEditor** (session 189 — Phase B1 stages editor: add/duplicate/reorder/rename/kind/dates + mark-current + reset-to-standard; used by create.vue + edit.vue).

Contest stage logic lives in two auto-imported layer utils (session 189): `utils/contestStages.ts` (synthesizeStages/normalizeStages/currentStageId + STAGE_KIND_ICON/LABEL — client mirror of the server's pure helpers) and `utils/contestTransitions.ts` (CONTEST_VALID_TRANSITIONS + status-action labels — single client source of truth shared by ContestHero + edit.vue, mirrors the server map). ContestSidebar renders the dynamic stage timeline; ContestHero shows the current stage name as a chip when explicit stages exist.

**Phase B2 (session 189):** ContestEntries shows per-entry cohort badges (Advanced / Not advanced, dimming eliminated cards). The contest edit page gains an **Advancement** section (per review stage, a **Top N** vs **Pick manually** toggle → `POST /api/contests/[slug]/advance` with `mode: 'topN'|'manual'`; manual lists the eligible cohort as checkboxes + scores). Editor `cpub-form-*` styles are self-contained in `ContestStagesEditor` (scoped CSS doesn't cross component boundaries).

**Editor UX pass (session 189):** the contest **edit** page is a two-column layout — a wide `cpub-edit-main` content column + a sticky `cpub-edit-side` meta rail (Stage & Status, Entry rules, Danger Zone) so lifecycle controls stay reachable; the save bar spans full-width and sticks to the viewport bottom. `ContestStagesEditor` got a top toolbar (Add stage / Reset) for discoverability and carries its OWN tokenised `cpub-form-*` control styles (scoped CSS doesn't cross component boundaries — see [[09-gotchas-and-invariants]]). Stage array-ops (add/duplicate/move/remove/seed) are pure functions in `utils/contestStages.ts`, unit-tested in `utils/__tests__/contestStages.test.ts`.

### Events (session 124)

EventCard, EventCalendar.

### Hubs (10)

HubDiscussions, HubFeed, HubHero, HubLayout (tabs), HubMembers, HubProducts, HubProjects, HubResources, HubSidebar, HubSidebarCard.

### Homepage sections (8)

ContentGridSection, ContestsSection, CustomHtmlSection, EditorialSection, HeroSection, HomepageSectionRenderer (dispatcher), HubsSection, StatsSection.

### Layout engine renderers (session 157 Phase 1 → session 168 PageFrame)

**LayoutSlot / LayoutRow / LayoutSection** (`components/LayoutSlot.vue`, `LayoutRow.vue`, `LayoutSection.vue`) — `<LayoutSlot route="/" zone="main" />` renders one zone of a route's active layout, delegating each row to `LayoutRow` (12-column CSS Grid) and each cell to `LayoutSection` (the cell itself sets the `--cpub-section-cols-{sm|md|lg}` custom properties that drive its responsive `grid-column` span via media queries; mobile defaults to span 12 = stack). Visibility at render time filters on `enabled`, `role`, and `feature` (`LayoutRow.sectionVisible` — a non-visible section isn't rendered). `hideAt` is **CSS-side**, not render-time: the section IS rendered into the DOM and hidden via `data-hide-{sm/md/lg}` attrs + a media-query `display:none`. `previewOverride` prop lets the editor's preview pane render an in-progress draft without a save round-trip (single source of truth for editor + production rendering). Gated by `features.layoutEngine`. (`LayoutRow`/`LayoutSection` were extracted from `LayoutSlot` in session 163 — see the CSS-scope extraction note in MEMORY.)

**PageFrame** (`components/PageFrame.vue`, session 168) — the canonical page frame wrapper. Full-width variant is full-bleed (matches the live homepage; ADR 028). Shared by production pages AND the editor's canvas previews so the editor is WYSIWYG (session 168 Stage 2).

**Section registry — Stage E unification** (session 159, `layers/base/sections/`): the layout engine is an *arranger for EXISTING components*, not a parallel renderer. `registry.ts` registers 17 built-in `SectionDefinition`s (`builtin/*.ts` — divider, hero, heading, paragraph, image, content-feed, editorial, stats, hubs, contests, learning, custom-html, cta, markdown, gallery, video, embed). Each definition's `component:` points at an EXISTING `Block*`/`Homepage*`/`*Section` component and uses a `propMap` to adapt the layout-section shape to that component's props. (Stage E deleted the 16 duplicate `Section*.vue` files that session 158 had created — see `feedback-reuse-existing-components` in MEMORY.) Only `SectionCta.vue` + `SectionLearning.vue` remain under `components/sections/` as genuinely new renderers.

**Editor** (`components/admin/layouts/AdminLayouts*.vue`, sessions 160–169) — the drag-drop layout editor surface rendered by `pages/admin/layouts/[id].vue`:
- `AdminLayoutsCanvas.vue` — the preview/edit canvas (renders via `<PageFrame>` for WYSIWYG, session 168)
- `AdminLayoutsToolbar.vue` — save / publish / undo-redo / viewport controls
- `AdminLayoutsPalette.vue` + `AdminLayoutsPaletteTile.vue` — draggable section palette (drag via `@vue-dnd-kit/core`, Phase 3b)
- `AdminLayoutsInspector.vue` + `AdminLayoutsInspectorPage` / `AdminLayoutsInspectorRow` / `AdminLayoutsInspectorSection` — context-dispatched property panels
- `AdminLayoutsAutoForm.vue` — form-from-Zod for a section's `configSchema`
- `AdminLayoutsConflictModal.vue` — 3-option save-conflict resolution
- `AdminLayoutsHelpOverlay.vue` — keyboard-shortcut help
- `AdminLayoutsAnnouncer.vue` — ARIA live-region for drag/resize a11y

**Homepage adoption + canary** (session 158 → 159): `layers/base/pages/index.vue` has a 3-way v-if/v-else-if/v-else. `v-if="layoutEngineActive"` renders LayoutSlot zones; v-else-if renders the existing configurable section renderer (when `hasCustomSections`); v-else renders the legacy hardcoded homepage. **commonpub.io's homepage renders LIVE via the layout-engine canary using `<LayoutSlot>`** (session 159). Flag default OFF → behavior on existing instances unchanged.

**Per-section config validation** (session 161): `layers/base/server/utils/validateSectionConfigs.ts` enforces every section's Zod `configSchema` on POST/PUT to `/api/admin/layouts/*`. Schemas live in `@commonpub/schema/sectionConfigs` (server-safe, no Vue imports) and are looked up via `SECTION_CONFIG_SCHEMAS`. Rejection → 400 with structured `data.sectionErrors` payload (zone + rowIndex + sectionIndex + Zod issues per offending section) + audit log `cpub.audit.layout.config-rejected` (the log is emitted by the calling routes `admin/layouts/index.post.ts` + `[id].put.ts`, not inside `validateSectionConfigs.ts`). Closes the "admin bypasses URL guards / size caps / sandbox flags" surface (session 160 R2 P1 deferred → wired in session 161 after the schema-package refactor removed the .vue transitive that broke the R2 attempt).

### Admin theme editor (`components/admin/theme/`, 8 — session 154)

AdminThemeFamilyCard, AdminThemeOverridesPanel, AdminThemePreviewPane, AdminThemeSceneAdmin, AdminThemeSceneGallery, AdminThemeSceneProse, AdminThemeTokenGroup, AdminThemeTokenInput.

### Federation admin (session 184)

**MirrorDetailModal** (`components/MirrorDetailModal.vue`) — per-mirror detail dialog opened from the federation admin Mirrors tab: full facts + filter chips, last error, bounded re-backfill (depth picker), two-step delete. `role=dialog` + `useFocusTrap`. `pages/admin/federation.vue` Mirrors tab was overhauled (session 184): create-form with one-directional explainer + content-type/tag filters + history depth picker, mirror list with direction/filters/lastSync/errorCount, status legend, "Instances mirroring you" panel (`GET /api/admin/federation/followers`), bounded re-federate scope selector. Note: dynamic `$fetch` URLs use a `string`-typed const to avoid the typed-routes TS2321 recursion. **Session 185 (Phase 3):** create-form gained a direction selector (pull / "request they mirror me") + "Requests to mirror you" / "Requests you've sent" panels + `MirrorRequestApproveModal.vue` (depth + filter picker on approve). **Session 186 (Phase 4):** a "Registry" tab (shown when `actAsRegistry`) renders `RegistryDirectory.vue` — presentational (props/events) directory list with search + per-entry Mirror / Request-mirror (reusing Phase-3 endpoints) + Hide/Unhide/Block, online dot + status badge, axe-tested.

### Navigation (session 124)

**NavRenderer**, **NavDropdown**, **MobileNavRenderer**, **NavLink**.

### Voting / polls (session 124–125)

**PostVoteButtons**, **PollDisplay**.

### Utilities / widgets

AnnouncementBand, AppToast, AuthorCard, AuthorRow, CategoryBadge, CommentSection, ContentAttachments, ContentCard, ContentPicker, ContentStarterForm, ContentTypeBadge, CookieConsent, CountdownTimer, CpubEditor, CpubMarkdown, DiscussionItem, EditorialBadge, EngagementBar, FederatedContentCard, FeedItem, FilterChip, HeatmapGrid, ImageUpload (events cover image integration in session 125), ImportUrlModal, MemberCard, MentionText, MessageThread, NotificationItem, ProgressTracker, PublishErrorsModal, RemoteActorCard, RemoteFollowDialog, RemoteUserSearch, SearchFilters, SearchSidebar, SectionHeader, ShareToHubModal, SiteLogo (OVERRIDE POINT), SkillBar, SortSelect, StatBar, TOCNav, TimelineItem, VideoCard.

(`DocsPageTree` + `MarkdownImportDialog` live under `components/editors/`, listed above — not under a separate Docs group.)

## Composables (34, non-test)

| Name | Purpose |
|---|---|
| useAuth | session state (user, isAuthenticated, isAdmin), sign-in/out |
| useFeatures | reactive feature flags, hydrated from /api/features |
| useContentFeed | (session 179) keyset/offset feed driver — picks keyset-for-recency / offset-for-popular transparently; backs the infinite-scroll feed via `GET /api/content/feed` |
| useFocusTrap | focus-trap a11y helper for modals/dialogs |
| useTheme | data-theme / isDark / setDarkMode |
| useThemeAdmin | (session 154) admin theme picker state — unified families view across built-in/registered/custom, refresh via `/api/admin/themes`. Discovery + import/export live in `utils/themeDiscovery.ts` + `utils/themeIO.ts`; id helpers in `utils/themeIds.ts`; types in `types/theme.ts` |
| useLayout | (session 157, Phase 1 layout engine) resolves a route's active layout via `useFetch('/api/layouts/by-route')`. SSR-safe with hydration. Accepts `string \| Ref<string> \| (() => string)` — pass a getter/Ref for reactive callers (a parent-driven `<LayoutSlot>` whose `route` prop changes); a plain string for the typical static case. 404-as-null so consumers fall through to legacy renderers when `features.layoutEngine` is off. |
| useToast | notification system |
| useCookieConsent | GDPR consent state |
| useContentSave | autosave + publish workflow |
| useContentTypes | enabled content types |
| useContentUrl | URL builders for content pages |
| usePublishValidation | pre-publish validation |
| useMarkdownImport | md → BlockTuple |
| useApiError | HTTP error parsing |
| useMessages | DMs + unread count + SSE |
| useNotifications | notification inbox + SSE |
| useRealtimeCounts | two GLOBAL unread counters — notification count + message count — over a single SSE stream (`/api/realtime/stream`); replaced the separate useNotifications/useMessages EventSource connections. Not per-target. |
| useSiteName | from runtime config |
| useJsonLd | schema.org structured data |
| useFederation | AP resolve + search |
| useMirrorContent | federated content handlers |
| useSanitize | DOMPurify wrapper |
| useEngagement | like/bookmark state |
| useAdminSidebar | (session 161) admin chrome left-nav state machine. Two surfaces: desktop collapse (200px ↔ 56px icons-only, persisted to `cookie[cpub-admin-sidebar-collapsed]` — switched from localStorage in audit-polish round to eliminate SSR/CSR hydration flash) + mobile drawer (independent). Editor routes `/admin/layouts/[id]` + `/admin/theme/edit/[id]` auto-collapse to give canvas room; user can override per visit (session-only, resets on route change). 16 tests in `__tests__/useAdminSidebar.test.ts`. |
| useEditorChrome | (session 161) palette + inspector visibility state for the layout editor. Two cookie-persisted booleans (`cpub-editor-palette-hidden`, `cpub-editor-inspector-hidden`). Page grid (`pages/admin/layouts/[id].vue`) reflows `grid-template-columns` based on visibility class; `v-show` on the panels themselves preserves component state across toggles. User-reported canvas squish fix. 9 tests in `__tests__/useEditorChrome.test.ts`. |
| useLayoutEditor | (session 160, Phase 3a) the editor's core state machine — loads a layout, tracks the working draft + dirty/selection state, single-flight save (`AbortController`), publish, discard. Backs `pages/admin/layouts/[id].vue`. |
| useLayoutHistory | (session 160) undo/redo ring buffer over the editor's working draft (bounded). |
| useLayoutAutoSave | autosave loop for the editor draft (debounced; pairs with the single-flight save guard). |
| useLayoutDrag | (session 160, Phase 3b) drag-to-place sections from the palette + reorder within the canvas, built on `@vue-dnd-kit/core` (keyboard a11y included). |
| useLayoutResize | (session 166, Phase 3c) pointer/keyboard column-span resize handles on a section. Resize-handle tests needed a `PointerEvent` polyfill in jsdom (see `feedback-jsdom-pointerevent-missing`). |
| useLayoutHotkeys | (session 160) keyboard shortcuts for the editor (undo/redo, save, delete, nudge). |
| useLayoutAnnouncer | (session 160) ARIA live-region announcer for drag/resize/selection — backs `AdminLayoutsAnnouncer.vue`. |
| autoFormSchema | helper that drives `AdminLayoutsAutoForm.vue` — turns a section's Zod `configSchema` into form field descriptors. |

## Middleware

### Client-side route guards (3)

- **auth.ts** — `definePageMeta({ middleware: 'auth' })` redirects to `/auth/login?redirect=...`
- **feature-gate.global.ts** — global middleware that throws 404 if route's feature is disabled. Path mapping: `/learn → learning`, `/docs → docs`, `/videos → video`, `/admin → admin`, `/contests → contests`, `/events → events`, `/explainer → explainers`.
- **admin-layouts.ts** — route guard for the layout-editor pages (`/admin/layouts/*`).

### Server-side request middleware (11)

- `auth.ts` — enrich `event.context` with Better Auth session/user
- `theme.ts` — resolve instance theme + user dark-mode pref → `event.context.resolvedTheme`
- `features.ts` — populate feature flags (build-time + DB overrides)
- `security.ts` — CSP, HSTS, X-Frame-Options, etc.
- `content-ap.ts` — Accept: application/activity+json content negotiation
- `content-redirect.ts` — legacy content URL redirects
- `blog-redirect.ts` — one-way article→blog legacy redirects (301)
- `hub-ap.ts` — AP content negotiation for hub Group actors
- `hub-post-ap.ts` — AP content negotiation for hub posts
- `mastodon-alias-redirect.ts` — Mastodon-style alias redirects
- `public-api-auth.ts` — bearer-token auth for `/api/public/v1/**`

### Server plugins (10)

- `auto-admin.ts` — promote first registered user to admin (startup plugin)
- `federation-delivery.ts` — start outbound delivery worker
- `federation-hub-sync.ts` — periodic hub mirror sync
- `migrate-article-to-blog.ts` — one-time content type normalization
- `notification-email.ts` — register email sender callback with `@commonpub/server/notification`
- `search-index.ts` — subscribe to content hooks → index in Meilisearch
- `feature-flags-prime.ts` — prime the feature-flag cache at boot
- `identity-startup.ts` — cross-instance identity runtime init; `assertIdentityConfig` refuses to boot if an `identity.*` token flag is on without `CPUB_FED_TOKEN_KEY`
- `metrics-rollup.ts` — (session 190) daily `metrics_daily` rollup worker; backfills from entity timestamps if empty, then refreshes every 6h; opt-in on `features.publicApi`
- `registry-heartbeat.ts` — (session 186/188) sends periodic signed heartbeats to `federation.registryUrl`; self-skips if the URL is the instance's own domain; gated by `features.announceToRegistry` + `features.federation`

## Theme & CSS

Bundled CSS loaded by the layer's nuxt.config:

```
theme/
├── base.css             :root tokens (colors, fonts, spacing, shadows, radii)
├── dark.css             [data-theme="dark"]
├── generics.css         alt theme family
├── agora.css            editorial theme
├── agora-dark.css       agora dark variant
├── stoa.css             Stoa Light — the new default theme (session 190; warm paper, moss accent, Fraunces/Newsreader/Work Sans, 12px radius)
├── stoa-dark.css        Stoa Dark variant
├── components.css       .cpub-* component styles
├── prose.css            rich text / BlockTuple output
├── layouts.css          layout utilities
├── forms.css            form defaults
└── editor-panels.css    TipTap UI panels
```

Plus presets from `@commonpub/explainer/vue/theme/`: dark-industrial, punk-zine, paper-teal, clean-light.

Fonts pulled from Google Fonts (Fraunces serif/display, Newsreader reading serif, Work Sans sans) + Font Awesome 6.5.1 CDN.

### Consumer override

Consumer apps add `assets/theme.css` with `:root { --accent: #ff0000; ... }`. Consumer CSS loads AFTER the layer's, so it wins.

Key overridable tokens:

- `--border-width-default` (2px default, e.g. 1px for deveco)
- `--radius` (0px default)
- `--shadow-sm/md/lg`
- `--accent` (#5b9cf6 default)
- `--font-sans`, `--font-display`

## SSR theme plumbing

1. Server middleware `theme.ts` calls `resolveThemeContext(userScheme, registeredIds)` from `server/utils/instanceTheme.ts`, which reads instance theme + user dark-mode cookie + custom-theme tokens + instance overrides (cached 60s). **Default fallback is `stoa`** (session 190 — was `base`): a fresh install or any instance with no DB `theme.default` row resolves to Stoa Light (or `stoa-dark` by OS preference). Instances with an explicit DB `theme.default` are unaffected; a secondary `base` fallback guards unknown/missing admin choices.
2. Middleware writes four context values for the client plugin: `instanceTheme`, `resolvedTheme`, `isDarkMode`, **`themeInlineCss`** (session 154 — a serialized `:root { --token: value; … }` rule body for any active DB-stored custom theme + ad-hoc overrides).
3. Client plugin `plugins/theme.ts` reads context and calls `useHead({ htmlAttrs: { 'data-theme': themeId }, style: [{ id: 'cpub-theme-inline', innerHTML: themeInlineCss }] })` — both shipped in SSR HTML. Zero FOUC.
4. `useTheme().setDarkMode(bool)` mutates cookie + re-applies `data-theme` for built-in families; for custom themes with a `pairId`, the server picks the variant on next request.
5. Cascade order: built-in `theme/*.css` → code-registered theme CSS (loaded by thin app) → inline `<style id="cpub-theme-inline">`. No `@layer` wrapper on the inline style so it beats `@layer commonpub` rules without `!important`.

`error.vue` re-applies **only** `useHead({ htmlAttrs: { 'data-theme': themeId } })` (and only when `themeId !== 'base'`) because error pages render outside the layout tree on SSR. NOTE: it does NOT re-apply the `style:[{id:'cpub-theme-inline', innerHTML: themeInlineCss}]` block — so on an error page with a DB-stored custom theme, the inline token CSS is not re-injected.

## Nuxt config highlights

- `compatibilityDate: '2024-11-01'`
- `nitro.preset: 'node-server'`
- `routeRules: {}` (empty) + `nitro.prerender.crawlLinks: false`. The old `/docs/** → prerender: true` rule was **removed in session 126** (prerendering at build time saved API-error HTML as `/docs/index.html` and crawlLinks propagated it). Use `swr: 60` at runtime, not build-time prerender, if caching `/docs/**` again.
- Runtime config:
  - **private**: databaseUrl, authSecret, smtp/resend creds, S3 keys, uploadDir
  - **public**: siteUrl, domain, siteName, features (the **22 boolean flags only** — `identity.*` is NOT declared in `runtimeConfig.public.features`, so it can't be env-toggled here; it lives only in `@commonpub/config`'s `FeatureFlags` type), contentTypes, contestCreation, instanceCookies
- CSS array loads the whole `theme/` bundle + explainer presets

## Recent additions (sessions 124–125) confirmed present

✔ Nav system: NavRenderer + NavDropdown + MobileNavRenderer + NavLink
✔ Admin nav page `/admin/navigation` + API
✔ Events pages, EventCard, EventCalendar
✔ Events API with pagination + status whitelist + filters
✔ PostVoteButtons + hub post voting API
✔ PollDisplay + poll voting API
✔ ContestJudgeManager + judges API
✔ `error.vue` SSR theme re-apply via useHead
✔ ImageUpload wired into event cover images (create/edit)
✔ Contest entry heart-vote UI with optimistic updates (session 125)
✔ Batch `/api/contests/:slug/votes` endpoint

## Known mobile gap

~70 components lack `@media` breakpoints. Mobile polish is low-priority outstanding.
