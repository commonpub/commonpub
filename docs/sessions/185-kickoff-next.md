# Kickoff — next session (federation discovery & hardening: RELEASE)

Read this, then start. Master plan: `docs/plans/federation-discovery-and-hardening.md` (living,
all phase checkboxes done). Prior logs: `183` (Phase 0+1), `184` (Phase 2), `185`
(Phase 3 — mirror requests), `186` (Phase 4 — registry). **Always `curl /api/features` +
`npm view @commonpub/<pkg> version` before trusting any state claim.**

## STATE (2026-06-02)

- Branch **`feat/federation-discovery-and-hardening`**, **9 commits**, **nothing published/deployed**.
- **Phases 0–4 ALL done** (code + tests + docs). The only remaining work is the **batched release
  (task #7)**. Verified green: `pnpm typecheck` **26/26**; config **24**, protocol **424**,
  server **1244**, layer **901**; reference `vue-tsc` clean.
- Commits since `main`: `610a76b` P0 · `195b26e` P1 · `7efdc91` P0/1 audit · `608a842` P2 ·
  `402af17` P2 audit · `180320a` P3 · `75ebd5d` P3 audit · `5b35fe4` P3 handoff · `464d533` P4.

## THE RELEASE (task #7)

Suggested bumps + **publish order schema → config → protocol → auth → server → ui(unchanged) → layer**,
polling `npm view` between each; **layer only via `pnpm run publish:layer`**; **hand-edit caret pins
across 0.x minors** (`feedback_caret_semver_0x_minor_bump`); **never trust `gh run` — `curl
/api/health` + a real route per instance** (`feedback_deploy_health_check_warn_not_fail`).

- **@commonpub/schema** 0.25.0 → **0.26.0** — migrations **0013** (self-ref FKs) + **0014**
  (mirror_requests) + **0015** (registry_instances). All apply via `db-migrate.mjs`; heatsync
  `db:push --force` handles them (plain tables + unique + FK; only *partial* indexes are skipped).
- **@commonpub/config** 0.16.0 → **0.17.0** — registry flags + `federation.registryUrl`/ping interval.
- **@commonpub/protocol** 0.12.0 → **0.13.0** — `contentToCreateActivity` (P0) + `APOffer` /
  `buildMirrorRequestActivity` / `onMirrorRequest` / `Offer` dispatch (P3 wire change).
- **@commonpub/auth** 0.7.0 → **0.8.0** — `createAuth` `onUserCreated` callback (P1).
- **@commonpub/server** 2.72.0 → **2.73.0** — outbox projection + visibility gate, bounded backfill,
  transactions, 5 hooks (P0/1); mirror requests (P3); `registry.ts` (P4).
- **@commonpub/layer** 0.43.3 → **0.44.0** — federation admin UX (P2), mirror-request UI (P3),
  registry routes + `RegistryDirectory` + Registry tab (P4), error.vue theme, hook wiring.

## LIVE VERIFY after deploy (needs TWO CommonPub instances for P3/P4 round-trips)

Single-instance smoke can't exercise the Offer→Accept or ping→directory round-trips.

- **P0/P1/P2:** heatsync `/actor/outbox` shows all public posts (`?page=1` lists them); deveco bounded
  backfill pulls the window; one-directional intact (heatsync has zero deveco content);
  `reconcile-counters --check` = 0 drift; browser-smoke `/admin/federation`.
- **P3 (mirror requests):** on A, "Request they mirror you" → B; an `Offer` lands in A's outbound +
  delivers. On B, `/admin/federation` → "Requests to mirror you" → **approve** w/ depth → a pull
  mirror of A appears + A backfills + B enters A's `/actor/followers`. A's outgoing request flips
  **approved**; A publishes → B ingests (`federatedContent.mirrorId` set). Reject → A shows **rejected**.
- **P4 (registry):** set `actAsRegistry` on one instance + `announceToRegistry`+`registryUrl` on
  another → a signed ping lands, the directory lists it with **NodeInfo-pulled** stats, admin
  hide/block works, and Mirror/Request actions create the right P3 artifacts. Browser-smoke the
  Registry tab. (Registry routes 404 until `actAsRegistry` is flipped.)
- **Latent coupling to confirm per instance:** `onMirrorRequest` gates `target ==
  https://{extractDomain(siteUrl)}/actor` and the heartbeat builds the local actor from
  `config.instance.domain` — these must resolve to the same host. Confirm `siteUrl` host ==
  `instance.domain` on all 3 or requests/pings silently drop.

## Known gaps / deferred (non-blocking — see 185/186 logs)
- No HTTP/signature layer in tests (forged-Accept closed in code + inbox verification, not e2e'd).
- `approveMirrorRequest` not transactional (network resolution inside; recoverable via idempotent
  re-approve). Admin-notify queries `users.role=='admin'` (custom RBAC may notify nobody).
- Registry: no public directory page, no registry→registry gossip, no independent stats poller
  (refresh on ping), no auto-mirror, no NodeInfo "is-CommonPub" pre-check before an Offer.
- Streaming backfill progress + filter dry-run preview (P2 carry-over).

## Respect these memories
[[feedback_caret_semver_0x_minor_bump]], [[feedback_pnpm_publish_layer]],
[[feedback_npm_propagation_lag]], [[feedback_verify_packages_changed_before_publish]],
[[feedback_use_deploy_migrations_not_ssh]], [[feedback_deploy_health_check_warn_not_fail]],
[[feedback_heatsync_dbpush_ci_fragile]], [[feedback_layer_source_consumer_typecheck]],
[[feedback_vue_tsc_strict_vs_vitest]], [[feedback_verify_flag_state]],
[[feedback_pnpm_install_drops_files]].
