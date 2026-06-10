# Session 195 — Theme advanced tokens: chrome registry, glass treatment, Glass archetype

Executes `docs/plans/theme-studio-advanced-tokens.md` (all phases). Everything is additive:
built-in themes (base/dark/agora/Stoa) and already-stored custom themes render byte-identical;
new tokens default to true no-ops; old recipes project to the exact same token set (locked by a
regression test).

## Phase A — chrome token family registered (ui 0.13.0)

`packages/ui/src/tokens.ts` gains a `chrome` group with the 24 `--cpub-topbar-*` /
`--cpub-nav-link-*` / `--cpub-footer-*` tokens (+ `--cpub-content-top-offset`) that base.css
defined since session 180 but the registry never knew about — custom themes/Studio literally
could not touch the nav bar or footer. Also registered: `sidebar-width-collapsed`,
`cpub-card-min`, `cpub-card-gap` (layout). Defaults copied verbatim from base.css and locked by
a defaults-sync test that parses base.css. Registry-only: zero rendering change; the granular
editor renders the new "Site chrome" group automatically.

**Capture-flood fix found while verifying the plan's Phase-A check:** `getComputedStyle`
substitutes `var()` inside custom-property values, so every var()-defaulted spec diffs as
"overridden" on a STOCK site — a pre-existing bug (`font-heading` etc.) that the 15
var()-defaulted chrome tokens would have amplified to ~18 phantom overrides (the "capture your
theme" banner would show for everyone). `detectAppliedOverrides` now resolves spec defaults via
`resolveVarRefs()` before diffing (`layers/base/utils/themeDiscovery.ts`, +6 tests).

## Phase B — treatment tokens (ui 0.13.0 / layer 0.72.0)

- `--surface-backdrop: none` — applied as `backdrop-filter` (+`-webkit-`) on `.cpub-sb-card`
  (components.css). `none` default is a TRUE no-op; `blur(0)` would create a stacking context +
  containing block for fixed descendants on every theme, so the default is never a zero-blur.
- `--bg-image: none` — `body { background-image: var(--bg-image, none) }` (base.css).
- **Value guard** (schema 0.40.0): `--bg-image` is the one token whose value can FETCH
  (`url()` beacon). `themeTokenMapSchema` now rejects anything but `none`/CSS gradients —
  no quotes, no backslashes (CSS-escape smuggles), no `url` substring (kills protocol-relative
  `url(//host)`). Known-bad payloads tested red (`theme-validators.test.ts`).
- CSS mirrored to `layers/base/theme/` (byte-identical copies). default.vue topbar gained the
  missing `-webkit-backdrop-filter` for older Safari.

## Phase C — Studio glass treatment (schema 0.40.0 / theme-studio 0.6.0 / layer 0.72.0)

- `ThemeRecipe.treatment?: { glass?: 0–0.3; bgGradient?: boolean }` (optional → old persisted
  recipes parse + project unchanged; `themeRecipeSchema` mirrors the bounds).
- `recipeToTokens` with glass > 0: translucent `surface` (rgba, alpha = 1−glass),
  `--surface-backdrop: blur(6+40g px) saturate(1.35)`, frosted top bar via the Phase-A chrome
  tokens (`--cpub-topbar-bg` slightly more opaque + `--cpub-topbar-blur`). Text/dim AA is
  enforced against the **flattened** composite (`blendOver` in color.ts) — tested at max
  strength across every curated palette in both modes.
- `bgGradient`: `--bg-image: linear-gradient(165deg, bg → bg tinted 7% toward accent)` — far
  stop AA-tested; emitted string asserted against a mirror of the schema allowlist so a
  generator drift fails in CI, not on the live save.
- New **Glass archetype** (frosted panels + gradient, rounded 14px, soft shadow). `ArchetypePatch`
  gains `treatment`; the wizard's `applyArchetype` now REPLACES treatment (switching Glass →
  Brutalist clears the translucency — tested).
- Wizard Feel step: Glass strength slider + "Background gradient" toggle, normalized so all-off
  stores `undefined` (keeps recipes legacy-identical). `randomizeRecipe` deliberately does NOT
  roll treatment (no surprise translucency on "Surprise me").
- AI-brief export mentions glass + page background when set.

## Phase D — wedge-gap radius audit (targeted)

Enumerated all 58 layer components using `overflow: hidden`; most uses are text-ellipsis,
avatars (explicit radius), or full-bleed page bands (no rounded parent → no wedge). Fixed the
three clear-cut edge-spanning backgrounded sections inside rounded clipped containers with
explicit `border-radius: 0` (the 0.21.21 recipe): `ContentCard .cpub-cc-thumb`,
`VideoCard .cpub-video-thumb`, `HubHero .cpub-hub-banner`. No-op at radius 0; kills the wedge
on rounded themes. The FULL per-component radius migration stays deferred (unchanged
risk/benefit since 193).

## Verification

Full workspace build green; `pnpm test` 33/33 tasks (server 1339, layer 961 incl. 14 Studio +
6 discovery, theme-studio 78, ui 27 token/radius, schema +7); `pnpm typecheck` 28/28.

## SHIPPED (same session, 2026-06-09)

PR #27 squash-merged (`decfe0f`); commonpub.io deployed from source (health 200, treatment +
chrome tokens verified in the served CSS). Published in order: **schema 0.40.0 → ui 0.13.0 →
theme-studio 0.6.0 → layer 0.72.0** (`pnpm publish:layer`; pack dry-run grep clean — zero test
files, theme CSS bundled; registry pins verified exact). CLI **create-commonpub 0.5.14** published
to crates.io (pins layer ^0.72.0 / schema ^0.40.0 / server ^2.84.1). deveco + heatsync pins
hand-edited (caret-0.x), lockfiles refreshed (schema dist complete — layout.js present), pushed +
deployed, health curl-verified.

**Audit finding during ship (not a blocker):** deveco's local `nuxt typecheck` fails with 21
lib-dom/vue-tsc structural-type errors (`Element` vs expanded `HTMLElement` shape, TS 5.9
`autocorrect`) in editor/explainer/old-layer files. Counterfactual at the untouched 0.71.2
lockfile shows the IDENTICAL 21 errors — pre-existing ecosystem skew, not a 0.72 regression.
The earlier "tarball typecheck passed" run was unreliable (npm-install-over-pnpm hybrid layout
hid those packages from vue-tsc); future tarball checks should `pnpm install` the tarball or
diff error sets against a baseline run instead of trusting exit 0.

## Open questions / next steps

- Browser smoke after deploy: build a Glass theme via Studio → check topbar + sidebar cards over
  the gradient in light AND dark; flip the site Light/Dark toggle (pair variants carry per-mode
  treatment values); confirm `/api/admin/themes` round-trips `recipe.treatment`.
- Glass visibility is currently strongest on `.cpub-sb-card` + the topbar; scoped modals/
  dropdowns + ContentCard glass are the deferred Phase E sweep.
- Glass alpha ceiling (0.3) cleared AA at max strength across all curated palettes in tests;
  judge the AESTHETIC ceiling in the browser.
