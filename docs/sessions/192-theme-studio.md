# Session 192 — Theme Studio (guided theme generator)

**Date:** 2026-06-08
**Branch:** main (working tree; not yet released)

## What was done

Built **`@commonpub/theme-studio`** — a new framework-agnostic package that derives a
complete, harmonized, WCAG-checked CommonPub design system from a small `ThemeRecipe`, and
wired it into the admin theme builder as an "easy mode" beside the existing granular token
editor. Source for the generator brain was `~/Downloads/gauge.html` (a self-contained
"design system bench"), refactored into typed, tested, Vue-free modules and re-targeted from
gauge's `--ds-*` token model onto CommonPub's ~130-key canonical registry.

### Package `packages/theme-studio/` (pure TS, zero Vue)
- `color.ts` (hex/hsl/rgb, contrast, WCAG), `harmony.ts`, `naming.ts` (evocative swatch
  names), `palette.ts` (`buildPalette` → full semantic ramp), `scales.ts` (type/space/radius
  + shadow/density/motion), `fonts.ts` (catalog + `googleHref`), `presets.ts` (color/type
  vibes, shape/shadow/ratio presets), `recipe.ts` (`ThemeRecipe`, `defaultRecipe`,
  deterministic `randomizeRecipe(seed)` via mulberry32, `randomName`).
- **`generate.ts` — `recipeToTokens(recipe)`** is the crux: maps a recipe onto canonical
  `TOKEN_SPECS` keys, returns `{ tokens, fonts, parentTheme, fontHref }`. Emits only derived
  tokens; the rest inherit from a **mode-matched parent** (`dark`/`base`).
- 26 unit tests, including **"every emitted token key passes `validateTokenOverrides`"**
  (imports the canonical list from `@commonpub/ui`'s pure `tokens.ts` source — no Vue) and
  **"all curated vibe presets clear WCAG AA on text/bg"**, plus deterministic-randomize.

### Persistence (additive, NO migration)
Custom themes live in `instance_settings.theme.custom` (JSON array, not a table), so adding
fields is free: `recipe?` + `fonts?` on `customThemeSchema` (new `themeRecipeSchema`),
`CustomThemeRecord` (server + layer types), POST/PUT pass-through, and `parseExportFile`
carry-through (export already spread the whole record).

### UI (generate-then-edit, one-way)
- `AdminThemeStudio.vue` — a 4-step wizard (Color/Type/Shape/Feel) + dice. Owns a recipe,
  emits `generate` (full token map) on every change, `finish`, and `roll` (name suggestion).
- `AdminThemeSceneSheet.vue` — a 4th preview scene ("Spec sheet"): named swatches with live
  hex + WCAG readout, type ladder, spacing bars, radius/shadow tiles. Reads resolved values
  via `getComputedStyle`. Registered in `AdminThemePreviewPane`.
- `/admin/theme` create flow: **Build with Studio**, **Surprise me** (dice), **Blank**.
- `/admin/theme/edit/[id]`: **Studio | Advanced** toggle over the SAME draft; overwrite
  warning banner; persists recipe + fonts. Gated on new `features.themeStudio` (default ON,
  declared in `nuxt.config` runtimeConfig per the env-propagation landmine).
- Component + axe tests for both new components (all green; 925 layer tests pass).

### Google-Font loading
`resolveThemeContext` → `fontHref` (`googleHref(fonts)`) → middleware `themeFontHref` →
theme plugin injects `<link rel="stylesheet">` for the active custom theme. CSP already
allowed `fonts.googleapis.com`. The editor loads the same `<link>` client-side for live
preview.

## Decisions made
- Package name **theme-studio** (user pick). Brain is Vue-free + reusable; the wizard lives
  in the layer (needs `$fetch`/auto-imports/preview pane).
- **Both** preview modes: real component pane (default) + ported gauge "spec sheet" scene.
- **One-way** Studio→editor handoff with a saved recipe (re-openable, overwrite-warned) —
  not two-way sync.
- **Load Google Fonts** for the full catalog (not a curated subset).

## Verification
- `pnpm --filter @commonpub/theme-studio test` → 26/26.
- `pnpm --filter @commonpub/reference typecheck` → clean.
- `pnpm --filter @commonpub/layer test` → 925/925 (incl. new Studio + sheet axe tests).
- `pnpm --filter @commonpub/server test` → 1324/1324; config 25/25.

## Audit pass (same session)
Adversarial self-review + an independent reviewer agent. The projection was confirmed
correct (all emitted keys canonical, math right, values serializer-safe, reactivity sound,
no hand-authored-theme clobber, fontHref gated to the active theme, CSP OK). Fixes applied:
- **`tokensToCss` hardening** (`packages/ui/src/theme.ts`): strip `;{}` from token *values*
  (not just CR/LF + `</`) so a crafted/imported token value can't close the `:root` rule and
  inject global CSS. Benefits all custom themes, not just Studio. +7 unit tests.
- **`googleHref` injection hardening** (`theme-studio/fonts.ts`): URL-encode family names so a
  tampered `fonts` entry can't inject extra `&family=`/`display=` query params. +1 test file.
- **Removed inert controls**: the wizard's harmony-scheme + hand-pick-secondary controls
  derived nothing in CommonPub's token model (no secondary-accent token), so they were dead
  UI. Removed; the vibe presets remain the rich easy path and the advanced editor still
  exposes `color-link` etc. for true granularity.
- **More tests**: `scales.test.ts` (11), projection on-accent-AA over arbitrary accents +
  type-ramp monotonicity + radius-full-not-emitted, layer `themeIO` export/import round-trip
  of recipe+fonts (4), wizard mode→parentTheme + type-vibe→font (2), server integration
  recipe/fonts round-trip (1, CI). Totals now: theme-studio **48**, ui **265**, layer **931**,
  all green; reference typecheck clean.

## Follow-up (same session) — light+dark pairs + smart per-mode color

After the initial release (theme-studio 0.1.0 / layer 0.65.0, live), a second pass made Studio
generate **both modes by default** and be contrast-smart per mode:
- **`ensureReadable(color, bg, ratio, dark)`** (color.ts): nudges lightness (preserving hue/sat)
  until a target contrast is met. `buildPalette` now floors the accent to stay visible on the
  mode's bg and derives an `accentText` (AA on bg); `generate.ts` uses `accentText` for
  `color-link`/`color-link-hover`. So a pale accent stays vivid on the dark variant but darkens
  to readable on the light variant — links are never unreadable. Tests assert accent-visible +
  link-AA for arbitrary accents in both modes.
- **`recipeToThemePair(recipe)`** renders both modes from one recipe. The editor's `save()`
  upserts the opposite-mode **sibling** (recipe-derived, `siblingIdFor` → `<base>-dark`/`-light`),
  cross-linked via `pairId` in a **unique family (= the slug)** — fixing the prior `family:'custom'`
  collapse where multiple Studio themes merged into one picker card. Soft-fails if the sibling slot
  collides (primary still saves).
- Wizard copy notes "saves a matching light + dark pair, each tuned for its mode."
- theme-studio 54 tests, ui/layer/reference all green, typecheck clean. Released as
  **theme-studio 0.2.0 / layer 0.66.0** (schema/config/server/ui unchanged).

## Studio v2 — color family + secondary, texture, create-flow, extras (same session)

A close re-read of gauge.html + an independent triple-check drove a big follow-up:
- **Real secondary accent + color family.** New canonical tokens `secondary`/`-hover`/`-bg`/`-border`
  + `color-on-secondary` (ui `tokens.ts` + `base.css`) and a `.cpub-btn-secondary` variant
  (`components.css`). `buildPalette` derives a per-mode-readable secondary ramp; **the harmony
  scheme now drives the category accents** (`purple`/`teal`/`pink`, used in cards/tags/badges) as the
  accent's companions — so "color family" is visible. Restored the wizard's harmony-scheme control +
  hand-pick-secondary picker + a "suggested family" strip (they were inert before; now real).
- **Texture/grain.** New `grain` token + an opt-in (default 0) film-grain overlay in `app.vue`;
  `texture` field on the recipe + `themeRecipeSchema`; a Grain slider in the Feel step.
- **Create-flow rationalized.** `createBlank`/`captureCurrent` now use a **unique family (= the slug)**
  — fixes the collapse where multiple blank/captured themes merged into one picker card. The 7 entry
  points are consolidated into one **"New theme"** dropdown (Guided / Surprise / Blank / Capture /
  Import). Studio create flow already used unique families + pairs.
- **Extras:** live WCAG chip in the wizard footer (text + links); a **Finish step** (name + "Save &
  apply as default"); **Export ▾** menu (.cpub-theme.json / AI brief .md / tokens .json) via new
  pure exporters in `@commonpub/theme-studio` (`export.ts`); **image/logo color extract** (canvas
  quantize → accent) in the color step.
- **Density** (from the prior pass) now multiplies the space scale + sets body leading.
- Released as **schema 0.37 / ui 0.12 / theme-studio 0.3 / layer 0.67** (config/server unchanged, no
  migration). theme-studio 60 tests, ui 265, schema 443, layer 932, typecheck 28/28, full build green.

## Light/dark switch fix (layer 0.68.0)

**Bug:** on a custom-theme site, the Light/Dark toggle didn't switch — `useTheme.setDarkMode`
flipped `data-theme` client-side only for built-in families; custom themes "persisted the
preference for the next request", and the SSR injected only the ACTIVE variant's tokens at `:root`,
so there was nothing to flip to (and with no functional-cookie consent, nothing happened at all).

**Fix:** `resolveThemeContext` now returns BOTH pair variants as **scoped** token blocks
(`:root[data-theme="cpub-custom-<id>"]`, instance overrides merged into each) + a `pair`
{lightAttr,darkAttr}; the middleware injects both and the plugin exposes the pair; both variants'
fonts load. `useTheme.setDarkMode` flips `data-theme` between the pair attrs **instantly**
client-side (like built-ins) — no round-trip, no consent needed for the in-session switch.

**UX de-dup:** the editor toolbar Mode pill + "Pair with" select are hidden for Studio (recipe)
themes (the pair manages modes); the Studio mode toggle is relabeled "Default mode (both saved)";
the editor hint explains the pair + that the site toggle switches it. Released **layer 0.68.0 / CLI
0.5.11** (layer-only; theme-studio/ui/schema unchanged). Known follow-up: the in-editor preview
pane still shows the primary variant's tokens in both preview modes (cosmetic; the live site is correct).

## Open questions / next steps
- **Not released** — needs version bumps + publish (schema/config/server/ui/layer +
  new theme-studio) and consumer-pin bumps. Add theme-studio to the publish chain
  (after ui, before layer) + the CLI `template.rs` pins.
- **Pair generation** (auto light/dark sibling from one recipe) — natural follow-up.
- Manual browser smoke of `/admin/theme` (Guided/Dice → generate → fine-tune → Save &
  apply → verify the injected font `<link>` + `recipe`/`fonts` on `/api/admin/themes`).
- The gauge `ui` font role is preview-only (CommonPub conflates UI labels with `font-mono`);
  documented in `generate.ts`.
