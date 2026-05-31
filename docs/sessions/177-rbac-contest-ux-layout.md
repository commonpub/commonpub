# Session 177 — RBAC Phase 0+1 shipped + contest UX overhaul + layout/feed fixes

2026-05-31. Long session: shipped RBAC Phase 0+1 (inert), a contest-UX overhaul,
the hero-logo capability, several bug fixes, and repaired heatsync's deploy. ~13
layer releases (0.30.0 → 0.37.0), schema 0.22→0.24, server 2.63→2.67, config 0.16.0,
auth 0.7.0. All flag-OFF for RBAC — zero auth behavior change in prod.

## Shipped + live on all 3 (commonpub.io / deveco.io / heatsynclabs.io)
- **RBAC Phase 0+1** (flag OFF, byte-identical): 70 `requireAdmin`→keyed
  `requirePermission`, `ownerOrPermission` gate, full per-route key contract tests.
  Migrations 0009 (RBAC tables). Phases 2–4 (seed + flip flag + admin UI) remain.
- **Contest UX**: Markdown description/rules (`CpubMarkdown` → `markdownToBlockTuples`
  → `BlocksBlockContentRenderer`); `subheading` field (migration 0010) for the hero
  tagline; `prizesDescription` (migration 0011) on the Prizes tab; flexible prizes
  (title/place/value all optional); delete-contest UI (gated `ownerOrPermission`);
  status-transition clarity; full rank-ordered standings (`listContestEntries`
  `orderBy:'rank'`); banner `ImageUpload`; entry-card restyle; clickable notification
  rows; ContentCard avatar-squish fix.
- **Entry submission**: endpoint returns the SPECIFIC failure reason (was a catch-all
  400 — top cause is the contest being `upcoming`, must be Active). Gallery picker
  (content-card grid, was a `<select>`) scoped to the user's OWN content (was listing
  everyone's). "Create new project" tile → editor `?contest=slug` → auto-enters on
  publish. Prominent Entries-tab CTA.
- **Hero logo** (L6, additive): `HeroSection` accepts `config.logoImageUrl`.
- **Layout**: base `.cpub-listing` (/project,/blog) was 960px left-aligned → centered,
  padded, ~1200px. Other base pages verified already centered.
- **Feed load-more** (L8): `listContent` federated-merge paginated local at offset but
  federated from 0 then `slice(0,limit)` → duplicates every page. Now both sources
  fetch `[0, offset+limit)`, merge, `slice(offset, offset+limit)`.
- **Contest dedupe**: hero publishes `useState('cpub:hero-contest-id')`; `ContestsSection`
  sidebar excludes it (no double-showing the active contest).
- **Notification nav**: `resolveComponent('NuxtLink')` (the `:is="'NuxtLink'"` string
  broke SSR resolution → hydration mismatch + dead link). hub-post like/comment
  notifications now set a `/hubs/{slug}/posts/{id}` link.

## Infra: heatsync deploy FIXED
heatsync ran `db:push --force`, which aborts on drizzle-kit's interactive truncate
prompt (no TTY) and `| tee` masked the failure → schema silently never applied
(subheading column missing → contests 500). Switched its deploy to `db-migrate.mjs`
(added `scripts/db-migrate.mjs` to the repo + `DRIZZLE_MIGRATIONS_FOLDER=node_modules/
@commonpub/schema/migrations`) + baselined `drizzle.__drizzle_migrations` at 0011 +
applied the 0009 RBAC tables. Future migrations auto-apply. deveco uses a MANAGED DB
(no local pg container) — to run DB scripts there, `docker cp` a .cjs into
`/app/.output/server` and `docker exec -w /app/.output/server deveco-app-1 node X.cjs`.

## Audit notes (this session)
- No hardcoded colors in any added `.vue`/CSS (`var(--*)` rule held).
- Gallery uses `role=radiogroup/radio`; dedupe + hero-logo are additive/config-driven.
- Mild duplication: markdown-strip excerpt logic was copy-pasted in `ContestHero`
  (`tagline`) + `contests/index.vue` (`cardBlurb`). **Resolved (layer 0.39.0):**
  extracted to `layers/base/utils/markdownExcerpt.ts` (`markdownToExcerpt`, auto-imported,
  9 unit tests); both callers now delegate. Also removed orphaned `.cpub-rules-list` /
  `.cpub-rule-item` / `.cpub-rules-text` CSS from `ContestRules.vue` (dead after rules
  went always-Markdown). Added a `listContent` includeFederated no-duplicate-page
  regression test to `content.integration.test.ts`.
- New gotchas recorded in `docs/llm/gotchas.md` (federated-feed pagination; NuxtLink-via-:is).
- **Gitignore swallowed a real route (fixed):** the Stryker `reports/` ignore (unanchored)
  also matched `layers/base/server/api/admin/reports/`, so the RBAC-gated resolve-report
  endpoint (`resolve.post.ts`, key `reports.review`) was never committed. Passed locally
  (file on disk) + shipped in the npm layer tarball (pnpm packs on-disk files → npm
  consumers had it), but was absent from commonpub.io (repo-built) + CI's checkout →
  CI's `admin-route-keys` completeness test went red. Narrowed to `**/reports/mutation/`
  + committed the route. Feedback memory: unanchored-gitignore-swallows-source. Swept the
  rest of `.gitignore` for the same class — only `node_modules/`/`dist/` match real dirs
  (both legit); no other source-swallowing patterns.
- **deveco homepage contest dup + completed-contest-shown (user-reported, fixed in deveco-io):**
  deveco's *custom* `pages/index.vue` (not the base homepage) fetched `/api/contests` with
  no `status` filter and `v-for`'d the sidebar over ALL items, so (1) a `completed` contest
  ("Edge AI Challenge 2026", 0d left) showed under "Active Contests" and (2) the active hero
  contest was repeated in the sidebar. The base 0.38.0 dedup (`heroContestId` useState) never
  reached deveco. Fix: fetch `status:active` + `sidebarContests` computed (active-only, minus
  the hero contest). Audited the other two sites: commonpub.io uses the correct base dedup;
  heatsync's shadowed `HeroSection` intentionally drops the contest-hero (nothing to dup).
  Caught a `noImplicitAny` vue-tsc error on the filter param (deveco CI is strict) — fixed.
- **docs CI flake (fixed):** `packages/docs` `pipeline.test.ts` `renderMarkdown` cold-loads
  `@shikijs/rehype` (WASM + grammars) on the first call (~3.5s local, >60s on a loaded CI
  runner → "Test timed out in 60000ms" flake). Added a `beforeAll` warmup (120s headroom)
  so every test runs against the globally-cached highlighter. Test-only; no docs republish.

## Open / next
- **L5+L7 (deveco migration)**: deveco ships a fully custom `layouts/default.vue` (flat
  hardcoded nav) + `pages/index.vue` (gradient hero + logo). Switching to the base needs
  base hero GRADIENT config (L6 added logo only), homepage-sections hero config, flat
  nav seed, + sidebar/grid parity — then deveco config. Theme (`deveco-theme.css`) only
  sets CSS vars + cpub-* overrides; it can't change markup. NEEDS VISUAL SIGN-OFF — would
  change deveco's gold-standard look. Traced in detail (see chat / task #23).
- Legacy homepage path (`pages/index.vue`) has its own hero+sidebar contest cards; the
  dedupe only covers the sections path (which the live instances use).
- RBAC Phases 2–4. Event notifications (none emitted today). Reviewer-listing test.
