# Session 071 — Feature-Flag-Aware UI + CLI Scaffolder Fixes

**Date:** 2026-03-23
**Goal:** Make reference app UI respect feature flags; fix CLI scaffolder; test standalone site

---

## What Was Done

### CLI Scaffolder Rewrite (SvelteKit → Nuxt 3)
- Rewrote all Rust templates for Nuxt 3: nuxt.config.ts, package.json, app.vue, server utils, middleware, composables
- Added interactive feature selection (10 flags), auth methods, content types, contest permissions
- Added ResendEmailAdapter to @commonpub/infra + wired through server/CLI
- Added CLI flags for non-interactive mode: `--features`, `--content-types`, `--contest-creation`, `--no-docker`
- Feature-aware page generation + dynamic nav layout
- Published: @commonpub/infra@0.2.1, @commonpub/server@0.2.1, create-commonpub@0.2.0

### Feature Flag System (Phase 1)
- `server/utils/config.ts` now reads FEATURE_* env vars into defineCommonPubConfig()
- `nuxt.config.ts` exposes features, contentTypes, contestCreation in runtimeConfig.public
- New `useFeatures()` composable — typed reactive access to feature flags
- New `useContentTypes()` composable — parses enabled content types with metadata
- Flags propagate: .env → server config → Nuxt runtimeConfig → client composables

### Feature-Flag-Aware UI (Phase 2)
- `layouts/default.vue` — 12+ nav links gated (desktop, mobile, footer)
- `pages/index.vue` — tabs from useContentTypes(), sidebar sections gated
- `pages/create.vue` — content type cards filtered
- `layouts/admin.vue` — gated on admin flag + isAdmin role
- `pages/explore.vue`, `feed.vue`, `search.vue` — filters from config
- `pages/dashboard.vue` — learning tab gated
- `pages/u/[username]/index.vue` — profile tabs filtered
- `pages/about.vue`, `SearchSidebar.vue`, `ProjectView.vue` — links gated
- `pages/contests/index.vue` — Create Contest gated on contestCreation permission

### Bug Fixes
- Auth signup: send `username` field (not just `name`) in sign-up request body
- Component resolution: added `pathPrefix: false` to Nuxt components config
- Missing deps: @tiptap/pm, @opentelemetry/api added

---

## Key Decisions

1. **Features disabled via config flags, NOT file stripping** — all packages installed, all files on disk. Disabled = invisible in UI, not deleted. Users can re-enable later.
2. **ALL @commonpub/* packages must be in standalone sites** — even disabled features have files that Nuxt compiles. Missing packages cause build errors.
3. **CLI should copy reference app, not generate stubs** — Rust string templates produce broken, unstyled sites. Phase 3 (CLI rearchitecture) will embed the reference app.

---

### Production Readiness Sweep (Post-Session)

#### Security + API Correctness
- Federation inbox guards: both inbox routes now return 404 when `federation` flag is off
- HTTP Signature verification wired in both inbox routes using `verifyHttpSignature()` + `resolveActor()` from protocol package
- Conditional docs prerendering: `/docs/**` route rule skipped when `NUXT_PUBLIC_FEATURES_DOCS=false`
- CLI scaffolder Zod version fixed: `^3.24.0` → `^4.3.6` to match monorepo

#### Mobile Editor UX
- Touch-friendly cover image overlays: `@media (hover: none)` + `:focus-within` on ProjectEditor, ArticleEditor, BlogEditor
- Block library touch targets: padding increased from `6px 10px` → `10px 10px` for 44px WCAG minimum
- Floating toolbar viewport clamping: `Math.max`/`Math.min` prevents overflow on small screens
- Block wrapper controls: drag handle + control buttons always visible on touch devices
- Mobile slide-out sidebars: all 4 editors (Project, Article, Blog, Explainer) now have fixed sidebar slide-outs with toggle buttons + overlay instead of `display: none`

#### Documentation + Code Quality
- CLI README rewritten: all flags documented, Nuxt 3 generation, Phase 3 note
- Deployment docs: "Deploying a Scaffolded Site" section covering Docker, npm, S3, email
- ADR-014 fix: removed stale "guide" content type + "svelte:head" reference
- 5 skipped learning tests fixed: replaced `inArray` with `or(eq(...))` for PGlite compatibility, `deletePath` uses `.returning()` instead of `rowCount`
- `.stryker-tmp/` confirmed gitignored and untracked
- Search API empty query confirmed working (false positive)

---

## Open Items

- [ ] Phase 3: CLI rearchitecture (copy + patch approach)
- [ ] Email: works via ConsoleEmailAdapter (logs to server), no SMTP/Resend configured
- [ ] npm version of CLI (`create-commonpub` npm package)

---

## Current State

| Check | Result |
|-------|--------|
| Feature flags | 10 flags wired end-to-end |
| UI flag-aware | 12+ files updated |
| Test site | Running at localhost:3001 |
| Auth | Sign-up/sign-in working |
| Editor | Working (with @tiptap/pm fix) |
| Preview | Working (with pathPrefix fix) |
| Storage | Local ./uploads/ (S3 ready but not configured) |
