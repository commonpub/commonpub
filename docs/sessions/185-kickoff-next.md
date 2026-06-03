# Kickoff — next session (federation discovery & hardening: RELEASE — ✅ DONE)

Read this, then start. Master plan: `docs/plans/federation-discovery-and-hardening.md`. Prior logs:
`183` (Phase 0+1), `184` (Phase 2), `185` (Phase 3), `186` (Phase 4), `187` (deep audit),
**`188` (RELEASE — this completed it)**.
**Always `curl /api/features` + `npm view @commonpub/<pkg> version` before trusting any state claim.**

## ✅ RELEASE COMPLETE (2026-06-03, session 188)

Phases 0–4 squash-merged to `main` (PR #1, `a86d4d7`) and shipped, THEN commonpub.io made the
default registry (PR #2, `33d77f2`):
- **Published:** schema **0.26.0**, protocol **0.13.0**, auth **0.8.0**, server **2.73.0**,
  config **0.18.0**, layer **0.45.0**. ui unchanged 0.9.2. test-utils intentionally not published.
  (config 0.17.0→0.18.0 + layer 0.44.0→0.45.0 came in the registry-default follow-up.)
- **Deployed all 3** (commonpub.io / deveco.io / heatsynclabs.io); migrations 0013/0014/0015 applied.
- **P0 verified LIVE:** heatsync `/actor/outbox` totalItems **2→8**, deveco **23**, `#create` ids.
  Latent coupling SAFE (actor host == domain all 3).
- **Registry SHIPPED + P4 VERIFIED LIVE:** `announceToRegistry` now defaults TRUE (config 0.18.0);
  commonpub.io has `actAsRegistry:true`. deveco+heatsync announce on boot → commonpub.io
  `/api/registry/instances` lists both with NodeInfo-pulled stats (deveco 40 users, heatsync 5
  users/8 posts/online). Signed-ping→verify→NodeInfo-pull→directory round-trip confirmed.
  CLI scaffolder pins bumped to current (new instances announce out of the box).

### CLI published + everything reconciled (session 188)
- **create-commonpub 0.5.3 published to crates.io** (`cargo install create-commonpub`) with current
  pins — crates.io had been stuck at 0.4.0 (the lapse that caused pin drift). Added
  `cli-release.yml` (tag `create-commonpub-v*` → `cargo publish`; needs `CARGO_REGISTRY_TOKEN` secret).
- **All 13 @commonpub/* packages: source==published, no drift.** main clean. deveco/heatsync on
  current pins + deployed. Everything is current as of 2026-06-03.

### What still needs the OPERATOR (interactive — admin auth)
- **P3** mirror-request Offer→Accept round-trip (admin login on 2 instances, click approve/reject) —
  the only manual item left.
- Add `CARGO_REGISTRY_TOKEN` repo secret to enable tag-triggered CLI releases.
- Browser-smoke `/admin/federation` (Mirrors + Registry tabs); `reconcile-counters --check` on droplets.

### Corrected stale claims this release found
- **Federation is ALREADY ON in prod** (was "off") — the 187 actor↔signer inbox binding is LIVE.
- **All 3 deploy via `db-migrate.mjs`** — heatsync no longer `db:push --force` (since session 177).
- **Both siblings use `npm install`** — pnpm-drops-files workaround already in their Dockerfiles.

### Post-release audit (session 188) — what was checked + what's confirmed
- **Layer 0.44.0 IS live** (not a stale npm layer): `/api/admin/federation/mirror-requests` +
  `/followers` return **401** (exist, auth-gated) on commonpub.io + heatsync — not 404/500.
- **Registry routes 404 = gated** (`actAsRegistry` off), confirmed same-release as the live 401 routes.
- **NodeInfo works on all 3** (registry's stat source). `software.version` is hardcoded `"0.0.1"` —
  NOT a version-drift signal; don't use it to verify deploys. (Use `/api/features` + outbox totalItems
  + the 401 route surfaces instead.)
- **Federation topology (live):** commonpub.io ↔ deveco.io mutual-follow (seamless pair, both
  `seamlessFederation:true`); deveco → heatsync (deveco in heatsync's `/actor/followers`; heatsync
  content present in deveco's feed). The actor↔signer binding is provably safe for all 3 — delivery
  signs with `keyId = ${activity.actorUri}#main-key` (`delivery.ts:145`), so signer-host == actor-host
  by construction; only cross-host *forwarded* activities 401. No Mastodon peers currently exist.
- **All federated content predates the deploy** (newest 2026-05-30) — nobody has posted since. Live
  delivery is unexercised post-deploy but provably intact. **Definitive test: publish 1 public post on
  heatsync → curl `deveco.io/api/content?limit=5` within a minute; it should appear w/ a today stamp.**

### ⚠️ Release-hygiene MISS found in audit (not production-affecting)
- **CLI scaffolder pins are stale** — `tools/create-commonpub/src/template.rs` constants
  (`COMMONPUB_{CONFIG,LAYER,SCHEMA,SERVER}_VERSION` = `^0.16.0 / ^0.38.0 / ^0.24.0 / ^2.67.0`) and the
  matching assertions in `tests/cli.rs:249-252` are ~6 releases behind. Should be **^0.17.0 / ^0.44.0
  / ^0.26.0 / ^2.73.0**. The file's own "RELEASE CHECKLIST" comment ("Last synced: session 152") has
  been ignored across releases. Fix = bump 4 constants + 4 test assertions + rebuild CLI (the `rust`
  CI job tests them). Only affects freshly-scaffolded apps, NOT the 3 live instances. See
  `feedback_cli_scaffolder`.

### Minor pre-existing items noted (not caused by this release)
- deveco's `/actor/following` lists only commonpub, NOT heatsync — yet heatsync has deveco as a
  follower (the mirror works off heatsync's followers list). Cosmetic projection asymmetry.
- deveco NodeInfo `localPosts: 81` vs feed/outbox `23` — NodeInfo counts all statuses/visibilities;
  if deveco is ever listed in a registry, that 81 is what shows. Confirm it's the intended public stat.

---

## ARCHIVED — pre-release state (2026-06-02, before session 188)

- Branch **`feat/federation-discovery-and-hardening`**, **12 commits**, **nothing published/deployed**.
- **Phases 0–4 ALL done + 3 audit rounds** (code + tests + docs). The only remaining work was the
  **batched release (task #7)**. Verified green: `pnpm typecheck` **26/26**; config **25**,
  protocol **424**, server **1246**, layer **907**; reference `vue-tsc` clean.
- Commits since `main`: `610a76b` P0 · `195b26e` P1 · `7efdc91` P0/1 audit · `608a842` P2 ·
  `402af17` P2 audit · `180320a` P3 · `75ebd5d` P3 audit · `5b35fe4` P3 handoff · `464d533` P4 ·
  `bd1146d` deep-audit fixes · `6d5c1cf` audit-of-audit fixes · `08ea17c`+ handoff docs.

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
