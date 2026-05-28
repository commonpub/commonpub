# Layout Engine

> DB-stored, admin-editable page layouts composed from a registry of section components. Powers the homepage today (Phase 1c); future phases extend to hub pages, blog indexes, the footer, the 404, and admin-authored custom pages.

**Status**: Phase 3a editor shell shipped + 4 audit rounds (session 160). Feature-flagged OFF by default — `features.layoutEngine`. Operators flip ON per-instance, then either auto-migrate (legacy editor saves trigger a one-time non-destructive sync) or use the explicit "Migrate homepage to layout" CTA on `/admin/layouts`. Phase 1c (session 158) shipped the runtime (`<LayoutSlot>`, CRUD, public endpoint). Phase 3a (session 160) shipped the visual editor at `/admin/layouts/[id]` + page-meta inspector + auto-save with optimistic concurrency + 3-option conflict modal.

**Source**:
- Schema: `packages/schema/src/layout.ts` (Drizzle tables) + `packages/schema/src/validators.ts` (`layoutScopeSchema`, `layoutSchema`, `layoutCreateSchema`, `layoutSectionSchema`, `layoutRowSchema`, `layoutZoneSchema`, `pageMetaSchema`, `sectionVisibilitySchema`, `sectionResponsiveSchema`)
- Server CRUD: `packages/server/src/layout/layout.ts` (`listLayouts`, `getLayoutByScope`, `getLayoutById`, `saveLayout`, `deleteLayout`, `publishLayout`, `listLayoutVersions`, `revertToVersion`)
- Server bootstrap: `packages/server/src/layout/seed.ts` (`seedHomepageLayout`)
- Section registry types: `packages/ui/src/sections.ts` (`SectionRegistry`, `SectionDefinition`, `SectionRenderProps`, `SectionRenderMeta`, `resolveColSpan`, `migrateSectionConfig`)
- Layer runtime registry: `layers/base/sections/registry.ts` + `layers/base/sections/builtin/*.ts`
- Section components: `layers/base/components/sections/Section*.vue`
- Public resolver endpoint: `layers/base/server/api/layouts/by-route.get.ts`
- Admin write API: `layers/base/server/api/admin/layouts/*`
- Shared cache util: `layers/base/server/utils/layoutCache.ts`
- Renderer: `layers/base/components/LayoutSlot.vue`
- Composable: `layers/base/composables/useLayout.ts`
- Plan: `docs/plans/layout-and-pages.md` (1342 lines — architectural source of truth)
- Migration: `packages/schema/drizzle/0005_*.sql`

---

## The three storage layers

```
layouts (1)  →  layout_rows (N per zone)  →  layout_sections (N per row)
                                              ↓
                                          layout_versions (immutable snapshots)
```

| Table | Purpose |
|---|---|
| `layouts` | One row per scope: `('route', '/')`, `('virtual', '__footer')`, `('custom-page', '/about')` |
| `layout_rows` | Horizontal groups inside a zone. 12-column grid + gap + align + background + paddingY |
| `layout_sections` | Concrete content. `type` slug resolves in the registry. `col_span`, `responsive` (per-bp overrides), `visibility` (role/feature/hideAt) |
| `layout_versions` | Immutable snapshot per publish. Never UPDATEd; revert COPIES a snapshot back into the current rows + sections |

**Scope uniqueness**: `(scope_type, scope_key)` is `UNIQUE` — one layout per scope. POST returns 409 if you try to create over an existing layout.

**Cascade**: deleting a layout cascades through rows → sections → versions via FK.

---

## Section registry — what an admin can drop on a page

Built-in sections shipped today (17 total — Phase 1c catalog + 5 Phase 6b additions in Stage C, session 159):

| Type slug | Category | Default colSpan | Resizable | Notes |
|---|---|---|---|---|
| `divider` | layout | 12 | no | Horizontal rule. Variants: solid / dashed / dotted / accent |
| `hero` | layout | 12 (min 6) | yes | Title (h1) + optional eyebrow + subtitle + up to 2 CTAs. Variants: default / compact / centered |
| `heading` | content | 12 (min 3) | yes | h1–h4 + optional eyebrow + subline. Align left/center |
| `paragraph` | content | 6 (min 3) | yes | Plain prose, blank-line split into `<p>`. Phase 3e upgrades to TipTap subset via `.describe('rich')` |
| `image` | content | 12 (min 3) | yes | `<img>` lazy-loaded, optional `<a href>` wrap, optional caption. Fit + aspect ratio |
| `gallery` | content | 12 (min 6) | yes | 2–5 column image grid, 5 aspect ratios, 20-item cap. URL guards on src + href. Lightbox via `data-lightbox-id` hook (Phase 10) |
| `video` | content | 12 (min 6) | yes | Dispatches between `<video>` (local file/.mp4) and `<iframe>` (YouTube/Vimeo via `utils/embedUrl`). Restrictive sandbox; autoplay → muted |
| `embed` | embed | 12 (min 6) | yes | **`status: 'beta'`** — generic sandboxed iframe with hardcoded host allowlist (twitter/x, github, codepen, loom, jsfiddle, figma, glitch, replit, youtube, vimeo). Per-instance override planned via `instance_settings.embedAllowlist` |
| `markdown` | content | 12 (min 6) | yes | Sanitised via `@commonpub/docs renderMarkdown` (remark + rehype-sanitize). Server-side render via `useAsyncData`; safer than `custom-html` |
| `custom-html` | embed | 12 (min 3) | yes | **`status: 'beta'`** — admin-only raw HTML escape hatch. Renders via `v-html` without runtime sanitisation; matches legacy `CustomHtmlSection.vue` security baseline. Phase 6b adds DOMPurify at admin-write |
| `cta` | interactive | 12 (min 6) | yes | Heading + body + up to 3 buttons (variants: default/contrast/minimal). URL guard on hrefs |
| `content-feed` | data | 12 (min 6) | yes | Server-backed grid of `<ContentCard>`. Filters: type / sort / limit / tag / featured. 1–4 cols responsive |
| `editorial` | data | 12 (min 6) | yes | Staff Picks grid — `/api/content?editorial=true&sort=editorial`. 1–4 cols responsive |
| `stats` | data | 4 (min 3) | yes | Platform stats: Projects / Posts / Members / Hubs (hubs cell gated on `features.hubs`). Card layout, sidebar-friendly default |
| `hubs` | data | 4 (min 3) | yes | Trending hubs with Join action. Anonymous click → `/auth/login?redirect=/`; auth → POST `/api/hubs/:slug/join`. Feature-gated upstream on `features.hubs` |
| `contests` | data | 4 (min 3) | yes | Active contests with `Nd left` countdown + Enter CTA. Feature-gated upstream on `features.contests` |
| `learning` | data | 12 (min 6) | yes | Learning paths grid (cover image + difficulty + duration + enrollment). Feature-gated upstream on `features.learning` |

All section types the legacy `homepage.sections` renderer dispatched to (`HomepageSectionRenderer.vue`) are now representable as registered sections.

Phase 6b will add the remaining 13 types (spacer, featured-content, content-card, contest-list, hub-list, event-list, member-list, stats-grid, contact-form, newsletter, announcement, iframe, content-grid alias). See `docs/plans/layout-and-pages.md` §3.4.

---

## How a section is defined

Three files. The `divider` section (committed `afd5111`, session 157) is the canonical template.

### 1. The Zod-typed definition

`layers/base/sections/builtin/{type}.ts`:

```ts
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionMy from '../../components/sections/SectionMy.vue';

const configSchema = z.object({
  variant: z.enum(['a', 'b']).default('a'),
  // … other fields …
});

export const mySection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'my-section',          // kebab-case slug, used in LayoutSection.type
  name: 'My section',
  description: 'One-line description shown in the palette',
  icon: 'fa-puzzle-piece',
  category: 'content',          // layout | content | data | interactive | editorial | embed | custom
  status: 'stable',             // stable | beta | deprecated
  configSchema,
  defaultConfig: { variant: 'a' },
  schemaVersion: 1,
  component: SectionMy,
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 6,
  resizable: true,
};
```

### 2. The Vue renderer

`layers/base/components/sections/SectionMy.vue`:

```vue
<script setup lang="ts">
import type { SectionRenderProps } from '@commonpub/ui';

interface MyConfig extends Record<string, unknown> {
  variant: 'a' | 'b';
}

defineProps<SectionRenderProps<MyConfig>>();
</script>

<template>
  <section :data-variant="config.variant" :aria-labelledby="`section-${meta.sectionId}`">
    …
  </section>
</template>

<style scoped>
/* var(--*) only — no hardcoded colors. The registry's no-color-leak test
   greps every component in this directory for hex/rgb/hsl/oklch literals
   and fails the suite on any match. */
</style>
```

### 3. The registry call

`layers/base/sections/registry.ts` adds one line:

```ts
import { mySection } from './builtin/my-section';
// …
registry.register(mySection);
```

The class-level enforcement (in `@commonpub/ui`'s `SectionRegistry`) rejects duplicate type slugs at register time (fail-fast).

---

## Enabling the layout engine on the homepage

The flag defaults OFF and the layouts table starts empty. **As of layer 0.23.3, flipping the flag without seeding first is SAFE** — `pages/index.vue` checks both the flag AND `useLayout('/')` resolves to non-null; if the flag's on but no layout exists, it falls through to the existing configurable / legacy renderer instead of rendering blank `<LayoutSlot>` zones. So the order of operations is flexible.

**Per-instance enable sequence** (recommended order, but step 3 won't break anything if done before step 2):

1. **Run migration 0005** (creates the 4 tables). Skip if already applied — `drizzle-kit` migrator is idempotent.
2. **Seed the homepage layout**: `POST /api/admin/layouts/seed-homepage` (admin auth required; flag must be ON to reach this endpoint — see step 3). `seedHomepageLayout()` creates + publishes a default layout at `('route', '/')` with one hero + one content-feed. Idempotent — returns `{ created: false, layoutId }` on second call.
   - Server-side alternative for ops scripts: `import { seedHomepageLayout } from '@commonpub/server'; await seedHomepageLayout(db, { adminId });`
3. **Flip the flag**: set `features.layoutEngine: true` in the instance's `commonpub.config.ts` (build-time) or via the admin-features API at runtime. (As of layer 0.23.2, admin UI flips persist verbatim — earlier dedup bug that reverted overrides was fixed.)
4. **Verify**: load `/`. The layout-engine branch in `pages/index.vue` resolves to the LayoutSlot zones. Hero shows; content-feed pulls latest published content; the legacy section renderer is bypassed. (If flag is on but layout doesn't exist: page falls back to legacy automatically.)

**Rollback**: flip the flag OFF. The v-else-if branches (configurable section renderer if `hasCustomSections`, else legacy hardcoded) take over. The layouts table is untouched — re-enabling is a flag flip again.

---

## API surface

Public — no auth, gated only by the flag:

```
GET /api/layouts/by-route?path=/some-path  → resolved layout for SSR (60s server cache)
```

When `features.layoutEngine` is OFF, returns 404 (caller falls through to legacy renderers).

Admin — admin auth + flag-gated:

```
GET    /api/admin/layouts                          list (?scope=route|virtual|custom-page)
POST   /api/admin/layouts                          create  *invalidates by-route cache*
GET    /api/admin/layouts/[id]
PUT    /api/admin/layouts/[id]                     update  *invalidates*
                                                   (scope immutable; 400 on change)
DELETE /api/admin/layouts/[id]                     delete (cascade)  *invalidates*
POST   /api/admin/layouts/[id]/publish             snapshot+publish  *invalidates*
GET    /api/admin/layouts/[id]/versions            list versions
POST   /api/admin/layouts/[id]/versions/[versionId]/revert  *invalidates*
POST   /api/admin/layouts/seed-homepage            bootstrap (idempotent)  *invalidates if created*
```

**The cache invariant**: every admin handler that mutates state MUST call `invalidateLayoutsByRouteCache()` from `layers/base/server/utils/layoutCache` before returning. A static contract test (`server/api/admin/layouts/__tests__/handlers-contract.test.ts`) walks the handler tree and asserts this — if you add a new write handler, that test catches a missing invalidation at refactor time.

---

## Rendering — `<LayoutSlot>`

```vue
<LayoutSlot route="/" zone="full-width" />
<LayoutSlot route="/" zone="main" />
<LayoutSlot route="/" zone="sidebar" />
```

The component:

1. Calls `useLayout('/')` → `useFetch('/api/layouts/by-route?path=/')` (SSR-safe).
2. For the named zone, walks rows → sections.
3. Filters: section.enabled, visibility.features (intersected with active flags), visibility.roles (against current user role).
4. For each survivor, looks up `section.type` in the registry → `<component :is="def.component">` with `config` + `meta`. Unknown types render an admin-only placeholder (end users see nothing).
5. Row container is a 12-column CSS Grid; each section gets `grid-column: span N` per breakpoint via `--cpub-section-cols-{sm|md|lg}` custom properties.
6. `previewOverride` prop lets the editor's preview pane inject a draft layout without a save round-trip — single source of truth for editor + production rendering.

---

## Test contract — what each new section ships with

Every section addition is reviewed against three test types:

| Test | Where | What it pins |
|---|---|---|
| **Registry assertion** | `layers/base/sections/__tests__/registry.test.ts` | Section is registered; `defaultConfig` passes its own `configSchema`; rejects an out-of-enum value |
| **Component render** | `layers/base/components/sections/__tests__/Section{Type}.test.ts` | DOM assertions (the right tag, the right attributes, the right text) for default config + a custom config + at least one variant. Per `docs/plans/layout-and-pages.md` §10.2: real DOM, not `wrapper.exists()` |
| **No-color-leak sweep** | (in `registry.test.ts`) | Grep across every `Section*.vue` style block for hex/rgb/hsl/oklch literals — fails the suite on any match. Catches the `var(--*)` discipline at the test layer, not at code review |

For data-driven sections (today: `content-feed`), the test stubs `useFetch` to capture the query + assert the rendered grid.

---

## Common pitfalls

- **`await useFetch` in a section's setup**: don't. The section is rendered inside `<LayoutSlot>` deep in the tree; awaiting top-level would require Suspense on every parent (the page chain isn't set up for that, and the editor preview pane definitely isn't). Use plain `useFetch` and surface pending/empty/loaded states in the template. See `SectionContentFeed.vue` for the canonical non-await pattern.
- **Hardcoded colors**: even one `#fff` in a section component will fail the registry test's color sweep. Always `var(--*)`. Add a new token in `packages/ui/theme/base.css` + `dark.css` if the existing palette is insufficient.
- **Forgot to invalidate the cache on a new admin write route**: the handlers-contract test catches this — assertion message points at the offending file. Import from `server/utils/layoutCache`, not from `api/layouts/by-route.get`.
- **Layer's local `FeatureFlags` interface and `@commonpub/config`'s drift apart**: when adding a new flag, update BOTH `packages/config/src/types.ts` AND `layers/base/composables/useFeatures.ts` (the layer mirror, including `DEFAULT_FLAGS` + the destructure). Session 157 missed this; session 158 fixed it for `layoutEngine`.
- **Tried to seed via `INSERT INTO layouts ...` directly**: don't — `saveLayout` is transactional + generates UUIDs + creates the version row + validates. The `seedHomepageLayout` helper wraps it.

---

## Operator runbook (session 160 additions)

### Three paths into the `layouts` table

Three distinct entry points exist for getting a layout into the database — pick by your starting state.

| Path | When | Endpoint / Trigger | Behavior |
|---|---|---|---|
| **Seed** | Fresh instance, no legacy data | `POST /api/admin/layouts/seed-homepage` | Creates a stub homepage layout (hero + content-feed) if NONE exists. Idempotent — returns `{created:false}` if a layout already exists. Used in developer setup + the create-commonpub CLI scaffolder. |
| **Migrate** | Existing instance with `instance_settings.homepage.sections` JSON | `POST /api/admin/layouts/migrate-homepage` OR the "Migrate homepage to layout" CTA on `/admin/layouts` (R3 audit) | Converts the legacy JSON into a layout row matching the live homepage. Skip-if-exists by default; `{force: true}` deletes and recreates (destructive — kills publish history; R4 deferred work to use saveLayout-by-id instead). |
| **Auto-sync** | Existing instance, operator still edits `/admin/homepage` | Hook in `PUT /api/admin/homepage/sections` (R4 audit changed `force: true → false`) | First save creates the layout (idempotent, non-destructive). Subsequent saves DO NOT touch the layout — preserves bespoke layout-engine edits. |

### Fresh-instance flow

1. `docker compose up -d` (Postgres + Redis + Meilisearch)
2. `pnpm install && pnpm build`
3. Run migrations: `cd apps/reference && pnpm exec drizzle-kit migrate` (applies 0001 through 0005)
4. Set environment: `NUXT_PUBLIC_FEATURES_LAYOUT_ENGINE=true` (see [[feedback-nuxt-env-only-declared-keys]])
5. Start the server: `pnpm dev`
6. Open `/admin/layouts` → empty state → click **"Migrate homepage to layout"** → operator's stub layout appears

### Existing-instance flow (`instance_settings.homepage.sections` populated)

1. Apply migration 0005: `pnpm exec drizzle-kit migrate` — adds 4 tables
2. Flip the flag: `NUXT_PUBLIC_FEATURES_LAYOUT_ENGINE=true` and restart
3. Either: hit the **"Migrate homepage to layout"** CTA on `/admin/layouts` once → layout created from current legacy sections
4. Or: just save any change in `/admin/homepage` once with the flag on → auto-sync creates the layout (non-destructive after R4)
5. Open the new layout in `/admin/layouts/[id]` → bespoke edits from this point forward are preserved against subsequent legacy saves

### Rollback

| Scenario | Action |
|---|---|
| Editor regresses | `DELETE FROM layouts WHERE scope_type='route' AND scope_key='/'` — auto-fallback to legacy renderer kicks in within 60s (cache TTL) |
| Flag flip-off | `NUXT_PUBLIC_FEATURES_LAYOUT_ENGINE=false` + restart → public endpoint returns 404 → catch-all + homepage v-if fall back to legacy. Migration 0005 stays in place. |
| Permanent revert | Drop the tables: `DROP TABLE layout_versions, layout_sections, layout_rows, layouts CASCADE;` then drizzle-kit's status will show migration 0005 as pending. Re-apply on flag flip-on. |

### Cache + concurrency model

- **Cache**: Per-pod in-memory `Map` with **60s TTL** and **1000-entry bounded LRU** (R4 fix). Key trifurcated by tier: `admin:<path>` / `members:<path>` / `anon:<path>` (R3 fix prevents draft + access-restricted layouts leaking across tiers).
- **Invalidation**: every write handler calls `invalidateLayoutsByRouteCache()` — full clear. The handlers-contract test locks this across all 7 write handlers.
- **Multi-pod note**: each pod has its own cache, so after a write the other pods serve the previous version for up to 60s. Acceptable for v1; Phase 10 replaces with ETag-based revalidation.
- **Optimistic concurrency**: the editor sends `If-Match: <updatedAt>` on every save (R2). Server returns 409 on mismatch + `{code: 'LAYOUT_CONFLICT'}`. The client surfaces a 3-option modal (Reload their version / Keep editing here / Overwrite their changes).
- **Single-flight save**: client-side guard prevents parallel `save()` calls from sending PUTs with the same stale If-Match (R2 fix).

### Access tiers + draft visibility

- `state === 'draft'` → only `admin` users see the payload via `/api/layouts/by-route`. Non-admins see null (P0 R2 fix).
- `pageMeta.access === 'public'` → anyone sees it (default)
- `pageMeta.access === 'members'` → only authenticated users see it
- `pageMeta.access === 'admin'` → only admins see it (R3 added server-side enforcement parallel to the catch-all's client check)

Combined: `admin && state==='draft'` is the only path to draft visibility. Cache key bifurcation prevents cross-tier leak.

### Audit / forensic trail

All 7 destructive admin paths emit structured stdout audit logs prefixed `cpub.audit.layout.*`. Greppable:

```bash
docker logs commonpub-app-1 2>&1 | grep cpub.audit.layout
```

| Event | Triggered by | Fields |
|---|---|---|
| `cpub.audit.layout.create` | POST `/api/admin/layouts` | `adminId, layoutId, scope, name, state` |
| `cpub.audit.layout.delete` | DELETE `/api/admin/layouts/[id]` | `adminId, layoutId, scope, name, state` |
| `cpub.audit.layout.force-save` | PUT `/api/admin/layouts/[id]` with `X-Cpub-Force-Save: 1` header (the "Overwrite their changes" modal action) | `adminId, layoutId, scope, previousUpdatedAt` |
| `cpub.audit.layout.publish` | POST `/api/admin/layouts/[id]/publish` | `adminId, layoutId, scope, versionId` |
| `cpub.audit.layout.revert` | POST `/api/admin/layouts/[id]/versions/[versionId]/revert` | `adminId, layoutId, scope, versionId` |
| `cpub.audit.layout.seed-homepage` | POST `/api/admin/layouts/seed-homepage` (only when result.created === true) | `adminId, layoutId` |
| `cpub.audit.layout.migrate-homepage` | POST `/api/admin/layouts/migrate-homepage` | `adminId, migrated, force, layoutId, reason` |

### Homepage scope is special

Deleting the `('route', '/')` layout requires the `X-Cpub-Confirm-Homepage-Delete: 1` header (R4 fix). The list-page UI sets it after a SECOND confirm() — admin sees two prompts when deleting the homepage layout (defense in depth against direct API calls).

### Validation contracts

Per-section configSchema enforcement at the API boundary is currently **DEFERRED** — the validator (`layers/base/server/utils/validateSectionConfigs.ts`) is implemented + tested but un-wired because the registry import transitively pulls `.vue` components which Nitro's server bundle can't parse. Proper fix in `docs/sessions/160-audit-round2-deep.md`: move per-section Zod schemas to `@commonpub/schema` (server-safe), then wire the validator. Residual risk while deferred: admin can craft section.config to bypass URL guards / size caps / sandbox flags. Mitigated by admin-only auth + audit logs.

Top-level `layoutCreateSchema` (`packages/schema/src/validators.ts`) enforces overall shape + array bounds (R2 fix): zones `.max(16)`, rows `.max(200)` per zone, sections `.max(24)` per row.
