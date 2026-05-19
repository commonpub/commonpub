# Session 148 — Federation hardening, Stage 1+2

Date: 2026-05-19. Branch: `main`. **Code applied + gated locally;
NOT yet committed/published/deployed (paused for go-ahead).**

Implements `docs/plans/federation-hardening.md` Stage 1 (Items 5, 1,
3) + Stage 2 (Item 4, unsigned-GET subset). All dormant in prod
(`features.federation` OFF); `contentImport` is the one live-relevant
surface and stays default-on.

## Item 5 — SSRF module consolidated into @commonpub/protocol

- New `packages/protocol/src/ssrf.ts` is the canonical implementation
  (moved verbatim from `packages/server/src/import/ssrf.ts`, behaviour
  unchanged — verified: the consolidation introduced no classifier
  change; a unit test that initially over-asserted the compressed-hex
  IPv4-mapped form was corrected, not the code).
- `packages/protocol/src/index.ts` exports
  `isPrivateIp/isPrivateUrl/safeFetch/safeFetchBinary/SafeFetchOptions`.
- `actorResolver.ts` deleted its diverged private copy; imports
  `isPrivateUrl` from `./ssrf.js` (divergence eliminated).
- `packages/server/src/import/ssrf.ts` is now a thin re-export shim
  from `@commonpub/protocol` — every internal `~/import/ssrf` import
  site and `@commonpub/server`'s public API (stable since 2.48.0)
  are unchanged for consumers.
- `undici@^7.24.7` added to `@commonpub/protocol` deps (for the
  pinned-lookup Agent).

## Item 1 — pinned-lookup undici dispatcher

`safeFetch`/`safeFetchBinary` now dispatch through a module-level
`undici.Agent` whose `connect.lookup` resolves the host once
(`dns.lookup {all,verbatim}`), rejects fail-closed if ANY resolved
address is private/reserved, and hands back the FIRST validated
address in Node's classic `(err,address,family)` `net.connect`
contract — so the socket pins to the validated IP and there is no
second resolution between check and connect (closes the DNS-rebind
TOCTOU). `isPrivateIp` v6 gained explicit 6to4 (`2002::/16`) and
NAT64 (`64:ff9b::/96`) rejection. The per-hop string `isPrivateUrl`
check is retained.

## Item 3 — `contentImport` feature flag (default true)

Added to `@commonpub/config` schema + `FeatureFlags` type, the layer
`useFeatures()` (interface + DEFAULT_FLAGS + return), the Nitro
`ENV_FLAG_MAP` (`FEATURE_CONTENT_IMPORT`), the test-utils + identity
health-test mock literals (required-field ripple), and gated
`content/import.post.ts` with `requireFeature('contentImport')` as
its first line. Default-on → no behaviour change; operators can now
disable URL import independently (rule #2 satisfied).

## Item 4 — extend SafeFetchOptions + migrate unsigned remote GETs

`SafeFetchOptions` gained `method` / `headers` / `body` /
`followRedirects` (signed requests must pass `followRedirects:false`).
Migrated the **unsigned remote-GET** sites to `safeFetch` (now
DNS-rebind-protected via the pinned dispatcher): `federation.ts:178`,
`inboxHandlers.ts:1267`, `timeline.ts:549`,
`hubMirroring.ts:174/189/222/1461` (incl. the second-order
attacker-controlled `actorJson.followers`).

**Deferred to Stage 3 (signed/digest-sensitive — needs the
two-instance interop test):** `hubMirroring.ts:1050` (signedGet) +
`:1172` (the unsigned branch is coupled to the signedGet `Response`
shape — migrating one half alone would break the loop's response
handling); `delivery.ts:181` (signed POST — must not follow
redirects, body bytes are digest-covered); `backfill.ts:36/39`
(signedGet + fallback); `oauth.ts:562` (OAuth token POST). These
carry signature/digest headers a partial `Request→SafeFetchOptions`
extraction could corrupt; they go with Stage 3's digest/sig work
which the plan already gates on a real-environment interop test.

## Verification

typecheck 26/26 · lint · cargo 26/26 · drizzle no-drift (no schema
change — `contentImport` is config, not a DB column; migration count
still 5) · pathPrefix sweep 0 unresolved · all package suites incl.
new `protocol/__tests__/security/ssrf-module.test.ts` (isPrivateIp/
isPrivateUrl table + 6to4/NAT64 + re-export-shim contract). The
existing `server/import-ssrf.test.ts` + `protocol/security/
ssrf.test.ts` still pass against the consolidated module (behaviour
preserved). The DNS-rebind *integration* test (real server + stub
resolver) remains the one piece requiring a real-environment harness
— tracked with Stage 3, as the plan specifies.

## Release plan (PENDING GO-AHEAD)

New public API in `@commonpub/protocol` (SSRF exports + undici dep) →
minor: **0.9.10 → 0.10.0**. `@commonpub/config` new flag → minor:
**0.12.0 → 0.13.0**. `@commonpub/server` (shim + Item-4 federation
edits + new flag in mocks) → minor: **2.53.1 → 2.54.0**.
`@commonpub/layer` (useFeatures + import gate) → patch: **0.21.7 →
0.21.8**. `@commonpub/test-utils` (mock flag) → patch **0.5.4 →
0.5.5**. Publish order (deps): config → protocol → test-utils →
server → layer. Then `tools/create-commonpub` pins
(config ^0.13.0, server ^2.54.0, layer ^0.21.8) + tests/cli.rs +
cargo; then deveco.io + heatsynclabs.io `@commonpub/layer ^0.21.8`;
commonpub.io builds from source. README version table + CHANGELOG +
this session log. Leave heatsync's uncommitted `commonpub.config.ts`
+ `ONBOARDING.md` untouched.

## P0 hotfix (same session) — layer 0.21.9

While verifying the ship, the user reported explainers 500ing
(heatsync). Root cause (NOT introduced by 145–148; pre-existing):
`pages/u/[username]/[type]/[slug]/index.vue` `readTime` did
`for (const [type,data] of content.content as BlockTuple[])`.
blog/project store `content` as `BlockTuple[]`; explainer
document-format content is an object → `for…of` threw "not iterable"
→ via `enrichedContent` it 500'd SSR for every v2 explainer on every
instance. Fixed with an `Array.isArray` guard (document-format
explainers get no read-time estimate; ExplainerView has its own
chrome). Shipped as `@commonpub/layer` 0.21.8 → **0.21.9** on top of
the Stage-1+2 release. typecheck 26/26.
