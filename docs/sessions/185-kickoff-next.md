# Kickoff — next session (federation discovery & hardening, Phase 4 + release)

Read this, then start. Master plan: `docs/plans/federation-discovery-and-hardening.md` (living,
checkboxes current). Prior logs: `183` (Phase 0+1+audit), `184` (Phase 2+audit),
`185-federation-phase3-mirror-requests.md` (Phase 3+audit). **Always `curl /api/features` +
`npm view @commonpub/<pkg> version` before trusting any state claim.**

## STATE (2026-06-02)

- Branch **`feat/federation-discovery-and-hardening`**, **7 commits**, **nothing published/deployed**
  (release is deliberately batched — task #7). Working tree clean.
- Phases **0, 1, 2, 3 done** (code + tests + docs). Verified green this session:
  **`pnpm typecheck` 26/26**, protocol **424**, server **1231**, layer **888**, reference `vue-tsc` clean.
- Phase 3 commits: `180320a` (feat: consent-based mirror requests) + `75ebd5d` (audit: tighten
  correlation + harden 5 coincidental-pass tests).

### What changed, by package (cumulative — for the eventual release)
Suggested bumps + publish order **schema → protocol → auth → server → layer** (ui unchanged):
- **@commonpub/schema** 0.25.0 → **0.26.0** — migrations **0013** (self-ref FKs) + **0014**
  (`mirror_requests` table + 2 enums); `.references()`, `approveMirrorRequestSchema`.
- **@commonpub/protocol** 0.12.0 → **0.13.0** — `contentToCreateActivity` (Phase 0) + **Phase 3
  wire change:** `APOffer`, `CPUB_MIRROR_REQUEST`, `buildMirrorRequestActivity`, `onMirrorRequest`
  callback + `Offer` dispatch.
- **@commonpub/auth** 0.7.0 → **0.8.0** — `createAuth` `onUserCreated` callback.
- **@commonpub/server** 2.72.0 → **2.73.0** — outbox projection + visibility gate, backfill
  `since`, `listInstanceFollowers`, 5 hook emits, leaveHub/submitContestEntry transactions, **Phase 3:
  `requestMirror`/`listMirrorRequests`/`approveMirrorRequest`/`rejectMirrorRequest`, `createMirror`
  pull-only (throws on push), `onMirrorRequest` + onAccept/onReject correlation, `Offer` delivery**.
- **@commonpub/layer** 0.43.3 → **0.44.0** — federation admin UX, `MirrorDetailModal`, followers,
  bounded backfill/refederate, error.vue theme, hook wiring, **Phase 3: 3 `mirror-requests/*` routes
  + RBAC keys, create-form direction selector, request panels, `MirrorRequestApproveModal.vue`**.

## NEXT: Phase 4 — registry / instance directory (the "eventually")
`features.actAsRegistry` (default OFF) + `instance.registryUrl` (default `https://commonpub.io`);
signed rate-limited `POST /api/registry/ping` heartbeat + `registry_instances` table (lastSeenAt,
software, stats, derived active/inactive) + directory browse/search UI with per-entry "Mirror this
instance" (pull+depth) and "Request they mirror me" (reuses Phase 3 `requestMirror`). **Schema+design
first; opt-in rollout; abuse controls (rate-limit, signature, allowlist?).** This is public-facing —
checkpoint the product decisions (who can register, what stats are exposed, dedupe/spam) before building.

## THEN: Release (task #7)
Publish in the order above polling `npm view` between each; layer only via `pnpm run publish:layer`;
hand-edit caret pins across 0.x minors; deploy 3 instances; **never trust `gh run` — `curl
/api/health` + a real route per instance**. Migrations **0013 + 0014** apply via `db-migrate.mjs`
(drizzle migrator; fails hard). 0014 is a plain table + `unique(direction,remote_domain)` +
FK→instance_mirrors — heatsync `db:push --force` handles it (only *partial* indexes are skipped).

**Phase 3 live-verify needs TWO CommonPub instances** (single-instance smoke can't exercise the
Offer→Accept round-trip). Checklist:
- On instance A, "Request they mirror you" → B; confirm an `Offer` lands in A's outbound activities
  and delivers (A's `instance_health` for B shows success).
- On B, `/admin/federation` → "Requests to mirror you" shows the pending request → **approve** with a
  depth → a pull mirror of A appears + A's content backfills + B enters A's `/actor/followers`.
- Back on A, the outgoing request flips to **approved**; A publishes → B ingests (federatedContent
  `mirrorId` set). Reject path: B rejects → A's outgoing shows **rejected**.
- **Latent coupling to verify:** `onMirrorRequest` gates `target == https://{extractDomain(siteUrl)}/actor`
  while `requestMirror` builds the local actor from `config.instance.domain`. On all 3 instances these
  resolve to the same host, but confirm `siteUrl` host == `instance.domain` per instance or requests
  silently drop.
- **Browser-smoke `/admin/federation`** (Phase 2+3 UI was vue-tsc + component-tested, NOT
  browser-verified): direction selector, both request panels, the approve modal.

## Known gaps / deferred (non-blocking, noted)
- No HTTP/signature layer in tests → forged-Accept is closed in CODE (sender must match + inbox
  verifies signature) but not exercised end-to-end without two live instances.
- `approveMirrorRequest` isn't transactional (createMirror does network resolution, so a tx would
  hold a connection across I/O); partial failure is recoverable via idempotent re-approve.
- Admin-notify in `onMirrorRequest` queries `users.role=='admin'` — under custom RBAC roles this may
  notify nobody (best-effort; the panel badge is the real surface).
- Outgoing-request manual cancel/retry UI; NodeInfo "is-CommonPub" pre-check before sending an Offer
  (graceful failure already covers non-CommonPub targets — request just stays pending).
- Streaming/live backfill progress + filter dry-run preview (Phase 2 carry-over).

## Respect these memories
[[feedback_bound_bulk_federation_ops]], [[feedback_layer_source_consumer_typecheck]],
[[feedback_verify_packages_changed_before_publish]], [[feedback_npm_propagation_lag]],
[[feedback_pnpm_publish_layer]], [[feedback_caret_semver_0x_minor_bump]],
[[feedback_use_deploy_migrations_not_ssh]], [[feedback_deploy_health_check_warn_not_fail]],
[[feedback_heatsync_dbpush_ci_fragile]], [[feedback_vue_tsc_strict_vs_vitest]],
[[feedback_reuse_existing_components]], [[feedback_nuxt_pathprefix_components]],
[[feedback_test_populates_both_sources]], [[feedback_integration_test_full_output_path]].
