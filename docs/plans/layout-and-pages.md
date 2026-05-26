# Layout + Pages — Deep Plan

**Status**: design only. Not yet scheduled. Replaces ad-hoc "future scenes" notes scattered through session 154 + the theme-editor LLM ref.

**Why now**: session 154 shipped the admin theme editor and stubbed a "pluggable scene picker" with the explicit intention of growing into layout editing. This document is the architectural contract for that next phase, including a thorough test strategy that audits what session 154 left thin and specifies what every new piece must prove before it ships.

**Audience**: the next maintainer (probably me-future or another agent) picking this up.

---

## 1. Vision + scope

CommonPub admins should be able to, without writing code:

1. **Edit the layout of any built-in page** — the homepage already has a section editor; extend the same model to hub pages, blog/project indexes, profiles, search, the explainer landing, the docs landing, the 404, the footer.
2. **Create new pages from scratch** — `/about`, `/team`, `/contact`, campaign landings, member-only resource hubs. These pages live in the database, not as `.vue` files in the layer.
3. **Compose pages from a library of sections** — hero, content feed, contact form, gallery, embed, custom HTML, etc. The library is extensible: the thin layer app (or a future code-registered theme bundle) can register additional section types.
4. **Preview live** before publishing — light/dark, mobile/desktop, with the in-progress theme applied.
5. **Version + revert** — layouts have draft / published states with rollback.

**Out of scope** (called out so we don't drift into them):

- **A full visual page builder (drag-and-drop on a canvas)** — Phase 8+. Phase 1–6 deliver a form-based editor that's still complete and usable.
- **i18n / per-locale layouts** — design must not preclude it, but no implementation in v1.
- **A/B testing of layouts** — same as above.
- **Federation of layouts** — layouts are instance-local, like docs.
- **Re-skinning federated content cards via layouts** — out of scope; they always render through the canonical component (per `feedback_view_identity_classes`).

---

## 2. What exists today (informs every decision)

Read this section before second-guessing the schema choices below.

### 2.1 Homepage section system (the model to generalise)

- **Schema**: `instance_settings.homepage.sections` JSON array (key/value, no dedicated table).
- **Type**: `HomepageSection { id, type, title?, enabled, order, config }` — see `packages/server/src/homepage/homepage.ts:18`.
- **Renderer**: `layers/base/components/homepage/HomepageSectionRenderer.vue` — a long `v-if` chain dispatching by `section.type`.
- **Zone hack**: zones (`full-width`, `main`, `sidebar`) are derived from section type via hardcoded sets in the renderer. Not user-controllable.
- **8 built-in section types**: hero, editorial, content-grid, contests, hubs, learning, stats, custom-html.
- **Admin UI**: `/admin/homepage` lets admins enable/disable, reorder, and configure sections.
- **Default**: `DEFAULT_SECTIONS` (homepage.ts:30) — used when no admin override exists.
- **API**: `GET/PUT /api/admin/homepage/sections`.

This is the prototype. Generalising it is most of the work.

### 2.2 Navigation editor

- **Schema**: another `instance_settings` key (`navigation.items`).
- **Pattern**: same JSON-array-in-settings approach.
- **Lesson learned**: ad-hoc renderer per surface (`<NavRenderer>` for nav, `<HomepageSectionRenderer>` for homepage) — duplication that the generalised layout engine will collapse.

### 2.3 Block-based content (TipTap)

- **Schema**: `contentItems.content` is `BlockTuple[]` for articles/projects/explainers/docs (per CLAUDE.md rule 4).
- **Renderer**: `BlockContentRenderer` dispatches to `Block*View` components by tuple `type`.
- **Different from layouts**: block content is *inside* a content page; layouts compose *the page itself*. But the section-registry pattern below MIRRORS the block-registry pattern — admins who've used the content editor will feel at home.

### 2.4 File-based routing

- **Layer pages**: `layers/base/pages/*.vue` (85+ pages). Bundled at build time.
- **Thin app pages**: thin apps can add their own `pages/` directory — Nuxt merges layer + app routes.
- **Catch-all routes**: NOT used in the layer today. `pages/[...path].vue` doesn't exist.
- **Constraint**: any DB-stored page system MUST coexist with file-based routes without taking over their URLs.

### 2.5 Theme editor scene picker (session 154)

- Shipped with 3 scenes (gallery / prose / admin shell).
- The picker is the architectural seed for `'page-layout'` (mockup) and `'iframe-route'` (real route) scenes.
- This plan finally cashes in that seed.

---

## 3. The architectural shape

### 3.1 Three page sources (mirrors theme sources)

| Source | Origin | Editable? | Examples |
|---|---|---|---|
| **File-routed** | `layers/base/pages/*.vue` shipped by the layer | No (only via code fork) | `/admin/*`, `/settings/*`, `/auth/*`, content viewers |
| **Code-registered** | thin app's `pages/*.vue` | No | community-specific pages |
| **DB-custom** | created in the admin editor | Yes | `/about`, `/team`, landing pages |

Priority on URL conflicts: file-routed > code-registered > DB-custom. Conflict detection on save (see §6.4).

### 3.2 Layout-bearing routes (the editable surface for built-in pages)

Even file-routed pages can have an editable LAYOUT for sections that compose their body. Think of the page's `.vue` file as the FRAME and the layout DB row as the FILLINGS:

```vue
<!-- pages/index.vue (the frame — code) -->
<template>
  <LayoutSlot route="/" zone="full-width" />
  <div class="cpub-content-grid">
    <LayoutSlot route="/" zone="main" />
    <aside><LayoutSlot route="/" zone="sidebar" /></aside>
  </div>
</template>
```

The same code page is now layout-editable per route: `<LayoutSlot>` resolves the active layout from the DB, fetches the sections for the named zone, and renders them. The existing `HomepageSectionRenderer` is the v0 of `LayoutSlot`.

**Editable layout-bearing routes shipped in v1** (concrete list — keeps scope visible):
- `/` (homepage) — migrates from `HomepageSectionRenderer`
- `/hubs/[slug]` (hub home) — sidebar + main
- `/blog` (blog index) — sidebar
- `/projects` (project index) — sidebar
- `/learn` (learning index) — sidebar
- `/u/[username]` (profile) — sidebar
- The site footer (a virtual route `__footer`)
- The 404 page (a virtual route `__not-found`)

Each layout-bearing route declares its zones in code (the page's `.vue` is the schema). The admin can only place sections in declared zones — no surprise renders.

### 3.3 Layout schema

A single shape covers both "edit a built-in page's layout" and "compose a custom page". The schema has THREE nested layers — **zone → row → section** — so the editor can express a visual grid that admins can drag and resize:

```typescript
interface Layout {
  id: string;
  scope:
    | { type: 'route'; path: string }                  // existing file-routed page
    | { type: 'virtual'; key: '__footer' | '__not-found' | '__error' }
    | { type: 'custom-page'; path: string };           // new DB-stored page
  name: string;
  /** Page-level metadata. Required for custom-page; optional for route. */
  page?: PageMeta;
  /** Zones (declared by the page's frame) hold rows; rows hold sections. */
  zones: LayoutZone[];
  state: 'draft' | 'published';
  publishedVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

interface LayoutZone {
  /** Zone slug — must match a slot the page exposes ('main', 'sidebar', 'full-width', …). */
  zone: string;
  rows: LayoutRow[];
}

interface LayoutRow {
  id: string;
  /** Order within zone. Renumbered to {0..n} server-side on every write. */
  order: number;
  /** Per-row styling — gap, vertical alignment, optional background tone. */
  config?: {
    gap?: 'none' | 'sm' | 'md' | 'lg';
    align?: 'start' | 'center' | 'stretch';
    /** A token reference, never a literal — e.g. 'var(--surface2)'. */
    background?: string;
    /** Optional vertical padding override. */
    paddingY?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  };
  sections: LayoutSection[];
}

interface LayoutSection {
  id: string;
  order: number;
  /** Section type — resolves in the SECTION_REGISTRY (built-in or registered). */
  type: string;
  /** Section-specific config — validated against the section's Zod schema. */
  config: Record<string, unknown>;
  /** Default column span (1-12). Auto-flows left-to-right in the row. */
  colSpan: number;
  /** Responsive overrides. Falls through: lg ↦ md ↦ sm ↦ colSpan. */
  responsive?: {
    /** ≤ 640px (mobile). Default: 12 (full width) so rows stack cleanly. */
    sm?: number;
    /** ≤ 1024px (tablet). Default: colSpan. */
    md?: number;
    /** > 1024px (desktop). Default: colSpan. */
    lg?: number;
  };
  enabled: boolean;
  visibility?: {
    roles?: ('anonymous' | 'member' | 'pro' | 'verified' | 'staff' | 'admin')[];
    features?: string[];
    /** Hide entirely below these breakpoints (different from responsive colSpan). */
    hideAt?: ('sm' | 'md' | 'lg')[];
  };
  schemaVersion: number;
}

interface PageMeta {
  title: string;
  description?: string;
  ogImage?: string;
  noindex?: boolean;
  ogType?: 'website' | 'article' | 'profile';
  access?: 'public' | 'members' | 'admin';
  /** Page frame — which zones exist and how wide. Each frame declares its grid. */
  frame?: 'narrow' | 'wide' | 'two-column' | 'three-column' | 'sidebar-left' | 'sidebar-right';
}
```

**Invariants enforced server-side**:

1. Sum of `colSpan` within a row must be ≤ 12 (excess wraps to a new visual row at render time; the editor prevents authoring this state).
2. Each section has `1 ≤ colSpan ≤ 12` AND `colSpan` is within the section type's `[minColSpan, maxColSpan]` from the registry.
3. `responsive.sm/md/lg` each obey the same bounds.
4. `order` within a row + `order` within a zone is renumbered to `{0..n}` on every write — clients can send any integers; the server normalises.
5. Each row in the same zone has a unique `order`; ditto for sections within a row.

### 3.4 Section registry

Sections are Vue components plus metadata. Each section's metadata is:

```typescript
interface SectionDefinition<TConfig extends Record<string, unknown>> {
  /** Unique slug. Used in `LayoutSection.type` + URLs. */
  type: string;
  /** Display name shown in the section palette. */
  name: string;
  /** One-line description shown under the name. */
  description: string;
  /** Font Awesome icon class. */
  icon: string;
  /** Category for the palette grouping. */
  category: 'layout' | 'content' | 'data' | 'interactive' | 'editorial' | 'embed' | 'custom';
  /** Zod schema for the section's `config`. Drives the auto-generated config form. */
  configSchema: z.ZodType<TConfig>;
  /** Default config when the admin first adds the section. */
  defaultConfig: TConfig;
  /** Current schema version. Bump when configSchema breaks. */
  schemaVersion: number;
  /** Renderer Vue component. Receives `config: TConfig` + `meta: { route, zone, isPreview }`. */
  component: Component;
  /** Optional migrations: oldVersion → newConfig. */
  migrations?: Record<number, (oldConfig: Record<string, unknown>) => TConfig>;
  /** Which feature flag must be ON for this section to appear in the palette. */
  featureGate?: string;
  /** Which zones this section is allowed in. Default: all. */
  allowedZones?: string[];
  /** Preview screenshot URL (optional). Shown in the palette tile. */
  previewImage?: string;
}
```

**Built-in sections shipped in v1** (concrete list):

| Type slug | Category | What |
|---|---|---|
| `hero` | layout | Big banner + heading + CTA (variant: `default` | `compact` | `centered`) |
| `heading` | content | Single heading (h1–h4) with optional eyebrow + subline |
| `paragraph` | content | Rich-text paragraph (TipTap subset — no embeds) |
| `image` | content | Single image with caption + link |
| `gallery` | content | Image grid (2–5 columns, lightbox) |
| `video` | embed | Local video or YouTube/Vimeo embed |
| `embed` | embed | oEmbed URL (Twitter/X, GitHub, CodePen, Loom, etc.) |
| `divider` | layout | Horizontal rule (variant: solid / dashed / dotted / accent) |
| `spacer` | layout | Vertical space (sm / md / lg / xl) |
| `cta` | interactive | Heading + paragraph + button(s) |
| `content-feed` | data | Filterable feed (type, tag, hub, sort, limit, columns) |
| `featured-content` | data | Curated single piece of content with cover |
| `content-card` | data | Single content piece, compact card |
| `contest-list` | data | Active contests (gated `contests`) |
| `hub-list` | data | Trending or featured hubs (gated `hubs`) |
| `event-list` | data | Upcoming events (gated `events`) |
| `member-list` | data | Recent or featured members |
| `stats-grid` | editorial | Platform stats (members, content, federated) |
| `contact-form` | interactive | Email contact form (sends to `contactEmail`) |
| `newsletter` | interactive | Email capture (integrates with email adapter) |
| `announcement` | editorial | Dismissible banner (tone: info / warning / success) |
| `markdown` | content | Markdown body (sanitised) |
| `custom-html` | custom | Raw HTML (sanitised via `@commonpub/explainer`'s sanitizer) |
| `iframe` | embed | External iframe (URL must match `iframe-allowlist` instance setting) |
| `editorial` | editorial | Staff-picks grid (existing) |

That's 25. Each has its own Vue component + Zod schema + default config + Vitest tests. **The catalogue size is the work**, not the registry mechanism — the registry itself is small.

### 3.5 LayoutSlot component (the renderer)

Pages call `<LayoutSlot route="/" zone="main" />`. The slot:

1. Reads the active layout for the route from `useLayout('/')` (a composable wrapping a cached `/api/layouts/by-route?path=/` fetch).
2. For the named zone, walks rows → sections; filters by enabled + visibility (role / feature / breakpoint via `hideAt`).
3. Renders rows as CSS Grid containers (12-column grid; gap from `row.config.gap`); renders each section into `grid-column: span N` where N is the resolved responsive colSpan.
4. Errors gracefully on unknown section types (logs once, renders an admin-only placeholder, end users see nothing).
5. Supports `previewOverride` prop for editor preview — injects an in-progress layout instead of the saved one. **The editor's canvas IS a `<LayoutSlot :previewOverride :editable>` instance** — same component, edit mode toggled. Single source of truth for rendering.

`<LayoutSlot>` replaces `<HomepageSectionRenderer>`, `<NavRenderer>`, and any future per-surface dispatcher. One renderer, many surfaces.

### 3.6 Grid system + responsive breakpoints

**12-column CSS Grid, mobile-first.** Every row is a `display: grid; grid-template-columns: repeat(12, 1fr); gap: <row.config.gap>` container. Sections occupy `grid-column: span N` per breakpoint.

**Breakpoints** — match the design tokens we already ship:

| Slug | Width | Default colSpan |
|---|---|---|
| `sm` | ≤ 640px (phones) | **12** (full width — rows stack) |
| `md` | 641–1024px (tablets) | inherits `colSpan` |
| `lg` | > 1024px (desktop) | `colSpan` |

**Resolution rule**: `effectiveColSpan(section, vw) = section.responsive[vw] ?? (smaller breakpoint chain) ?? section.colSpan`. With mobile defaulting to 12, rows ALWAYS stack on phones unless an admin explicitly overrides — which is the right default for content sites.

**Why 12 columns, not free-form pixels**:

- Universal mental model (Bootstrap, Tailwind, every design tool)
- Resize snaps to discrete stops (1/12 increments) — no fiddly pixel-perfect dragging
- Trivially responsive — same grid scales 320px → 1920px
- Source order preserved → screen readers + SEO see sections in author intent order, no `absolute` positioning footguns

**Section registry constraint**:

```typescript
interface SectionDefinition<TConfig> {
  …
  /** Minimum colSpan this section's content tolerates. Hero = 6, paragraph = 3, divider = 12, etc. */
  minColSpan: number;
  /** Maximum colSpan. Almost always 12. Set lower if the section breaks at full width (rare). */
  maxColSpan: number;
  /** Initial colSpan when dropped into a row. */
  defaultColSpan: number;
  /** Whether the section can be resized at all. False = always `defaultColSpan`. (Used by divider/spacer.) */
  resizable: boolean;
}
```

Resize is bounded by `[minColSpan, maxColSpan]` AND by what fits in the row. Dragging a section narrower expands its right-neighbour; dragging wider shrinks the neighbour (down to its `minColSpan`); past that, the resize stops with a haptic-style snap.

---

## 4. Database schema

### 4.1 Tables

```sql
-- layouts: one row per route or custom page
create table layouts (
  id uuid primary key default gen_random_uuid(),
  scope_type varchar(32) not null,           -- 'route' | 'virtual' | 'custom-page'
  scope_key varchar(512) not null,           -- the path or virtual key
  name varchar(256) not null,
  page_meta jsonb,
  state varchar(16) not null default 'draft',
  published_version_id uuid references layout_versions(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_type, scope_key)
);

create index idx_layouts_scope on layouts (scope_type, scope_key);

-- layout_rows: a row groups sections horizontally inside a zone
create table layout_rows (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references layouts(id) on delete cascade,
  zone varchar(64) not null,
  position integer not null,
  config jsonb,                                -- gap / align / background / paddingY
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (layout_id, zone, position)
);

create index idx_layout_rows_layout on layout_rows (layout_id, zone, position);

-- layout_sections: a section lives in exactly one row
create table layout_sections (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references layout_rows(id) on delete cascade,
  position integer not null,                   -- order within row, left-to-right
  enabled boolean not null default true,
  type varchar(128) not null,
  config jsonb not null default '{}',
  col_span integer not null default 12 check (col_span between 1 and 12),
  responsive jsonb,                            -- { sm?: 1-12, md?: 1-12, lg?: 1-12 }
  visibility jsonb,                            -- roles / features / hideAt
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (row_id, position)
);

create index idx_layout_sections_row on layout_sections (row_id, position);
create index idx_layout_sections_type on layout_sections (type);  -- powers per-type migrations

-- layout_versions: immutable snapshots for revert + audit
create table layout_versions (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references layouts(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,                     -- full Layout shape (nested zones→rows→sections) at publish time
  published_by uuid references users(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (layout_id, version)
);

create index idx_layout_versions_layout on layout_versions (layout_id, version desc);
```

**Migration**: `0005_layout_engine.sql`. Bumps migration count from 5 → 6.

**Read pattern**: a single query joins layouts → rows → sections, ordered by `rows.position, sections.position`. The route resolver returns a nested `Layout` object so the client doesn't make N+1 calls. Drizzle's relational query API handles this cleanly.

**Write pattern**: editor sends the WHOLE zones array; server diffs against current state inside a transaction and issues minimal inserts/updates/deletes. Position fields are renumbered to `{0..n}` on every write so clients can send any integers and the canonical order is deterministic.

### 4.2 Why normalised sections, not JSON-in-column

Homepage's current JSON-in-settings approach is fine for one short list. For v1 we'll have:
- 1 layout per layout-bearing route (~10 in the layer) + N custom pages
- Each layout has ~5–30 sections
- Reordering happens often
- Section config can be large (custom HTML, embedded content)

A normalised section table:
- Lets us index, paginate, and reorder without rewriting whole JSON blobs
- Makes section-level RLS / permission checks cheaper
- Makes section-config schema migrations a `UPDATE WHERE type = 'foo' AND schema_version < 3` instead of every-layout JSON walk

JSON-in-settings stays for the homepage transition period (legacy flag).

### 4.3 Migration of the existing homepage

The migration script (idempotent, runs once at deploy time):

1. Read `instance_settings.homepage.sections`. If absent, use `DEFAULT_SECTIONS`.
2. Create a `layouts` row with `scope = ('route', '/')`, `state = 'published'`.
3. For each section in the old array, INSERT a `layout_sections` row with `zone` derived from the existing zone-mapping (`HomepageSectionRenderer.SIDEBAR_TYPES` / `FULL_WIDTH_TYPES`) and `position` = original `order`.
4. Snapshot the result into `layout_versions` v1.
5. Update the old `homepage.sections` key in-place to `{ migrated: true, layoutId: <uuid> }` so re-runs are no-ops.
6. Feature flag `features.layoutEngine`: when ON, the renderer reads from `layouts`; when OFF, the legacy `homepage.sections` path stays live. Flag flips per-instance during rollout.

The rollback path: flag → OFF, restore `homepage.sections` from the most recent `layout_versions.snapshot` mapped back. Scripted in `scripts/rollback-layout-engine.mjs`.

---

## 5. API surface

```
GET    /api/layouts/by-route?path=/                  → resolve a route's active layout (public — used by SSR)
GET    /api/admin/layouts                            → list all layouts (paginated, with scope filter)
POST   /api/admin/layouts                            → create a layout (custom page or new layout for a route)
GET    /api/admin/layouts/:id                        → fetch one (draft state included)
PUT    /api/admin/layouts/:id                        → update draft (auto-save target)
DELETE /api/admin/layouts/:id                        → delete (only custom-page or virtual; routes refuse delete)
POST   /api/admin/layouts/:id/publish                → snapshot draft → version; set published_version_id
GET    /api/admin/layouts/:id/versions               → list versions
POST   /api/admin/layouts/:id/versions/:versionId/revert → snapshot → draft

GET    /api/sections                                 → list registered section types (with categories + previews + Zod schemas as JSON-Schema)
POST   /api/admin/layouts/:id/sections                → insert section (with default config)
PUT    /api/admin/layouts/:id/sections/:sectionId    → update section (config, enabled, visibility, zone)
POST   /api/admin/layouts/:id/sections/reorder       → bulk reorder within zones
DELETE /api/admin/layouts/:id/sections/:sectionId    → remove
```

Auth: every `/api/admin/layouts/*` route requires admin + the `layoutEngine` feature flag.

The public `GET /api/layouts/by-route` is cached client-side (5 min) and server-side (60s, invalidated on save). The shape is the smallest thing the renderer needs — only enabled + visible sections, ordered.

---

## 6. Routing — the catch-all

### 6.1 The problem

Custom pages live in the DB. Nuxt uses file-based routing. The bridge is a Nuxt catch-all `pages/[...customPath].vue` that:

1. Runs LAST in Nuxt's route precedence (file-defined routes win automatically).
2. Looks up the path in `layouts` where `scope_type = 'custom-page'`.
3. If found: render the layout with `<LayoutSlot>`s based on `page_meta.frame`.
4. If not found: throw a 404 via `createError({ statusCode: 404 })` — handled by `error.vue`.

### 6.2 Conflict detection on save

When admin tries to save a custom page at `/about`:

1. Server normalises path (`/about/`, `about` → `/about`; reject queries, fragments, double slashes).
2. Cross-check against the in-memory list of file-routed paths (built from Nuxt's `routes()` manifest at startup, stored on `event.context.fileRoutes`).
3. Reject save with 409 if file-routed path exists.
4. Reject save with 409 if another `custom-page` layout already has this path.
5. Reject save if path starts with reserved prefixes: `/api`, `/_nuxt`, `/__nuxt`, `/.well-known`.

**The file-routes manifest** is built at startup by walking Nuxt's compiled route table and stripping dynamic segment markers. It's exposed via `useNuxtFileRoutes()` so both the catch-all and the admin save handler agree on the same list.

### 6.3 Path normalisation rules

```
input            → normalised
/about           → /about
/about/          → /about
about            → /about
//about//team    → /about/team    (collapses + adds leading slash)
/About           → /about         (lowercase)
/about?ref=x     → reject (no query)
/about#section   → reject (no fragment)
/api/foo         → reject (reserved)
/                → reject (homepage is a route-scope layout, not a custom page)
```

These rules are codified in `pathNormalize(input): string` with full Vitest coverage.

### 6.4 Render path for a custom page

```
Browser GET /about
  ↓ Nuxt catch-all `[...customPath].vue`
  ↓ definePageMeta + setResponseStatus(found ? 200 : 404)
  ↓ useFetch('/api/layouts/by-route', { query: { path: '/about' } })
  ↓ If layout found:
      ↓ useSeoMeta from page_meta
      ↓ access check: 'public' / 'members' / 'admin'
      ↓ render <DynamicFrame :frame="page_meta.frame">
        ↓ <LayoutSlot v-for="zone in frame.zones" :route="/about" :zone="zone" />
  ↓ If not found:
      ↓ throw createError({ statusCode: 404 })
      ↓ error.vue takes over
```

---

## 7. Admin editor UX — visual canvas with drag, drop, resize

The editor is a **visual canvas, not a form list**. Admins see what their visitors will see, manipulate it directly, and never juggle abstract section IDs. Drag-and-drop and resize are first-class — they are how the editor WORKS, not features bolted on. Mobile-first means the editor itself is usable on a tablet; the OUTPUT is responsive on every device.

The guiding principles:

- **WYSIWYG, not WYSI-approximately-What**: the canvas is the same `<LayoutSlot>` that renders production — toggled to `:editable`. What you see IS what ships.
- **Direct manipulation**: click a section, see its handles; drag it, watch it move; drag its edge, watch it resize. No abstraction layer.
- **Pointer-event-native**: one event model for mouse, touch, and pen. No "desktop edition" vs "mobile edition" code paths.
- **Keyboard-equivalent for every gesture**: drag-and-drop is famously bad for a11y; we make every drag operation reachable via Tab + Space + Arrow + Enter.
- **Snap to grid, always**: resize snaps to 12-column stops. No fiddly half-pixel widths. No "almost aligned".
- **Undo absolutely everything**: every operation that touches state is undoable. The history clears only on Save.
- **No UI library, no drag library**: pointer events + CSS Grid handle this in a few hundred LOC. We own the contract end-to-end.

### 7.1 Page structure

```
/admin/pages
  list — three groups (routes, custom pages, virtuals) with quick edit / publish state per row

/admin/pages/[id]
  the editor itself — single full-bleed canvas surface
```

### 7.2 Editor layout — desktop (≥ 1024px)

```
┌─ Top toolbar ──────────────────────────────────────────────────────────────┐
│ ‹ Pages  ·  About (custom-page) /about  ·  [Mobile|Tablet|Desktop]  ·  ⤺⤻ │
│                                  Auto-saved 3s ago · Preview ▸ Save Publish│
├─ Sidebar ─────┬─ Canvas ───────────────────────────────────────────────────┤
│ ✦ Add         │ ┌─ Row · gap-md ──────────────────────────────────────┐   │
│ ─────         │ │ ┌─ Hero (12/12) ───────────────────────────────┐    │   │
│ Layout        │ │ │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │   │
│ • Hero        │ │ │  Welcome to our community                    │    │   │
│ • Heading     │ │ │  [ CTA button ]                              │    │   │
│ • Divider     │ │ └─────────────────────────────────────────┐────┘    │   │
│ • Spacer      │ └────────────────────────────────────────────────────┘   │
│               │ ┌─ Row · gap-md ──────────────────────────────────────┐   │
│ Content       │ │ ┌─ Image (6/12) ──┐│┌─ Paragraph (6/12) ──────────┐│   │
│ • Paragraph   │ │ │   IMG           ║│Lorem ipsum dolor sit amet…  ││   │
│ • Image       │ │ │                 ║│                              ││   │
│ • Gallery     │ │ └─────────────────┘│└──────────────────────────────┘│   │
│ • Video       │ └────────────────────────────────────────────────────┘   │
│               │ ┌─ Row drop-target ─────────────────────────────────┐    │
│ Data          │ │            + Drop a section here                  │    │
│ • Content fed │ └────────────────────────────────────────────────────┘   │
│ • Hub list    │ [ + Add row ]                                            │
│ • …           │                                                          │
│               │ ◂ Zone: Main ▸  (tabs for: Main · Sidebar · Footer)    │
│ Search…       │                                                          │
├───────────────┴──────────────────────────────────────────┬───────────────┤
│ Inspector (right) — context-sensitive                      │              │
│ Section selected → auto-form for its Zod config            │              │
│ Row selected → row config (gap, align, background)         │              │
│ Nothing selected → page meta (title, slug, frame, access) │              │
└────────────────────────────────────────────────────────────┴─────────────┘
```

### 7.3 The eight direct-manipulation gestures

Each gesture works with mouse, touch, and pen via pointer events. Each has a keyboard equivalent.

| # | Gesture | Result | Keyboard |
|---|---|---|---|
| 1 | **Tap/click a section** | Selects it; inspector shows its config | Tab to section, Enter |
| 2 | **Drag a section's grab handle** (top-left) horizontally within a row | Reorder within row; drop indicator (vertical line) shows landing position | Focus + Space to pick up; Arrow ←/→ to move; Space to drop |
| 3 | **Drag a section's grab handle vertically across rows** | Move to another row; row drop targets highlight | Focus + Space; Arrow ↑/↓ to move between rows; Space |
| 4 | **Drag a section's right edge (resize handle)** | Resize colSpan in 1/12 increments; right-neighbour auto-shrinks | Focus + Shift+Arrow ←/→ to resize one col at a time |
| 5 | **Drag a row's grab handle** (top-left of row) vertically | Reorder rows in zone | Focus row + Space; Arrow ↑/↓; Space |
| 6 | **Drag a palette tile onto canvas** | Insert section at the drop point (within row, between rows, or in empty zone) | Focus palette tile + Space; Arrow keys navigate drop targets; Space |
| 7 | **Long-press OR right-click section** | Context menu: duplicate, delete, change colSpan, copy config, set responsive overrides | Focus + Esc-Menu (Shift+F10 fallback) |
| 8 | **Double-tap a section** | Opens config inspector in focus mode (full-height drawer on mobile, expanded panel on desktop) | Focus + Enter+Enter |

Drop validity:
- **Valid drop target**: dashed accent outline (`var(--accent)` 2px dashed)
- **Invalid drop**: red outline + 200ms shake animation on attempt
- **Hover during drag**: subtle highlight on hovered drop target (background `var(--accent-bg)`)

### 7.4 Drop targets, in detail

The canvas exposes three TYPES of drop targets, each visually distinct:

| Target | When it appears | Visual | Behaviour |
|---|---|---|---|
| **Between-rows gap** | Dragging a section or palette tile; row boundary hovered | Thin horizontal accent line (2px), expands to 32px height on hover with "+ insert new row" text | Drop creates a new row, places the section there as the only section |
| **Within-row slot** | Dragging over a row, between existing sections | Vertical accent line between sections | Drop inserts section at that position; right-side sections shift right; if row has no space (sum > 12) the new section gets next-row treatment |
| **Empty-zone target** | Zone has zero rows | Large dashed card filling the zone with centered icon + "Drop a section to begin" | Drop creates first row + section |

### 7.5 Resize semantics

Dragging the right-edge handle of a section:

1. Cursor changes to `col-resize` (or pointer-grab on touch).
2. As pointer moves, calculate `deltaCols = round((pointerDX / containerWidth) * 12)`.
3. **New section colSpan** = `current + deltaCols`, clamped to `[section.minColSpan, section.maxColSpan]`.
4. **Right-neighbour** (if exists) absorbs the inverse: `current - deltaCols`, clamped to ITS `[minColSpan, …]`. When the neighbour hits its minimum, the resize stops cold.
5. If the section is the LAST in a row, growing extends to the right edge (no neighbour to shrink); shrinking leaves trailing space that the renderer flexes to fill (or admin can drop another section there).
6. **Visual feedback during drag**:
   - 12 faint vertical grid lines appear behind the row (`opacity 0.25` accent)
   - The current snap line bolds (`opacity 0.7`)
   - A pill near the cursor: `8/12` (current span), updates in realtime
   - Neighbour's pill on the other side: `4/12`, dimmed
7. On release: state commits. If you drag back to the original span, the operation is a no-op (no undo entry).
8. **Constraint snap**: if you'd violate a min/max, the section sticks at the limit and a small "🔒 min 3/12" label appears beside the pill.

**Resize is disabled on mobile editor view (< 768px viewport)** — colSpan changes happen via the inspector's number input instead. The handles still exist visually so the affordance is consistent, but touch-resize at tiny widths is fiddly even with snap; the inspector is clearer.

### 7.6 The drag-drop state machine

Implemented as a single `useLayoutEditorDrag` composable. State shape:

```typescript
type DragState =
  | { kind: 'idle' }
  | { kind: 'pickup-pending'; sectionId: string; startedAt: number; pointerType: 'mouse'|'touch'|'pen' }
  | { kind: 'dragging-section'; sectionId: string; pointer: { x: number; y: number }; hoverTarget: DropTarget | null }
  | { kind: 'dragging-row'; rowId: string; pointer: { x: number; y: number }; hoverTarget: DropTarget | null }
  | { kind: 'dragging-from-palette'; sectionType: string; pointer: { x: number; y: number }; hoverTarget: DropTarget | null }
  | { kind: 'resizing-section'; sectionId: string; startColSpan: number; startPointerX: number; currentColSpan: number };

type DropTarget =
  | { kind: 'between-rows'; zone: string; insertBefore: number }
  | { kind: 'within-row'; rowId: string; insertBefore: number }
  | { kind: 'empty-zone'; zone: string };
```

Transitions:

- `pointerdown` on grab handle → `pickup-pending` (with 100ms threshold to disambiguate from click)
- After 100ms OR after pointer moves > 4px → `dragging-section`
- `pointermove` → updates `pointer` + `hoverTarget` (throttled via `requestAnimationFrame`)
- `pointerup` on valid target → applies move op + transitions to `idle`
- `pointerup` on invalid target / outside canvas → cancels + returns to `idle`
- `keydown Esc` during drag → cancels

**Why the 100ms threshold**: prevents accidental drags from quick clicks. On touch (where `pointerdown` happens easily during scrolling), the threshold + 4px movement requirement disambiguates "drag intent" from "scroll intent". On the canvas surface, vertical scroll is blocked while drag is pending — released if no movement after 100ms.

**Throttling**: pointermove fires 60+ times/sec. The state update is queued in `requestAnimationFrame` so reactivity triggers at most once per frame. The dragged element uses CSS `transform: translate(...)` updated via direct DOM manipulation (bypassing Vue's reactivity in the hot path) — only the drop-target highlight is reactive.

### 7.7 Mobile editor — touch-first

The editor is usable on tablets (iPad ~1024px and up is the realistic editing surface). On phones (< 640px), the editor is read-only with a "edit on a larger screen" affordance — drag-drop and resize on a phone are user-hostile no matter how well-designed.

**Tablet (640–1023px)**:

```
┌─ Toolbar (compact) ──────────────────────────────────────┐
│ ‹  About  · Auto-saved  · ⤺ ⤻  · Save  ⋮                │
├──────────────────────────────────────────────────────────┤
│ Canvas (full width)                                       │
│ ┌─ Row ─────────────────────────────────────────────┐    │
│ │ Hero (12/12)                                       │    │
│ └────────────────────────────────────────────────────┘    │
│ ┌─ Row ─────────────────────────────────────────────┐    │
│ │ Image (6) │ Paragraph (6)                           │    │
│ └────────────────────────────────────────────────────┘    │
│                                                            │
│   FAB ✦ Add  (bottom-right)                              │
└──────────────────────────────────────────────────────────┘
↑ Bottom sheet for palette (swipe up from FAB, snap points: half / full)
↑ Bottom sheet for inspector (swipe up from selected section, snap points)
```

**Touch-specific affordances**:

- **Long-press (450ms) to enter drag mode** — disambiguates from scrolling. Visual cue: target scales up 1.02× + slight haptic-style shadow shift. (No actual Vibration API — too noisy.)
- **Drag handles enlarged to 44×44px** (iOS HIG minimum) — visible on tap (mouse devices keep 24×24 hover-revealed handles).
- **Bottom sheet palette**: swipe up from FAB. Tile size 80×80px. Search at top. Categories as horizontal pill scroller.
- **Bottom sheet inspector**: opens on section tap. Snap points: peek (120px), half (50vh), full (90vh). Swipe handle at top, body uses native scroll.
- **No resize on tablet/phone** — handles invisible, colSpan via inspector slider.
- **Toolbar collapse**: secondary actions (undo, redo, preview) move into a ⋮ menu on viewports < 768px.
- **Pinch to zoom canvas**: at < 1024px viewport. Lets admin see the whole layout shape, then zoom in to edit. Pinch state persists for the session.
- **Two-finger drag scrolls the canvas**; one-finger long-press drags a section. No ambiguity.

**Phone (< 640px)**:

- Editor is read-only. Banner: "Layout editing requires a tablet or larger screen. Tap to preview only."
- Can still SELECT sections (taps inspect-only view of config)
- Add / move / resize / delete are disabled
- Inspector becomes a full-screen modal on tap

This is the pragmatic choice — visual drag-drop on a 375px-wide screen is bad UX no matter how well-designed. We don't try.

### 7.8 Accessibility — keyboard equivalence + screen-reader narration

Drag-drop has a notoriously bad a11y story. We make every gesture reachable via keyboard, and we narrate state changes.

**Keyboard model**:

| Action | Keys |
|---|---|
| Move focus between sections | Tab / Shift+Tab |
| Move focus between rows | Tab through last section in row, or Cmd/Ctrl+↓ to skip to next row |
| Open section inspector | Enter on focused section |
| Pick up section for move | Space (focused section) → enters "drag mode" |
| Move in drag mode | Arrow keys (↑↓ across rows, ←→ within row) |
| Drop | Space again |
| Cancel drag | Esc |
| Resize section | Shift + ← or Shift + → on focused section (1 col per press) |
| Delete section | Backspace or Delete on focused section (with confirm) |
| Duplicate section | Cmd/Ctrl + D |
| Undo / Redo | Cmd/Ctrl + Z / Cmd/Ctrl + Shift + Z |
| Save | Cmd/Ctrl + S |
| Preview | Cmd/Ctrl + P |
| Help (shortcut overlay) | ? |
| Focus search in palette | Cmd/Ctrl + / |

**Screen-reader narration** via a polite ARIA live region:

```html
<div role="status" aria-live="polite" class="cpub-sr-only">{{ dragAnnouncement }}</div>
```

Sample announcements:
- `Hero picked up. Row 1 of 3. Press arrows to move, space to drop, escape to cancel.`
- `Moved to Row 2 of 3, position 1.`
- `Dropped Hero in Row 2 position 1.`
- `Cancelled.`
- `Resize: Hero now spans 8 of 12 columns.`
- `Constraint reached: minimum 3 columns.`

**Focus management** during drag:
- Picked-up section retains focus
- Visual focus ring stays visible (no `outline: none` cheats)
- After drop, focus stays on the section in its new location
- After cancel, focus stays on the section in its original location

**No color-only indicators**: drop targets show both an outline AND an icon (✓ valid / ✕ invalid) AND text ("Drop here" / "Cannot drop") so colorblind users have three independent signals.

**Axe-core regression test**: every editor surface state (idle, dragging, resizing, inspector-open, palette-open) runs through axe with zero violations at AA. Catches regressions when someone adds an interactive control without a label.

### 7.9 Inspector — context-sensitive editing

The right panel adapts to selection:

**Nothing selected** (default): page meta — title, description, OG image, frame picker, access, custom slug (for custom-pages only).

**Row selected**: row config — gap, align, background tone, vertical padding. Plus a "Duplicate row" action.

**Section selected**: auto-generated config form from the section's Zod schema (rules table below). Plus a top strip with: colSpan slider (with breakpoint chooser: sm/md/lg), visibility (roles + features + hide-at), enabled toggle, duplicate, delete.

### 7.10 Auto-generated config form

Generated from the section's `configSchema: z.ZodType`. Mapping rules:

| Zod kind | Input control |
|---|---|
| `z.string()` | text input |
| `z.string().describe('rich')` | TipTap inline editor (small, no toolbar) |
| `z.string().describe('rich:full')` | TipTap with full toolbar in expanded drawer |
| `z.string().url()` | URL input + validation pill |
| `z.string().email()` | email input + validation pill |
| `z.number()` / `z.number().int()` | number stepper |
| `z.number().min(1).max(12).describe('col-span')` | colSpan slider (1–12) |
| `z.boolean()` | toggle |
| `z.enum([...])` | segmented control (≤4) or select (>4) |
| `z.array(...)` | repeating field with add/remove/reorder |
| `z.object({...})` | nested form group (collapsible) |
| `z.string().describe('content-picker:project')` | content picker (reuses `<ContentPicker>`) |
| `z.string().describe('hub-picker')` | hub picker |
| `z.string().describe('image')` | image picker (reuses `<ImageUpload>`) |
| `z.string().describe('color-token')` | token-aware color picker (canonical CSS tokens preferred over literal colors) |

Custom refinement metadata is read via `.describe('keyword:arg')` strings. This keeps section schemas plain Zod with no extra DSL.

**Form behaviour**:
- Live updates: every keystroke updates the draft (debounced 200ms to avoid history-spam)
- Validation: per-field error shown in band; section won't save with invalid required fields
- Undo: each commit is one undo step (the debounce coalesces typing into single steps)

### 7.11 Visual design system

Editor chrome stays out of the way. The canvas IS the design.

**Visual hierarchy**:
- **Canvas background**: `var(--surface2)` — slight contrast against page bg so the canvas reads as a "stage"
- **Row chrome (idle)**: invisible (no border, no background) — sections look like the real page
- **Row chrome (hover)**: 1px dashed `var(--border2)`, fades in over 100ms
- **Row chrome (selected)**: 2px solid `var(--accent)`, plus grab handle slides in from left
- **Section chrome (idle)**: invisible
- **Section chrome (hover)**: 1px dashed `var(--border2)`
- **Section chrome (selected)**: 2px solid `var(--accent)` + grab handle + resize handle + context-menu trigger
- **Drop indicator (between sections)**: 2px solid `var(--accent)`, animates from height 0 to 4px on dragover
- **Drop indicator (between rows)**: 2px solid `var(--accent)`, full-width, expands 32px on hover with "+ insert row" label

**Motion**:
- Insertion: section appears with `transform: scale(0.96) → 1` + `opacity 0 → 1` over 150ms (cubic ease-out)
- Removal: reverse, then `display: none`
- Reorder: FLIP animation (record positions before move, animate via transform from delta) — sections slide to new positions over 180ms
- Drag pickup: scaled 1.02× + shadow-md (vs. shadow-sm at rest)
- Drop indicator pulse: opacity 0.6 ↔ 1.0 over 600ms while drag is active in the area

**Typography in editor**:
- Inspector field labels: mono, uppercase, letter-spaced (`var(--text-label)`)
- Body controls: regular sans (`var(--font-body)`)
- Section type pills: mono small caps (`var(--text-xs)` uppercase)

**Color discipline**:
- Selection / accents: `var(--accent)` (NEVER another color)
- Destructive: `var(--red)`, only in confirms / delete affordances
- Neutral states: `var(--text-dim)` text, `var(--surface)`/`var(--surface2)` backgrounds
- Zero hardcoded colors per CLAUDE.md rule #3

**Microinteractions**:
- Save button morphs into a checkmark for 800ms on success, then back
- Add-row button has a faint pulse if the zone is empty (gentle nudge)
- Drag-drop landing site briefly flashes accent-bg before the section commits
- Resize pill bounces on snap-to-limit (`scale 1 → 1.1 → 1` over 120ms)

**Empty states with illustrations**:
- Empty zone: simple line-art icon (cube / grid / stack) + "Drop a section here to begin" + "Try a Hero" quick-add chip
- Empty page list: illustration + "Create your first custom page" CTA
- No search results: "No sections match 'foo'" + clear-search action

### 7.12 Toolbar

Top-of-page strip, sticky:

```
‹ Pages   ·   About (custom-page)  /about   ·   [📱 Mobile | 📋 Tablet | 🖥 Desktop]   ·   ⤺ ⤻   ·   Auto-saved 3s ago   ·   Preview ▸   Save   Publish ▾
```

- **Breadcrumb left**: `‹ Pages` returns to the list. Name + scope follow.
- **Responsive preview toggle**: changes the canvas width to simulate viewport (`375px` / `768px` / `100%`). Inside resizes, sections re-flow per their responsive colSpans. Edits made while in `Mobile` viewport update `responsive.sm`; in `Tablet` update `responsive.md`; `Desktop` updates the base `colSpan`. A subtle indicator at the section level shows which breakpoint(s) the value comes from.
- **Undo / Redo**: with hover-tooltip showing the action ("Undo: Resize Hero to 8/12").
- **Save status**: live text. `Auto-saved 3s ago` / `Saving…` / `Unsaved changes` / `Save failed — retry`.
- **Preview**: opens the actual route in a new tab with `?previewLayoutId=<draftId>`. Token in URL is short-lived (15min).
- **Save**: commits draft. Cmd/Ctrl+S.
- **Publish ▾**: dropdown contains Publish (snapshot + go live), Revert to last published, Version history.

### 7.13 Auto-save + conflict detection

- **Debounce**: 1.5s after last change. Save sends the WHOLE draft (atomic).
- **Optimistic UI**: state updates immediately; failed save reverts with explanation.
- **Concurrency**: send `If-Match: <updated_at>` header. Server rejects with 409 if changed since last load. UI surfaces "another admin edited this layout. View their changes" → diff modal with merge / overwrite options.

### 7.14 Undo / redo

In-memory stack of operations. Each operation captures its inverse so redo is symmetrical. Stack depth: 50. Cleared on Save (a saved draft is the new baseline; redo across save would be hostile).

Operations are typed:

```typescript
type LayoutOp =
  | { kind: 'add-section'; rowId: string; position: number; section: LayoutSection }
  | { kind: 'remove-section'; rowId: string; section: LayoutSection /* full data for redo */ }
  | { kind: 'move-section'; sectionId: string; from: { rowId: string; position: number }; to: { rowId: string; position: number } }
  | { kind: 'resize-section'; sectionId: string; from: number; to: number; breakpoint: 'lg'|'md'|'sm' }
  | { kind: 'edit-section-config'; sectionId: string; from: Record<string,unknown>; to: Record<string,unknown> }
  | { kind: 'add-row'; zone: string; position: number; row: LayoutRow }
  | { kind: 'remove-row'; row: LayoutRow }
  | { kind: 'move-row'; rowId: string; fromPosition: number; toPosition: number }
  | { kind: 'edit-row-config'; rowId: string; from: Record<string,unknown>; to: Record<string,unknown> }
  | { kind: 'edit-page-meta'; from: PageMeta; to: PageMeta };
```

Each op has `apply(draft)` and `revert(draft)` pure functions. The history is `{ undo: LayoutOp[]; redo: LayoutOp[] }`. Undo pops from `undo`, applies its revert, pushes to `redo`. Redo is the mirror.

Config-edit ops debounce: typing in the inspector coalesces into a single undo step per "edit session" (no edits for 1s → close session).

### 7.15 Empty / error states

- **Empty layout**: large illustration in canvas + "This page has no sections. Drag one from the left or click [+ Add row]."
- **Unknown section type after save** (e.g. layer upgrade removed a section): renders an error card with section type slug + "Remove this section" button. Non-admin users see nothing in that slot.
- **Schema-version mismatch on load**: silent migration in `useLayout`; the migrated config is visible in the inspector but not yet saved — banner: "Hero section config was upgraded. Save to keep changes."
- **Save failure**: in-band toast at bottom + the save button stays enabled + status reads `Save failed — retry`.
- **Network offline during edit**: toast + auto-save pauses + when back online, save resumes with conflict check.

### 7.16 Component file layout (preview)

```
components/admin/pages/
  AdminPagesList.vue               — the /admin/pages list page
  AdminPagesEditor.vue              — the /admin/pages/[id] page (orchestrator)
  AdminPagesToolbar.vue             — top toolbar
  AdminPagesPalette.vue             — left section library
  AdminPagesPaletteTile.vue         — single section tile
  AdminPagesCanvas.vue              — the editable canvas (hosts <LayoutSlot :editable>)
  AdminPagesInspector.vue           — right panel dispatcher
  AdminPagesInspectorPage.vue       — page-meta form
  AdminPagesInspectorRow.vue        — row config form
  AdminPagesInspectorSection.vue    — section config form (auto-form from Zod)
  AdminPagesAutoForm.vue            — Zod → form mapper
  AdminPagesAutoFormField.vue       — one field
  AdminPagesDragGhost.vue           — the floating dragged-thing
  AdminPagesDropIndicator.vue       — drop-target visual
  AdminPagesResizePill.vue          — the "8/12" pill during resize
  AdminPagesShortcutOverlay.vue     — ? overlay
  AdminPagesMobileSheet.vue         — tablet bottom sheet
composables/
  useLayoutEditor.ts                — draft state + history + ops
  useLayoutEditorDrag.ts            — pointer-event state machine
  useLayoutEditorResize.ts          — resize math + state machine
  useLayoutEditorA11y.ts            — keyboard handlers + live region
  useLayoutAutoSave.ts              — debounce + conflict detection
```

Sizes target: orchestrator ≤ 350 lines; each focused component ≤ 250; composables ≤ 200. None monolithic.

---

## 8. Phases

Drag-drop + resize are NOT deferred — they are how the editor works from Phase 3 onwards. The phasing reflects that.

| Phase | Deliverable | Estimated sessions |
|---|---|---|
| **0.5** | Retroactive test gap fill — see §10.1 | 1 |
| **1** | Schema (zones→rows→sections, responsive colSpan), migration `0005_layout_engine`, `<LayoutSlot>` with 12-col grid, 5 starter sections, homepage migrated behind `features.layoutEngine` | 2 |
| **2** | Custom-page catch-all route, path normalisation, conflict detection vs file routes | 1 |
| **3a** | Editor shell + page list + canvas (read-only render via `<LayoutSlot :editable=false>`) + inspector page-meta form + auto-save + toolbar with responsive viewport toggle | 1 |
| **3b** | **Drag-drop interactions** — pointer-event state machine, palette-to-canvas, within-row reorder, between-row reorder, drop indicators, FLIP animations, undo/redo stack | 2 |
| **3c** | **Resize interactions** — edge handle, snap-to-12-grid, neighbour absorption, constraint snap, visual feedback (grid lines + pills) | 1 |
| **3d** | **Keyboard equivalence + a11y narration** — every gesture reachable via Tab+Space+Arrow, ARIA live region, axe-clean editor surface | 1 |
| **3e** | **Auto-form from Zod** — all 14 Zod-kind mappings (§7.10), with picker integrations (content/hub/image/color-token) | 1 |
| **3f** | **Inspector polish** — row config form, section colSpan slider per breakpoint, visibility, duplicate, delete with confirm | 1 |
| **4** | Layout editing wired up for 8 built-in routes (`<LayoutSlot>` adoption in `pages/index.vue`, `pages/hubs/[slug].vue`, blog/project/learn indexes, profile, footer, 404) | 1 |
| **5** | Theme/layout preview-scene integration — `'page-layout'` scene renders an in-progress layout; `'iframe-route'` renders any route with the in-progress theme overlay | 1 |
| **6a** | **Tablet/mobile editor adaptation** — bottom sheets for palette + inspector, long-press drag, FAB, pinch-to-zoom, phone read-only mode | 1 |
| **6b** | Remaining 20 section types (5 per session ~ 4 sessions) | 4 |
| **7** | Versioning + draft + publish + revert UI; conflict-detection modal with diff view | 1 |
| **8** | Section duplication, multi-select (drag a group), context menus | 1 |
| **9** | Code-registered sections from thin app's `commonpub.config.ts`; startup type-collision check | 1 |
| **10** | Performance hardening — ETag on `/api/layouts/by-route`, server cache, SSR static-section inlining, per-section lazy hydration | 1 |

**Critical path to editable layouts**: 0.5 → 1 → 2 → 3a → 3b → 3c → 4. After that, every phase is incremental.

**Why split Phase 3 into a–f**: each is independently shippable behind the flag, each has a focused test suite, none is "too much to fit in one session" (which is when drag-drop usually goes wrong — last-minute shortcuts on a11y or touch).

Each phase ends with: schema validated, real tests green, codebase-analysis updated, a session log entry, no published version drift.

---

## 9. Risk register + mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Catch-all route shadows everything if `pageNotFound()` is broken | M | C | Phase 2 integration tests cover: file-route match returns file, custom-page match returns layout, neither returns 404 with correct status code. The test runs against a real Nuxt server (not just the handler in isolation). |
| 2 | XSS via `custom-html` / `iframe` / `markdown` sections | M | C | All HTML-bearing sections route through `@commonpub/explainer`'s sanitizer. Tests include the OWASP XSS payload list, `<script>`, `<iframe>` (unsafe attrs stripped), `javascript:` URLs, SVG payloads. Admin role is required to add these sections — the existing `features.admin` gate plus a per-section `addRoles: ['admin']` flag. |
| 3 | Section schema migrations corrupt data | M | C | `schema_version` column + per-section `migrations: Record<number, fn>` map. Migration runs lazily on read (the renderer asks the registry to upgrade if `section.schema_version < registry.schemaVersion`). Tests: round-trip old → new → assert no data loss; downgrade explicitly unsupported. |
| 4 | Performance regression on `/` (highest-traffic page) | H | M | 60s server-side cache + 5-min client-side. ETag on `/api/layouts/by-route` so revalidation is cheap. Phase 10 adds compile-time inlining for purely static section types (heading, paragraph, image) — they ship in the SSR HTML, not via Vue. |
| 5 | DB-stored page interferes with file-routed page (e.g. `/admin`) | H | C | Conflict detection on save (§6.2) + a startup integrity check that logs warnings if the layouts table contains a `custom-page` row that now shadows a newly-added file route (caught after a layer upgrade adds a page). |
| 6 | Admin saves a section config that crashes the renderer | M | M | Section renderer is wrapped in an error boundary that logs + renders a "section failed to render — admin only" placeholder. The placeholder is opaque to non-admin users (returns empty so the page doesn't show errors to end users). |
| 7 | Code-registered sections from the thin app cause hydration mismatches | L | M | Section registry is loaded SAME on server and client (it's a config + import map). Phase 9 tests assert SSR + hydration produce identical DOM for every section type. |
| 8 | Big section configs blow up the row size | L | L | `config jsonb` defaults to TOAST; size cap of 64 KB per section enforced at the API layer. Tests: insert a 65 KB config → 413 response. |
| 9 | Permission gate bypass — public custom page that should be members-only | L | C | `access` enforced server-side in the catch-all handler BEFORE `useFetch`. Integration tests: anonymous request to a members-only page returns 401/302; member returns 200. |
| 10 | "Edit a built-in route" overrides the page in a way the layer doesn't expect | M | M | Built-in routes declare their zones in code via `defineLayoutZones(['main', 'sidebar'])`. The admin can only place sections in declared zones. Removing a zone in a future layer release drops sections quietly (the admin UI surfaces the orphan). |
| 11 | Drag-drop is keyboard-inaccessible (single-mode design forces all admins to use mouse) | M | H | §7.8 specifies a complete keyboard model — pick up via Space, move via arrows, drop via Space, cancel via Esc, resize via Shift+Arrow. Tests (§10.6) include keyboard equivalence assertions for EVERY drag operation. Axe runs on every editor surface state. |
| 12 | Touch-drag ambiguity with page scroll on tablet (drag intent vs scroll intent) | H | M | 100ms + 4px movement threshold before drag commits (§7.6). Long-press explicit gesture on touch (450ms). Two-finger gesture reserved for canvas pan. Touch-event tests assert scrolling still works during pickup-pending, drag is committed only past threshold. |
| 13 | 60fps requirement on drag means Vue reactivity in the hot path is too slow | M | M | Pointer move handling uses `requestAnimationFrame` + direct DOM `transform` mutation on the dragged element (bypasses Vue). Only drop-target highlight goes through reactivity. Performance budget: drag at 60fps with 50+ sections on canvas. Tests include a benchmark with `performance.mark()` assertions. |
| 14 | Resize math edge cases corrupt row colSpan sum (overflows 12 or leaves gaps) | M | H | Pure-function `computeResize(rowSections, sectionId, deltaCols)` returns the new colSpans for the affected pair, with min/max/sum invariants checked. Unit tests cover: shrink past neighbour min, grow past 12, last-section special case, no-neighbour case. Server-side validator re-checks invariants on save — corrupt row = 422 with diagnostics. |
| 15 | Mobile editor on a phone is hostile (everything I design at 1024+px doesn't translate to 375px) | H | M | Phone (< 640px) editor is explicitly read-only with an "edit on a larger screen" banner. We don't try to ship a phone-editable UI. Output (rendered pages) is fully responsive. Tablet (640–1023) gets the touch-adapted editor (bottom sheets, FAB, long-press, no resize). |
| 16 | Auto-save races with manual save (both fire simultaneously, second one races the response) | L | M | Save mutex in `useLayoutAutoSave` — a manual save cancels in-flight auto-save; queues new ops until response. If-Match header on every save (etag = `updated_at`). 409 surfaces conflict modal. Tests simulate concurrent saves. |
| 17 | Undo across save creates the wrong restore point (admin presses Cmd+Z after a save, expects to undo the LAST edit, not the SAVE itself) | M | L | History stack clears on save. UI shows "No changes to undo" if user presses Cmd+Z after save. Documented in the shortcut overlay. |
| 18 | FLIP reorder animation jitters on touch devices (Safari iOS bug with transform mid-flow) | L | L | Animation respects `prefers-reduced-motion`. Touch devices get a simpler crossfade if `matchMedia('(hover: none)')` matches. Tested on iPad Safari + Android Chrome. |

---

## 10. Test strategy — real vs cosmetic

This is the part of the plan that decides whether v1 ships solid or hollow.

### 10.1 Audit of existing layout-adjacent tests

Findings from a quick read:

| File | Lines | Real? | Gaps |
|---|---|---|---|
| `layers/base/components/__tests__/HomepageSectionRenderer.test.ts` | 56 | **Real** (regression test for an actual session-145 bug — feature gate indexing `ref` instead of `ref.value`) | Only 2 cases. No coverage of: zone routing, type-allow/exclude lists, disabled sections, full type matrix. |
| `packages/server/src/__tests__/` (no homepage test) | — | **GAP** | Zero coverage of `getHomepageSections`, `setHomepageSections`, `resetHomepageSections`, `DEFAULT_SECTIONS` shape. The single user of these is the entire admin homepage UI. |
| `packages/server/src/__tests__/` (no navigation test) | — | **GAP** | Same — the nav-item server module ships with no tests. |
| Session 154 new tests | 31 | **Real** — found a real bug, real CRUD round-trips, real XSS escape verification on `tokensToCss` | Missing: SSR end-to-end (request a page, assert `<style id="cpub-theme-inline">` is present + correct); editor save + reload round-trip via the API; scene rendering with token overrides. |
| `useMirrorContent.test.ts` | 210 | **Real** — comprehensive content-type resolution coverage with realistic fixtures | None apparent. |

The pattern is: where tests exist, they are real (because they were written to fix a real bug). Where there are no tests, the gap is total. **The layout engine plan must not perpetuate this pattern** — every phase deliverable lists the tests up front, and "no tests" is not a valid deliverable state.

### 10.2 Definition of "real" tests (the criteria each test must meet)

A test is REAL if it would catch a regression in the production code it covers. Concretely:

1. **It exercises the function/component being tested, not a mock of it.** Asserting that a mock was called is cosmetic.
2. **It asserts an observable outcome** (DOM, HTTP response body, DB row, file output) — not implementation details (call counts, internal call paths) unless the call ordering IS the contract being tested.
3. **It covers the full output path** — when feasible, the test exercises framework serialisation (h3, undici, Vue's renderer) rather than algorithm in isolation. (Per `feedback_integration_test_full_output_path`: sessions 149 + 150 shipped P0 bugs whose unit tests were green because the helper output was verified by the same algorithm but the framework layer above broke the wire format.)
4. **It exercises edge cases that have plausible regression value** — empty inputs, max-size inputs, unicode, concurrent saves, schema-version mismatch, unknown types, malformed JSON.
5. **It tests the FAILURE mode** — the assertion fails informatively when the underlying code breaks (try mutating the implementation and confirm the test catches it).
6. **For security-sensitive paths**, it uses the known-bad payload corpus (OWASP XSS, SSRF private IPs, path traversal sequences, malformed JSON-LD, oversized inputs).

A test is COSMETIC if any of: it asserts the component renders (without asserting WHAT it renders), it mocks the function under test, it duplicates the implementation's algorithm to "verify" it, it asserts an internal helper was called.

### 10.3 Tests required per phase

**Phase 0.5 — retroactive theme-editor coverage** (~12 new tests, fill gaps from §10.1):

| Test file | Cases | Real-test rationale |
|---|---|---|
| `packages/server/src/__tests__/homepage.test.ts` (new) | listSections defaults to DEFAULT_SECTIONS; set replaces; reset restores; concurrent writes don't overwrite each other (last-writer-wins is the contract); invalid section types accepted (back-compat) | The server module has zero tests today; adding them is debt repayment. |
| `packages/server/src/__tests__/navigation.test.ts` (new) | same shape | Same. |
| `apps/reference/test/theme-ssr.e2e.test.ts` (new — first e2e in the repo) | Given a custom theme set as default, GET `/` and assert response body contains `<style id="cpub-theme-inline">` with the right tokens + correct `<html data-theme="cpub-custom-...">` | The unit tests for `tokensToCss` + middleware + plugin are real individually, but the integration is unverified. This is the full-output-path test for the theme system. Per session 149/150 lesson: pinned wire format. |
| `apps/reference/test/theme-editor.api.test.ts` (new) | POST a custom theme → assert returned shape; GET it back → assert deep equality; PUT updates createdAt invariant; DELETE returns `resetDefault: true` when active | API round-trip for the theme editor. |
| `layers/base/components/__tests__/HomepageSectionRenderer.test.ts` (extend) | type-allow filter; type-exclude filter; disabled section skipped; section in wrong zone skipped; all 8 section types render (with stubs); unknown type renders nothing | Existing test only covers feature gating. Expand to the full dispatch matrix. |

**Phase 1 — generalised layout engine** (~35 tests):

| Test file | Cases |
|---|---|
| `packages/schema/src/__tests__/layout.test.ts` | Layout schema accepts valid shape; rejects: unknown scope_type, dangling sections (FK enforcement), duplicate position within zone, invalid section type slug; PageMeta optional only for `scope: route`; required for `scope: custom-page`; access enum; frame enum. |
| `packages/server/src/__tests__/layouts.integration.test.ts` | CRUD: create returns row; get returns same; list with scope filter; update by id; delete with cascade to sections + versions; concurrent updates use `updated_at` as conflict marker. Migration: existing `homepage.sections` migrates to a layout; running migration twice is a no-op. Resolution: `getLayoutByRoute('/')` returns published version, NOT draft. |
| `packages/server/src/__tests__/sections.integration.test.ts` | Insert section: gets next position in zone; reorder rewrites positions atomically; delete renumbers remaining; section config validated against registered Zod schema; unknown type rejected at write. |
| `packages/server/src/__tests__/section-migrations.test.ts` | Section with old schemaVersion gets migrated on read; downgrade is a no-op; missing migration function logs warning + renders error placeholder; schema version mismatch in tests: assert renderer's behaviour, not internal call counts. |
| `layers/base/components/__tests__/LayoutSlot.test.ts` | Given mocked layout payload: renders only enabled sections; only sections in named zone; respects role visibility (anonymous vs member vs admin); respects feature gates; falls back gracefully on unknown section types; respects breakpoint visibility (via `matchMedia` mock). |
| Phase-1 sections: 5 per-section tests | Each section: renders with default config; renders with custom config; handles missing required fields (graceful); accessibility — semantic HTML, aria labels, keyboard nav; no token leaks (uses `var(--*)` only — grep test). |

**Phase 2 — custom pages + catch-all** (~15 tests):

| Test file | Cases |
|---|---|
| `packages/server/src/__tests__/pathNormalize.test.ts` | Each rule in §6.3 has its own assertion. Path normalisation is the load-bearing security check; cover every case. Include unicode (`/about` vs `/āböüt`), normalisation form, BIDI override characters, long paths (>2 KB), null bytes (rejected). |
| `packages/server/src/__tests__/pageConflict.test.ts` | Given a file-routes list, save at conflicting path returns 409; save at orphan path succeeds; save at duplicate `custom-page` path returns 409; save at reserved prefix returns 409. |
| `apps/reference/test/custom-page.e2e.test.ts` | POST a custom page → GET its URL → assert 200 + rendered title in `<title>` + section text in body. Negative: GET a path that doesn't exist returns 404 with `error.vue` shell. Negative: rename file route to shadow a custom page → assert the file route wins. |
| Access control e2e | Members-only page anonymous → 401 with redirect-to-login; admin page member → 403; public page → 200. |

**Phase 3a — editor shell + auto-save + responsive viewport** (~12 tests):

| Test file | Cases |
|---|---|
| `AdminPagesList.test.ts` | Three groups render correctly (routes / custom / virtuals); per-row badges (published / draft / unpublished); clicking a row navigates to editor. |
| `AdminPagesEditor.test.ts` (canvas read-only state) | Given a layout payload: canvas renders zones in declared order; rows in `position` order; sections in `position` order; respects responsive colSpan when toolbar viewport toggle is set to mobile/tablet/desktop. |
| `useLayoutAutoSave.test.ts` | Debounce: 5 changes in 6s → 1 PUT; pause auto-save on network error then retry; manual save cancels pending auto-save; If-Match header on every PUT. |
| `useLayoutEditor.test.ts` (state machine + ops) | `applyOp` is pure: input draft + op → new draft (input untouched); `revertOp(op).apply(applyOp(draft, op)) === draft` for every op kind; history.push trims at 50; save clears history. |

**Phase 3b — drag-drop interactions** — see §10.6 for the full breakdown (~32 tests).

**Phase 3c — resize interactions** — see §10.6 (~14 tests).

**Phase 3d — keyboard equivalence + a11y narration** — see §10.6 (~18 tests).

**Phase 3e — auto-form from Zod** (~20 tests):

| Test file | Cases |
|---|---|
| `AdminPagesAutoForm.test.ts` | For EACH of the 14 Zod-kind mappings in §7.10: given a section configSchema using that kind, the right control is rendered. Required-field validation: empty value → red outline + error pill + section won't commit. Array fields: add row, remove row, reorder via arrow buttons. Nested objects: collapsible group with indent. |
| `AdminPagesAutoFormField.test.ts` | Each control type has its own test (color picker fires update with hex; toggle fires on space + click; number stepper clamps to min/max; select keyboard nav). |
| `AdminPagesAutoForm.pickers.test.ts` | `.describe('content-picker:project')` renders `<ContentPicker>` filtered to type=project; `.describe('hub-picker')` renders hub picker; `.describe('image')` renders ImageUpload; `.describe('color-token')` renders the token-aware color picker that prefers `var(--accent)` over `#5b9cf6`. |

**Phase 3f — inspector polish** (~10 tests):

| Test file | Cases |
|---|---|
| `AdminPagesInspectorSection.test.ts` | Section colSpan slider commits to base `colSpan` when viewport=desktop, to `responsive.md` when viewport=tablet, to `responsive.sm` when mobile. Visibility roles editor: array of role chips; saves correctly. Duplicate creates new section with same config at next position. Delete shows confirm; cancel keeps section. |
| `AdminPagesInspectorRow.test.ts` | Row config: gap, align, background-token picker, paddingY. Each updates the row's config and triggers re-render. |
| `AdminPagesInspectorPage.test.ts` | Title / description / OG image / frame picker / access. Slug field disabled for `scope: route`; editable for `scope: custom-page`; conflict detection visible inline. |

**Phase 3 end-to-end** (~5 tests):

| Test file | Cases |
|---|---|
| `apps/reference/test/editor-roundtrip.e2e.test.ts` | Real Nuxt server: load editor → drag a Hero from palette into zone 'main' → resize to 8/12 → drop an Image at position 0 in a new row → save → reload editor → assert layout matches → click publish → fetch the public URL → assert SSR HTML contains hero + image markup. |

**Phase 4 — built-in route layouts** (~10 tests):

| Test file | Cases |
|---|---|
| For each of 8 routes: an integration test that loads `<Layout>` for that route, asserts the right `<LayoutSlot>` zones are present, asserts each zone renders the right default sections. |
| Edit-then-render: PUT a layout for `/blog` adding a hero, GET `/blog`, assert hero in SSR HTML. |

**Phase 5 — theme/layout preview** (~6 tests):

| Test file | Cases |
|---|---|
| New scene `'layout'`: given a draft layout + tokens, renders the layout scoped inside a `data-theme` container with inline tokens; switches mode to `dark` re-renders; multiple sections render. |
| New scene `'iframe-route'`: posts a temp layout to a debug endpoint, opens iframe to `/some-route?previewLayoutId=...`, sandboxed to prevent navigation; sandbox `allow-same-origin allow-scripts` ONLY when previewing same-origin. |

**Phase 6 — section catalogue** (per-section tests):

For EACH of the remaining 20 section types: same suite as Phase 1's per-section tests, plus type-specific edge cases:

- `content-feed`: filter by type, by hub, by tag; sort by recent/popular; empty result; gated by feature; pagination boundary.
- `contact-form`: submit calls the email adapter with correct payload; honeypot field blocks bots; rate-limited; missing required fields client + server.
- `custom-html`: known-bad XSS payloads stripped — full OWASP cheat-sheet sample; `<script>` removed; `<iframe>` removed unless in allowlist; `javascript:` URLs neutered; SVG-based XSS neutered.
- `iframe`: URL must match `iframe-allowlist` setting; failed match → no render; allowed match → iframe with `sandbox="allow-scripts allow-same-origin"` (no `allow-top-navigation`).
- `markdown`: math/code/links/images render; XSS payloads embedded in markdown are stripped; relative URLs preserved; broken markdown doesn't crash.
- `newsletter`: submit calls the email adapter; double-opt-in flow; invalid email rejected; existing subscriber → "already subscribed".
- Data sections (`content-feed`, `featured-content`, etc.): missing referenced content → graceful empty state, not crash.

**Phase 7 — versioning + drafts** (~8 tests):

| Test file | Cases |
|---|---|
| Publish: snapshot created; published_version_id points at snapshot; the version's snapshot matches the layout at publish time exactly. |
| Revert: snapshot copied back to layout; draft state cleared; original version row untouched (immutable). |
| Auto-save: PUT debounces (the API tests assume the client sends ~1/sec; server accepts at any rate but rejects payloads >256 KB). |
| Version list: ordered desc; paginated; includes publisher + timestamp. |

**Phase 6a — tablet/mobile editor** (~14 tests):

| Test file | Cases |
|---|---|
| `AdminPagesMobileSheet.test.ts` | Bottom sheet snap points (peek 120px, half 50vh, full 90vh); swipe handle drags between snaps; backdrop tap closes; Esc closes; focus traps inside sheet. |
| `AdminPagesPalette.tablet.test.ts` | At viewport < 1024: palette appears as bottom sheet triggered by FAB; FAB visible at bottom-right; tile size 80×80; long-press on tile to start drag. |
| `AdminPagesInspector.tablet.test.ts` | Section tap opens inspector bottom sheet; close returns focus to selected section. |
| `AdminPagesEditor.phone.test.ts` | Viewport < 640: edit affordances disabled (drag handles hidden, resize handles hidden, FAB hidden, add-row button hidden); banner present; tap section opens inspect-only view; no save button. |
| `useLayoutEditorDrag.touch.test.ts` | `pointerType: 'touch'`: long-press 450ms commits to drag; release before 450ms = no drag; movement during long-press cancels (treated as scroll); two-finger gesture passes through to scroll. |
| `pinch-zoom.test.ts` | Pinch gesture scales canvas; pan with two fingers; persists in session storage; reset button restores 1.0x. |

**Phase 8 — duplication + multi-select** (~10 tests):

| Test file | Cases |
|---|---|
| Section duplicate (context-menu + Cmd+D): creates a clone at next position with same config; uuid is new; copies responsive overrides. |
| Multi-select: Shift+click adds to selection; group drag moves all together; group delete with one confirm; selection persists across reorder. |
| Drag-onto-self: no-op (history doesn't record); section returns to original position with animation. |
| Drag across zones: section's row gets re-parented; old row is empty → auto-deletes after 200ms (with undo). |

**Phase 9 — code-registered sections** (~6 tests):

| Test file | Cases |
|---|---|
| Given config-registered `sections: [{type, ...}]`: appears in `/api/sections` response; appears in editor palette; saves a section with the registered type; renders via the registered component. |
| Type collision: registered type shadowing built-in returns 409 on app startup (fails fast). |
| SSR/hydration parity: a registered section renders identically on server + client. |

**Phase 10 — performance** (~5 tests):

| Test file | Cases |
|---|---|
| `/api/layouts/by-route` ETag honored: GET with matching `If-None-Match` returns 304 + empty body. |
| Server cache hit doesn't re-query DB (test via spy on `db.select` — exception to the no-mock rule because cache testability requires it; spy is on the DB driver, not the function under test). |
| Static-section inlining: a layout with only static sections produces SSR HTML with the section content baked in (no client-side Vue overhead) — assertion: a small snippet of section text is in the HTML body returned by the dev server. |

### 10.4 Test infrastructure additions

- **PGlite is fine for everything CRUD.** All `layouts.integration.test.ts` and similar tests use PGlite per `testdb.ts`.
- **First e2e tests in the repo**: Phases 0.5, 2, 3 introduce `apps/reference/test/*.e2e.test.ts`. Requires either Playwright or starting a Nuxt dev server programmatically. Plan: `vitest`-based, starts Nuxt in a child process at a random port, waits for `/api/health`, runs HTTP tests with `undici`. New util: `apps/reference/test/helpers/nuxtServer.ts`. No new heavy dep — Nuxt + undici both already present.
- **A11y tests**: `@testing-library/vue` + axe-core via `@axe-core/vue` (already in dev deps for UI package — see `packages/ui/package.json:73`). Per CLAUDE.md WCAG 2.1 AA minimum.
- **Section preview snapshot tests**: per section, render with three configs (empty / typical / max-fill), snapshot the DOM. Snapshots are committed and reviewed on diff (caught visual regressions are real regressions).

### 10.5 What we WON'T do (because it would be cosmetic)

- Tests that just `mount(Component)` and assert `wrapper.exists()`.
- Tests that mock `useLayout` and assert the mock was called.
- Snapshot tests as the sole coverage for sections — paired with explicit assertions on key DOM elements.
- Tests that count internal function invocations (except the cache-hit case, where the no-DB-call assertion IS the contract).
- Drag-drop tests that mock the state machine and assert "moveSection was called with X" — they prove the test is wired, not that the FEATURE works. Real tests fire `pointerdown` / `pointermove` / `pointerup` events and assert DOM outcomes (see §10.6).

### 10.6 Drag-drop, resize, mobile, a11y — the part most editors get wrong

Drag-drop is the most-likely-to-rot subsystem of this whole plan. Most editors ship it, declare it tested via a handful of "wrapper.exists()" tests, and then ship a regression every other release. The plan defends against that with the following test breakdown — every gesture in §7.3 has multiple real tests across unit, component, and e2e levels.

#### 10.6.1 Pure-function tests (the foundation — fast, deterministic)

These are the load-bearing math + state machines. Pure functions, no DOM, runs in milliseconds. **If these don't cover every edge case, the integration tests above them are sandcastles.**

| Test file | Cases | Real-test rationale |
|---|---|---|
| `useLayoutEditorResize.math.test.ts` | `computeResize({sections, sectionId, deltaCols})` for: shrink past neighbour min (clamped); grow past 12 (clamped); section is last in row (no neighbour to absorb — trailing space allowed); 12-section row (every section at 1/12, can't shrink any further); single-section row (resize bounded by min/max only); section type with resizable:false (returns unchanged); 0-delta no-op; negative delta swaps direction correctly. | Pure-function failure modes: catches off-by-one in the clamping logic. Mutation testing: change `<=` to `<` in any branch → at least one test fails. |
| `useLayoutEditorDrag.machine.test.ts` | State transitions: `idle → pickup-pending` on pointerdown; `pickup-pending → dragging` after 100ms OR 4px movement; `dragging → idle` on valid drop (state captures op); `dragging → idle` on invalid drop (no op); `dragging → idle` on Esc; concurrent pickup ignored while drag in progress; pointercancel treated as Esc. | Each transition is a single test; the test asserts BOTH the new state AND any side-effect (drop indicator visible / op applied). Catches "transition fires but state doesn't update". |
| `useLayoutEditor.ops.test.ts` | Each `LayoutOp.apply(draft)` is pure + idempotent; each `revert(op).apply(apply(draft, op)) === draft` deeply equal; ops on missing IDs throw (not silent no-op); position renumbering after each op produces `{0..n}`. | Confirms history can fully reproduce or roll back any sequence. Critical for undo/redo correctness. |
| `pathNormalize.test.ts` | (Already specified in Phase 2; relevant here because the editor saves a path field for custom pages.) |

#### 10.6.2 Component tests with simulated pointer events (real DOM, fast)

`@testing-library/vue` + `fireEvent.pointerDown` / `pointerMove` / `pointerUp`. These run in JSDOM, so layout math (`getBoundingClientRect`) requires explicit mocking of element bounds — done via a `mockRect(el, {left, top, width, height})` helper.

| Test file | Cases |
|---|---|
| `AdminPagesCanvas.drag-within-row.test.ts` | Pointer down on section A's grab handle → pointer move 200px right → pointer up over section B's slot → assert section A is now at position 1 (was 0), section B at position 0. Drop indicator visible during move, gone after up. |
| `AdminPagesCanvas.drag-between-rows.test.ts` | Drag section from row 1 to row 2 → asserts section row_id changed, position renumbered, both rows have new section count. |
| `AdminPagesCanvas.drag-from-palette.test.ts` | Pointer down on palette tile "Hero" → pointer move into empty-zone target → pointer up → assert new row created with hero section at position 0. |
| `AdminPagesCanvas.drag-cancel.test.ts` | Start drag → press Escape → assert section returns to original position, no state change. Start drag → pointer up outside canvas → same. Start drag → pointer leaves window → same. |
| `AdminPagesCanvas.drag-threshold.test.ts` | Pointer down + pointer up within 100ms with no movement → NO drag committed (it's a click); section selected instead. Pointer down + small movement (< 4px) + pointer up → still treated as click. |
| `AdminPagesCanvas.resize-within-bounds.test.ts` | Pointer down on right edge of section (colSpan=6) → pointer move 100px right with container width 1200px → assert colSpan now 7, neighbour was 6 now 5. Pill shows "7/12" during drag. |
| `AdminPagesCanvas.resize-snap-to-min.test.ts` | Section with minColSpan=3 → drag to span 1 → snaps to 3, pill shows "🔒 min 3/12". |
| `AdminPagesCanvas.resize-snap-to-neighbour-min.test.ts` | Neighbour at minColSpan=3 → can't shrink it further → drag stops growing. |
| `AdminPagesCanvas.resize-no-resizable.test.ts` | Section type with resizable:false → no right-edge handle visible → drag-attempt on the area is no-op. |
| `AdminPagesCanvas.responsive-edit.test.ts` | Viewport toggle = mobile → resize commits to `responsive.sm`. Toggle to tablet → commits to `responsive.md`. Toggle to desktop → commits to base `colSpan`. Indicator on section shows which breakpoints have overrides. |
| `AdminPagesDropIndicator.test.ts` | Drop indicator only renders when drag is active in the area; valid target = accent outline; invalid = red outline + shake (assert `class="shake"`); within-row indicator is vertical line; between-rows is horizontal. |

#### 10.6.3 Touch / pointer-type tests

Same harness, `pointerType: 'touch'` on every event.

| Test file | Cases |
|---|---|
| `AdminPagesCanvas.touch.long-press.test.ts` | Touch pointerdown → wait 450ms → assert drag mode entered (drag ghost visible, source ghosted at 30% opacity). Touch down + release before 450ms → NO drag, click semantics. Touch down + movement before 450ms → cancels long-press timer (treated as scroll start). |
| `AdminPagesCanvas.touch.scroll-passthrough.test.ts` | Touch down on row gap (not on a section) → pointer move vertically → assert canvas scrolls (default behaviour preserved). |
| `AdminPagesCanvas.touch.two-finger-pan.test.ts` | Two `pointerdown` events with `isPrimary: false` on second → no drag started; pan handlers receive both pointers. |
| `AdminPagesPalette.touch.test.ts` | Long-press on palette tile → drag ghost; release on canvas → section added. |

#### 10.6.4 Keyboard equivalence (every gesture in §7.3 has a keyboard test)

| Test file | Cases |
|---|---|
| `AdminPagesCanvas.kbd.tab-focus.test.ts` | Tab cycles through sections in DOM order; Shift+Tab reverses; focus visible on each. |
| `AdminPagesCanvas.kbd.pickup-move-drop.test.ts` | Focus section → press Space → assert "drag mode" state + live-region announces "X picked up". Press Arrow Right → focus moves to next drop target + announcement. Press Space → drop committed + announcement. Press Esc instead → cancelled + announcement. |
| `AdminPagesCanvas.kbd.resize.test.ts` | Focus section → press Shift+ArrowRight → colSpan increments by 1, pill flashes. Press Shift+ArrowLeft → decrements. At min: announcement "constraint reached, minimum 3 columns". |
| `AdminPagesCanvas.kbd.delete.test.ts` | Focus section → Backspace → confirm dialog appears + focus moved into it. Confirm = delete. Cancel = no-op. |
| `AdminPagesCanvas.kbd.duplicate.test.ts` | Focus section → Cmd+D → new section appears at next position + focus moves to it. |
| `AdminPagesCanvas.kbd.undo.test.ts` | Make 3 changes → Cmd+Z three times → state matches initial. Then Cmd+Shift+Z three times → state matches final. |
| `AdminPagesCanvas.kbd.shortcut-overlay.test.ts` | Press `?` → overlay opens with all shortcuts listed; Esc closes. |

#### 10.6.5 Accessibility — axe + live-region content

| Test file | Cases |
|---|---|
| `AdminPagesEditor.axe.idle.test.ts` | Render full editor (palette + canvas + inspector) → run axe → zero AA violations. |
| `AdminPagesEditor.axe.dragging.test.ts` | Same, but with a section in dragging state → zero AA violations (catches "drop indicator has no aria-label"). |
| `AdminPagesEditor.axe.inspector-open.test.ts` | Section selected, inspector showing config form → zero AA violations. |
| `AdminPagesEditor.axe.mobile-sheet-open.test.ts` | Bottom sheet open at 768px viewport → zero AA violations. |
| `useLayoutEditorA11y.announcements.test.ts` | Every drag transition produces a non-empty announcement; announcement is unique per transition (no `Moved` vs `Moved.` duplicates); cancel announcement does NOT say "dropped". |
| Color-only check | Drop indicators have icon + text in addition to color. Verifiable: `screen.getByRole('region', {name: /drop target/i})` finds them by text. |

#### 10.6.6 Performance tests (the 60fps budget)

| Test file | Cases |
|---|---|
| `useLayoutEditorDrag.perf.bench.ts` | Vitest benchmark: simulate 100 pointermove events; assert reactive update batches into a single Vue tick per frame. Measures via `performance.now()` — fail if total state update time > 16ms per frame. |
| `AdminPagesCanvas.perf.large-layout.test.ts` | Render layout with 50 sections + drag one → assert DOM mutations during drag < 5 (the dragged element + drop indicator only; everything else uses CSS transforms). |
| `useLayoutEditor.history.perf.test.ts` | Push 100 ops + trim to 50 → assert constant-time pop (no O(n) array shift). |

#### 10.6.7 End-to-end on real Nuxt server

| Test file | Cases |
|---|---|
| `apps/reference/test/editor-drag-drop.e2e.test.ts` | Boot Nuxt → log in as admin → load editor at `/admin/pages/<id>` → POST a payload via API simulating "section added at row 1 position 0" → reload → assert section appears in canvas DOM. (We can't really fire pointer events in a headless context without Playwright, but we can drive the editor STATE via the same composable + assert UI updates.) |
| `apps/reference/test/editor-publish-roundtrip.e2e.test.ts` | Editor → add hero + paragraph + image → publish → fetch `/about` → assert SSR HTML contains the section content; assert response is 200; assert `<head>` has correct `<title>` from page meta. |
| `apps/reference/test/editor-mobile-readonly.e2e.test.ts` | Same boot, but set viewport via Nuxt's `Cookie: cpub-viewport=phone` (a debug cookie we add for testing) → assert editor renders read-only banner; assert no drag handles in DOM; assert add-row button absent. |

#### 10.6.8 Cross-cutting test rules for drag-drop

- **No mocking the state machine.** Tests fire real pointer events or invoke real composable methods. Mocks limited to: network (`$fetch`), random IDs (deterministic uuid), `Date.now()` (for animation timing).
- **Every drag test asserts both visual + state.** A test that says "section moved" must check both the DOM (`screen.getByText('Hero').closest('[data-row-id]')?.getAttribute('data-row-id')`) AND the underlying state (`editor.draft.value.zones[0].rows[1].sections[0].id`).
- **Touch tests use `pointerType: 'touch'` explicitly**, not `simulate.touch()`. We use pointer events end-to-end so the test mirrors production.
- **Animation timing** controlled via `vi.useFakeTimers()` so tests are deterministic — never `setTimeout(..., 200)` then assert.
- **All tests run in JSDOM EXCEPT the perf bench** (which runs in real-browser-ish jsdom + happy-dom for closer fidelity).

Total drag-drop / resize / mobile / a11y test count across §10.6: **~110 tests**, all real, none cosmetic by the §10.2 criteria.

---

## 11. Cross-cutting concerns

### 11.1 i18n forward-compat

Layout `name` and PageMeta `title`/`description` are strings today. Future i18n: change to `string | Record<locale, string>` with a normaliser. Schema migration is straightforward; design now to make it cheap.

### 11.2 Accessibility

- Every section component MUST pass axe at AA (zero violations).
- Every editor control MUST be keyboard-navigable, with a visible focus ring (no `outline: none` cheats).
- **Drag-drop has keyboard equivalence from Phase 3b, not later** (§7.8). Picking up, moving, dropping, cancelling, resizing — all reachable via keyboard. ARIA live region narrates every state change.
- All drop-target indicators use icon + text + color (three independent signals) so colorblind users have unambiguous feedback.
- Bottom sheets on tablet are focus-trapped while open; Esc closes; backdrop tap closes.
- Phone editor read-only mode preserves keyboard-only inspect of every section.
- Color contrast assertions in the auto-form (warns if a section's config produces a combination that fails AA — reuses the contrast checker noted as future work in the theme editor doc).
- Animations respect `prefers-reduced-motion`: FLIP reorder becomes instant crossfade, drag-pickup scale becomes simple opacity, microinteractions skip entirely.

### 11.3 Touch + responsive standards

- Tap targets ≥ 44×44px on touch viewports (iOS HIG minimum).
- No hover-only affordances — every hover-revealed control has a tap-equivalent on touch.
- `pointer:coarse` media query swaps controls to touch-optimised variants.
- The OUTPUT (rendered pages) uses mobile-first CSS: base styles target phones; `@media (min-width: 641px)` and `(min-width: 1025px)` enhance for larger.
- Editor `pinch-to-zoom` state persists in `sessionStorage` per layout.
- All editor surfaces are usable at minimum supported widths: 1024px (full editor), 768px (tablet adaptation), 375px (read-only inspect).

### 11.4 Federation

Layouts and custom pages are **instance-local**. They do not federate. Documented in `CLAUDE.md`'s federation scope table.

### 11.5 Performance budgets

- Custom-page TTFB: < 200 ms warm, < 400 ms cold (matches existing content page budgets).
- `/api/layouts/by-route`: < 50 ms cached, < 150 ms cold.
- Editor save: < 300 ms (single layout + sections write).
- Editor preview update latency: < 16 ms per keystroke (token change → DOM repaint).

### 11.6 Backwards compatibility

- `HomepageSectionRenderer` stays in the codebase, deprecated, for one release after the layout engine ships. Removed in a follow-up.
- `instance_settings.homepage.sections` stays writeable while the legacy flag is on. Removed when the flag defaults to OFF.
- `/api/admin/homepage/sections` proxies to the new layout API once the flag flips ON.

---

## 12. Documentation deliverables per phase

Each phase ends with updates to:

- `docs/sessions/NNN-layout-engine-phase-X.md` (session log)
- `docs/reference/guides/layout-engine.md` (NEW — single comprehensive ref like `theme-editor.md`)
- `codebase-analysis/03-server-modules.md` (each new server module)
- `codebase-analysis/04-api-routes.md` (each new route group)
- `codebase-analysis/05-layer-pages-components.md` (LayoutSlot, sections, editor)
- `codebase-analysis/09-gotchas-and-invariants.md` (catch-all route order, conflict detection, section schema versioning, sanitisation contract)
- `codebase-analysis/13-architecture-patterns.md` (extend the pluggable-scene + section-registry pattern entry)
- `codebase-analysis/11-codebase-stats.md` (per-phase deltas)
- `CLAUDE.md` if a new standing rule emerges (e.g. "every section MUST register a Zod schema").

---

## 13. Open product decisions (need owner input before Phase 1)

1. **Reserved-prefix list** for custom page paths — confirm: `/api`, `/_nuxt`, `/__nuxt`, `/.well-known`, `/admin`, `/auth`. Or just block any path that's already file-routed?
2. **Should custom pages support per-page custom CSS?** A `customCss` field on PageMeta — sanitised, scoped to the page. Trade-off: power vs. footgun (admins can break their own site).
3. **Section access roles**: do members-only sections need a separate permission from members-only pages? (Recommendation: yes, default to "match parent page" but allow override.)
4. **Custom HTML feature flag**: should `custom-html` and `iframe` sections require a separate `features.advancedSections` flag, defaulting OFF? (Recommendation: yes — these are the highest-blast-radius sections.)
5. **Layout export/import**: same `.cpub-theme.json` style for `.cpub-layout.json`? Useful for sharing across instances. Phase 8 deliverable?

---

## 14. What success looks like

After Phase 4 ships (the v1 milestone):

- An admin opens `/admin/pages`, clicks **New page**, types `/about`, picks a `two-column` frame, **drags** a Hero from the palette into the main zone, **drags** its right edge to span 8/12 (a paragraph snaps into the remaining 4/12 when dropped), **drags** a contact-form into a new row below, clicks **Save & publish**. Total time: under 90 seconds.
- A browser visits `https://commonpub.io/about` from a phone, tablet, AND desktop — sees three correctly responsive layouts (rows stack on phone, side-by-side on tablet+, with the right colSpans at each breakpoint). TTFB < 200 ms on all three.
- The same admin opens `/admin/pages` from an iPad, taps the homepage, taps a section in the sidebar zone, taps the FAB, swipes up the palette, taps a Stats section to add it, publishes — all without leaving touch.
- A screen reader user navigates the editor with Tab + Space + Arrow keys, hears every move announced, drops a section accurately, and publishes — zero mouse events fired.
- Existing tests stay green; new tests reach >85% line coverage on the new modules; the section-XSS test suite includes every payload from the OWASP cheat sheet; drag-drop tests (§10.6) total >110 cases including keyboard equivalence + touch + perf benches.
- Migration count: 5 → 6 (one new migration). No new dependencies (drag-drop, resize, undo are pointer-event + CSS Grid + plain TypeScript).

Every test added is real per §10.2. Cosmetic tests are explicitly rejected in code review. Drag-drop tests mock only the network, never the state machine.
