# Kickoff — next session (supersedes 178-kickoff-next.md)

Read this, then start. Prior context: `docs/sessions/179-keyset-pagination-server.md`
(keyset) + `docs/sessions/180-deveco-nav-and-chrome-tokens.md` (nav/tokens + the security
audit). **Always `curl /api/features` + `npm view @commonpub/<pkg> version` before trusting
any state claim below — it drifts.**

## STATE (2026-06-01, end of session 180)
- **All 3 instances LIVE + healthy + DoS-immune** (commonpub.io / deveco.io / heatsynclabs.io).
- **Published:** schema 0.25.0 · **server 2.72.0** · config 0.16.0 · **layer 0.43.3** ·
  ui 0.9.2 · auth 0.7.0. **13 migrations** (0012 = composite feed indexes). All 3 repos
  clean + pushed.
- **SHIPPED recently:** keyset feed pagination (sessions 178–179: `GET /api/content/feed`,
  `listContentKeyset`, cursor helpers, migration 0012, `useContentFeed` client — OVERLAP=0
  verified live); deveco config-driven nav (respects `/admin/navigation`, custom page kept);
  base-layout chrome tokenization (`--cpub-topbar-*`/`--cpub-nav-link-*`/`--cpub-footer-*` —
  any theme can restyle chrome without forking); **security fix server 2.72.0** (crafted-
  cursor DoS — was LIVE — + federated-leak-past-local-filters, both fixed + verified live).

There is **no half-finished work in flight.** This is a clean stopping point — pick any
backlog item below fresh.

## BACKLOG (no priority forced — pick what the user wants)

### deveco visual parity — NOW OPTIONAL (user kept the custom page)
The original B–D parity cutover (drop deveco's custom `layouts/default.vue` +
`pages/index.vue`, build config-driven banner/footer, registered theme) was **declined** —
deveco keeps its custom page (and therefore can't use the layout engine on its homepage;
the two are mutually exclusive per route). Session 180 instead gave deveco config-driven nav
+ tokenized the base chrome. If the user EVER wants the full cutover, the path is fully
designed in `docs/plans/deveco-registered-theme-parity.md` (registered `deveco` theme via
the agora `[data-theme]` override pattern + 2 small components for the top-banner/footer-
extras). Don't start it unprompted.

### RBAC Phases 2–4  (from session 177)
Phase 0+1 shipped, `features.rbac` flag OFF/inert. Remaining: seed roles/permissions, flip
the flag, build the admin role-management UI. Catalog + `requirePermission` already in place.
Probably the highest-value un-started product work.

### E2E CI drift (pre-existing red)
`apps/reference/e2e/{navigation,responsive,smoke}.spec.ts` fail (homepage tab/hero structure,
login "2 submit buttons") — test-vs-app drift from session-177 changes, NOT a runtime bug
(deploys green). NOTE: session 180's nav/chrome changes may have shifted more selectors —
re-baseline against the current live DOM. The unit-test + docs-flake jobs are already green;
only e2e is red.

### Minor / opportunistic
- **Pagination step D (optional, long-term):** unified `feed_items` timeline table → single
  keyset query, no in-app merge. Only if federated volume grows large. Plan:
  `docs/plans/pagination-scalability.md`.
- Two audited non-bugs left as-is (server 2.72.0 audit): `idx_content_items_feed_popular`
  is currently unused (keyset is recency-only + offset-popular uses a createdAt secondary) —
  cheap, forward-looking, leave it; federated `type='blog'` doesn't expand the legacy
  `article` alias the local query does — near-zero impact on a deprecated alias.
- Event notifications: none emitted today (notification nav infra exists).
- Federation popular-sort: on seamless-fed instances the "For You" tab is chronological in
  the merge (federated content has no viewCount). Acceptable.

## Release/deploy discipline (every release this run hit one of these)
- Publish order **schema → server → ui → layer**, POLL `npm view` between each
  (`feedback_npm_propagation_lag`). Layer ONLY via `pnpm run publish:layer`
  (`feedback_pnpm_publish_layer`) — verify the packed tarball has no `workspace:*`.
- `^0.x` caret does NOT cross a minor (`^0.43.2` excludes `0.44.0`) — hand-edit pins
  (`feedback_caret_semver_0x_minor_bump`).
- deveco CI is `pnpm install --frozen-lockfile` → regen `pnpm-lock.yaml` after a pin bump or
  CI goes red; deveco/heatsync Docker builds use `npm install`. heatsync tracks BOTH lockfiles.
- **NEVER trust `gh run` deploy status** — `curl /api/health` + a real route on each instance
  (`feedback_deploy_health_check_warn_not_fail`). deveco's deploy health-check cold-start
  false-alarms; verify live anyway.
- **Layer ships SOURCE** — a stricter consumer tsconfig (deveco) can red-CI on layer TYPE
  changes the reference app accepts; repro against the packed tarball + deveco `nuxt
  typecheck` before publishing (`feedback_layer_source_consumer_typecheck`).

## Respect these memories
[[feedback_keyset_merge_invariants]], [[feedback_decode_untrusted_validate_domain_not_shape]],
[[feedback_pagination_needs_unique_tiebreaker]], [[feedback_layer_source_consumer_typecheck]],
[[feedback_use_deploy_migrations_not_ssh]], [[feedback_heatsync_dbpush_ci_fragile]],
[[feedback_pnpm_install_drops_files]], [[feedback_caret_semver_0x_minor_bump]],
[[feedback_vue_tsc_strict_vs_vitest]], [[feedback_deploy_health_check_warn_not_fail]],
[[feedback_reuse_existing_components]].
