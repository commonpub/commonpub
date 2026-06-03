# Kickoff — next session (federation discovery & hardening, Phase 3+)

Read this, then start. Master plan: `docs/plans/federation-discovery-and-hardening.md` (living,
checkboxes current). Prior logs: `183-federation-phase0-outbox-bounded.md` (Phase 0+1+audit),
`184-federation-phase2-admin-ux.md` (Phase 2+audit). **Always `curl /api/features` +
`npm view @commonpub/<pkg> version` before trusting any state claim.**

## STATE (2026-06-02)

- Branch **`feat/federation-discovery-and-hardening`**, 5 commits, **nothing published/deployed**
  (release is deliberately batched — task #7). Working tree clean.
- Phases **0, 1, 2 done** (code + tests + docs). Verified green this session:
  **`pnpm typecheck` 26/26**, server **1216** tests, layer **872** tests, reference `vue-tsc` clean.
- Commits: `610a76b` Phase 0 (outbox projection + bounded backfill/refederate) · `195b26e`
  Phase 1 (transactions, reconcile script, listContent count, error.vue theme, 5 hooks emitted,
  migration 0013 self-ref FKs) · `7efdc91` audit fixes + tests · `608a842` Phase 2 (admin UX) ·
  (+ the Phase-2 audit polish commit).

### What changed, by package (for the eventual release)
Suggested bumps + publish order **schema → protocol → auth → server → layer** (ui unchanged):
- **@commonpub/schema** 0.25.0 → **0.26.0** — migration **0013** (self-ref FKs) + `.references()`.
- **@commonpub/protocol** 0.12.0 → **0.13.0** — `contentToCreateActivity` (deterministic Create).
- **@commonpub/auth** 0.7.0 → **0.8.0** — `createAuth` `onUserCreated` callback.
- **@commonpub/server** 2.72.0 → **2.73.0** — outbox projection + visibility gate, backfill
  `since`, `listInstanceFollowers`, 5 hook emits, leaveHub/submitContestEntry transactions.
- **@commonpub/layer** 0.43.3 → **0.44.0** — federation admin UX, `MirrorDetailModal`,
  `/api/admin/federation/followers`, bounded backfill/refederate routes, error.vue theme, hook wiring.

## NEXT: Phase 3 — push = consent-based mirror-request protocol

"Push" reframed (owner's words): **a request to have another instance mirror you** — B can only
get A's content by pulling A, so A "pushing" = A asking B to set up a pull mirror of A. Build:
- `createMirror(direction:'push')` → send a signed, **cpub-namespaced** mirror-request to the
  target instance's inbox (model as AP `Offer`/`Follow`-style; CommonPub↔CommonPub only — others ignore).
- `inboxHandlers.ts` handles the inbound request → store it (likely a new `mirror_requests` table
  or reuse `instanceMirrors` with a `requested` status — decide in plan).
- Admin **"Requests to mirror you"** inbox: list pending; **approve** → create a `pull` mirror of
  the requester (with B's own depth/filters) + accept their instance Follow; **reject** → mark rejected.
- New routes under `/api/admin/federation/mirror-requests/*` + a Mirrors-tab section/tab.
- The Phase-2 create form can then offer the direction selector (currently pull-only — see note).
- TDD: two-instance e2e (request → approve → bounded pull → content flows). Anti-loop +
  circuit-breaker paths already exist; don't regress them. This is a **wire-protocol** change —
  version the protocol; keep it CommonPub-only so non-CommonPub instances are unaffected.

## THEN: Phase 4 — registry / instance directory (the "eventually")
`features.actAsRegistry` (default OFF) + `instance.registryUrl` (default `https://commonpub.io`);
signed rate-limited `POST /api/registry/ping` heartbeat + `registry_instances` table (lastSeenAt,
derived active/inactive) + directory browse UI with per-entry "Mirror this instance" (pull+depth)
and "Request they mirror me" (Phase 3). Schema+design first; opt-in rollout.

## THEN: Release (task #7)
Publish in the order above polling `npm view` between each; layer only via `pnpm run
publish:layer`; hand-edit caret pins across 0.x minors; deploy 3 instances; **never trust `gh
run` — `curl /api/health` + a real route per instance**. Migration 0013 applies via
`db-migrate.mjs` (drizzle migrator; fails hard on error). **Live-verify**: heatsync `/actor/outbox`
shows all public posts + `?page=1` lists them; deveco bounded backfill pulls the window; heatsync
has zero deveco content (one-directional intact); reconcile-counters `--check` = 0 drift;
**browser-smoke `/admin/federation`** (Phase 2 UI was vue-tsc + component-tested, NOT browser-verified).

## Deferred (non-blocking, noted)
- Streaming/live backfill progress (needs polling) + filter **dry-run preview** (needs a
  remote-outbox probe) — Phase 2 left these out; current UX is in-flight state + result toast.
- Page-level test for `federation.vue` `createMirror`/`toggleType` (needs `@nuxt/test-utils`).

## Respect these memories
[[feedback_bound_bulk_federation_ops]], [[feedback_layer_source_consumer_typecheck]],
[[feedback_verify_packages_changed_before_publish]], [[feedback_npm_propagation_lag]],
[[feedback_pnpm_publish_layer]], [[feedback_caret_semver_0x_minor_bump]],
[[feedback_use_deploy_migrations_not_ssh]], [[feedback_deploy_health_check_warn_not_fail]],
[[feedback_heatsync_dbpush_ci_fragile]], [[feedback_vue_tsc_strict_vs_vitest]],
[[feedback_reuse_existing_components]], [[feedback_nuxt_pathprefix_components]].
