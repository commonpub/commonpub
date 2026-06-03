# Kickoff — next session (supersedes 181-kickoff-next.md)

Read this, then start. Prior context: `docs/sessions/182-codebase-analysis-deep-audit.md`
(docs accuracy audit + Part 2 implementation-verification audit). **Always
`curl /api/features` + `npm view @commonpub/<pkg> version` before trusting any state claim
below — it drifts.**

## STATE (2026-06-01, end of session 182)
- **All 3 instances LIVE + healthy** (commonpub.io / deveco.io / heatsynclabs.io).
- **Published:** schema 0.25.0 · server 2.72.0 · config 0.16.0 · layer 0.43.3 · ui 0.9.2 ·
  auth 0.7.0. **13 migrations** (0012 = composite feed indexes). All repos clean + pushed.
- Session 182 was **docs/analysis-only** — no code changed, nothing published, no version bumps.
- **Live flags (verified by curl this session):** federation ON all 3; federateHubs +
  seamlessFederation ON commonpub+deveco, OFF heatsync; **layoutEngine ON only commonpub.io**
  (canary); events ON all 3; **rbac + publicApi OFF everywhere** (shipped but dark).

There is **no half-finished work in flight.** Clean stopping point.

## VERIFIED LATENT ISSUES (session 182 impl audit — source-confirmed, pick freely)
None are P0 (nothing live-broken); these are the real "missing / doing wrong" backlog.
Memory: `project-session-182-impl-audit`.

1. **Counter integrity (cheapest correctness win).** `leaveHub` (members.ts:129-136) and
   `submitContestEntry` (contest.ts:49,57) update denormalized counters in two NON-transactional
   statements. There is also **no reconcile/recount script anywhere**. Fix: wrap both in
   `db.transaction`, and/or add a `scripts/reconcile-counters.mjs`.
2. **Hooks bus mostly dead.** `hooks.ts` declares 13 events; 5 are never emitted
   (`content:liked`, `content:unliked`, `user:registered`, `federation:hub:post:received`,
   `hub:content:shared`). Either emit them (e.g. `content:liked` in `social.ts toggleLike`,
   `hub:content:shared` in `posts.ts shareContent`) or prune the dead declarations + document
   the bus as a consumer-extension API.
3. **`listContent` COUNT(*)-every-request + O(M²) merge** (content.ts:389-409). Clients mostly
   ignore `total`. Move more numbered/immutable-sort lists to keyset (`listContentKeyset`); make
   COUNT page-1-only. (Long-term step D = unified `feed_items` table, plan
   `docs/plans/pagination-scalability.md`.)
4. **Self-ref trees have no DB FK** (hubs.parentHubId, comments.parentId, hubPostReplies.parentId,
   docsPages.parentId). Latent orphans — add FKs (ON DELETE SET NULL / CASCADE) or a documented
   app-level guarantee.
5. **Mobile: 100 of 135 layer components have no `@media`.** Reading-platform polish gap.
6. **`error.vue:16` drops custom-theme inline CSS** — re-applies only `data-theme`, not
   `cpub-theme-inline`. Custom-themed error pages render with base tokens. One-line fix.
7. **`approval` join policy == `invite`** (members.ts:47); `hubMemberStatusEnum('pending')` is
   dead. Either implement request-to-join (set `status:'pending'`, admin approves) or drop the
   enum value + collapse the policy.
8. **Doc fix:** `codebase-analysis/02` + `03` call events "unvalidated / a gap" — but
   `POST /api/events` validates inline (`index.post.ts:5,31`). Reword to "no *centralized*
   validator in `validators.ts`; validation is decentralized inline" (not a security hole).

## CARRIED-FORWARD BACKLOG (from 181)
- **RBAC Phases 2–4** (session 177): seed roles/permissions, flip `features.rbac`, build admin
  role-management UI. Catalog + `requirePermission` in place. Highest-value un-started product
  work — and rbac is currently DARK on all 3.
- **publicApi is also DARK on all 3** — fully built (20 routes, 12 scopes) but flag OFF
  everywhere. Decide: launch it or stop maintaining it.
- **E2E CI drift** (pre-existing red): `apps/reference/e2e/{navigation,responsive,smoke}.spec.ts`
  — test-vs-app drift from 177/180, NOT a runtime bug (deploys green). Re-baseline against live DOM.
- **deveco visual parity** — OPTIONAL, user kept the custom page. Full path designed in
  `docs/plans/deveco-registered-theme-parity.md`. Don't start unprompted.
- **Redis** is opt-in via `NUXT_REDIS_URL` (memory store default) — flip it before any
  multi-instance web tier, else rate-limit counters reset each deploy + SSE fanout splits.
- Minor: event notifications none emitted; federation popular-sort is chronological in merge.

## Release/deploy discipline (unchanged — every release hits one of these)
- Publish order **schema → server → ui → layer**, POLL `npm view` between each
  (`feedback_npm_propagation_lag`). Layer ONLY via `pnpm run publish:layer`
  (`feedback_pnpm_publish_layer`) — verify packed tarball has no `workspace:*`.
- `^0.x` caret does NOT cross a minor — hand-edit pins (`feedback_caret_semver_0x_minor_bump`).
- deveco CI = `pnpm install --frozen-lockfile` → regen `pnpm-lock.yaml` after a pin bump;
  deveco/heatsync Docker builds use `npm install`; heatsync tracks BOTH lockfiles.
- **NEVER trust `gh run` deploy status** — `curl /api/health` + a real route on each instance
  (`feedback_deploy_health_check_warn_not_fail`).
- **Layer ships SOURCE** — repro layer TYPE changes against the packed tarball + deveco `nuxt
  typecheck` before publishing (`feedback_layer_source_consumer_typecheck`).

## Respect these memories
[[project_session_182_impl_audit]], [[feedback_verify_flag_state]],
[[feedback_keyset_merge_invariants]], [[feedback_decode_untrusted_validate_domain_not_shape]],
[[feedback_pagination_needs_unique_tiebreaker]], [[feedback_layer_source_consumer_typecheck]],
[[feedback_use_deploy_migrations_not_ssh]], [[feedback_heatsync_dbpush_ci_fragile]],
[[feedback_pnpm_install_drops_files]], [[feedback_caret_semver_0x_minor_bump]],
[[feedback_vue_tsc_strict_vs_vitest]], [[feedback_deploy_health_check_warn_not_fail]],
[[feedback_reuse_existing_components]].
