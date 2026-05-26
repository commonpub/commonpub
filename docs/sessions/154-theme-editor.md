# Session 154 — Admin theme editor

**Date**: 2026-05-26
**Branch**: main
**Status**: implemented, not yet published

## Why

Custom themes from thin layer apps (e.g. deveco.io's `assets/deveco-theme.css`) had no presence in the admin UI — they hijacked `:root` via CSS file load order, but the picker only knew about the five built-in themes hard-coded in `@commonpub/ui`. The admin couldn't see, switch to, or edit them. There was also no first-class editor: `theme.token_overrides` existed as a saved-but-unapplied bag of strings, and the UI for adding overrides was a two-input strip.

User asked for a complete theme management system: visible custom themes (auto-detected and code-registered), a full editor with live preview, import/export, and an LLM ref doc.

## What shipped

Three theme **sources** now feed the same admin picker:

| Source | Where it lives | Editable in UI? |
|---|---|---|
| Built-in | `@commonpub/ui` (5 themes) | No |
| Code-registered | thin app's `commonpub.config.ts` `themes:` array | No (fork → custom to edit) |
| DB-stored custom | `instance_settings.theme.custom` JSON array | Yes |

DB-stored themes use the data-attribute prefix `cpub-custom-<slug>`. The SSR middleware looks up the theme record, serializes its `tokens` map via `tokensToCss(':root', tokens)`, and injects an inline `<style id="cpub-theme-inline">` via `useHead` — first paint is correct.

### New surfaces

- `/admin/theme` (rebuilt) — family-grouped list across all three sources; per-card actions (Select / Edit / Duplicate / Fork / Export / Delete); top-of-page "Capture current site theme" CTA when the live `:root` differs from the built-in defaults; legacy token-overrides panel moved to a collapsible details
- `/admin/theme/edit/[id]` (new) — split-pane editor with grouped collapsible token panel + live preview pane; supports `__new` id for create-mode seeded from sessionStorage
- Special URL `/admin/theme/edit/__new` handles create-mode (capture, duplicate, fork, blank, import all route through it)

### Preview scene architecture (pluggable, future-proof)

`<AdminThemePreviewPane>` hosts a scene picker. Three scenes shipped:

- `AdminThemeSceneGallery` — buttons, cards, badges, alerts, code, shadows, forms, typography
- `AdminThemeSceneProse` — long-form article mockup (headings, blockquote, table, code, list)
- `AdminThemeSceneAdmin` — fake admin shell (topbar, sidebar, stat cards, table)

Picker also has a Light/Dark mode toggle so admins can preview both modes without leaving the editor.

The picker exists today even with just three scenes because the user wants the system to absorb future scenes: `iframe-route` (real route in an iframe), `page-layout` (editable section list mockup), `layout-builder` (drag-and-drop section composer). Themes are first; layouts are next.

### Token registry consolidated

`packages/ui/src/theme.ts` now exports `TOKEN_SPECS: TokenSpec[]` — one entry per canonical token with `key`, `group`, `kind`, `default`, optional `description`. The editor reads this list, buckets by group via `tokensByGroup()`, and renders one `<AdminThemeTokenInput>` per spec. The input picks its control by `spec.kind`:

- `color` → native color picker + hex/rgba text fallback (with transparent checkerboard for `rgba()`)
- `length` → split number + unit dropdown + raw text fallback (so `var(--accent)` still works)
- `font-family` → text field rendered in the picked font
- `font-weight` → restricted dropdown 100–900
- `number` / `shadow` / `transition` / `string` → raw text fields

Each row shows a "reset to default" button when modified; clicking it deletes the override from the draft map so the parent-theme value comes through.

### Import / export

`buildExportFile(theme) → { filename, content }` + `parseExportFile(text) → CustomThemeRecord` in `composables/useThemeAdmin.ts`. Format:

```json
{
  "formatVersion": 1,
  "exportedAt": "<ISO>",
  "theme": { ... CustomThemeRecord ... }
}
```

Files named `<id>.cpub-theme.json`. On import, id collisions auto-suffix (`autumn` → `autumn-2`).

### Capture discovery

`useThemeAdmin.detectAppliedOverrides()` reads `getComputedStyle(document.documentElement)` for every `TOKEN_SPECS` key, normalizes whitespace, compares against the canonical default, and surfaces the diff. The list page shows a banner when `count > 0`:

> ⚡ Your site has a custom theme — we detected N tokens on `:root`. Capture it.

Clicking **Capture** seeds a new DB-stored custom theme with the detected tokens and opens the editor. Result: a deveco-style thin app can have its visual identity captured into an editable theme without ever touching the CSS file.

### Config-registered themes

`@commonpub/config` types/schema extended with optional `themes: RegisteredTheme[]`. Thin apps declare:

```ts
themes: [
  { id: 'deveco', name: 'devEco', family: 'deveco', isDark: false, pairId: 'deveco-dark' },
]
```

The SSR middleware accepts these IDs as valid `data-theme` values (cross-checked against `useConfig().themes` so the runtime registry is the source of truth). The admin picker shows them as **From code** with a purple "registered" badge.

## Files changed / added

| File | Change |
|---|---|
| `packages/schema/src/validators.ts` | + `customThemeSchema`, `customThemeUpdateSchema`, `themeExportSchema`, `themeTokenMapSchema`, `customThemeIdSchema`, `themeTokenKeySchema`, `themeTokenValueSchema` |
| `packages/config/src/types.ts` | + `RegisteredTheme` interface; + `themes?: RegisteredTheme[]` on `CommonPubConfig` |
| `packages/config/src/schema.ts` | + `registeredThemeSchema`; + `themes` in `configSchema` |
| `packages/config/src/index.ts` | + re-exports |
| `packages/ui/src/theme.ts` | rewritten: + `TokenSpec`, `TokenGroup`, `TokenKind`, `TOKEN_SPECS`, `TOKEN_GROUP_LABELS`, `TOKEN_GROUP_ORDER`, `ALIAS_TOKEN_NAMES`, `tokensByGroup`, `getTokenSpec`, `tokensToCss`, `previewFromTokens`, `isBuiltInThemeId` — `TOKEN_NAMES` preserved (TOKEN_SPECS keys + aliases) |
| `packages/ui/src/index.ts` | + re-exports for the new symbols |
| `packages/server/src/theme.ts` | + `CustomThemeRecord`, `listCustomThemes`, `getCustomTheme`, `saveCustomTheme`, `deleteCustomTheme`, `customThemeDataAttr`, `parseCustomThemeId`, `CUSTOM_THEME_PREFIX`; `resolveTheme` now accepts custom + registered theme IDs |
| `packages/server/src/index.ts` | + re-exports |
| `packages/server/src/__tests__/custom-themes.integration.test.ts` | new — 10 tests, all green |
| `packages/server/src/__tests__/theme-oauth.integration.test.ts` | updated — `setUserTheme` is now permissive (validation moved to API layer) |
| `layers/base/server/api/admin/themes/index.get.ts` | new — unified list |
| `layers/base/server/api/admin/themes/index.post.ts` | new — create |
| `layers/base/server/api/admin/themes/[id].get.ts` | new |
| `layers/base/server/api/admin/themes/[id].put.ts` | new |
| `layers/base/server/api/admin/themes/[id].delete.ts` | new — auto-resets `theme.default` if the deleted theme was active |
| `layers/base/server/api/admin/themes/discover.get.ts` | new — returns base token defaults for client-side diff |
| `layers/base/server/api/profile/theme.put.ts` | length cap bumped 32→96 for `cpub-custom-*` IDs |
| `layers/base/server/utils/instanceTheme.ts` | rewritten: + `resolveThemeContext` with custom-theme + registered-theme support; injects `event.context.themeInlineCss` |
| `layers/base/server/middleware/theme.ts` | rewritten: passes registered IDs through, builds inline CSS via `tokensToCss` |
| `layers/base/plugins/theme.ts` | forwards `themeInlineCss` into `useHead({ style })` so SSR ships the custom tokens |
| `layers/base/composables/useTheme.ts` | now handles custom themes (no client-side variant flip; server picks the pair on next request) |
| `layers/base/composables/useThemeAdmin.ts` | new — singleton client-side state, family builder, discovery, export/import helpers, `parseCustomThemeId`/`CUSTOM_THEME_PREFIX` re-declarations (server module is Node-only) |
| `layers/base/pages/admin/theme.vue` | moved → `theme/index.vue` and rewritten |
| `layers/base/pages/admin/theme/edit/[id].vue` | new — split-pane editor |
| `layers/base/components/admin/theme/AdminThemeFamilyCard.vue` | new |
| `layers/base/components/admin/theme/AdminThemePreviewPane.vue` | new — scene host |
| `layers/base/components/admin/theme/AdminThemeSceneGallery.vue` | new |
| `layers/base/components/admin/theme/AdminThemeSceneProse.vue` | new |
| `layers/base/components/admin/theme/AdminThemeSceneAdmin.vue` | new |
| `layers/base/components/admin/theme/AdminThemeTokenGroup.vue` | new |
| `layers/base/components/admin/theme/AdminThemeTokenInput.vue` | new |
| `docs/reference/guides/theme-editor.md` | new — complete LLM ref |
| `docs/reference/guides/theming.md` | + cross-link to the new doc |
| `docs/reference/index.md` | + entry for the new doc |

## Decisions made

- **DB storage**: single `instance_settings` row keyed `theme.custom` holding a JSON array. No new table — the data is small (admins manage a handful of themes), atomic upserts are simple, and migrations are avoided. **Migration count: 5 (unchanged).**
- **Custom theme ID prefix**: `cpub-custom-<slug>` so it can never collide with built-in or future registered IDs.
- **Validation split**: `setUserTheme` and `resolveTheme` do structural validation only (slug regex + custom-prefix recognition). Cross-checking against the actual list of available themes happens at the API layer where the runtime config is reachable. On read, unknown IDs fall back silently to `base` — users shouldn't see a broken theme just because an admin deleted a custom one.
- **Sparse tokens**: the editor only stores tokens that differ from the parent theme. Empty/missing means "inherit". Keeps JSON small + lets parent updates propagate.
- **Scene system NOW even though we only have 3 scenes**: the picker is the architectural seed for the future layout-builder work. Wiring it later would mean migrating the editor; wiring it now costs almost nothing and signals where this grows.
- **Inline style cascade order**: built-in CSS → registered CSS → inline `<style id="cpub-theme-inline">` (no `@layer`). Most specific wins; no `!important` needed.
- **Token overrides preserved**: the legacy `theme.token_overrides` mechanism stays (collapsed in a `<details>`). Useful for "flip the accent for one week" without authoring a full theme.

## Verification

| Package | Tests | Status |
|---|---|---|
| `@commonpub/schema` | 372 | ✅ |
| `@commonpub/config` | 23 | ✅ |
| `@commonpub/ui` | 238 (+21 new in `tokens.test.ts`) | ✅ |
| `@commonpub/server` | 974 (+10 new in `custom-themes.integration.test.ts`) | ✅ |
| `@commonpub/layer` | 85 | ✅ |
| `apps/reference` `vue-tsc --noEmit` | — | ✅ clean |

No new feature flags, no new migrations, no new external dependencies.

## Post-implementation audit pass

After the initial implementation an ultrathink audit landed:

1. **`useThemeAdmin.ts` (327 lines) split** into 5 files for cleaner separation:
   - `composables/useThemeAdmin.ts` (167) — singleton state + family builder
   - `utils/themeDiscovery.ts` (67) — `detectAppliedOverrides`, `estimateLuminance`
   - `utils/themeIO.ts` (79) — `buildExportFile`, `parseExportFile`, `downloadThemeFile`
   - `utils/themeIds.ts` (25) — `CUSTOM_THEME_PREFIX`, `parseCustomThemeId`, `customThemeDataAttr`
   - `types/theme.ts` (54) — `CustomThemeRecord`, `RegisteredThemeRecord`, `ThemesPayload`, `ThemeFamilyView`

2. **`packages/ui/src/theme.ts` (421 lines) split**:
   - `theme.ts` (177) — `BUILT_IN_THEMES`, `applyThemeToElement`, `tokensToCss`, `previewFromTokens`
   - `tokens.ts` (287) — `TOKEN_SPECS`, `ALIAS_TOKEN_NAMES`, `TOKEN_GROUP_LABELS`, `tokensByGroup`, `validateTokenOverrides`
   - `theme.ts` re-exports the tokens surface so existing imports don't break

3. **List page (`pages/admin/theme/index.vue`)** 539 → 424 lines by extracting the legacy token-overrides panel into `AdminThemeOverridesPanel.vue` (222 lines, self-contained).

4. **Added `AdminThemeOverridesPanel.vue`** — the panel owns its own draft state, emits `save` with the final map. Page only persists.

5. **Added `downloadThemeFile`** in `utils/themeIO.ts` and switched both pages to use it. Removed ~12 lines of duplicated `Blob`/`URL.createObjectURL`/anchor-click boilerplate per call site.

6. **New UI tests** (`packages/ui/src/__tests__/tokens.test.ts`, 21 tests) covering `TOKEN_SPECS`, `ALIAS_TOKEN_NAMES`, `isBuiltInThemeId`, `tokensToCss` (including XSS escape tests — `</style>` termination, newline injection, sanitisation), `previewFromTokens`.

7. **Caught a real bug** via the new alias-duplication test: `color-link` and `color-link-hover` were in BOTH `TOKEN_SPECS` and `ALIAS_TOKEN_NAMES`. Removed the aliases (canonical entries already cover them).

8. **Codebase-analysis docs updated**:
   - `03-server-modules.md` — expanded the theme.ts entry with the new CRUD surface + cross-file `CUSTOM_THEME_PREFIX` contract
   - `04-api-routes.md` — table of all 6 new admin theme routes
   - `05-layer-pages-components.md` — new admin page, new composable, updated SSR theme plumbing section (now includes the inline-CSS injection step)
   - `09-gotchas-and-invariants.md` — 4 new entries: inline-style cascade, prefix duplication, `tokensToCss` escaping, `/theme/`-anchored gitignore footgun
   - `11-codebase-stats.md` — bumped counts (API +6, pages +1, components +8, composables +1, tests ~+31)
   - `13-architecture-patterns.md` — documented the "pluggable scene pattern" as a generalised approach (ship the picker on day 1 with a 3-item list, future plugins drop in without restructuring)

### File-size verdict after audit

| File | Before | After | Norm comparison |
|---|---|---|---|
| `useThemeAdmin.ts` | 327 | 167 | well under `useContentSave.ts` 265 |
| `packages/ui/src/theme.ts` | 421 | 177 (+ 287 in tokens.ts) | each focused |
| `pages/admin/theme/index.vue` | 539 | 424 | typical (vs `federation.vue` 547, `api-keys.vue` 464) |
| `pages/admin/theme/edit/[id].vue` | 554 | 547 | typical |
| Scene/family/input components | 140–353 | unchanged | within norm (vs `ContentCard.vue` 352, `EventCalendar.vue` 301) |

No file is bloated relative to its scope.

## Not done in this session

These are scope-cuts called out explicitly in the LLM ref doc:

- **Per-page layout editing** — placeholder in the scene picker; needs a layout-JSON schema + per-page composer
- **Component-level theme overrides** beyond tokens (e.g. "this theme also reshapes the button") — achievable today via a CSS file shipped alongside a code-registered theme; not authorable in the editor
- **Font upload / Google Fonts integration** — admins can paste any CSS value into the font-family input, but loading the font itself is still the thin app's job
- **Theme sharing / marketplace** — export JSON is the portable format; no public registry
- **WCAG contrast checking** — the gallery scene has alert primitives that could host a checker UI when the contrast primitive lands

## Open questions for next session

1. Should `cpub-custom-*` themes be installable from the public CDN of a hosted instance? (Would let `deveco.io` ship a "use our theme" button.) Probably yes; needs a CORS-fetched theme JSON spec.
2. Should the layer-app expose a way to ship default DB themes (seed data)? Right now an admin must capture-on-first-visit. A `commonpub.config.ts` `defaultCustomThemes:` field would be cleaner.
3. The discovery banner currently fires once per page load. Should it be dismissible-per-session?

## Commits this session

(pending — to be added on commit)

## Standing rule reminders

- Schema is the work. **Migration count: 5 (unchanged).**
- No feature without a flag. **No new flags.**
- `var(--*)` only — every new component (preview scenes, editor) uses `var(--*)` exclusively. The inline-style injection IS the override semantic, not a hardcoded value.
- WCAG 2.1 AA min — all editor controls have visible focus rings; color picker has text fallback for screen-reader entry.
- Sessions logged at `docs/sessions/154-theme-editor.md` (this file).
- Memory: no new feedback files (`feedback_nuxt_pathprefix_components` already covered the prefix discipline; `feedback_css_layer_specificity` already covered the cascade rules).
