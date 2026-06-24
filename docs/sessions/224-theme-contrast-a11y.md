# Session 224 — theme-wide contrast a11y pass (readable `--*-text` tokens) SHIPPED

Continues the `--code-inline` work (session 223) into a systemic fix. **SHIPPED + rolled to all 3.**

## What was done (task A — the headline)
The raw vivid semantic tokens (`--green`/`--yellow`/`--red`/`--teal`/`--purple`/`--pink`/`--accent`)
fail WCAG AA as small **text** on light surfaces (~2-4:1 — `--yellow` ≈2.2:1, `--green` ≈2.3:1 on
white). This was the same bug class the inline-code fix addressed, but systemic across ~110
components/pages.

**Tokens (in `packages/ui/theme/base.css` — the SOURCE, not the gitignored bundle):** added
`--green-text/--yellow-text/--red-text/--teal-text/--purple-text/--pink-text/--accent-text`. Each is
the vivid `color-mix`ed toward `--text` (per-color %: green 50, yellow 50, red 25, teal 45, purple 20,
pink 30, accent 40), with the raw vivid as the no-`color-mix` fallback (=today's behavior, zero
regression). One definition adapts per theme because the inner `var()`s resolve at `:root` — and on the
real site dark mode is `<html data-theme="dark">`, so `--*-text` recomputes with the dark tokens (a
nested `data-theme` does NOT adapt — it inherits the pre-resolved `:root` value; this tripped the
verification harness first).

**Replacements:** swept `color: var(--vivid)` → `color: var(--vivid-text)` across ~110 files with a
precise regex (lookbehind excludes `border-color`/`background-color`/`accent-color`/`outline-color`;
trailing `[,)]` avoids matching `--green-border`/`--green-bg`). Only the `color:` property changed —
fills, borders, and icons over the dark badge overlay keep the raw vivid. **Exclusions:** ContentCard
224/228 + EditorialBadge 25 (teal/yellow on the dark `--color-badge-overlay` — mixing toward `--text`
there would REDUCE contrast), and `AdminThemeSceneGallery` palette swatches (show raw tokens by
design). **Accent** stays the brand/link color everywhere except a few named status/badge/chip cases
(AppToast info, FeedItem badges, MirrorDetailModal `.cpub-mm-dir/.cpub-mm-chip/.cpub-fed-status.active`
+ `:hover`, RegistryDirectory `.cpub-fed-btn-sm:hover`).

## Verification (empirical, both themes)
- **Contrast:** Playwright loaded the real `base.css` + `dark.css` and measured the browser's actual
  `color-mix` output. ALL tokens pass ≥4.5:1 — **light 5.07-6.15:1, dark 6.25-12.82:1** across
  `surface`/`surface2`/`bg` and each token's own `*-bg`.
- **Visual:** before/after swatch screenshots (badges, toasts, fed-status, inline errors) in light +
  dark. After = legible while keeping hue/border/tinted-bg; the washed-out `before` yellow/pink/teal
  are now crisp. Dark barely changes (raw vivids already pass there) — no regression.
- Layer suite **1371/1371 green** (107 files; confirms no `.vue` style block became unparseable).
- Sweep audited: every changed line is a `color: var(--*-text)` swap; zero `<script>`-context or
  corrupted (`-text-text`/`-text-border`) changes; no test asserts on the old tokens.

## Released
**layer 0.86.4** only (theme is bundled into the layer at publish via
`layers/base/scripts/bundle-theme.mjs`, which copies `packages/ui/theme/` → `layers/base/theme/` in
`prepublishOnly`). Verified the published bundle contains the tokens (NOT a 0.86.2-style no-op).
Rolled to all 3: commonpub.io (push to main), deveco.io + heatsynclabs.io (pin → `^0.86.4`, both
lockfiles refreshed to the resolved 0.86.4). All 3 `/api/health` 200.

## Task D (docs refresh) — done
- `docs/llm/facts.md`: versions → schema 0.48 / server 2.92 / config 0.23 / layer 0.86.4 / editor 0.9 /
  protocol 0.14 / infra 0.9 / test-utils 0.5.8 / CLI 0.5.18; added the `--*-text` token note.
- `codebase-analysis/02-schema-inventory.md`: added migrations **0032** (banner_meta/cover_meta) +
  **0033** (cover_placement).

## Remaining (next session) — from the session 223 audit
- **C. Test coverage:** the new contest fields still have no dedicated tests (bannerMeta/coverMeta/
  coverPlacement hydrate+buildPayload, instructionsBlocks public render, video/embed size cap +
  aspect-ratio, `.cpub-ctabs` roles/roving-focus + axe pass, block-intro markdown round-trip). No
  publish needed — rides the next layer release.
- **B. Contest UX polish (P2/P3):** subheading clamp (`ContestHero` `.cpub-hero-tagline` ~L267, add
  `-webkit-line-clamp:5`/`max-height`); tab-band a11y guards (`onTabKey`/`focusTab` when active tab
  removed; `scrollIntoView` at 640px); submit dialog `aria-labelledby`→`<h2>` id; `ContestBannerAdjust`
  `:focus-visible` outline + zero-rect drag guard. These need a layer release (0.86.5) + roll.
- **Residual a11y (not done this pass):** `--accent` as small TEXT on links/nav fails AA (~2.8:1) but
  is the brand/link color sitewide — a separate brand decision, deliberately out of scope. A few faint
  `color: var(--green-border)` used as text (e.g. `ExplainerView`) also fail — different token, left.
- **E. Deferred backlog** (terms block-editing, bulk PII UI, judge-invite-resend trigger, stage-advance
  discoverability, `pnpm pack` test-leak check in `publish:layer`).
