# Plan — deveco parity via a REGISTERED THEME (the agora pattern), not a layout fork

**Question answered:** *"Isn't it supposed to be that themes apply? Will tokenizing get us parity?"*
**YES** — and the codebase already proves the mechanism. `agora`/`agora-dark` are registered
themes (`packages/ui/src/theme.ts`) that scope `[data-theme="agora"] .cpub-topbar { … }` to
restyle the BASE layout's real classes — height, radius, shadow, nav pills, footer — without
forking the layout. deveco today does it the WRONG way: a global `:root` token override **plus**
a fully custom `layouts/default.vue` + `pages/index.vue` that ignore the base entirely (and
ignore the admin-configured nav — see the user's screenshots: `/admin/navigation` is configured
but the live nav is hardcoded in the custom layout).

## The two-layer theming model (why tokens alone are ~70%)
1. **Tokens** (`--accent`, `--surface`, `--deveco-dark-green`): change VALUES the base CSS already
   references → all colors, accent, footer/banner bg. **Cannot** change hardcoded structural
   values (base nav 12px square neutral; deveco wants 14px rounded-pill green; base topbar 48px
   flat-border; deveco 60px rounded shadow sticky-centered).
2. **Theme component overrides** (`[data-theme="deveco"] .cpub-topbar { … }`): target the base
   layout's classes and override ANY property — the agora pattern. THIS is what reaches the
   structural deltas. Must live OUTSIDE `@layer commonpub` to beat scoped styles
   ([[feedback_css_layer_specificity]]).

## Fidelity verdict (deveco custom layout vs base, element by element)
| Element | Delta deveco→base | Reachable by |
| --- | --- | --- |
| Topbar height 60→48, radius 12→0, shadow→border, sticky→fixed, centered inner→full-bleed, blur | structural | `[data-theme=deveco] .cpub-topbar` override |
| Nav link 14px→12px, rounded pill→square, green active→neutral | structural | `[data-theme=deveco] .cpub-nav-link/.router-link-active` override |
| Footer dark-green bg, white text | color | tokens `--cpub-footer-bg/text` (B5) + override |
| Footer backer badge / IoC bottom line / Powered-by | MISSING NODES in base markup | config-driven footer additions (B2) |
| Top strip-banner ("Backed by EDGE AI…") | NO base element | new `AnnouncementBanner` component (B1) |
| Hero 135° gradient + hexagon logo | structural | hero variant tokens / `heroVariant` (B3) + logo already configurable |

**Conclusion:** registered-theme overrides reach everything EXCEPT two genuinely-new structural
pieces (top banner, footer extras) that need real components because the base MARKUP lacks the
nodes. So: registered theme (parity for existing chrome) + 2 small config-driven components.

## Risk profile — LOW for the other instances
`[data-theme="deveco"]` overrides apply ONLY when deveco's theme is active. commonpub.io and
heatsync need ZERO base-layout changes for the override layer. The only base changes are the 2
new opt-in components (default-off) + a few neutral-default tokens. No pixel risk to others.

---

## Execution phases (each ships independently, no regression)

### P1 — Register the `deveco` theme (parity for existing chrome) — UI package
- `packages/ui/src/theme.ts`: add `{ id: 'deveco', family: 'deveco', … }` (+ optional `deveco-dark`).
- `packages/ui/theme/deveco.css`: port deveco's tokens (from `deveco-theme.css`) scoped to
  `[data-theme="deveco"]`, PLUS `[data-theme="deveco"] .cpub-topbar / .cpub-nav-link /
  .cpub-topbar (radius,height,shadow,sticky,inner-max-width) / .cpub-footer` overrides carrying
  the EXACT values from the custom `layouts/default.vue` `<style>`. Outside `@layer commonpub`.
- Verify: set deveco's instance `defaultTheme = 'deveco'` (the instance-settings the middleware
  reads) and confirm `<html data-theme="deveco">` on SSR.

### P2 — AnnouncementBanner component (B0/B1) — config + layer
- `packages/config`: `chrome.announcementBanner { enabled:false, html:'', dismissible? }` +
  `chrome.footer { social[], backer, partOf, poweredBy, tagline }`. Defaults = current base.
- Declare `runtimeConfig.public.chrome` in `apps/reference/nuxt.config.ts` (env-var memory).
- `useChrome()` composable (layer) merges config defaults ← admin DB overrides.
- `components/AnnouncementBanner.vue`: `v-if chrome.announcementBanner.enabled`, sanitized html
  (`<a><strong><em>` only), tokens `--cpub-banner-bg/text`. Rendered above `<header>` in base
  `layouts/default.vue`. Renders NOTHING for commonpub.io/heatsync.

### P3 — Footer config-driven extras (B2) — layer
- Base footer reads `chrome.footer`: social[] (default = commonpub set), tagline, optional
  backer badge + partOf IoC line + poweredBy. Tokens `--cpub-footer-bg/text` (default neutral).
- deveco config supplies its social/backer/partOf; `deveco.css` sets the footer bg token.

### P4 — Hero variant (B3) — layer (highest fidelity risk, prototype + visual-diff)
- Hero gradient via `--cpub-hero-bg` token + (if needed) a `heroVariant: 'gradient'` branch in
  HeroSection. Logo column already configurable. Prototype against deveco's hero before committing.

### P5 — Admin + CLI surfaces (C/C')
- `admin/branding.vue` (reuse theme-editor DB-settings pattern): footer social rows, tagline,
  backer, partOf, banner toggle+html, hero variant. `useChrome()` merges DB over config.
- `tools/create-commonpub/template.rs`: scaffold the `chrome` block.

### P6 — deveco cutover (D) — the payoff (needs visual sign-off)
- Set deveco `defaultTheme = 'deveco'`, fill its `chrome` config.
- **Delete** deveco `layouts/default.vue` → base layout + `deveco` theme + chrome config.
- **Delete** deveco `pages/index.vue` → base homepage (hero gradient+logo, content feed, contest
  banner, sidebar). The homepage already keyset-paginates via base.
- Keep `DevEcoLogo.vue` + `deveco-theme.css` (now folded into the registered theme, or kept as
  the theme's css). Visual-diff EVERY breakpoint on a preview deploy BEFORE deleting.

## Release / deploy
- Publish: ui (theme) + config (chrome) + layer (banner/footer/useChrome/hero) → schema unaffected.
- All 3 instances bump pins; only deveco changes visually. curl + visual-diff each.

## Open questions to confirm before P6
- Confirm the instance-settings store the theme middleware reads (`defaultTheme`) is the same one
  the admin theme editor writes — reuse it ([[feedback_test_populates_both_sources]]).
- Decide: fold `deveco-theme.css` INTO `packages/ui/theme/deveco.css` (shipped, versioned) vs keep
  it deveco-local and only register the id. Shipped is cleaner for "every instance can pick deveco".
