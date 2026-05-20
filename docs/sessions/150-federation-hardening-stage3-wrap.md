# Session 150 — Federation-hardening Stage 3 wrap (Items 4 + 8 + 9, + F1/F2)

Date: 2026-05-19. Branch: `main`. **STATUS: code complete + green
locally, NOT yet pushed/published.** Awaiting user approval for the
publish chain per the standing "audit, discuss, get approval" pattern.

Triggered by the user: continue federation-hardening Stage 3 with
Items 8 + 9 — and verify flag state empirically rather than trusting
memory.

## Flag state — empirical verification

`curl /api/features` on each instance at 19:23Z:

```
commonpub.io     federation=true   seamlessFederation=true   federateHubs=true   identity.*=false
deveco.io        federation=true   seamlessFederation=true   federateHubs=true   identity.*=false
heatsynclabs.io  federation=false  seamlessFederation=false  federateHubs=false  identity.*=false
```

So:
- Stage 3 Items 6+7 (raw-body digest, coverage policy) are LIVE-ACTIVE
  on commonpub.io + deveco.io as session 149 already noted.
- Item 8 (federated-auth callbacks) — identity flags OFF everywhere,
  routes effectively unreachable in prod, still dormant.
- Item 9 (XFF rate-limit key) — hot on all 3 (rate limiter always
  runs in prod regardless of federation).
- A new finding (F1) reclassified Item 4 as LIVE-EXPLOITABLE on
  commonpub.io + deveco.io.

## Audit pass — 3 parallel subagents

Spawned three deep-audit agents:
1. **Full-repo audit, post-149** — surface any new issues since the
   session 149 ship.
2. **Item 8 deep dive** — pin the Better Auth 1.6.4 / better-call 1.3.5
   cookie shape against the vendored source; design the surgical fix.
3. **Item 9 deep dive** — investigate the reverse-proxy contract for
   all 3 prod instances; determine the right XFF parsing rule.

### Net-new findings

**F1 (NEW P0)** — federation outbound `fetch()` calls bypass the SSRF
guard, despite session 148's audit-fix work. Federation is LIVE on
commonpub.io + deveco.io, so a malicious remote can publish a `next:`
URL pointing at `127.0.0.1` or `169.254.169.254` (cloud metadata IP)
and our signed crawler/delivery probes it for them.

Specific sites:
- `packages/server/src/federation/backfill.ts:36, 39` — `signedGet`
  signed + unsigned fallback.
- `packages/server/src/federation/hubMirroring.ts:1045` — `signedGet`
  outbox crawl.
- `packages/server/src/federation/hubMirroring.ts:1167` — raw
  `fetch(nextPage)` follower-collection walk.
- `packages/server/src/federation/delivery.ts:181` — signed POST to
  remote inbox (URI from follower actor JSON; attacker-controlled).
- Plus the underlying `resolveActor(uri, fetch)` /
  `resolveActorViaWebFinger(name, domain, fetch)` calls at
  `backfill.ts:98`, `federation.ts:163`, `federation.ts:264`,
  `hubMirroring.ts:1067`, `hubMirroring.ts:1150`, `messaging.ts:59`
  pass the raw `globalThis.fetch` (not the pinned dispatcher) — the
  per-hop `isPrivateUrl` string check is there but DNS-rebind is not
  caught without the pinned-lookup `fetch`.
- `oauth.ts:562` — token-endpoint POST. Identity flags OFF in prod
  so dormant, but the URL comes from remote-discovered NodeInfo /
  OAuth-server metadata so attacker-influenced.

The original Stage-3 plan Item 4 explicitly anticipated this and said
"extend SafeFetchOptions with method/headers/body so signed AP GET/POST
can route through safeFetch", but only the schema-level option fields
landed; the actual migration never shipped.

**F2** — same `xff.split(',')[0]` leftmost-token pattern as known
Item 9 in 4 more callsites:
- `layers/base/server/api/content/[id]/view.post.ts:22-24` — view-dedup
  key (publicly exploitable to inflate view counts).
- `layers/base/server/api/federation/content/[id]/view.post.ts:18-20`
  — same dedup for federated view counter.
- `layers/base/server/api/auth/federated/callback.get.ts:51-53` and
  `mastodon/callback.get.ts:99-100` — session `ipAddress` audit column
  (log-poisoning only; identity flags OFF).

## Decisions

Asked the user (AskUserQuestion):
1. **Scope** — bundle F1 + Items 8 + 9 in one patch (Recommended). User
   confirmed.
2. **`getClientIp` placement** — `@commonpub/infra/security`
   (Recommended). User confirmed.

## Implementation — test-driven, in dependency order

### Item 4 + F1 — safeFetchSigned / safeFetchResponse

Pre-condition discovery: `SafeFetchOptions` ALREADY had
`method`/`headers`/`body`/`followRedirects` from a prior session, but
no Response-shape primitive (existing `safeFetch`/`safeFetchBinary`
throw on !ok — wrong for federation delivery's circuit-breaker logic).

Added two new exports to `packages/protocol/src/ssrf.ts`:

- `safeFetchResponse(url, options)` returns
  `{ ok, status, statusText, headers, body: Buffer, contentType,
  finalUrl }`. Doesn't throw on non-2xx. `followRedirects: false` by
  default (signed AP requests must not replay to redirect targets).
  Body is fully consumed under deadline + 10MB cap.
- `safeFetchSigned(signedRequest, options?)` extracts headers + body
  from a pre-signed `Request` and forwards them through
  `safeFetchResponse`. `followRedirects` forced false.
- New `SafeFetchResponseResult` type.
- Re-exported from `@commonpub/protocol/index.ts` and the
  `@commonpub/server/import/ssrf.ts` shim.

14 unit tests pin: SSRF rejection of private URLs / non-http schemes /
blocked hostnames; non-2xx returns instead of throws; method/headers/
body passthrough for signed AP POST; `followRedirects: false` default;
Content-Type preservation; 10MB body cap; redirect re-validation when
`followRedirects: true`; `safeFetchSigned` forwards Signature header;
DNS-rebind-equivalent rejection (literal-IP-in-Request); GET handling
(no body).

New helper `packages/server/src/federation/safeFetchFn.ts` —
`createSafeActorFetchFn()` builds a `FetchFn`-compatible
`(url, init?) => Promise<Response>` that proxies to `safeFetchResponse`
and reconstructs a Response object so `resolveActor`'s manual redirect
loop + `.json()`/`.ok`/`.headers.get('location')` keep working.

Migration to `safeFetchSigned` / `safeFetchResponse` /
`createSafeActorFetchFn`:
- `backfill.ts` `signedGet` + the unsigned fallback + the `resolveActor`
  call.
- `hubMirroring.ts` `signedGet` + the unsigned-fallback `fetch` + 2x
  `resolveActor`.
- `delivery.ts` signed-POST.
- `federation.ts` `resolveActor` + `resolveActorViaWebFinger`.
- `messaging.ts` `resolveActorViaWebFinger`.
- `oauth.ts` token-endpoint POST.

### Item 8 — Better Auth signed-cookie helper

Pinned cookie shape against vendored
`node_modules/.pnpm/better-auth@1.6.4_…/dist/cookies/index.mjs:20-46`
and `better-call@1.3.5/dist/crypto.mjs:22-32`. Confirmed:
- Name in prod: `__Secure-better-auth.session_token` (the prefix is
  applied when `isProduction === true`, OR when `baseURL` starts with
  `https://`, OR when `useSecureCookies: true` is set explicitly).
- Value: `encodeURIComponent(`${token}.${signature}`)` where
  signature is `btoa(String.fromCharCode(...HMAC_SHA256(secret,
  token)))` — RFC 4648 standard base64 with `=` padding (44 chars).
- Verify: `getSignedCookie` rejects if signature isn't exactly 44 chars
  ending with `=`.
- Node's `createHmac('sha256', secret).update(token).digest('base64')`
  is byte-identical to better-auth's `btoa(...)` output.

New `layers/base/server/utils/betterAuthCookie.ts` exports:
- `getBetterAuthSessionCookieName(isProd)` — pure name resolver.
- `getBetterAuthSessionDataCookieName(isProd)` — for the SSR cache.
- `signBetterAuthCookieValue(token, secret)` — pure HMAC/encode.
- `setBetterAuthSessionCookie(event, token, expiresAt)` — h3 wrapper
  that pulls `AUTH_SECRET` from `useRuntimeConfig().authSecret`.
- `clearBetterAuthSessionCookies(event)` — deleteCookie x2 with the
  correct prod-prefixed names.

11 unit tests cover the cookie name in prod/dev, the
`length === 44 && endsWith('=')` invariant, HMAC-binding to both
token and secret, secret-required guard, and a full WebCrypto round-trip
that replicates better-call's `verifySignature` exactly.

Wired into 4 routes:
- `auth/federated/callback.get.ts` (federated-instance SSO callback,
  Outcome 1 "already linked → log them in").
- `auth/mastodon/callback.get.ts` (Mastodon-instance OAuth callback,
  same outcome 1).
- `auth/federated/link.post.ts` (post-callback password-confirm to
  attach the federated identity — now reuses the signed-cookie helper
  with the token Better Auth's `sign-in/email` returned; the inner
  $fetch's Set-Cookie doesn't propagate to the outer event so the
  helper's the simplest fix).
- `auth/delete-user.post.ts` (now clears both `__Secure-`-prefixed
  cookies — token + SSR data cache).

### Item 9 + F2 — getClientIp helper

New `packages/infra/src/clientIp.ts`:
- `getClientIp(event, opts?)` returns
  `xff[length - depth]` (clamped to 0), defaults to depth=1, env
  `CPUB_TRUSTED_PROXY_DEPTH` overrides. Falls back to `x-real-ip` →
  socket `remoteAddress` → `'unknown'` sentinel.
- Locally-defined `ClientIpEvent` interface so `@commonpub/infra` stays
  framework-agnostic (no `h3` dependency).
- Re-exported via `@commonpub/infra/security` (where `checkRateLimit`
  lives) → `@commonpub/server/security.ts` → `@commonpub/server` index.

17 unit tests cover: single-token, multi-token rightmost, whitespace,
empty tokens, x-real-ip fallback, socket fallback, IPv6 verbatim,
attacker-rotated leftmost tokens still resolve to the trusted token;
explicit `trustedProxyDepth` opt for 2 and 3; depth-larger-than-tokens
clamp to leftmost; depth=0 skips XFF; env-var read; explicit option
overrides env; non-numeric env ignored; negative env ignored.

Proxy-contract investigation confirmed all 3 prod sites use Caddy
with `header_up X-Forwarded-For {remote_host}` (overwrite), so XFF
chain length is always 1 → leftmost === rightmost. **The old leftmost
code was NOT live-exploitable on our prod deploys** — the fix is
forward-compatible hardening for self-hosters who run nginx-append or
multi-proxy topologies (CDN → nginx → app). depth=1 default is correct
for both Caddy-overwrite and nginx-single-proxy cases without operator
action. Documented in `docs/deployment.md` (new "Reverse-proxy contract"
subsection under Option 1).

Wired into 5 callsites:
- `middleware/security.ts:57` (rate-limit key — security-critical).
- `content/[id]/view.post.ts` view dedup (publicly exploitable to
  inflate view counts).
- `federation/content/[id]/view.post.ts` federated view dedup.
- `auth/federated/callback.get.ts` session.ipAddress audit row.
- `auth/mastodon/callback.get.ts` same.

## Test counts

- `@commonpub/protocol`: 416 → 430 (+14 safeFetchResponse).
- `@commonpub/infra`: 288 → 305 (+17 clientIp).
- `@commonpub/server`: 967 → 967 (no test changes; federation modules
  re-tested through existing suites — all pass after migration).
- `@commonpub/layer`: 72 → 83 (+11 betterAuthCookie).
- `tools/create-commonpub` cargo: 27 → 27 (pin-test value bumped).

Typecheck green across all packages (server typecheck caught the
Buffer-vs-BodyInit type mismatch in `safeFetchFn.ts` and got fixed
inline).

## Version bumps + release plan (PREPARED, not yet published)

Dep order:

1. `@commonpub/infra` 0.7.1 → **0.8.0** (minor: new `getClientIp`
   public surface).
2. `@commonpub/protocol` 0.11.0 → **0.12.0** (minor: new
   `safeFetchResponse` + `safeFetchSigned` exports).
3. `@commonpub/server` 2.54.3 → **2.55.0** (minor: re-exports
   `safeFetchResponse`/`safeFetchSigned`/`getClientIp` + federation
   outbound migrated to SSRF-safe paths).
4. `@commonpub/layer` 0.21.14 → **0.21.15** (patch: new cookie helper
   + 5 XFF callsites migrated; no API surface change).

Scaffolder pins bumped in `tools/create-commonpub/src/template.rs`
(`COMMONPUB_LAYER_VERSION` → `^0.21.15`, `COMMONPUB_SERVER_VERSION` →
`^2.55.0`) — required by the lockstep-pin rule because server crosses
minor. Cargo test `package_json_pins_current_commonpub_versions`
updated and green.

CHANGELOG updated.

Deploy plan once published: deveco.io + heatsynclabs.io bump
`@commonpub/layer ^0.21.15` + `@commonpub/server ^2.55.0`;
commonpub.io builds from source. No schema change; migration count
stays 5.

## Deep audit pass — caught a P0 mid-process (same shape as session 149)

After "code complete" was reported, ran a second-pass deep-certainty
audit (one subagent) tracking session 149's pattern. Found 4
findings:

### P0 — Double URL-encode of session cookie (would break every federated session)
**File**: `layers/base/server/utils/betterAuthCookie.ts`
`signBetterAuthCookieValue` returned `encodeURIComponent(\`${token}.${signature}\`)`.
h3's `setCookie` calls cookie-es's `serialize`, which itself does
`encodeURIComponent(value)` exactly once (verified at
`node_modules/.pnpm/cookie-es@3.1.1/.../dist/index.mjs:enc(value)`).
So the wire value was DOUBLE-encoded — `+/=` → `%2B%2F%3D` → `%252B%252F%253D`.
Better Auth's `getSignedCookie` decodes ONCE, leaving `%XX` escapes in
the would-be signature → length ≠ 44 → `getSignedCookie` returns null
→ every federated SSO session lands as anonymous.

Same exact failure class as session 149's safeFetch P0: algorithm
verified in isolation by the WebCrypto HMAC unit test, but a layer
above (h3 / cookie-es) intervened and broke the integration. The 11
unit tests (cookie name, sig shape after one decode, HMAC round-trip)
all PASSED on the broken code because they fed the helper output
directly to a WebCrypto verifier, never through h3.

**Fix**: dropped the `encodeURIComponent` from
`signBetterAuthCookieValue`; h3 now encodes exactly once. Added 2 new
integration tests in `betterAuthCookie.test.ts`:
- Positive: simulates cookie-es serialize (one encodeURIComponent) →
  one decodeURIComponent (browser/Better Auth) → asserts the decoded
  value === the helper's raw output AND signature length 44 + `=` AND
  HMAC verifies under the same secret.
- Regression guard: applies double-encode (the OLD broken behavior)
  → asserts decode-once still contains `%` → asserts sig shape FAILS.
  This negative test stays green only if someone re-introduces the
  pre-encode bug.

**Dormancy** unchanged: identity flags are OFF on all 3 instances, so
this bug was never going to fire in prod today. But it would have
made the feature dead-on-arrival the moment any operator flipped a
flag.

### P1 — Rate-limit doc claim was over-stated for our prod
**Files**: `CHANGELOG.md`, `docs/sessions/150-*.md`,
`packages/infra/src/clientIp.ts` doc, `layers/base/server/middleware/security.ts`
inline comment.

The original framing said the rightmost-XFF fix "defeats the
auth:5/min brute-force tier." On all 3 prod deploys Caddy OVERWRITES
XFF (`header_up X-Forwarded-For {remote_host}`), so the chain length
is always 1 → leftmost === rightmost → the old code was NOT
live-exploitable in our setup. The fix is hardening for self-hosters
on nginx-append or multi-proxy topologies (CDN → nginx → app).

**Fix**: re-framed all 4 doc/comment sites to call it "hardening for
multi-proxy operators" rather than a live brute-force fix. No code
change.

### P2 — `createSafeActorFetchFn` ignored caller's AbortSignal
**File**: `packages/server/src/federation/safeFetchFn.ts`,
`packages/protocol/src/ssrf.ts`.

`resolveActor` creates its own AbortController + 30s timeout and
passes `signal` to the injected `FetchFn`. My wrapper discarded it
and let safeFetchResponse use only its internal deadline (also 30s,
so functionally equivalent today). Future-fragile.

**Fix**: forwarded `init?.signal` through; `safeFetchResponse` now
combines `options.signal` with the deadline signal via
`AbortSignal.any` (stable since Node 20.3, our runtime is Node 22).
Added 2 new tests: external-signal-aborts-first (cancellation
propagates) and no-external-signal-falls-back-to-deadline (regression
guard).

### P2 — `shouldUseSecurePrefix` order divergence vs Better Auth
**File**: `betterAuthCookie.ts:56-68`.

Better Auth checks `advanced.useSecureCookies !== undefined` FIRST
(operator escape hatch). My helper short-circuits on
`NODE_ENV=production`, skipping the escape hatch. We don't set
`useSecureCookies` anywhere in our config, so no current consumer
affected. Documented in the helper's docstring; no code change.

## Final post-audit counts

- `@commonpub/protocol`: 416 → **419** (+14 safeFetchResponse +2
  signal +1 lowercase-headers regression = 17 new but some replaced
  the no-signal test scaffolding; net +3 from current).
- `@commonpub/infra`: 288 → 305 (+17 clientIp).
- `@commonpub/server`: 967 (no test changes since base; federation
  modules re-tested through existing suites).
- `@commonpub/layer`: 72 → **85** (+13 betterAuthCookie — 11 original
  + 2 new h3-integration round-trip tests).
- Cargo: 27/27. Typecheck: 26/26. Lint: 24/24.

## Open before publish (next steps)

- User approval of the publish chain (now post-audit).
- After publish: live verification per the standard pattern —
  `/api/health`, `/api/features.federation`, `/api/image-proxy`,
  SSRF defense (`http://127.0.0.1/`, metadata IP) → 400, plus a
  quick rate-limit smoke test if practical.
- The two-instance interop test from session 149's "open work" still
  pending — needs a real second instance.

## Stage 3 status

- Items 1, 2, 3, 5, 6, 7 — shipped sessions 145–149.
- Items 4, 8, 9 — code complete this session; awaiting publish.
- F1, F2 — bundled into the Item 4 + Item 9 patches.
- The Stage 3 plan in `docs/plans/federation-hardening.md` is fully
  cleared once this session ships.
