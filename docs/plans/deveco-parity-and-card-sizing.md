# Plan — Card-sizing fix + deveco visual parity via config-driven chrome

**Goal (two intertwined asks):**
1. **Fix base content-card sizing** — base cards render "massive"; align to deveco.io's
   sizing, sourced from **theme tokens**, applied **everywhere cards are listed**, shipped
   to **all instances**.
2. **Make deveco.io look pixel-identical on the BASE homepage + layout** so it can drop its
   custom Vue pages. Principle: anything that **helps everyone** → port into the base;
   anything **deveco-specific** that would regress other instances → a **config-driven /
   admin-configurable add-on, default OFF/neutral**, turned ON + configured for deveco.
   Every such option must be settable in **two** surfaces: the **admin console** AND
   **`commonpub.config.ts` / the create-commonpub CLI**.

Sister docs: `stage-e-unification.md` (reuse existing components, don't fork — memory
`feedback-reuse-existing-components`), `layout-and-pages.md` (layout engine).

---

## Findings (ground truth)

### Card sizing — root cause
- deveco feed renders the **base `<ContentCard>`** (identical markup; cover already `4/3`).
  The size difference is purely the **grid container**.
- deveco grid (`.de-content-grid`): `repeat(auto-fill, minmax(260px, 1fr))`, `gap: 20px`.
- base homepage grid (`ContentGridSection.vue`): `repeat(var(--grid-cols, 2), 1fr)`, `gap: 16px`
  — **only 2 fixed columns, no min-width** → cards stretch huge. **This is the bug.**
- The rest of the base scatters card grids inconsistently (220–300px):
  `[type]/index.vue` 280 · `feed.vue` 280/14 · `search.vue` 260 · `explore.vue` 280/300 ·
  `products/index.vue` 240 · `tags/[slug].vue` · `u/[username]/index.vue` ·
  `federated-hubs/[id]` 280 · `hub/HubProjects.vue` · `contest/ContestEntries.vue` 220/14.

### deveco-unique chrome (`layouts/default.vue` + `pages/index.vue`)
- **Top strip-banner** (`.de-top-banner`): dark-green bar above the header — "Backed by EDGE
  AI FOUNDATION · Part of the Internet of Communities™" (2 links). **No base equivalent.**
- **Flat nav** (`.de-topbar`): sticky 60px, rounded-bottom, flat links, deveco-green active.
  Base nav is **already** `NavRenderer` + `navItems` config → expressible as data.
- **Footer** (`.de-footer`): dark-green bg, 4-col grid, brand + tagline + **backer badge** +
  **social links** (GitHub `edge-ai-foundation`, Discord `discord.gg/deveco`, RSS) + 3 link
  columns + bottom bar (copyright, IoC line in `#5865F2`, "Powered by CommonPub").
  Base footer (`.cpub-footer`) is **structurally identical** but social/tagline are
  **hardcoded** (`github.com/commonpub`, `discord.gg/uncPaJ5SwV`) and bg is neutral.
- **Hero** (`.de-hero`): `linear-gradient(135deg, --deveco-dark-green, --deveco-dark-blue)` +
  radial accents, eyebrow w/ accent line, gradient-clipped title span, 320px logo column,
  accent/outline buttons. Base `HeroSection` is surface + grid pattern; L6 added `logoImageUrl`.
- deveco already ships `assets/deveco-theme.css` (token set incl. `--deveco-dark-green`,
  `--accent` #00e7ad, etc.) + `components/DevEcoLogo.vue`.

### Config surfaces (the web)
- `packages/config/src/{schema.ts,types.ts}` — Zod + TS. Has `features`, `social`, OAuth,
  cookie-consent. **No** footer/social-links/announcement/chrome config yet.
- `apps/reference/nuxt.config.ts` `runtimeConfig.public` — **env vars only propagate to
  DECLARED keys** (memory `feedback-nuxt-env-only-declared-keys`). New keys must be declared.
- Admin pages exist: `admin/settings.vue`, `admin/navigation.vue`, `admin/homepage.vue`,
  `admin/theme/*` (theme editor already persists custom config to DB — reuse that pattern).
- `tools/create-commonpub/src/template.rs` — scaffolds `commonpub.config.ts` (`instance`,
  `features`). New chrome keys scaffolded here.

---

## Part A — Card sizing (port to base, all instances, tokenized) — LOW RISK, DO FIRST

1. Add design tokens to `packages/ui/theme/base.css` (design source of truth):
   `--cpub-card-min: 260px;` `--cpub-card-gap: 20px;` (deveco's values = new base default).
2. `components/homepage/ContentGridSection.vue`: grid →
   `repeat(auto-fill, minmax(var(--cpub-card-min), 1fr))`, gap → `var(--cpub-card-gap)`.
   Keep an optional fixed-column override only if a section explicitly sets `--grid-cols`
   (else auto-fill wins — matches deveco's responsive behavior).
3. Normalize the **content-card** grids to the same tokens: `[type]/index.vue`, `feed.vue`,
   `search.vue`, `explore.vue` (content grid; hub grid may keep its own token),
   `tags/[slug].vue`, `u/[username]/index.vue`, `federated-hubs/[id]`, `hub/HubProjects.vue`,
   `ContentGridSection`/`EditorialSection`. **Leave non-card grids alone** (product specs 200,
   prize grid, admin stat grids, gallery 200 — these aren't content cards).
   - Optional: a 2nd token `--cpub-card-gap` + `--cpub-card-min-dense: 220px` for the
     contest-entry/dense grids, or just reuse the main token.
4. ContentCard internals unchanged (cover already `4/3`).
5. Ship in the layer (+ `@commonpub/ui` if tokens live there). All instances get deveco
   sizing by default; any instance can retune via the token in its theme CSS.

**Reversible**, no markup change, no behavior change — just consistent responsive columns.

---

## Part B — Config-driven chrome add-ons (default OFF/neutral; deveco ON)

### B0 — Config schema + plumbing (foundation, no visual change)
- `packages/config`: add a `chrome` (or `branding`) object:
  ```
  chrome: {
    announcementBanner?: { enabled: false, html: '', dismissible?: false },
    footer?: { tagline?: string, social?: { icon: 'github'|'discord'|'rss'|'x'|'mastodon'|'youtube'|'web', url: string }[],
               backer?: { label: string, name: string, url: string },
               partOf?: { label: string, url: string },
               poweredBy?: true },
    hero?: { /* gradient/variant tokens — see B3 */ },
  }
  ```
  Defaults reproduce **current base** exactly (so other instances don't move).
- Declare the keys in `apps/reference/nuxt.config.ts` `runtimeConfig.public.chrome`.
- A `useChrome()` composable (layer) merges: config defaults ← admin DB overrides (B-admin).
- Sanitize `announcementBanner.html` (allow `<a>`, `<strong>`, `<em>` only).

### B1 — Top announcement strip-banner (NEW component)
- `components/AnnouncementBanner.vue` rendered above `<header>` in base `layouts/default.vue`.
- `v-if="chrome.announcementBanner.enabled"` → renders nothing for every other instance.
- Tokens `--cpub-banner-bg` / `--cpub-banner-text` (default neutral; deveco = dark-green).
- deveco: enabled + its HTML + bg token.

### B2 — Footer (extend the existing base footer)
- Social links: drive from `chrome.footer.social[]` (default = current commonpub set).
- Tagline: `chrome.footer.tagline` (default `Powered by {siteName}.`).
- Optional **backer badge** + **partOf** bottom line + **poweredBy** link (deveco wants all).
- Footer bg/text: tokens `--cpub-footer-bg` / `--cpub-footer-text` (default neutral surface;
  deveco = dark-green/white). **Biggest visual lever** — purely token, no markup fork.

### B3 — Hero gradient/variant (extend HeroSection; L6 added logo)
- Token-drive hero bg: `--cpub-hero-bg` (default surface+grid; deveco = its 135° gradient +
  radial accents). Eyebrow accent-line + gradient title span: add optional `heroVariant` or
  expose via tokens. Logo column already configurable (`logoImageUrl`). **Highest-fidelity-
  risk item** — deveco's hero has unique structure; may need a `hero.variant: 'gradient'`
  branch in HeroSection rather than tokens alone. Prototype + visual-diff before committing.

### B4 — Nav parity (mostly done)
- Seed deveco `navItems` (flat: Home/Projects/Blog/Communities/Contests/Fediverse/Admin) via
  config. Active-pill + rounded-bottom topbar via deveco theme tokens / cpub overrides.

### B5 — Theme tokens
- Add the new base tokens (`--cpub-footer-bg/text`, `--cpub-banner-bg/text`, `--cpub-hero-bg`,
  `--cpub-card-min/gap`) with neutral defaults; deveco-theme.css sets them to its palette.

---

## Part C — Admin console surface
- New `admin/branding.vue` (or extend `admin/settings.vue`): edit footer social links
  (add/remove rows: icon + URL), tagline, backer, partOf, announcement banner (toggle + HTML),
  hero variant. Persist to DB using the **theme-editor DB-settings pattern** (verify the
  existing instance-settings store; add a `site_chrome` settings row/table if none).
- `useChrome()` merges DB overrides over config defaults at runtime.
- **OPEN QUESTION:** confirm where admin-editable instance settings persist today (theme editor
  uses a DB table) — reuse it; don't invent a parallel store (memory `feedback-test-populates-both-sources`).

## Part C' — create-commonpub CLI
- `template.rs`: scaffold the `chrome` block in generated `commonpub.config.ts` with sensible
  defaults + comments (social links, tagline). Bump version pins per release.

---

## Part D — deveco cutover (the payoff)
After A–C land + deveco config/theme set:
- Delete deveco `layouts/default.vue` → base layout + deveco chrome config + tokens.
- Delete deveco `pages/index.vue` → base homepage sections (hero gradient+logo, content feed,
  contest banner [already deduped in base], sidebar: contests/communities/explore).
- Keep `DevEcoLogo.vue` + `deveco-theme.css` (now also setting the new `--cpub-*` tokens).
- **Visual-diff every breakpoint** before deleting the custom files. Keep them until parity
  is signed off.

---

## Phasing (each phase ships independently, no regression)
1. **A — card sizing** (all-instance win, low risk). ← start here
2. **B0 — chrome config schema + `useChrome` + tokens** (no visual change).
3. **B2/B1 — footer config-driven + announcement banner** (default off elsewhere).
4. **C — admin branding UI + DB persistence.**
5. **C' — CLI scaffolding.**
6. **B3/B4 — hero gradient + nav parity** (fidelity-sensitive; prototype + visual-diff).
7. **D — deveco cutover + delete custom files** (needs visual sign-off).

## Risks / notes
- Card-grid token change touches many files but is mechanical + reversible; snapshot the live
  card sizes on all 3 before/after.
- Hero pixel-parity (B3) is the hardest; budget a variant branch, not just tokens.
- Two config sources (config file + admin DB) — define precedence (DB overrides file) and a
  single merge point (`useChrome`); don't read both ad-hoc.
- Honor `var(--*)`-only rule, WCAG contrast (deveco dark-green footer/banner text), and the
  `feedback-css-scope-component-extraction` + `feedback-view-identity-classes` memories.
