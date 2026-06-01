# Kickoff — next session (dive straight in)

Read this, then start. Prior context: `docs/sessions/178-contest-cardsizing-pagination.md`.
State: all 3 instances (commonpub.io / deveco.io / heatsynclabs.io) live + healthy; homepage
load-more dup FIXED + verified (OVERLAP=0 everywhere). Published: server 2.70.0, layer 0.42.0,
config 0.16.0, schema 0.24.0, auth 0.7.0. Migrations at 0011 (count 12).

---

## PRIMARY — keyset (cursor) pagination for feeds  [task #29]
**Design is locked:** `docs/plans/pagination-scalability.md`. **Server core (Steps 1–3) is
DONE + green as of session 179** — see `docs/sessions/179-keyset-pagination-server.md`.
Only the client cutover (Step 4, below) remains, and it SHIPS.

DONE (committed `0353f6c`, `37ccaf0`, `7f491b7`, audit `04a78fb`; full server suite
**1193 pass**, 0 regressions; suite mutation-tested so it has real teeth):
1. ✅ `query.ts`: `encodeCursor`/`decodeCursor`/`keysetWhere` (opaque base64url, NULLS-LAST).
2. ✅ Composite partial indexes, **migration 0012** (count now 13). EXPLAIN-verified the
   planner uses them. NOTE: index spells `id DESC NULLS FIRST` / `view_count DESC NULLS
   FIRST` — NULLS placement is matched syntactically (`ORDER BY id DESC` = NULLS FIRST),
   so `NULLS LAST` there makes Postgres silently ignore the index. Also `pushSchema` skips
   partial indexes, so the index test creates the DDL itself.
3. ✅ `listContentKeyset(db, {...filters, cursor}, options) → { items, nextCursor }` —
   keyset-merge, `limit+1` hasMore probe, no COUNT, additive (offset `listContent`
   untouched). popular/featured/editorial stay on the offset path. Limit clamped to
   `[1,100]` (a 0/negative limit would make `.limit(limit+1)<=0` → Postgres 500).
   The cross-source merge relies on Postgres `uuid DESC` == JS string-desc — PROVEN in
   `uuid-ordering-invariant.test.ts`; don't break it (e.g. don't switch id to a non-uuid
   key, or change `compareFeedOrder`, without re-proving it).

### Step 4 — ✅ COMPLETE + LIVE on all 3 (schema 0.25.0 / server 2.71.0 / layer 0.43.1)
Whole pagination-scalability plan (Steps 1–4) SHIPPED 2026-06-01. OVERLAP=0 verified live
on commonpub.io / deveco.io / heatsynclabs.io. See `179-keyset-pagination-server.md` §Step 4.
Only Step D (unified `feed_items` timeline table) remains — long-term/optional.

<details><summary>What was done (for history)</summary>
4. ✅ Endpoint: chose a SEPARATE endpoint (user decision) — `GET /api/content/feed`
   → `{ items, nextCursor }` (keyset). The offset `GET /api/content` is unchanged
   → `{ items, total }`. Both share `resolveContentQuery()` (new
   `layers/base/server/utils/contentQuery.ts`) so the auth/status/visibility/federation
   gate can't drift — `contentQuery.test.ts` locks the draft-leak gate (mutation-verified).
   `contentFiltersSchema` gained optional `cursor` (string ≤512). `listContentKeyset`
   re-exported from `@commonpub/server` root (strict nuxt typecheck caught the missing
   re-export — loose vitest didn't; ALWAYS run `pnpm --filter @commonpub/reference typecheck`).
5. ⬜ Clients: `loadMore` in `ContentGridSection.vue`, base `pages/index.vue`, deveco
   `index.vue` (+ feed.vue/search if infinite-scroll) → call `/api/content/feed`, store +
   send `nextCursor` instead of bumping offset. ~8 funcs across the 3 repos. The infinite-
   scroll feed views switch to the new endpoint; numbered/admin listings keep `/api/content`.
6. ✅ Released **schema 0.25.0 / server 2.71.0 / layer 0.43.0→0.43.1** + bumped all 3 pins.
   (0.43.1 = a TS2589 fix in useContentFeed only deveco's stricter typecheck caught — always
   repro a layer type change against the actual consumer's packed tarball before publishing.)
   OVERLAP=0 verified live on all 3.
</details>

## DEFERRED RELEASE (fold into the Step 4 / 2.71.0 release)
- The commonpub-WORKSPACE byte-align fix (commit 2d99c74) ships with 2.71.0 / layer 0.43.0
  so deveco + heatsync get the byte-aligned federated-merge ordering. (Not urgent — no
  federated data there today — but no reason to hold it once 2.71.0 cuts.)

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
