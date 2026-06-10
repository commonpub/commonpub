# Theme Studio — Advanced Tokens (treatments, chrome, glass)

> **STATUS (2026-06-09, session 195): SHIPPED** — Phases A–D merged (PR #27), published
> (schema 0.40.0 / ui 0.13.0 / theme-studio 0.6.0 / layer 0.72.0, CLI 0.5.14) and rolled to
> commonpub.io + deveco + heatsync (curl-verified). Bonus: capture-flood fix (`resolveVarRefs`).
> Phase E remains deferred. Log: `docs/sessions/195-theme-advanced-tokens.md`.

Refines the deferred backlog from sessions 192–193 (`docs/sessions/193-theme-variety.md`
"Deferred"): **better tokens for more advanced customization** — glass/frosted treatment
tokens, chrome (topbar/nav/footer) customization, page-background treatments, plus the
targeted wedge-gap radius cleanup. Strictly **additive**: every phase leaves built-in
themes (base / dark / agora / Stoa) and every already-stored custom theme byte-identical.

## Why this is the gap (verified against current code, 2026-06-09)

1. **The chrome token family is invisible to custom themes.** `packages/ui/theme/base.css`
   (~lines 255–290) defines `--cpub-topbar-*` (9), `--cpub-nav-link-*` (9),
   `--cpub-footer-*` (6) and `--cpub-content-top-offset` — the tokens deveco uses for its
   rounded sticky blurred topbar and dark footer. **None are in `TOKEN_SPECS` or
   `ALIAS_TOKEN_NAMES`** (`packages/ui/src/tokens.ts`), so `validateTokenOverrides` rejects
   them: the granular editor never shows them, fork/capture never copies them, and Theme
   Studio can't emit them. A Studio theme can restyle every card but not the nav bar.
2. **No treatment tokens.** Zero `backdrop-filter` anywhere in `packages/ui/theme/` except
   the topbar chrome token; no page-background-image hook. Glass/frosted (deferred in 193
   precisely because it "needs component backdrop-filter support") is not expressible.
3. **Wedge-gaps on rounded themes** inside `overflow:hidden` containers remain latent
   (193 Phase 1 known follow-up; 0.21.21 fixed 7 components, the rest unaudited).

## Proven patterns this plan reuses (do NOT invent new ones)

- **`--shadow-block` precedent** (ui 0.12.2): new canonical token whose base.css default
  reproduces the current rendered output exactly; built-in themes override the OLD tokens
  but not the new one → byte-identical; only generated themes emit it.
- **Whole-property no-op token**: `backdrop-filter: var(--cpub-topbar-blur, none)`
  (`layers/base/layouts/default.vue:284`, live on deveco). Default **`none`**, never
  `blur(0)` — any non-`none` backdrop-filter creates a stacking context + becomes the
  containing block for fixed/absolute descendants; `blur(0)` would silently break dropdown
  and fixed positioning on every existing theme. Same rule for `background-image: none`.
- **Registry-driven editor**: tokens.ts header — add a `TokenSpec` (+ group metadata) and
  the granular editor renders it with zero editor changes.
- **Recipe fields are optional** (`neutralHue` precedent, schema 0.38): old persisted
  recipes lack the field → generator takes the legacy path → identical output. No migration
  (custom themes are JSON in `instance_settings.theme.custom`).

## Backward-compat invariants (every phase must hold all of these)

- I1: New tokens get base.css defaults that are true no-ops or the current literal value.
  Built-in theme CSS files are not edited (except appending no-op defaults to base.css
  `:root` where needed — and the chrome family already has defaults).
- I2: `recipeToTokens` output for any pre-existing recipe (no new fields) is key-for-key
  identical to theme-studio 0.5.1. Add a regression test that locks this with a fixture.
- I3: No scoped-component `<style>` edits in Phases A–C (avoids the CSS-scope landmines;
  treatment application lives only in shared `packages/ui/theme/*.css` classes).
- I4: Schema changes are optional-field additions to `themeRecipeSchema`
  (`packages/schema/src/validators.ts`) only. No DB migration.
- I5: `packages/ui/theme/*.css` and `layers/base/theme/*.css` are mirrored copies — every
  CSS edit lands in both, same commit (they diff clean today; keep it that way).
- I6: The existing theme-studio test "every emitted key passes `validateTokenOverrides`"
  must keep passing — publish ui (registry) before theme-studio in the chain.

---

## Phase A — register the chrome token family (ui minor; no CSS, no behavior change)

Add to `packages/ui/src/tokens.ts`:

- New `TokenGroup` `'chrome'` (+ `TOKEN_GROUP_LABELS` entry "Site chrome — top bar, nav
  links, footer" + append to `TOKEN_GROUP_ORDER`).
- One `TokenSpec` per existing chrome token, `default` copied **verbatim** from base.css:
  - topbar: `cpub-topbar-height` (length), `-bg` (color), `-border` (string — shorthand),
    `-radius` (length), `-shadow` (shadow), `-position` (string), `-padding-x` (length),
    `-blur` (string), `cpub-content-top-offset` (string — it's a `var()` chain).
  - nav links: `cpub-nav-link-size/-weight/-padding/-radius/-color/-active-color/
    -active-bg/-active-weight/-active-border` (kinds per value).
  - footer: `cpub-footer-bg/-text/-muted/-border/-link-hover/-heading` (color).

Effects: granular editor grows a "Site chrome" group automatically; `validateTokenOverrides`
accepts the keys; fork/capture can carry them. Zero rendering change anywhere (registry-only).

Checks:
- Tests: extend `tokens.test.ts` — every chrome spec default matches base.css text (add a
  small parse-the-css-file assertion like radius-model.test.ts does), group metadata complete.
- Verify the capture/discovery flow (the "discovery diff is computed against defaults"
  consumer) handles `var()`-valued defaults sanely — chrome defaults reference other tokens;
  if capture reads *computed* styles it may materialize them. Acceptable, but confirm it
  doesn't break the diff; if it floods capture output, exclude `kind: 'string'` chrome
  tokens from capture (capture-side filter, still editor-editable).
- Watch-out: `--cpub-topbar-position` accepts only `fixed|sticky` meaningfully, and
  `sticky` requires `--cpub-content-top-offset: 0` (documented in base.css). Give both
  specs `description`s saying exactly that; the editor is admin-only, garbage values here
  degrade layout but nothing else (same exposure as today's `nav-height`).

## Phase B — treatment tokens (ui minor + layer patch; built-ins byte-identical)

New canonical tokens (group `'treatment'` or fold into `surfaces`/`shape` — decide once,
suggest a new `'treatment'` group so the editor story reads well):

1. `--surface-backdrop: none` (kind string) — applied as
   `backdrop-filter: var(--surface-backdrop, none);` to the **shared** surface classes in
   `packages/ui/theme/components.css` only: `.cpub-sb-card` and the other canonical
   card/panel classes that already read `--shadow-block` (enumerate at implementation
   time from components.css; same scope as the 0.12.2 shadow-block sweep). Scoped modal/
   dropdown components are explicitly OUT (Phase E candidate).
   - Glass also needs translucency: that comes free — `surface`/`surface2` are color
     tokens and already accept `rgba()`. No new token needed for it.
2. `--surface-glass-veil: transparent`? **No — rejected.** Keep the token count minimal;
   translucent `surface` + `--surface-backdrop` covers glass. (Note for reviewers: this
   was considered and dropped deliberately.)
3. `--bg-image: none` (kind string) — `body { background-image: var(--bg-image, none); }`
   in base.css. Enables subtle page gradients (and later textures).
   - **Security note:** unlike colors, `background-image` can fetch URLs (`url(...)` =
     beacon/exfil channel; governed by CSP `img-src` but don't rely on it). The token
     value sanitizer (`tokensToCss`, strips `;{}` CR/LF `</`) does NOT block `url(`.
     Add a server-side value guard on save for this one key: allow only
     `none` | `linear-gradient(...)` | `radial-gradient(...)` | `conic-gradient(...)`
     (reject anything containing `url(`). Lives next to `validateTokenOverrides` usage in
     the themes POST/PUT handler. Admin-only input, but cheap insurance and it documents
     intent. (Known-bad payload test per the regex-alternation lesson: assert
     `url(https://evil)` and `repeating-linear-gradient(url(...))`-style smuggles are rejected.)
4. `--border-style-default` — **deferred, not in this plan's ship set.** Shared classes
   hardcode `solid`; flipping only components.css would yield dashed cards next to solid
   scoped-modal borders (incoherent). Revisit with the Phase E sweep.

Checks:
- `backdrop-filter: none` + `background-image: none` are true no-ops — eyeball-diff a
  rendered page (computed styles) on base + Stoa before/after as the verification step.
- Add the new specs to the same defaults-match-base.css test from Phase A.
- Mirror CSS edits to `layers/base/theme/` (I5).
- Accessibility: when Studio later emits translucent surfaces, AA is checked at generation
  time (Phase C). For hand-set values in the Advanced editor the existing WCAG editor
  chip already evaluates token pairs — confirm it composites rgba over `--bg` (it likely
  treats rgba naively; if so, flatten with the same blend helper Phase C adds).

## Phase C — Studio: glass treatment + chrome emission (schema minor → theme-studio minor → layer minor)

Recipe (all optional — I2/I4):

```ts
/** Surface treatment. Absent = solid (legacy). */
treatment?: {
  /** 0 = off; 0.04–0.16 sensible. Drives surface alpha + backdrop blur. */
  glass?: number;
  /** Emit a subtle page gradient derived from bg + accent. */
  bgGradient?: boolean;
}
```

- `themeRecipeSchema`: add the optional object (bounded: glass 0–0.3, bgGradient boolean).
- `recipeToTokens` when `treatment.glass > 0`:
  - `surface` / `surface2` become `rgba(<computed surface>, 1 - glassAlpha)` variants;
    **AA contrast is checked against the flattened composite** (new `flattenOver(bg)`
    helper in color.ts; reuse `ensureReadable` against the flattened result — text tokens
    were derived against opaque surface, so re-derive against the flattened one).
  - `--surface-backdrop: blur(<8–16px from glass strength>) saturate(1.35)`.
  - chrome: `--cpub-topbar-bg: rgba(surface, …)` + `--cpub-topbar-blur: blur(…)` so the
    nav bar participates (this is what makes glass read as a *theme* and exercises Phase A).
  - Emit nothing when `treatment` absent (regression fixture from I2 guards this).
- `treatment.bgGradient`: emit `--bg-image: linear-gradient(165deg, <bg>, <bg tinted
  toward accent ~4–6% at the far stop>)` — subtle, AA-neutral by construction (tint kept
  inside the contrast budget; assert text-on-far-stop still clears AA in tests).
- New archetype in `DESIGN_ARCHETYPES`: `{ k: 'glass', label: 'Glass', sub: 'Frosted
  translucent panels, soft depth, rounded' }` — patch: rounded radius (~14), borderWidth 1,
  shadowStyle 'soft', motion 'smooth', `treatment: { glass: 0.1, bgGradient: true }`
  (extend `ArchetypePatch` with the optional treatment field). Structure-only: no accent/
  mode/neutralHue (per the 193 audit rule).
- Wizard: the Glass archetype card is the primary entry; plus a small "Glass" slider
  (off→strong) in the custom section of the Color/Style step (`applyArchetype` already
  generalizes). `randomizeRecipe`: leave treatment OUT of the random pool initially
  (avoid surprise translucency on "Surprise me"); revisit after a browser pass.
- Export (`export.ts` AI brief / token export) mentions treatment when set.

Tests: theme-studio — flatten/AA for glass in both modes; emitted keys pass
`validateTokenOverrides` (existing test auto-covers once ui ships first — I6); legacy-recipe
fixture byte-identical (I2). Layer — wizard wiring + slider emits treatment; save round-trips
`recipe.treatment` through POST/PUT (schema accepts).

Known interaction to verify in-browser: `backdrop-filter` on `.cpub-sb-card` blurs what's
BEHIND the card — over a flat `--bg` this is visually inert even at full strength; it only
shows over the bgGradient/grain. That's correct glass behavior, but confirm the pair
(`glass` + `bgGradient`) ships as the archetype default so the effect is actually visible.

## Phase D — wedge-gap radius audit (ui patch + layer patch; targeted, NOT the full migration)

The 193 Phase 1 structural reset stays. This phase only closes the known-latent inner-section
wedge-gaps ([[feedback_universal_radius_leak]] pattern — 0.21.21 fixed 7 components):

1. Enumerate: grep layer components + ui components for `overflow: hidden` co-occurring
   with rounded outer containers; render-audit on Stoa (12px) + a 20px Studio theme.
2. Fix shape: explicit `border-radius: 0` on inner sections (the 0.21.21 recipe), or
   `border-radius: inherit` on single-child media where that's the actual intent.
   Scoped-CSS edits ARE allowed here (it's the point), but each component's rules move
   with its markup — no cross-component sharing.
3. Guard: extend `radius-model.test.ts` only if a new structural rule lands in base.css;
   per-component fixes get nothing (CSS cascade is a unit-test blind spot — the
   verification is the real-browser pass, budget it explicitly).

The **full** per-component radius migration (removing the universal `*` rule) stays
deferred — 105 components rely on it; risk/benefit unchanged since 193.

## Phase E — explicitly deferred (recorded so it isn't re-litigated)

- Glass on scoped modals/dropdowns (needs a scoped-style sweep across ~10 components).
- `--border-style-default` (needs the same sweep to stay coherent).
- Full radius migration. Editor preview-mode fix (previewMode → recipe.mode — separate
  small fix, tracked in memory item 4 of session 192/193 notes).
- `prefers-reduced-transparency` media handling (browser support still thin; revisit).

## Release + verification (per STATUS runbook)

- Chain per phase: **schema → ui → theme-studio → layer** (ui before theme-studio — I6;
  theme-studio before layer; layer ONLY via `pnpm publish:layer`). Phases A+B can ship as
  one ui minor + layer patch; C is the schema/theme-studio/layer release; D trails as patches.
- After each publish: poll `npm view`, bump CLI `template.rs` pins (+ its test +
  Cargo.toml), consumer typecheck against the packed tarball for any layer TYPE change,
  pack dry-run grep (bracketed-paths lesson) before layer publish.
- commonpub.io picks up from source on merge; deveco/heatsync = manual pin bumps, then
  curl `/api/health` + a page (deploy health is warn-only there).
- Browser smoke (needs admin session): build a Glass theme via Studio → check topbar +
  cards over the gradient in light AND dark, the WCAG chip, save → reload public page →
  confirm `--surface-backdrop`/`--bg-image`/chrome tokens present in the injected
  `:root[data-theme="cpub-custom-<id>"]` block; flip the site Light/Dark toggle (pair
  scoping from layer 0.68.0 must carry the new tokens per-variant — they're per-mode
  generated, so each variant block gets its own values).

## Open questions

- Does the capture/discovery flow need the chrome-token exclusion (Phase A check), or do
  `var()` defaults diff clean? Decide during A.
- Glass strength ceiling: 0.3 alpha shift max is a guess — calibrate against AA on the
  worst-case vivid palettes (Candy Pop light, Cyber Neon dark) before locking the slider range.
- Should the granular editor group order put `chrome` before `treatment` or after? Cosmetic;
  decide when the groups render.
