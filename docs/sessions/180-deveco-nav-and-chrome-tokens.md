# Session 180 — deveco config-driven nav + base chrome tokenization

2026-06-01. Two related asks, both shipped + verified live on all 3:
1. Make deveco's CUSTOM layout respect the admin nav config (keep the custom page).
2. Tokenize the base layout's chrome (topbar/nav/footer) so it's fully theme-customizable
   — without changing how any existing instance looks.

## 1. deveco config-driven nav (deveco repo, commit cedd345 + d62727c)
**Problem (user's screenshots):** `/admin/navigation` was configured, but deveco's live
nav showed hardcoded Home/Projects/Blog/… — its custom `layouts/default.vue` ignored the
nav config entirely.

**Fix:** swapped the hardcoded `<nav>`/mobile links for the base `<NavRenderer>` /
`<MobileNavRenderer>` driven by `/api/navigation/items` (the same source the admin editor
writes). Kept deveco's exact look via `:deep()` rules mapping deveco's pill/green styling
onto the renderer's `.cpub-nav-link`/`.cpub-mobile-link` classes.
- Verified live: deveco.io now serves `cpub-nav-link` markup with the CONFIGURED labels
  (Home/Build▾/Read▾/Events/Communities/Fediverse) AND the served CSS has
  `.cpub-nav-link{border-radius:6px;font-size:.875rem;padding:8px 14px}` +
  `.router-link-active{background:var(--accent-bg);color:var(--deveco-dark-green)}` — pixel-same.
- **Layout-engine note (answered for the user):** the layout engine is OPT-IN per page
  (a page must place `<LayoutSlot>` + call `useLayout`). deveco's custom `pages/index.vue`
  has neither, so the layout engine CANNOT edit deveco's homepage while it keeps the custom
  page. Custom Vue page and the visual layout editor are mutually exclusive on a route.

## 2. Base chrome tokenization (ui 0.9.2 + layer 0.43.2, commit 57cb9f4)
Added `--cpub-topbar-*` / `--cpub-nav-link-*` / `--cpub-footer-*` tokens to
`packages/ui/theme/base.css` and wired `layers/base/layouts/default.vue` to them, so a
THEME can change the chrome's SHAPE (height/radius/shadow/position/padding, nav size/
padding/radius/active-color, footer bg/text) — not just colors — without forking the layout.

**Zero-regression by construction:** every token's default EXACTLY reproduces the current
value (`var(--x, <current>)`), and base.css `:root` applies globally via inheritance. Verified
no built-in theme (dark/agora/agora-dark/generics) nor instance theme (deveco/heatsync)
defines these tokens or redefines `:root` in a way that shadows them — so they all inherit
the defaults and look identical. Live-verified: heatsync (base layout) serves
`--cpub-topbar-height:48px`, `--cpub-nav-link-size:12px`, `--cpub-footer-bg:var(--surface)`
— unchanged. commonpub.io same.

Tokenized:
- topbar: height (single source — `#main-content` margin + `.cpub-mobile-menu` top track it
  via `--cpub-content-top-offset` for the sticky case), bg, border, radius, shadow, position,
  padding-x, blur.
- nav-link: size, weight, padding, radius, color + active color/bg/border/weight.
- footer: bg, text, muted, heading, border, link-hover.
- One structural aspect NOT tokenizable: centering the topbar CONTENT at a max width
  (deveco) needs an inner wrapper the base markup lacks. Left as a structural choice.

Banner tokens + AnnouncementBanner component deferred (the "top strip" + footer-extras
structural pieces) — see `docs/plans/deveco-registered-theme-parity.md` for the full path
to a registered `deveco` theme + cutover, if ever wanted. The user opted to KEEP deveco's
custom page for now, so that cutover is not done.

## Released + deployed
- Published: **ui 0.9.2, layer 0.43.2** (schema/server unchanged at 0.25.0/2.71.0).
- All 3 bumped + deployed + curl-verified:
  - deveco.io: config-driven nav live, pill look preserved.
  - heatsynclabs.io + commonpub.io: base chrome byte-identical (tokens default to old values).
- Migrations unchanged (13). No DB change.

## Honest note
The deveco-parity backlog (B–D: drop custom layout/homepage, config-driven banner/footer
components, registered theme) was NEVER done in prior sessions — it sat in handoff backlogs
while card-sizing + keyset shipped. This session did the user's actual asks (nav-respects-
config + tokenize-for-customizability), NOT the full parity cutover (user declined it).
