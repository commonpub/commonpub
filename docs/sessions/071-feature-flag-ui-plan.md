# Session 071 — Feature-Flag-Aware UI + CLI Rearchitecture

**Date:** 2026-03-23
**Goal:** Make the reference app UI respect feature flags; rearchitect CLI to copy reference app

---

## Phase 1: Wire Feature Flags (Foundation)

### 1.1 — `server/utils/config.ts`
- Read `FEATURE_*` env vars into `defineCommonPubConfig()`
- Pattern: `!== 'false'` for default-on flags, `=== 'true'` for default-off (contests, federation, admin)
- Also read `CONTENT_TYPES` and `CONTEST_CREATION`

### 1.2 — `nuxt.config.ts` runtimeConfig.public
- Add `features` object with all 10 boolean flags
- Add `contentTypes: 'project,article,blog,explainer'`
- Add `contestCreation: 'admin'`
- Nuxt maps `NUXT_PUBLIC_FEATURES_CONTENT=false` automatically

### 1.3 — `useFeatures()` composable
- Wraps `useRuntimeConfig().public.features` in typed reactive interface
- Returns individual computed refs: `hubs`, `docs`, `learning`, etc.
- Auto-imported by Nuxt

### 1.4 — `useContentTypes()` composable
- Parses comma-separated `contentTypes` string from runtimeConfig
- Returns `enabledTypes` (array) + `isTypeEnabled(type)` (computed)

### 1.5 — `.env.example` update
- Document all `NUXT_PUBLIC_FEATURES_*` env vars

---

## Phase 2: Make UI Feature-Flag-Aware (30+ files)

### Session A — High Impact (3 files)

**`layouts/default.vue`** (12+ nav links):
- Desktop nav: `v-if` on each feature link
- Mobile nav: same conditions
- Footer: content column driven by `useContentTypes()`, community/platform columns gated by flags
- Admin link: only for authenticated admins (`v-if="isAdmin && admin"`)

**`pages/index.vue`** (tabs, sidebar):
- Tabs: computed from `useContentTypes()` + static tabs (For You, Latest, Following)
- Sidebar: contest card gated on `contests`, hubs card gated on `hubs`
- Explore quick links: built from `enabledTypes` + feature-gated entries

**`pages/create.vue`** (content type cards):
- Filter hardcoded types array by `useContentTypes().enabledTypes`

### Session B — Remaining Files

| File | Change |
|------|--------|
| `layouts/admin.vue` | Gate on `admin` flag + isAdmin role |
| `pages/explore.vue` | Filter chips + tabs from config |
| `pages/feed.vue` | Filter chips from config |
| `pages/search.vue` | Type pills from config + features |
| `pages/dashboard.vue` | Learning tab gated |
| `pages/u/[username]/index.vue` | Profile tabs filtered |
| `components/SearchSidebar.vue` | Hubs section gated |
| `components/views/ProjectView.vue` | Hub links gated |
| `pages/about.vue` | Feature cards gated |

### Principle
- Disabled features = invisible via `v-if`, not deleted
- Files stay on disk — users can re-enable later
- No route middleware needed

---

## Phase 3: CLI Rearchitecture

### Strategy: Copy + Patch (not string templates)

1. **Embed** `apps/reference/` into CLI binary via `include_dir` crate
2. **Unpack** to target directory
3. **Patch** 5 files:
   - `.env` — from prompts
   - `commonpub.config.ts` — from prompts
   - `nuxt.config.ts` — fix CSS paths, inject feature flags
   - `package.json` — `workspace:*` → npm versions, conditional deps
   - `drizzle.config.ts` — from prompts
4. **Optional `--strip`** — remove page dirs for disabled features
5. Keep interactive prompts + CLI flags as-is

### Files to gut from template.rs
Remove all `render_*` functions for Vue/TS files (layout, pages, server utils, middleware, etc.)
Keep: `render_env()`, `render_config()`, `render_drizzle_config()`, `render_docker_compose()`, `render_gitignore()`
Add: `patch_package_json()`, `patch_nuxt_config()`

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Nuxt nested boolean env mapping | Test explicitly with NUXT_PUBLIC_FEATURES_HUBS=false |
| Home page breaks with all features off | Home + Search always visible |
| CLI binary couples to reference app structure | CI integration test + embedded hash check |
| Nav empty when everything disabled | Home always present |
