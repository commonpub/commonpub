# Kickoff — next session (dive straight in)

Read this, then start. Prior context: `docs/sessions/178-contest-cardsizing-pagination.md`.
State: all 3 instances (commonpub.io / deveco.io / heatsynclabs.io) live + healthy; homepage
load-more dup FIXED + verified (OVERLAP=0 everywhere). Published: server 2.70.0, layer 0.42.0,
config 0.16.0, schema 0.24.0, auth 0.7.0. Migrations at 0011 (count 12).

---

## PRIMARY — keyset (cursor) pagination for feeds  [task #29]
**Design is locked:** `docs/plans/pagination-scalability.md` (read it first). Goal: replace
the OFFSET + in-app-federated-merge + per-request `COUNT(*)` feed pagination with the proper
scalable pattern. No cruft: keyset for INFINITE-SCROLL feeds; offset stays for numbered/admin
tables (fit-for-purpose).

Build order (server core is fully testable in isolation with the PGlite integration DB — do
that + prove it green BEFORE any client/deploy cutover):
1. Shared helper in `packages/server/src/query.ts`: `encodeCursor`/`decodeCursor` (opaque
   base64url of `{v, id}`) + `keysetWhere(sortCol, idCol, cursor)` → `(sortCol,id) < (v,id)`
   with `NULLS LAST` semantics. Reusable like `normalizePagination`.
2. **Composite indexes** (schema migration 0012, partial `WHERE status='published'`):
   `(published_at DESC, id DESC)` and `(view_count DESC, id DESC)`. `popular` currently
   FULL-SCANS (no view_count index). Verify with `EXPLAIN ANALYZE` on seeded data (memory:
   indexes only used if the WHERE/ORDER BY matches).
3. `listContent` → keyset. Federated case = **keyset-merge**: fetch `limit+1` from each source
   `WHERE (publishedAt,id) < cursor`, merge the two sorted streams, take `limit`, emit
   nextCursor = last item's `(publishedAt,id)`. This structurally removes the offset-window
   fragility (the whole 5-release saga) + the O(M²). `hasMore` via the `n+1`th row — drop the
   per-request COUNT (feed clients already use `items.length < limit`, never `.total`).
4. Endpoint `layers/base/server/api/content/index.get.ts`: accept `?cursor=` + `limit`, return
   `{ items, nextCursor }`. Keep `total` ONLY where a non-feed UI needs it (search/listing
   first page) — feeds don't.
5. Clients: `loadMore` in `ContentGridSection.vue`, base `pages/index.vue`, deveco `index.vue`
   (+ feed.vue/search if doing infinite-scroll there) → store + send `nextCursor`. ~8 funcs
   across the 3 repos. Mechanical but coordinate the release.
The shipped `id` tiebreaker IS the cursor's total-order prerequisite — nothing's wasted.

## DEFERRED RELEASE (do early — fold into the keyset release or first)
- Publish the commonpub-WORKSPACE alignment fix (commit 2d99c74) as **server 2.71.0 / layer
  0.43.0** + bump deveco/heatsync pins, so they get the byte-aligned federated-merge ordering
  before they accrue federated content. (Not urgent — no federated data there today.)

---

## BACKLOG (discussed; tackle after/with keyset)

### deveco visual parity via config-driven chrome  [tasks #21 L5, #23 L7]
Plan: `docs/plans/deveco-parity-and-card-sizing.md`. **Phase A (card sizing) DONE.** Remaining
B–D: make deveco pixel-identical on the BASE homepage/layout so it can drop its custom Vue
pages. Principle (see [[project_deveco_parity_initiative]]): port to base if it helps everyone;
else a config-driven add-on, default OFF, settable in BOTH the admin console AND
`commonpub.config.ts` / the create-commonpub CLI (`template.rs`). Footer Discord/GitHub links
are the canonical example.
- B0: `chrome` config schema (`packages/config`) + `useChrome()` composable + tokens.
- B1: top announcement-banner component (default off; deveco's "Backed by EDGE AI…").
- B2: footer social-links/tagline/backer/partOf config + `--cpub-footer-bg` token (the base
  footer is ALREADY structurally identical — just hardcoded). 
- B3: hero gradient/variant (fidelity-risk, prototype + visual-diff). B4: deveco navItems seed
  (base nav is already `NavRenderer`-driven).
- C: admin branding UI (reuse the theme-editor DB pattern). C': CLI scaffold. D: deveco cutover
  (delete custom `layouts/default.vue` + `pages/index.vue`, visual sign-off).

### RBAC Phases 2–4  (from session 177)
Phase 0+1 shipped, flag OFF/inert. Remaining: seed roles/permissions, flip `features.rbac`,
build the admin role-management UI. Catalog + `requirePermission` already in place.

### E2E CI drift (pre-existing red)
`apps/reference/e2e/{navigation,responsive,smoke}.spec.ts` fail (homepage tab/hero structure,
login "2 submit buttons") — test-vs-app drift from the session-177 homepage/contest changes,
NOT a runtime bug (deploys green). Update the specs so CI is actually green. (The unit-test job
+ docs flake are already fixed; only e2e is red.)

### Minor
- Federation popular-sort semantics: on seamless-fed instances the "For You" tab is now
  chronological in the merge (federated content has no viewCount). Acceptable; revisit only if
  a true cross-instance ranking signal is ever wanted.
- Event notifications: none emitted today (notification nav infra exists).

## Respect these memories
[[feedback_pagination_needs_unique_tiebreaker]], [[feedback_use_deploy_migrations_not_ssh]],
[[feedback_heatsync_dbpush_ci_fragile]], [[feedback_pnpm_install_drops_files]],
[[feedback_caret_semver_0x_minor_bump]], [[feedback_vue_tsc_strict_vs_vitest]],
[[feedback_deploy_health_check_warn_not_fail]], [[feedback_reuse_existing_components]].
