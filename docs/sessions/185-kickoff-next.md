# Kickoff — next session (federation discovery & hardening: RELEASE — ✅ DONE)

Read this, then start. Master plan: `docs/plans/federation-discovery-and-hardening.md`. Prior logs:
`183` (Phase 0+1), `184` (Phase 2), `185` (Phase 3), `186` (Phase 4), `187` (deep audit),
**`188` (RELEASE — this completed it)**.
**Always `curl /api/features` + `npm view @commonpub/<pkg> version` before trusting any state claim.**

## ✅ RELEASE COMPLETE (2026-06-03, session 188)

Phases 0–4 squash-merged to `main` (PR #1, `a86d4d7`) and shipped, THEN commonpub.io made the
default registry (PR #2, `33d77f2`):
- **Published:** schema **0.26.0**, protocol **0.13.0**, auth **0.8.0**, server **2.73.0**,
  config **0.18.0**, layer **0.47.0** (0.45 registry → 0.46 banner → 0.47 avatar fix). ui unchanged
  0.9.2. test-utils intentionally not published. **CLI create-commonpub 0.5.5** on crates.io.
  Canonical operator doc/runbook is now **`docs/STATUS.md`**.
- **Deployed all 3** (commonpub.io / deveco.io / heatsynclabs.io); migrations 0013/0014/0015 applied.
- **P0 verified LIVE:** heatsync `/actor/outbox` totalItems **2→8**, deveco **23**, `#create` ids.
  Latent coupling SAFE (actor host == domain all 3).
- **Registry SHIPPED + P4 VERIFIED LIVE:** `announceToRegistry` now defaults TRUE (config 0.18.0);
  commonpub.io has `actAsRegistry:true`. deveco+heatsync announce on boot → commonpub.io
  `/api/registry/instances` lists both with NodeInfo-pulled stats (deveco 40 users, heatsync 5
  users/8 posts/online). Signed-ping→verify→NodeInfo-pull→directory round-trip confirmed.
  CLI scaffolder pins bumped to current (new instances announce out of the box).

### CLI publishing automated (session 188)
- **create-commonpub on crates.io** (`cargo install create-commonpub`), now at **0.5.5** — crates.io
  had been stuck at 0.4.0 (the lapse that caused pin drift). `cli-release.yml` publishes on a
  `create-commonpub-v*` tag; **`CARGO_REGISTRY_TOKEN` secret is SET** (validated publishing 0.5.4 + 0.5.5).
  Local copy gitignored at `.secrets/cargo-registry-token`.

### Continued — UI fixes shipped to all 3 (session 188, layer 0.46→0.49; schema→0.27; server→2.74; CLI→0.5.7)
- **Contest overhaul** (schema 0.27.0 / server 2.74.0 / layer 0.49.0, migration 0016): optional
  `contests.coverImageUrl` (cards prefer it cover-cropped → contained banner → trophy; create/edit
  forms gained a cover upload); ContestHero redesigned (full-width banner band like content pages +
  2-col body with countdown beside the title/details + status pill); **prizes entirely optional**
  (form stopped pre-filling 3 prize rows). Migration applied on all 3; verified live on deveco.
- **Contest banner −¼** (260→195px), layer 0.46.0. Verified live (deveco contest page CSS).
- **deveco mobile-nav hamburger** fixed — its FORKED `layouts/default.vue` used bare
  `<MobileNavRenderer>` (Nuxt pathPrefix → `<NavMobileNavRenderer>`), so it rendered an empty
  `<mobilenavrenderer>` + broke hydration. Fixed to `<NavMobileNavRenderer>` (deveco-repo-only;
  heatsync/commonpub use the layer's correct layout). Verified live.
- **Avatar oval → round**, layer 0.47.0. Byline/author/card avatars rendered as tall ovals (img fell
  back to intrinsic aspect on one axis — NOT flex compression, seen on wide viewports). Hard-locked
  `.cpub-av`/`.cpub-cc-av` to a square via `min/max` on BOTH axes (`--cpub-av-size` var). CSS verified
  live on deveco; **awaiting the operator's visual confirm**. Root cause (which global rule drops the
  dimension to `auto`) NOT found — the clamp fixes the symptom robustly; worth a root-cause pass.
- **Contest-card banner image**, layer 0.48.0. `/contests` cards now lead with the contest `bannerUrl`
  (16:9 cover-cropped thumb via image-proxy + grid/trophy fallback + status-badge overlay, whole-card
  link). Verified live on deveco (2 cards render `cpub-contest-cover`). **Awaiting visual confirm.**
- **CI check-job flakes fixed (merged):** infra Redis fixed-window boundary race → `waitForWindowHeadroom`
  guard; `@commonpub/docs` transient CI flake → `retry:2`. `check` now green first-try (no more reruns).
- **CLI** now at **0.5.6** on crates.io (auto-published via the `create-commonpub-v*` tag workflow,
  validated three times: 0.5.4/0.5.5/0.5.6).
- **Cruft:** removed ~874MB+ of gitignored `.stryker-tmp` (root + packages/infra + packages/schema).
- **codebase-analysis refreshed** (02 counts/migrations, 08 announce default, 11 + facts.md versions).

### Post-session audit (verified 2026-06-03)
- **Zero drift**: all 13 @commonpub/* source==published; layer 0.47.0; CLI Cargo 0.5.5==crates.io.
  main clean, 0 unpushed, only `main` branch. deveco+heatsync pinned `^0.47.0`, deployed, health 200.
- **No regressions** across the 4 layer releases: federation flags as designed; registry directory
  still lists deveco+heatsync (both online); outbox P0 intact (heatsync 8, deveco 23).

### Open items (next session)
- **P3** mirror-request Offer→Accept round-trip — the only federation feature never verified
  end-to-end (needs admin login on 2 instances: Request → approve w/ depth → pull mirror + backfill).
- **Finish e2e green (draft PR #7)** — `check`/`rust` are stable now. The e2e prod-build switch
  (PR #7, NOT merged) fixed the 2 homepage flakes but surfaced **7 console-error failures on
  auth/`/create`/admin-theme pages** in prod mode (e2e-prod-env config gaps; live login works fine).
  To finish: pull the run's Playwright **trace artifact** (or local prod repro) to pin the auth-page
  console error, add the missing e2e prod config (likely a `NUXT_PUBLIC_*` auth value), then merge PR #7.
- **GitHub Actions Node 20 deprecation** — auto-switches those actions to Node 24 on **2026-06-16**
  (non-breaking, self-resolving); bump action majors when convenient.
- **Avatar root cause** — found+fixed the symptom (square-lock); the global rule that drops the
  `<img>` dimension to `auto` is still unidentified.
- **Visual confirms pending:** avatar circle + contest-card banner on deveco (hard-refresh).
- Federation backlog: P3 round-trip (above), registry public directory page / stats poller / gossip,
  streaming backfill progress, `approveMirrorRequest` transaction.
- ~~`CARGO_REGISTRY_TOKEN` secret~~ DONE. Browser-smoke `/admin/federation`; `reconcile-counters --check`.

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
