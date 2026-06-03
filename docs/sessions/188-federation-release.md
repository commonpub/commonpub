# Session 188 — Federation discovery & hardening: the batched RELEASE (task #7)

Date: 2026-06-03. Branch `feat/federation-discovery-and-hardening` → squash-merged to `main`
(PR #1, merge commit `a86d4d7`). This session shipped the work of sessions 183–187 (Phases 0–4 +
3 audit rounds) to npm and all 3 production instances.

## What was done

### Pre-flight verification (did NOT trust the handoff)
- `npm view` confirmed pre-release published versions: schema 0.25.0, config 0.16.0, protocol
  0.12.0, auth 0.7.0, server 2.72.0, ui 0.9.2, layer 0.43.3. Local == published (nothing bumped yet).
- `pnpm typecheck` **26/26**. Suites re-run green: config 25, protocol 424, auth 84, server
  **1246** (+3 skipped), layer **907**. `pnpm build` 15/15.
- `git diff main...HEAD` per package: schema/config/protocol/auth/server changed + layers/base +
  **test-utils** (1 src file: the two new registry flags added to `createTestConfig` — devDep only,
  no runtime consumer → correctly NOT published). **ui confirmed untouched** → not bumped.
- All internal deps are `workspace:*` → pnpm rewrites to exact concrete versions at publish
  (verified: published protocol pins `@commonpub/schema 0.26.0` exact, not a caret). So no
  sibling-pin editing INSIDE the tarballs; caret hand-editing only needed in external consumer apps.

### Published (in dependency order, polled `npm view` between each)
schema **0.26.0** → config **0.17.0** → protocol **0.13.0** → auth **0.8.0** → server **2.73.0** →
layer **0.44.0** (via `pnpm run publish:layer`). ui unchanged at 0.9.2. Verified layer 0.44.0 pins
all six new versions. schema tarball ships `migrations/` incl. 0013/0014/0015 + `meta/_journal.json`
listing them.

### Deployed all 3
- **commonpub.io**: PR #1 squash-merged to main → Deploy Production (local layer, `db-migrate.mjs`,
  `smoke.mjs`) ✓ 6m11s. CI on the PR: `check`+`rust` green; **e2e red = PRE-EXISTING** (byte-identical
  `navigation.spec.ts:8`/`:38` homepage flakes are red on `main` too — main CI is chronically red;
  `smoke.mjs` is the real production gate). Re-ran the first CI failure (flaky infra Redis
  integration test `two stores sharing one Redis`) — passed on rerun.
- **deveco.io** (`devEcoConsultingLLC/deveco-io`): hand-edited carets layer^0.44.0 / config^0.17.0 /
  schema^0.26.0 / server^2.73.0; `npm install` (package-lock gitignored there); push main → deploy ✓.
- **heatsynclabs.io** (`heatsynclabs/heatsynclabs-io`): same caret edits; `npm install` regenerated
  the **tracked** package-lock.json; push main → deploy ✓.

### Live verification (curl, never trusting `gh`)
- All 3: `/api/health` 200, `/` 200.
- **New registry flags live** on all 3 (`actAsRegistry:false`, `announceToRegistry:false`) ⇒ config
  0.17.0 + nuxt runtimeConfig declaration deployed.
- **P0 outbox projection VERIFIED LIVE** — the headline fix:
  - heatsync `/actor/outbox` `totalItems: **8**` (was `2` for 8 posts — the documented bug), all 8
    on page 1, first activity `Create`/`Article` id ends `#create` (protocol 0.13.0
    `contentToCreateActivity` deterministic id).
  - deveco `totalItems: **23**`, 20/page, same `#create` shape.
  - commonpub.io `totalItems: 0` — CORRECT: its feed shows federated-in deveco content; its own
    instance actor authored no public content.
- **Latent coupling SAFE**: `actor.id` host == domain on all 3 (`https://<domain>/actor`) ⇒ siteUrl
  host == instance.domain ⇒ mirror requests / registry pings won't silently 401.
- Registry routes 404 on all 3 = EXPECTED (gated behind `actAsRegistry`, which is off).
- Migrations 0013/0014/0015 applied: deploy `db-migrate.mjs` is a hard-fail step (`set -e` +
  `|| exit 1`); all 3 deploys succeeded + apps serve with no 500s. (ssh-action `capture_stdout:false`
  hides the migrate stdout, but the exit code propagates.)

## Decisions
- Merged despite red e2e: the two failing specs are pre-existing homepage flakes identical on `main`;
  gating on them would block every merge. Confirmed via main's CI history before merging.
- Did NOT publish test-utils (devDep-only flag-sync change, no runtime consumer).
- Did NOT flip `actAsRegistry`/`announceToRegistry` — `announceToRegistry` is deliberately
  "no phone-home until opted in"; activating the registry is a product/privacy decision for the
  operator, not a release step.

## Corrected stale claims (verified, not assumed)
- **Federation is ALREADY ON in prod** (handoff said "flag off"): commonpub.io + deveco.io
  `federation:true, seamlessFederation:true`; heatsync `federation:true, seamless:false`. So the
  session-187 actor↔signer inbox binding went LIVE on deploy (safe for CommonPub↔CommonPub).
- **All 3 instances now deploy via `db-migrate.mjs`** — heatsync NO LONGER uses `db:push --force`
  (session 177 switched it; handoff was stale).
- **Both siblings use `npm install`** (not pnpm `--frozen-lockfile`) — the pnpm-drops-files
  workaround is already in their Dockerfiles.

## Still requires the operator (interactive / credentialed / product decision)
These are exactly the items the handoff flagged as needing TWO CommonPub instances + admin UI:
- **P3 mirror-request round-trip**: log into `/admin/federation` on two instances, send
  "Request they mirror you" → approve with depth on the other → confirm pull mirror + backfill +
  outgoing request flips `approved`. Needs admin auth; can't curl.
- **P4 registry**: flip `actAsRegistry` on one instance (registry routes 404 until then) +
  `announceToRegistry` + `registryUrl` on another → verify signed ping lands + NodeInfo-pulled stats
  + admin hide/block. This is a phone-home activation decision.
- **Browser-smoke** `/admin/federation` Mirrors + Registry tabs (admin auth).
- `scripts/reconcile-counters.mjs --check` should read 0 drift (droplet run).
- **Mastodon interop**: the actor↔signer binding rejects Mastodon inbox-FORWARDED activities (not
  direct delivery). Only a real Mastodon peer exercises it — watch for dropped reply-thread
  activities if/when interop is tested.

## Post-release audit (same session)
Verified beyond the headline checklist:
- **Layer 0.44.0 live** (not stale): `/api/admin/federation/mirror-requests` + `/followers` = 401
  (exist+gated, not 404/500) on commonpub.io + heatsync. Registry routes 404 = `actAsRegistry`-gated.
- **NodeInfo works on all 3** (registry stat source). `software.version` hardcoded `0.0.1` (not a
  deploy-verification signal).
- **Federation topology mapped + binding proven safe**: commonpub↔deveco mutual-follow (seamless);
  deveco→heatsync mirror (deveco in heatsync followers, heatsync content in deveco feed). Delivery
  signs `keyId=${activity.actorUri}#main-key` (`delivery.ts:145`) ⇒ signer-host==actor-host by
  construction ⇒ actor↔signer binding can't reject CommonPub peers. All federated content predates
  the deploy (no posts since) → live delivery unexercised but provably intact.

### Findings
- ⚠️ **CLI scaffolder pins stale** (`tools/create-commonpub/src/template.rs` +
  `tests/cli.rs:249-252`): `^0.16.0/^0.38.0/^0.24.0/^2.67.0` should be `^0.17.0/^0.44.0/^0.26.0/
  ^2.73.0` (~6 releases behind; file's own RELEASE CHECKLIST ignored). Affects only newly-scaffolded
  apps, not the 3 live instances. See `feedback_cli_scaffolder`.
- Pre-existing (not this release): deveco `/actor/following` omits heatsync (cosmetic — mirror works
  off heatsync's followers); deveco NodeInfo `localPosts:81` vs feed `23` (counts all statuses).

## Follow-up SHIPPED same session — commonpub.io as the default registry
Per operator decision (flip the library default, enroll existing instances):
- **@commonpub/config 0.18.0**: `announceToRegistry` default flipped **false→true** (instances are
  discoverable by default; heartbeat self-skips when `registryUrl`==own domain + requires
  `federation:true`). `actAsRegistry` stays default false. `registryUrl` already defaulted to
  commonpub.io. Updated `config.test.ts` + types/schema doc comments.
- **@commonpub/layer 0.45.0**: aligned `nuxt.config` runtimeConfig + `useFeatures` fallback to true.
- **commonpub.io** (`apps/reference/commonpub.config.ts`): `actAsRegistry: true`.
- **CLI scaffolder**: pins bumped to config ^0.18.0 / layer ^0.45.0 / schema ^0.26.0 / server
  ^2.73.0 (closes the ~6-release staleness; new instances announce out of the box). `cargo test` 29 ✓.
- **deveco + heatsync**: bumped config ^0.18.0 / layer ^0.45.0 → redeployed → inherit the new
  default → announce.

### P4 registry round-trip VERIFIED LIVE (PR #2 → `33d77f2`)
- commonpub.io `/api/registry/instances` **200** (was 404), `POST /api/registry/ping` **401**
  (exists, rejects unsigned), `actAsRegistry:true`.
- After deveco+heatsync redeployed, both report `announceToRegistry:true`; their boot heartbeats
  pinged commonpub.io, which verified the signatures + pulled NodeInfo. The directory now lists
  **deveco.io (40 users) + heatsynclabs.io (5 users, localPostCount 8, online:true,
  lastPingAt today)** — full signed-ping → NodeInfo-pull → directory round-trip confirmed end-to-end.
- commonpub.io does NOT self-list (announce self-skip working).

## CLI published proper + full currency reconciliation (same session)
- **Channel determined = crates.io** (`Cargo.toml` has full publish metadata; README says `cargo
  install create-commonpub`; no npm wrapper exists). crates.io was stuck at **0.4.0** — the local
  0.5.x bumps were never published, which is exactly why the scaffold pins drifted unnoticed.
- **Published `create-commonpub` 0.5.3 to crates.io** (`cargo publish --locked`, verified
  max_version 0.5.3). Ships the refreshed pins (config ^0.18.0 / layer ^0.45.0 / schema ^0.26.0 /
  server ^2.73.0) so `cargo install create-commonpub` scaffolds a current instance that announces
  to commonpub.io by default.
- **Added `.github/workflows/cli-release.yml`** — `cargo publish` on a `create-commonpub-v*` tag
  (gated on `cargo test`) so the CLI can't silently lapse again. **Needs a `CARGO_REGISTRY_TOKEN`
  repo secret** to use the automated path (the 0.5.3 publish was done locally via the existing
  `~/.cargo/credentials.toml`).
- **npm currency reconciled:** all 13 @commonpub/* packages have source==published (no drift).
  main clean, dependants (deveco/heatsync) on current pins + deployed. Everything is current.

## Next steps (open)
- **P3** mirror-request Offer→Accept round-trip — needs admin login on two instances (only manual
  item left).
- Add the `CARGO_REGISTRY_TOKEN` secret so future CLI releases go via the tag workflow.
- Optional future DX: an `npm create commonpub` wrapper (prebuilt-binary download) so JS devs don't
  need a Rust toolchain — larger effort (cross-compile matrix + release workflow), not done.
- Operator: run the P3/P4 interactive verifications when convenient (admin auth + 2 instances).
- Definitive live-delivery proof: publish 1 public post on heatsync → it should appear on deveco
  within a minute (`deveco.io/api/content?limit=5`, today stamp).
- If/when ready to stand up discovery: decide which instance is the registry (`actAsRegistry`),
  then opt others into `announceToRegistry`.
- Deferred (non-blocking, from 185/186/187): streaming backfill progress, filter dry-run preview,
  `approveMirrorRequest` transaction, registry gossip/independent stats poller.
