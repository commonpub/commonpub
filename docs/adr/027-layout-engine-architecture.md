# ADR 027 — Layout engine architecture

**Status**: Accepted (Phase 1c shipped session 158; Phase 3a editor shipped session 160 + 4 audit rounds)
**Date**: 2026-05-28 (written retroactively; design ratified across sessions 155-160)
**Supersedes**: nothing (layout engine is greenfield; the legacy `instance_settings.homepage.sections` JSON remains as a backward-compat fallback path)
**Author**: project author with parallel-agent audit synthesis

## Context

CommonPub's homepage and other key routes need DB-stored, admin-editable layouts beyond the legacy `instance_settings.homepage.sections` JSON. The legacy approach has two structural problems:
- One layout (homepage) — no extensibility to other routes or custom pages
- Editor is a sortable list, not a visual canvas — can't represent multi-column rows or per-breakpoint responsive overrides

The session 155 design doc (`docs/plans/layout-and-pages.md`, 1342 lines) sets out the requirements: zone-keyed scope model, 12-column responsive grid, section registry, draft/published states with versioning, admin-only editor, optimistic concurrency, instance-local (no federation).

## Decision

Adopt a **registry-and-arranger** architecture with four cooperating layers:

### 1. Data model — 4 tables, scope-keyed

```
layouts (1, UNIQUE on scope) → layout_rows (N per zone) → layout_sections (N per row)
                                                          ↓
                                                      layout_versions (immutable publish snapshots)
```

A `layouts` row is identified by `(scope_type, scope_key)`:
- `('route', '/')` — homepage
- `('route', '/blog')` — blog index
- `('custom-page', '/about')` — admin-created page
- `('virtual', '__footer')`, `('virtual', '__not-found')`, `('virtual', '__error')` — page chrome

`layout_versions` rows are immutable snapshots; publish copies the current rows+sections into a new version row and sets `published_version_id`. Revert reverses that.

**Cascade**: deleting a layout cascades to rows → sections → versions via FK. Homepage scope special-cased to require a confirmation header (R4 audit).

### 2. Section registry — sections are ARRANGED, not duplicated

The registry (`packages/ui/src/sections.ts` types + `layers/base/sections/registry.ts` runtime) holds `SectionDefinition` entries:

```ts
interface SectionDefinition<TConfig> {
  type: string;            // kebab-case slug, used in LayoutSection.type
  configSchema: ZodType<TConfig>;  // Zod-typed config
  defaultConfig: TConfig;
  component: Component;    // Vue renderer — typically an EXISTING Block*View or homepage *Section.vue
  propMap?: (props: { config; meta }) => Record<string, unknown>;  // adapt config to component's prop shape
  schemaVersion: number;   // bumped when configSchema changes shape
  migrations?: Record<number, (oldConfig) => TConfig>;
  // … display metadata (name, icon, category, status, colSpan limits, etc.)
}
```

**The propMap field is load-bearing.** Stage E (session 159) caught the "I built 17 parallel Section*.vue renderers when 16 of them duplicated existing Block + Homepage components" mistake. The fix: point `component` at the existing component, use `propMap` to adapt the standard `{config, meta}` shape to whatever the target expects. See [[feedback-reuse-existing-components]] memory + `docs/plans/stage-e-unification.md`.

### 3. Runtime — `<LayoutSlot>` + `useLayout`

Pages declare zones with `<LayoutSlot route="/" zone="full-width" />`. The composable `useLayout(path)` calls `GET /api/layouts/by-route?path=<path>` (the public endpoint). When `layout.value === null` (feature off, no layout, or access-restricted), the page falls back to its legacy renderer via `v-if`. **Auto-fallback is non-negotiable** — it's what prevents a flag flip without a seeded layout from blanking the page.

**Cache** (`layers/base/server/utils/layoutCache.ts`): per-pod in-memory Map with 60s TTL. **Bounded LRU at 1000 entries** (R4 fix) to prevent unbounded-Map DOS. **Cache key trifurcated** (R3 fix): `admin:<path>` / `members:<path>` / `anon:<path>` to prevent draft + access-restricted layouts leaking across tiers. Invalidation: every write handler calls `invalidateLayoutsByRouteCache()` (full-clear); contract test locks this across all 7 write handlers.

### 4. Editor — 3-column shell with auto-save

`/admin/layouts` (list) + `/admin/layouts/[id]` (editor) under feature flag `layoutEngine` (CLAUDE.md rule #2). Editor shell:
- Toolbar: viewport segmented control (mobile/tablet/desktop preview at 375/768/desktop), save indicator with relative timestamp ("Saved · 2m ago"), Save / Discard / Publish buttons, Strapi 3-state status pill (Draft / Modified / Published)
- Palette (left): catalog of registered section types grouped by category (drag-and-drop arrives in Phase 3b — currently READ-ONLY listing)
- Canvas (center): `<LayoutSlot :editable previewOverride>` renders the draft state
- Inspector (right): page-meta form (title / description / ogImage / ogType / access / frame); row + section forms in 3b/3f

**Auto-save**: `useLayoutAutoSave` watches the editor's `dirty` ref, debounces 1500ms (per design doc §7.13), calls `useLayoutEditor.save()`. Plus `visibilitychange` flush on tab-hide and `beforeunload` + `onBeforeRouteLeave` guards on in-app navigation (R4).

**Optimistic concurrency**: client sends `If-Match: <updatedAt>` header; server returns 409 on mismatch with `{code: 'LAYOUT_CONFLICT'}`. Client surfaces 3-option modal — `Reload their version` (primary, default-focused) / `Keep editing here` (neutral) / `Overwrite their changes` (destructive). Single-flight save guard prevents parallel PUTs with stale If-Match.

## Decisions made along the way

- **Per-section configSchema validation at the API boundary** (deferred). The server PUT should validate `section.config` against each section's registered Zod schema, not just the top-level layout shape. Validator implemented + 5 tests passing in session 160 R2; wiring rolled back when Nitro server bundle couldn't parse `.vue` (registry transitively imports Vue components). Proper fix: move per-section Zod schemas to `@commonpub/schema` (server-safe), keep Vue components in `@commonpub/ui`. Documented at `docs/sessions/160-audit-round2-deep.md`.
- **Hybrid library adoption for Phase 3b drag-drop**: `grid-layout-plus@1.1.1` (within-row drag/resize) + `@vue-dnd-kit/core@2.4.6` (palette → canvas drag + cross-zone) + FormKit deferred to Phase 3e. Rationale + alternatives rejected at [[feedback-phase-3-hybrid-libraries]].
- **`force: true` semantics on migrate-homepage are destructive** (R4 catch). The legacy `/admin/homepage` save hook originally ran `force: true` on every save — destroying bespoke layout-engine edits + entire publish history. R4 fix: flipped to `force: false` (creates on first save, never overwrites) + added deprecation banner directing operators to the new editor.
- **Layouts are local-only** — never federate. Verified by R4 audit (zero references in `@commonpub/protocol`). Documented in CLAUDE.md Federation Scope table (R5 addition).

## Consequences

### Positive

- **Extensibility**: any route, any custom page, any virtual zone gets the same architecture
- **WYSIWYG editor**: the canvas IS the production `<LayoutSlot>` with `:editable`; no separate rendering engine
- **Versioning**: every publish is an immutable snapshot; revert is one-click
- **Section reuse**: 16 of 17 sections in Phase 1c catalog reuse existing Block + Homepage components via propMap (Stage E unification)
- **Public-route hot path**: optimized at the SQL + cache layers (R4 fix + bounded LRU)
- **Operator forensics**: all 7 destructive admin paths emit greppable `cpub.audit.layout.*` stdout logs

### Negative / trade-offs

- **Per-section validation at write time is deferred** (residual security risk — admin can craft `section.config` to bypass URL guards / size caps / sandbox flags). Mitigated by admin-only auth + audit logs + top-level Zod's array bounds. Proper fix queued.
- **Multi-pod cache divergence**: each pod has its own in-memory cache; after a write, other pods serve stale up to 60s. Acceptable for v1; Phase 10 replaces with ETag-based revalidation.
- **No federation story for layouts** — instances can't share layouts. If we ever want this, a separate FEP-style proposal is needed.
- **Legacy `/admin/homepage` editor remains** — non-destructive auto-sync preserves backward compat but adds a maintenance surface. Deprecation banner directs operators to the new editor.

## Standing rules this decision implies

- CLAUDE.md rule #2: layout engine gated on `features.layoutEngine` flag (default OFF)
- CLAUDE.md rule #3: every section component uses `var(--*)` only — locked by a per-component test sweep
- CLAUDE.md rule #11 + #12: every section ships with `defaultConfig.parses-against-configSchema` test + WCAG 2.1 AA on every interactive element
- (R5 addition) **Layouts local-only in v1**: layout tables never serialize through `@commonpub/protocol`. New federation work must not include them without an explicit ADR superseding this one.

## References

- Design doc: `docs/plans/layout-and-pages.md` (1342 lines)
- LLM reference: `docs/reference/guides/layout-engine.md`
- Phase 3 plan: `docs/plans/phase-3-editor.md`
- Rollout tracker: `docs/plans/layout-engine-rollout.md`
- Stage E unification: `docs/plans/stage-e-unification.md`
- Session 160 main log: `docs/sessions/160-phase-3a-editor-shell.md`
- Audit docs: `docs/sessions/160-audit-godmode.md` (R1), `160-audit-round2-deep.md` (R2), `160-audit-round3-ops.md` (R3), `160-audit-round4-deep.md` (R4)
