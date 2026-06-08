# Theme Editor

> Admin-facing system for selecting, authoring, importing, exporting, and applying themes. Sits on top of the lower-level [`theming.md`](theming.md) primitives — that doc describes how tokens reach the browser; this one describes how admins (and code) tell the system *which* tokens to use.

**Source**:
- Schema: `packages/schema/src/validators.ts` (customThemeSchema, themeExportSchema)
- Config: `packages/config/src/types.ts` (RegisteredTheme)
- UI surface: `packages/ui/src/theme.ts` (TOKEN_SPECS, TOKEN_GROUP_LABELS, tokensToCss, previewFromTokens)
- Server CRUD: `packages/server/src/theme.ts` (CustomThemeRecord, listCustomThemes, saveCustomTheme, deleteCustomTheme)
- SSR resolution: `layers/base/server/utils/instanceTheme.ts`, `layers/base/server/middleware/theme.ts`
- Admin UI: `layers/base/pages/admin/theme/`, `layers/base/components/admin/theme/`
- Client composable: `layers/base/composables/useThemeAdmin.ts`

---

## Three theme sources

Every theme available to the admin picker comes from exactly one of:

| Source | Authored in | Stored in | Editable in UI? | Example |
|---|---|---|---|---|
| **Built-in** | `@commonpub/ui` CSS files | shipped with the layer | No | `base`, `dark`, `agora`, `agora-dark`, `generics` |
| **Code-registered** | The thin layer app's `commonpub.config.ts` `themes:` array + its own CSS file loaded via Nuxt `css:` | the thin app's repo | No (fork → custom to edit) | `deveco` (devEco.io's brand theme) |
| **DB-stored custom** | The admin UI editor (or imported JSON) | `instance_settings.theme.custom` (JSON array) | Yes | anything an admin creates |

The picker at `/admin/theme` merges all three into one family-grouped list. Custom themes win the meta-tug-of-war (their name/description override anything pre-existing for the same family slug).

DB-stored custom themes use a special data-attribute prefix: `cpub-custom-<slug>`. So saving a custom theme with `id: 'autumn'` produces `<html data-theme="cpub-custom-autumn">` plus an inline `<style>:root[data-theme="cpub-custom-autumn"] { --bg: ... }</style>` injected during SSR.

---

## How a thin layer app registers a theme

```ts
// commonpub.config.ts
import { defineCommonPubConfig } from '@commonpub/config';

export default defineCommonPubConfig({
  instance: { /* ... */ },
  features: { /* ... */ },
  auth: { /* ... */ },
  docs: { searchLanguage: 'english' },
  themes: [
    {
      id: 'deveco',           // must match the `[data-theme="deveco"]` selector in your CSS
      name: 'devEco',
      description: 'Edge AI brand palette',
      family: 'deveco',
      isDark: false,
      pairId: 'deveco-dark',  // optional: the dark sibling in the same family
      preview: {              // optional: swatches shown in the picker before the theme loads
        bg: '#f9fafb', surface: '#ffffff', accent: '#00e7ad', text: '#111827', border: '#e5e7eb',
      },
    },
    // ...the dark sibling, if any
  ],
});
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['@commonpub/layer'],
  css: [
    '~/assets/deveco-theme.css',  // loaded after the layer's theme files
  ],
});
```

```css
/* assets/deveco-theme.css */
:root {                       /* applies when this file is loaded — i.e. on every page */
  --bg: #f9fafb;
  --accent: #00e7ad;
  /* ... */
}

[data-theme="deveco"] :root,   /* ...or scoped to your registered id */
[data-theme="deveco"] {
  /* same overrides */
}
```

**Tip**: ship the CSS overrides under both selectors (`:root` and `[data-theme="<id>"]`). The `:root` form makes the theme always-applied (good for "this *is* the site's look"); the `[data-theme="<id>"]` form lets the admin select between your theme and another. With both, the registered theme behaves exactly like a built-in.

---

## Discovery + capture

When a thin layer app ships `:root` token overrides (the deveco pattern), an admin visiting `/admin/theme` sees a banner:

> ⚡ **Your site has a custom theme** — we detected N CSS tokens on `:root` that differ from the built-in defaults. Capture it.

Clicking **Capture** seeds a new DB-stored custom theme with the detected tokens and opens the editor at `/admin/theme/edit/__new`. The admin can then refine and save — without ever touching the layer-app's CSS file.

Detection logic lives in `useThemeAdmin.detectAppliedOverrides()`:

1. Read `getComputedStyle(document.documentElement)` for every canonical token in `TOKEN_SPECS`.
2. Normalize whitespace and compare against the built-in `default` value.
3. Anything different is an override. The admin sees the count, and on capture the diff becomes the new theme's `tokens` map.

The crude dark-mode heuristic (`estimateLuminance(bg) < 0.5`) seeds the `isDark` flag for the captured theme; the admin can flip it after.

---

## DB-stored theme record

```ts
interface CustomThemeRecord {
  id: string;                  // slug, used in `cpub-custom-<id>` data-attr
  name: string;                // display name
  description?: string;
  family: string;              // groups light + dark variants
  isDark: boolean;
  pairId?: string;             // sibling theme id for the opposite mode
  parentTheme: string;         // built-in id whose CSS file provides inherited defaults
  tokens: Record<string, string>;  // sparse: only overridden tokens
  createdAt: string;           // ISO
  updatedAt: string;
}
```

Storage: a single row in `instance_settings` with `key = 'theme.custom'` and a JSON array `value`. Atomic upsert — listing is O(themes), all CRUD goes through `packages/server/src/theme.ts`.

The `tokens` map is **sparse**: empty string or missing key means "fall through to the parent theme's value". This keeps the JSON small and lets parent-theme updates propagate.

---

## Token registry (`TOKEN_SPECS`)

The single source of truth for what tokens exist, what they mean, and what input control renders for each:

```ts
// packages/ui/src/theme.ts
interface TokenSpec {
  key: string;              // token name without `--` prefix
  group: TokenGroup;        // 'surfaces' | 'text' | 'accent' | …
  kind: TokenKind;          // 'color' | 'length' | 'number' | 'font-family' | 'font-weight' | 'shadow' | 'transition' | 'string'
  description?: string;
  default: string;          // base.css default — used for reset + diff
}
```

The editor reads `TOKEN_SPECS`, calls `tokensByGroup()` to bucket them, renders each spec via `<AdminThemeTokenInput :spec="..." />` (which picks the right input based on `kind`), and writes back into the draft `tokens` map.

To add a new token to the editor:

1. Add the CSS variable to `packages/ui/theme/base.css` (and any other family files).
2. Add a `TokenSpec` entry to `TOKEN_SPECS` in `packages/ui/src/theme.ts`.
3. (Optional) If you want it in a new group, add the group to `TokenGroup`, `TOKEN_GROUP_LABELS`, and `TOKEN_GROUP_ORDER`.

That's it — the editor picks it up automatically.

---

## API surface (`/api/admin/themes`)

All routes require `admin` feature + admin role.

| Verb | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/admin/themes` | — | `{ builtIn: ThemeDefinition[], registered: RegisteredTheme[], custom: CustomThemeRecord[] }` |
| GET | `/api/admin/themes/discover` | — | `{ defaults: Record<string, string> }` — every TOKEN_SPECS default, for client-side diff |
| POST | `/api/admin/themes` | `customThemeSchema` | Created `CustomThemeRecord` |
| GET | `/api/admin/themes/:id` | — | `CustomThemeRecord` (404 if not found) |
| PUT | `/api/admin/themes/:id` | `customThemeSchema` (id must match URL) | Updated `CustomThemeRecord` |
| DELETE | `/api/admin/themes/:id` | — | `{ ok: true, resetDefault: boolean }` — `resetDefault` is true if the deleted theme was active and the instance default was reverted to `base` |

All write routes call `invalidateThemeCache()` so the SSR middleware picks up changes on the next request.

---

## SSR application

`layers/base/server/middleware/theme.ts` runs on every page request and:

1. Reads the user's `cpub-color-scheme` cookie (`light` | `dark` | none).
2. Resolves `theme.default` from DB (cached 60s).
3. If the resolved theme is a DB-stored custom theme, looks it up and merges its `tokens` map into an `injectedTokens` map.
4. Merges any `theme.token_overrides` (the ad-hoc tweak feature) on top — overrides always win.
5. Builds a CSS rule body with `tokensToCss(':root', injectedTokens)` and stashes it on `event.context.themeInlineCss`.

`layers/base/plugins/theme.ts` runs in the page render and:

1. Sets `<html data-theme="...">` via `useHead({ htmlAttrs: { 'data-theme': ... } })`.
2. If `themeInlineCss` is non-empty, registers a `<style id="cpub-theme-inline">` tag via `useHead({ style: [...] })` so it lands in the document head with a stable key (replaceable on navigation).

Cascade order at first paint:

1. Built-in `theme/*.css` files (loaded via Nuxt `css:` array).
2. Code-registered theme CSS file (loaded by the thin app's `css:`).
3. Inline `:root { ... }` style block (custom theme + instance overrides).

Result: every level of customization wins over the level below, and the most specific (the editor's in-progress tokens) wins overall.

---

## Editor UX architecture

`/admin/theme/edit/[id].vue` is laid out as:

```
┌────────────────────────────────────────────────────────────────┐
│ ← Themes │ Name │ ID │ Family │ Parent │ Light/Dark │ Pair │ … │   toolbar
│                                              Export · Save · Apply│
├────────────────────────────────────────────────────────────────┤
│ Description textarea                                            │
├──────────────────────────┬─────────────────────────────────────┤
│ Surfaces                 │ [ Components | Article | Admin ]    │
│ Text                     │ [ Light | Dark ]                    │
│ Borders                  │                                     │
│ Accent          (38)     │   Live preview surface              │
│ Semantic                 │   (tokens applied via inline style) │
│ Typography               │                                     │
│ Spacing                  │                                     │
│ …                        │                                     │
└──────────────────────────┴─────────────────────────────────────┘
```

- **Token panel** (left): collapsible `<details>` groups via `<AdminThemeTokenGroup>`. Each group shows a count badge for "tokens modified in this group" so the admin can see at a glance what they've touched. Inside each group is one `<AdminThemeTokenInput>` per `TokenSpec`.
- **Token input** picks its control by `spec.kind`:
  - `color` → `<input type="color">` + hex/rgba text field
  - `length` → split number + unit dropdown + raw text fallback
  - `font-family` → text field rendered in the picked font
  - `font-weight` → `<select>` of `100`–`900`
  - `number` → plain text field
  - `shadow` / `transition` / `string` → raw mono text field
- **Reset to default** button appears whenever the row's value differs from `spec.default`. Clicking it deletes the token from the draft map (so the parent-theme value comes through).

- **Preview pane** (right): host for the **scene system**.
  - Scene picker: `[ Components | Article | Admin ]`
  - Mode toggle: `[ Light | Dark ]`
  - Surface: a div with `data-theme="<parentTheme>"` (to inherit CSS-file defaults) plus an inline `style` containing every token in the draft map. Each scene component (`<AdminThemeSceneGallery>`, `<AdminThemeSceneProse>`, `<AdminThemeSceneAdmin>`) uses only `var(--*)` so the inline style drives everything.

### Adding a new scene

1. Create `layers/base/components/admin/theme/AdminThemeScene{Name}.vue`. Use `var(--*)` everywhere — no hardcoded colors/fonts.
2. Register it in `AdminThemePreviewPane`'s `PREVIEW_SCENES` constant with an id, label, description, and icon.
3. Add the `<v-if>` branch in the surface section.

The scene system is intentionally extensible. The roadmap includes:

- `'iframe-route'` — render an actual site route in an iframe with the in-progress theme applied via injected `<style>`. Most realistic preview; heaviest scope.
- `'page-layout'` — a single fake landing-page mockup whose section list is editable (toggle sections, reorder). Bridge from theming → page composition.
- `'layout-builder'` — drag-and-drop section composer. Each section becomes a saved layout-JSON entry on the homepage/profile/etc.

The current scene picker exists already because that future is in scope. Themes are the first piece; layouts are the second.

---

## Import / Export

`buildExportFile(theme): { filename, content }` and `parseExportFile(text): CustomThemeRecord` live in `composables/useThemeAdmin.ts`.

Export format:

```json
{
  "formatVersion": 1,
  "exportedAt": "2026-05-26T12:00:00.000Z",
  "theme": {
    "id": "autumn",
    "name": "Autumn",
    "family": "autumn",
    "isDark": false,
    "parentTheme": "base",
    "tokens": { "accent": "#d97706", "bg": "#fef3c7" },
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

Files are named `<id>.cpub-theme.json`. On import, the id is auto-suffixed if it collides with an existing custom theme (`autumn` → `autumn-2`).

The `formatVersion` field exists so future breaking changes can be detected and either migrated or rejected. The parser rejects any other value today.

---

## Token overrides (the "quick tweak" lever)

`/admin/theme` keeps a collapsible **Token overrides** section. This is the legacy `theme.token_overrides` mechanism — a small Record<string,string> that the SSR middleware applies on top of *whichever* theme is active. Useful for one-off tweaks ("temporarily flip the accent for our anniversary week"). For real edits, the editor is the better tool.

Overrides win over the active theme's tokens. They survive theme switches.

---

## End-to-end flow

When an admin saves a new custom theme and clicks **Save & apply**:

1. Editor POSTs to `/api/admin/themes` with the draft.
2. Server validates with `customThemeSchema`, appends to `theme.custom`, calls `invalidateThemeCache()`.
3. Editor PUTs `theme.default = 'cpub-custom-<id>'` to `/api/admin/settings`.
4. Next page request: middleware reads the new default, looks up the custom theme, builds `tokensToCss(':root', tokens)`, attaches to `event.context.themeInlineCss`.
5. Theme plugin reads that, calls `useHead({ style: [{ id: 'cpub-theme-inline', innerHTML: ... }] })`.
6. SSR HTML includes both `<html data-theme="cpub-custom-<id>">` and the inline `<style>` — first paint matches the new theme.
7. Client hydrates with the same state ref, no FOUC.

When a user later toggles light/dark via the topbar:

1. `useTheme.setDarkMode(true)` runs.
2. If the active family is built-in (classic/agora), the variant flip happens client-side immediately for snappy UX.
3. If the active family is a custom theme with a `pairId`, the cookie is updated and the server picks the right variant on the next request (`resolveThemeContext` checks `pairId` and swaps).
4. If the active family is a custom theme without a `pairId`, the cookie still records the preference but the active theme doesn't change until the admin defines a pair.

---

## Studio — the guided generator (easy mode)

`@commonpub/theme-studio` is a framework-agnostic package (pure TS, zero Vue) that
**derives a complete, harmonized, WCAG-checked token set from a small recipe** — the
inverse of the granular token editor. It is wired into the admin theme builder as an
"easy mode" alongside the existing per-token editor; the two share one draft.

**The recipe.** `ThemeRecipe` is the small serializable set of inputs: mode, accent, four
font roles, base size + scale ratio, spacing base, density, corner radius, border width,
shadow style, motion (plus `scheme`/`secondary` fields carried by the vibe presets). It is
persisted on the theme record (`customThemeSchema.recipe`, stored in the
`instance_settings.theme.custom` JSON — **no migration**) so the wizard reopens with its
controls restored. Note: the whole palette (surfaces/text/borders/states) derives from
**accent hue/saturation + mode**, so the wizard exposes only those for color; `scheme` and
`secondary` don't change any rendered token (CommonPub has no secondary-accent token) and
aren't surfaced as controls.

**The projection.** `recipeToTokens(recipe)` maps a recipe onto the canonical
`TOKEN_SPECS` keys and returns `{ tokens, fonts, parentTheme, fontHref }`. It emits only
the tokens it derives; everything else inherits from a **mode-matched `parentTheme`**
(`dark` for dark recipes, `base` for light). A unit test asserts every emitted key passes
`validateTokenOverrides` and that all curated vibe presets clear WCAG AA on text/bg.

**Smart per-mode color (`ensureReadable`).** The brand accent is floored to stay visible
against each mode's bg (UI-component contrast), and an `accentText` variant is derived for
`color-link`/`color-link-hover` so links clear AA (4.5:1) as text on the page — both keep the
chosen hue, only shifting lightness. So a pale accent stays a pale accent on the dark variant
but darkens to a usable shade on the light variant; the generator "knows what would look bad
on what." Tests assert accent-visible + link-AA hold for arbitrary accents in both modes.

**Light + dark pair by default.** `recipeToThemePair(recipe)` renders the same recipe for
both modes. The wizard saves every Studio theme as a **linked light+dark pair** — two custom
records in one family (unique per theme, = the slug), cross-referenced via `pairId`, each
recipe-derived for its mode. The editor's `save()` upserts the opposite-mode sibling from the
recipe (`siblingIdFor` → `<base>-dark`/`<base>-light`); the family card then shows both and the
light/dark toggle flips between them. Per-token tweaks apply to whichever variant you're
editing; the sibling tracks the recipe.

**The UX (generate-then-edit, one-way).**
- The theme list (`/admin/theme`) offers **Build with Studio**, **Surprise me** (dice →
  `randomizeRecipe`), and **Blank** (the original path). The first two seed a draft +
  recipe and open the editor with `openStudio: true`.
- In the editor, a **Studio | Advanced** toggle swaps the left pane between
  `AdminThemeStudio` (the wizard) and the token-group grid — both editing the **same
  draft**. Touching a Studio control calls `recipeToTokens` and replaces `draft.tokens`
  wholesale; a banner warns that re-running Studio overwrites manual token tweaks.
- A fourth preview scene, **Spec sheet** (`AdminThemeSceneSheet`), visualizes the raw
  tokens (named swatches with live hex + a WCAG contrast readout, a type ladder, spacing
  bars, radius/shadow tiles) — complementing the component-in-context Gallery scene.

**Fonts (Google Fonts loading).** Studio's type vibes draw from a ~100-family catalog.
The chosen families are persisted on `customThemeSchema.fonts`; when a custom theme is the
active instance theme, `resolveThemeContext` builds a `fontHref` (`googleHref(fonts)`) and
the theme plugin injects a `<link rel="stylesheet">` (CSP already allows
`fonts.googleapis.com`). The editor loads the same `<link>` client-side so the live preview
renders the chosen fonts. A handful of families (Fraunces/Newsreader/Work Sans/JetBrains
Mono) are still statically preloaded in `nuxt.config.ts` for the built-in Stoa theme.

**Feature flag.** Gated on `features.themeStudio` (default ON). When off, the wizard +
entry points are hidden and the granular editor is byte-identical to before.

**Source**: `packages/theme-studio/` (brain), `layers/base/components/admin/theme/studio/`
(wizard) + `AdminThemeSceneSheet.vue` (preview scene).

---

## Standing rules touched by this system

- **#3 "No hardcoded color or font"** — every preview scene + editor component uses `var(--*)` only.
- **#2 "No feature without a flag"** — the theme editor is gated on `features.admin` (same as the rest of the admin panel).
- **`pathPrefix` footgun** ([memory feedback](../../../.claude/projects/-Users-obsidian-Projects-ossuary-projects-commonpub/memory/feedback_nuxt_pathprefix_components.md)) — every component under `components/admin/theme/` is named with the full `AdminTheme*` prefix so Nuxt's auto-import resolves bare tags.
- **CSS layer specificity** ([memory feedback](../../../.claude/projects/-Users-obsidian-Projects-ossuary-projects-commonpub/memory/feedback_css_layer_specificity.md)) — the inline `<style id="cpub-theme-inline">` is injected without a `@layer` wrapper, so it sits at the highest cascade tier and beats any layer-wrapped CSS without needing `!important`.
- **Universal radius leak** ([memory feedback](../../../.claude/projects/-Users-obsidian-Projects-ossuary-projects-commonpub/memory/feedback_universal_radius_leak.md)) — every preview scene that contains nested `overflow:hidden` sections sets `border-radius: 0` on its inner pieces, so a custom theme with non-zero `--radius` doesn't wedge-gap the gallery.

---

## What's NOT here yet (deliberate scope cuts)

- **Per-page layout editing**. The scene picker hints at it — `'page-layout'` and `'layout-builder'` are future scenes. The theme system stops at design tokens today.
- **Component-level overrides** (e.g. "this theme also uses a different button shape"). Achievable today by shipping a CSS file alongside a code-registered theme; not authorable in the editor.
- **Font upload (self-hosted)**. Studio loads Google Fonts for a theme automatically (see
  the Studio section above); arbitrary self-hosted `@font-face` files still need a CSS file
  shipped by the thin app. The font-family token accepts any CSS value regardless.
- **Theme sharing / marketplace**. Exported JSON files are the portable format (they carry
  the `recipe` + `fonts` too); there's no public registry.
- **Per-variant divergence**. Studio's light+dark pair is recipe-derived; hand-editing one
  variant's tokens in the advanced editor applies to that variant only, and the matching
  variant is re-derived from the recipe on save (it tracks the recipe, not your manual tweaks).

> A live WCAG contrast readout now exists in the **Spec sheet** preview scene (text on bg).
