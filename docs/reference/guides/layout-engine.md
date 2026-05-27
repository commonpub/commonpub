# Layout Engine

> DB-stored, admin-editable page layouts composed from a registry of section components. Powers the homepage today (Phase 1c); future phases extend to hub pages, blog indexes, the footer, the 404, and admin-authored custom pages.

**Status**: Phase 1c (session 158). Feature-flagged OFF by default — `features.layoutEngine`. Operators flip ON per-instance after running the homepage seed endpoint.

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

Built-in sections shipped today (Phase 1c starter catalog):

| Type slug | Category | Default colSpan | Resizable | Notes |
|---|---|---|---|---|
| `divider` | layout | 12 | no | Horizontal rule. Variants: solid / dashed / dotted / accent |
| `hero` | layout | 12 (min 6) | yes | Title (h1) + optional eyebrow + subtitle + up to 2 CTAs. Variants: default / compact / centered |
| `heading` | content | 12 (min 3) | yes | h1–h4 + optional eyebrow + subline. Align left/center |
| `paragraph` | content | 6 (min 3) | yes | Plain prose, blank-line split into `<p>`. Phase 3e upgrades to TipTap subset via `.describe('rich')` |
| `image` | content | 12 (min 3) | yes | `<img>` lazy-loaded, optional `<a href>` wrap, optional caption. Fit + aspect ratio |
| `content-feed` | data | 12 (min 6) | yes | Server-backed grid of `<ContentCard>`. Filters: type / sort / limit / tag / featured. 1–4 cols responsive |

Phase 6b adds the remaining 20 types (gallery, video, embed, spacer, cta, featured-content, content-card, contest-list, hub-list, event-list, member-list, stats-grid, contact-form, newsletter, announcement, markdown, custom-html, iframe, editorial). See `docs/plans/layout-and-pages.md` §3.4.

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

The flag defaults OFF and the layouts table starts empty. If you flip the flag before seeding, the homepage's v-if branch renders empty zones.

**Per-instance enable sequence**:

1. **Run migration 0005** (creates the 4 tables). Skip if already applied — `drizzle-kit` migrator is idempotent.
2. **Seed the homepage layout**: `POST /api/admin/layouts/seed-homepage` (admin auth required; flag must be ON to reach this endpoint — see step 3). `seedHomepageLayout()` creates + publishes a default layout at `('route', '/')` with one hero + one content-feed. Idempotent — returns `{ created: false, layoutId }` on second call.
   - Server-side alternative for ops scripts: `import { seedHomepageLayout } from '@commonpub/server'; await seedHomepageLayout(db, { adminId });`
3. **Flip the flag**: set `features.layoutEngine: true` in the instance's `commonpub.config.ts` (build-time) or via the admin-features API at runtime.
4. **Verify**: load `/`. The `v-if='layoutEngineEnabled'` branch in `pages/index.vue` resolves to the LayoutSlot zones. Hero shows; content-feed pulls latest published content; the legacy section renderer is bypassed.

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
