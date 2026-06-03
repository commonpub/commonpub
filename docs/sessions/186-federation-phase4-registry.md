# Session 186 — Federation Phase 4: registry / instance directory

2026-06-02. Phase 4 of `docs/plans/federation-discovery-and-hardening.md`, branch
`feat/federation-discovery-and-hardening`. Code + tests + docs done; **NOT published/deployed**
(release is batched — task #7). Completes the federation-discovery plan (Phases 0–4 all done).

## What it does

Instances can't discover each other — you must know a domain. Phase 4 adds an opt-in **registry**:
an instance acts as a directory (`features.actAsRegistry`); other instances opt in to announce
themselves (`features.announceToRegistry`) by sending a signed heartbeat to a configured
`federation.registryUrl` (default `https://commonpub.io`); the registry verifies the signature,
pulls the pinger's public NodeInfo for stats, and lists them. Admins browse the directory and
**mirror** / **request-mirror** (reusing Phase 3) per entry, and can hide/block entries.

## Decisions (signed off this session)

1. **Auto-list verified pings; admin hide/block** — no approval queue. A signature-verified ping is
   immediately visible (`status='active'`); admin can `hidden` (tracked, not shown) or `blocked`
   (future pings ignored).
2. **Registry pulls stats from the pinger's public NodeInfo** (`/.well-known/nodeinfo` → 2.1 doc),
   not self-reported — `fetchInstanceNodeInfo` is SSRF-guarded (`safeFetch`) and requires the 2.1
   href to be on the SAME host (no cross-host fetch redirection).
3. **Admin-only directory** + a public read API (`GET /api/registry/instances`); no public page.
4. **Separate default-OFF `announceToRegistry` flag** — federation can be on without phoning home.

## Identity / abuse model

Identity is proven by the ping's HTTP signature (`verifyInboxRequest` — keyId domain must match the
resolved actor), so a domain can only register **itself**. Abuse controls: the global IP rate-limit
middleware caps pre-verification floods; a per-source-domain limit (3 / 5 min) caps verified spam;
admin block persists across re-pings. NodeInfo pull is SSRF-guarded + same-host.

## Pieces (by package)

- **config**: `actAsRegistry` + `announceToRegistry` flags (default OFF); `federation.registryUrl`
  (`https://commonpub.io`) + `registryPingIntervalMs` (6h). nuxt `runtimeConfig.public.features`
  declares both flags (env-propagation gotcha). Layer's own `FeatureFlags` + `DEFAULT_FLAGS` updated.
- **schema**: `registry_instances` table + `registry_instance_status` enum, migration **0015**;
  `registryInstanceQuerySchema` / `setRegistryInstanceStatusSchema`.
- **server** `federation/registry.ts`: `fetchInstanceNodeInfo`, `recordRegistryPing` (blocked no-op,
  upsert preserving `hidden`), `listRegistryInstances` (active-only public / all admin, search,
  unique-tiebreaker order), `getRegistryInstance`, `setRegistryInstanceStatus`, `sendRegistryPing`
  (signed POST; injectable sender for tests).
- **routes**: `POST /api/registry/ping` (public, gated, rate-limited, sig-verified), `GET
  /api/registry/instances` (public allow-list), `GET /api/admin/registry/instances` + `POST
  …/[id]/status` (admin). RBAC route-keys map updated.
- **plugin**: `registry-heartbeat.ts` (Nitro; `announceToRegistry`-gated; skips self-registry +
  test env; interval + cleanup; models `federation-delivery.ts`).
- **UI**: `RegistryDirectory.vue` (presentational — props/events, testable) in a new federation
  "Registry" tab (shown when `actAsRegistry`).

## Tests

- config (2): both flags + registry knobs default correctly.
- server `registry.integration` (13): NodeInfo pull + **anti-SSRF different-host href rejected** +
  fetch-throws→null; ping record / re-ping updates / **blocked no-op** / **hidden preserved** /
  NodeInfo-unavailable keeps prior stats; list public-active-only vs admin-all + search +
  pagination; derived online; status set/get; **signed-ping builder asserts signature keyId +
  digest + target URL** (injected sender — no network).
- layer `RegistryDirectory` (9): Mirror/Request hit federation mirrors with right direction;
  Hide/Block hit the status endpoint; search emits; axe.
- Full `pnpm typecheck` **26/26** — the reference app's strict h3 types caught `Retry-After` being a
  number-typed header (the consumer-strict gap). config 24, protocol 424, server 1244, layer 901.

## Release impact (adds to the 185 handoff table)

- schema → migration **0015** (registry_instances + enum).
- config → registry flags + federation knobs.
- server → `registry.ts` (+ `createMirror`/Phase-3 already pending).
- layer → registry routes + `RegistryDirectory.vue` + federation tab.
No protocol change (registry reuses existing signing/verify/NodeInfo).

## Next

Batched release (task #7): publish config→schema→…→layer, migrations 0013+0014+0015, deploy, then
the **two-instance live verify** for Phase 3 (mirror requests) AND Phase 4 (set `actAsRegistry` on
one + `announceToRegistry`+`registryUrl` on another → ping lands, directory lists with pulled stats,
hide/block works, Mirror/Request create Phase-3 artifacts). Browser-smoke `/admin/federation`
Registry tab. Verify `siteUrl` host == `instance.domain` per instance (the onMirrorRequest /
heartbeat domain-derivation coupling).

## Deferred (non-blocking)

No public directory page; no registry→registry gossip; no independent stats poller (refresh on
ping only); no auto-mirror. NodeInfo pull is best-effort (a ping with unreachable NodeInfo still
records a heartbeat, keeping prior stats).
