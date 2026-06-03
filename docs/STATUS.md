# CommonPub — Status & Operator Runbook

> **Living doc — your "come back later" reference.** Snapshot taken 2026-06-03 (session 188).
> Verify any version/flag claim before trusting it: `npm view @commonpub/<pkg> version`,
> `curl https://<instance>/api/features`, `cargo search create-commonpub`.
> Companion docs: the plan `docs/plans/federation-discovery-and-hardening.md`, the work log
> `docs/sessions/188-federation-release.md`, the rolling handoff `docs/sessions/185-kickoff-next.md`.

---

## TL;DR — where things stand

Federation discovery & hardening (Phases 0–4) is **shipped and live on all 3 instances**, and
**commonpub.io is now the default discovery registry** — every instance announces to it by default.
All npm packages are published with zero source-vs-published drift; the `create-commonpub` CLI is
published to crates.io. `main` is clean. The only federation feature not yet exercised end-to-end is
the **P3 mirror-request approve flow** (needs an admin login on two instances).

---

## ✅ Verified live (2026-06-03)

- **P0 outbox correctness:** instance `/actor/outbox` projects published+public content via
  `contentToCreateActivity` (deterministic `<objid>#create` ids). heatsync `totalItems` 2→8,
  deveco 23. (Was the headline bug: outbox projected the delivery queue → backfill got nothing.)
- **Federation topology:** commonpub.io ↔ deveco.io mutual-follow (seamless); deveco → heatsync
  mirror (heatsync content present in deveco's feed). actor↔signer inbox binding is safe for all
  CommonPub peers (delivery signs `keyId = ${activity.actorUri}#main-key`, so signer-host ==
  actor-host by construction).
- **Registry (P4) round-trip:** commonpub.io `/api/registry/instances` → 200 and lists deveco.io
  (40 users) + heatsynclabs.io (5 users, 8 posts, online) with **NodeInfo-pulled** stats. Boot
  heartbeats → signed ping → verify → NodeInfo pull → directory. commonpub.io self-skips its own ping.
- All 3 instances: `/api/health` 200, homepage 200.

---

## 🔴 What remains

### Needs you (can't be done headlessly)
1. **Add the `CARGO_REGISTRY_TOKEN` repo secret** (commonpub/commonpub → Settings → Secrets →
   Actions). Until then, CLI releases must be done locally (`cargo publish`); with it, pushing a
   `create-commonpub-v*` tag publishes automatically (`.github/workflows/cli-release.yml`).
2. **P3 mirror-request Offer→Accept round-trip** — the one federation flow not yet live-verified.
   Log into `/admin/federation` on instance A → "Request they mirror you" → B. On B → "Requests to
   mirror you" → **approve** with a history depth → expect: a pull mirror of A appears on B, A
   backfills, B enters A's `/actor/followers`, A's outgoing request flips **approved**. Reject path
   should flip it **rejected**.
3. **Browser-smoke `/admin/federation`** (Mirrors + Registry tabs) — needs an admin session.
4. **`reconcile-counters --check`** on each droplet → expect 0 drift:
   `docker compose -f docker-compose.prod.yml exec -T app node scripts/reconcile-counters.mjs --check`

### Deferred federation backlog (non-blocking — from sessions 185–188)
- **Streaming backfill progress** + **filter dry-run preview** in the admin UI (need polling /
  a remote-outbox probe). Currently in-flight state + a result toast only.
- **`approveMirrorRequest` is not transactional** → a duplicate `Accept(Offer)` is possible on
  partial-failure retry. Harmless today (receiver's `onAccept` matches `status='pending'`), but
  worth wrapping in a transaction.
- **`onMirrorRequest` admin-notify queries `users.role=='admin'`** — custom RBAC roles with
  `federation.manage` get no notification (the admin badge still surfaces the request).
- **Registry maturity:** no public-facing directory *page* (UI is admin-only); stats only refresh on
  ping (no independent poller); no registry→registry gossip; no auto-mirror; no NodeInfo
  "is-this-CommonPub" pre-check before sending an Offer.
- **No HTTP/signature layer in unit tests** — the wire path (signing + `verifyInboxRequest` + the
  actor↔signer binding) is only exercised by a real 2-instance run, never in CI.

### Known issues (cosmetic / pre-existing — not regressions)
- **deveco `/actor/following` omits heatsync** though heatsync lists deveco as a follower. Projection
  asymmetry; the mirror works (heatsync delivers off *its* followers list). Cosmetic.
- **deveco NodeInfo `localPosts: 81` vs feed/outbox `23`** — NodeInfo counts all statuses; that 81 is
  what the registry displays. Confirm it's the intended public number.
- **CI on `main` is chronically red** on 2 homepage e2e flakes (`apps/reference/e2e/navigation.spec.ts`
  lines 8 & 38) + an intermittent `@commonpub/infra` Redis integration test + occasional
  `@commonpub/docs` test flake. **`check` + `rust` are the gating jobs; `e2e` is non-gating.** The
  real production gate is commonpub.io's `scripts/smoke.mjs`. These flakes should eventually be
  stabilized or quarantined so "green" means something.
- **`@commonpub/test-utils` 0.5.6**: source has a `mockConfig` flag addition that the published 0.5.6
  predates. Immaterial (devDep-only, no runtime consumer); can't republish the same version.
- **GitHub Actions Node 20 deprecation** — `actions/checkout@v4` etc. forced to Node 24 on 2026-06-16.

### Future / nice-to-have
- **`npm create commonpub` wrapper** — a thin npm package that downloads a prebuilt binary, so JS
  devs scaffold without a Rust toolchain. Larger effort (cross-compile matrix + release workflow).
- Public registry directory page; the broader 10-phase federation roadmap (hub Groups behind
  `federateHubs`, BOM federation) — see `docs/plans/`.

---

## 📓 Runbook

### Release an npm package (the chain)
1. **Bump** the `version` in each changed `packages/<pkg>/package.json` (+ `layers/base/package.json`).
   `ui` etc. unchanged → don't bump. Verify what changed: `git diff --stat main...HEAD -- packages/`.
2. **Verify green:** `pnpm typecheck` (expect 26/26) + the suites (`pnpm --filter @commonpub/<pkg> test`).
3. **Publish in dependency order**, polling `npm view @commonpub/<pkg> version` between each:
   `schema → config → protocol → auth → server → ui → layer`.
   - Packages: `pnpm --filter @commonpub/<pkg> publish --no-git-checks --access public`.
   - **Layer ONLY via `pnpm run publish:layer`** (never `npm publish` from a layer — it leaves
     `workspace:*` literals in the tarball).
   - Internal `workspace:*` deps are rewritten to **exact** versions at publish (so a config bump
     leaves server pinning the old config internally — harmless; the app's *direct* config dep drives
     `defineCommonPubConfig` defaults).
4. **Update consumer pins** (deveco/heatsync/CLI), which use literal carets: **hand-edit across 0.x
   minor boundaries** — `^0.17.0` does NOT auto-cross to `0.18.0`.

### Deploy the 3 instances
- **commonpub.io** = the reference app in *this* repo. Deploys on **push to `main`** (`deploy.yml`):
  Docker build → droplet → `db-migrate.mjs` (committed migrations, hard-fail) → `smoke.mjs`
  (fails on non-2xx critical routes). Concurrency cancels in-progress runs. Use PR + squash-merge.
- **deveco.io** = `devEcoConsultingLLC/deveco-io`, deploys `main` via `deploy-prod.yml`. Pins
  `@commonpub/{config,layer,schema,server}` as carets; uses `npm install` (NOT pnpm frozen). Bump
  pins → push `main`.
- **heatsynclabs.io** = `heatsynclabs/heatsynclabs-io` (droplet `167.99.13.109`), deploys `main` via
  `deploy.yml`. Tracked `package-lock.json` (regen with `npm install`). Bump pins → push.
- ⚠️ **deveco + heatsync deploy workflows are WARN-ONLY on health** — `gh run` "success" ≠ healthy.
  **Always curl-verify** `/api/health` + a real route after each. (commonpub.io's `smoke.mjs` is hard-fail.)
- All 3 apply schema via `db-migrate.mjs` (committed migrations) — **never** hand-edit the DB over SSH.

### Publish the CLI (`create-commonpub`)
- Channel = **crates.io** (`cargo install create-commonpub`). Not on npm.
- After bumping `template.rs` pins + `tests/cli.rs` assertions: bump `Cargo.toml` version, `cargo test`,
  `cargo check` (sync `Cargo.lock`), commit, then:
  - Local: `cd tools/create-commonpub && cargo publish --locked` (uses `~/.cargo/credentials.toml`), **or**
  - CI: push tag `create-commonpub-v<version>` → `cli-release.yml` publishes (needs `CARGO_REGISTRY_TOKEN`).
- **The pins go stale silently** — bump them after every config/layer/schema/server publish.

### Verify federation live (curl checklist)
```
for h in commonpub.io deveco.io heatsynclabs.io; do curl -s "https://$h/api/health"; done
curl -s -H 'Accept: application/activity+json' "https://heatsynclabs.io/actor/outbox" | jq .totalItems
curl -s "https://commonpub.io/api/registry/instances" | jq '.instances[].domain'   # actAsRegistry on commonpub.io
curl -s "https://<instance>/api/features" | jq '{federation,seamlessFederation,actAsRegistry,announceToRegistry}'
```
Definitive live-delivery test: publish a public post on heatsync → it should appear on deveco within
a minute (`curl deveco.io/api/content?limit=5`, today's timestamp).

---

## 📌 Reference

### Published versions (verified 2026-06-03)
| Package | Version | | Package | Version |
|---|---|---|---|---|
| @commonpub/schema | 0.26.0 | | @commonpub/infra | 0.8.0 |
| @commonpub/config | **0.18.0** | | @commonpub/editor | 0.7.11 |
| @commonpub/protocol | 0.13.0 | | @commonpub/explainer | 0.7.15 |
| @commonpub/auth | 0.8.0 | | @commonpub/docs | 0.6.3 |
| @commonpub/server | 2.73.0 | | @commonpub/learning | 0.5.2 |
| @commonpub/ui | 0.9.2 | | @commonpub/test-utils | 0.5.6 |
| @commonpub/layer | **0.45.0** | | create-commonpub (crates.io) | **0.5.3** |

Migrations applied this cycle: **0013** (self-ref FKs) · **0014** (`mirror_requests`) · **0015**
(`registry_instances`).

### Live flags per instance
| Instance | federation | seamless | actAsRegistry | announceToRegistry | role |
|---|---|---|---|---|---|
| commonpub.io | ✅ | ✅ | ✅ | ✅ (self-skips) | **the registry** |
| deveco.io | ✅ | ✅ | ❌ | ✅ | mirrors heatsync; seamless w/ commonpub |
| heatsynclabs.io | ✅ | ❌ | ❌ | ✅ | mirrored by deveco |

Registry config defaults (`@commonpub/config`): `registryUrl = https://commonpub.io`,
`registryPingIntervalMs = 21_600_000` (6h), `announceToRegistry` default **true**, `actAsRegistry`
default **false**.

### Repos & infra
- Main monorepo: `commonpub/commonpub` (this repo) — also builds commonpub.io.
- `devEcoConsultingLLC/deveco-io` → deveco.io.
- `heatsynclabs/heatsynclabs-io` → heatsynclabs.io (droplet `167.99.13.109`).

### Landmines (learned the hard way — see `feedback_*` memories)
- **Caret semver on 0.x doesn't cross minors:** `^0.17.0` ⊉ `0.18.0`. Hand-edit consumer pins.
- **Layer publish** only via `pnpm run publish:layer` (workspace:* leak otherwise).
- **npm propagation lag** — poll `npm view` before a publish-dependent install/deploy.
- **Verify flag/version state empirically** — memory & handoffs go stale (federation was claimed
  "off" but was live; heatsync was claimed `db:push` but now uses `db-migrate.mjs`).
- **Warn-only health checks** on deveco/heatsync deploys — curl-verify, don't trust `gh run`.
- **`siteUrl` host must == `instance.domain`** per instance, or mirror requests/registry pings 401.
  (All 3 currently satisfy this: actor host == domain.)
- **Nuxt env vars only override DECLARED `runtimeConfig.public.features` keys.**
- **Two-config-version skew is harmless** — the Zod default is applied by each app's *direct* config
  dep via `defineCommonPubConfig`, not by server's internal copy.
- **Mastodon inbox-*forwarded* activities are now rejected** by the actor↔signer binding (we don't
  forward; direct delivery is unaffected). If a Mastodon reply-thread shows dropped activities, that's why.
