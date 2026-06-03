# Kickoff — next session (federation discovery & hardening: RELEASE)

Read this, then start. Master plan: `docs/plans/federation-discovery-and-hardening.md` (living,
all phase checkboxes done). Prior logs: `183` (Phase 0+1), `184` (Phase 2), `185`
(Phase 3 — mirror requests), `186` (Phase 4 — registry), `187` (deep audit + fixes).
**Always `curl /api/features` + `npm view @commonpub/<pkg> version` before trusting any state claim.**

## STATE (2026-06-02)

- Branch **`feat/federation-discovery-and-hardening`**, **11 commits**, **nothing published/deployed**.
- **Phases 0–4 ALL done + 3 audit rounds** (code + tests + docs). The only remaining work is the
  **batched release (task #7)**. Verified green: `pnpm typecheck` **26/26**; config **25**,
  protocol **424**, server **1246**, layer **907**; reference `vue-tsc` clean.
- Commits since `main`: `610a76b` P0 · `195b26e` P1 · `7efdc91` P0/1 audit · `608a842` P2 ·
  `402af17` P2 audit · `180320a` P3 · `75ebd5d` P3 audit · `5b35fe4` P3 handoff · `464d533` P4 ·
  `bd1146d` deep-audit fixes · `6d5c1cf` audit-of-audit fixes.

## ⚠️ ONE BEHAVIOR CHANGE TO THE LIVE INBOX (session 187 — read before re-enabling federation)

The deep audit added **`assertActorMatchesSigner`** to all 3 inbox routes: an inbound activity's
top-level `actor` must be on the **same host as the HTTP-signature signer** (closes actor-spoofing
— a validly-signed request from X could previously claim `actor: victim`). CommonPub always signs
with `keyId == actor`, so CommonPub↔CommonPub is unaffected, and Mastodon/GoToSocial **direct**
delivery is unaffected (signer == author). The ONE thing this rejects: **Mastodon inbox-*forwarded*
activities** (server B forwards A's activity, HTTP-signed by B, `actor: A`) — we don't depend on
forwarding, and it's the correct security tradeoff, but if a live interop test shows dropped
reply-thread activities from Mastodon, this is why. The integration/interop tests call
`processInboxActivity` directly so they don't exercise this — only a real Mastodon peer will.

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
- **Actor↔signer binding (session 187):** a cross-instance `Accept`/`Create`/etc. must carry an
  `actor` whose host matches the signer, or it 401s (see the behavior-change box above).
- **Latent coupling to confirm per instance:** `onMirrorRequest` gates `target ==
  https://{extractDomain(siteUrl)}/actor` while the heartbeat + mirroring build the local actor from
  `config.instance.domain`. Confirm `siteUrl` host == `instance.domain` on all 3 or requests/pings
  silently drop. (The heartbeat was switched to `instance.domain` in 187; `onMirrorRequest` still
  uses the `siteUrl`-derived domain — they agree only if siteUrl host == instance.domain.)

## Known gaps / deferred (non-blocking — see 185/186/187 logs)
- No HTTP/signature layer in tests — the wire path (signing + verifyInboxRequest + the new
  actor↔signer binding) is only exercised by a real 2-instance run, not unit tests.
- `approveMirrorRequest` not transactional → a duplicate `Accept(Offer)` is possible on
  partial-failure retry (harmless: receiver's `onAccept` matches `status='pending'`). The
  reuse-existing-mirror + unique-race + duplicate-Follow paths were FIXED in 187; the
  blocked-race `setWhere` guard is correct but race-only (untested).
- `onMirrorRequest` admin-notify queries `users.role=='admin'` — custom RBAC roles with
  `federation.manage` get no notification (the admin badge still surfaces it).
- Registry: no public directory page, no registry→registry gossip, no independent stats poller
  (refresh on ping), no auto-mirror, no NodeInfo "is-CommonPub" pre-check before an Offer.
- Mastodon inbox-forwarded activities are now rejected (see behavior-change box) — re-deliver
  directly or dereference; we don't depend on forwarding.
- Streaming backfill progress + filter dry-run preview (P2 carry-over).

## Respect these memories
[[feedback_caret_semver_0x_minor_bump]], [[feedback_pnpm_publish_layer]],
[[feedback_npm_propagation_lag]], [[feedback_verify_packages_changed_before_publish]],
[[feedback_use_deploy_migrations_not_ssh]], [[feedback_deploy_health_check_warn_not_fail]],
[[feedback_heatsync_dbpush_ci_fragile]], [[feedback_layer_source_consumer_typecheck]],
[[feedback_vue_tsc_strict_vs_vitest]], [[feedback_verify_flag_state]],
[[feedback_pnpm_install_drops_files]].
