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

## Open questions / next steps
- **Not released** — needs version bumps + publish (schema/config/server/ui/layer +
  new theme-studio) and consumer-pin bumps. Add theme-studio to the publish chain
  (after ui, before layer) + the CLI `template.rs` pins.
- **Pair generation** (auto light/dark sibling from one recipe) — natural follow-up.
- Manual browser smoke of `/admin/theme` (Guided/Dice → generate → fine-tune → Save &
  apply → verify the injected font `<link>` + `recipe`/`fonts` on `/api/admin/themes`).
- The gauge `ui` font role is preview-only (CommonPub conflates UI labels with `font-mono`);
  documented in `generate.ts`.
