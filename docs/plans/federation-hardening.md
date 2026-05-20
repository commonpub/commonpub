# Federation Hardening Plan (SSRF + inbound signature/digest)

Created session 146 (2026-05-18). **Status (post-session 150,
2026-05-19): mostly SHIPPED.**

- Items 1, 2, 3, 5 shipped sessions 145–148.
- Items 6, 7 shipped session 149 (`@commonpub/protocol@0.11.0`).
- Items 4, 8, 9 shipped session 150 (this session — protocol 0.12.0,
  infra 0.8.0, server 2.55.0, layer 0.21.15). Item 4 was actually
  live-exploitable because `features.federation` had been silently ON
  on commonpub.io + deveco.io since the seamlessFederation work
  shipped (memory drift from session 137's "OFF" snapshot — see the
  session 149 doc's "corrected understanding" section).
- Two minor add-ons surfaced by the session 150 audit and bundled in:
  - **F1**: outbound `resolveActor(uri, fetch)` and `signedGet` /
    `safeFetch.delivery` raw-fetch sites in
    `federation/backfill.ts`, `hubMirroring.ts`, `delivery.ts`,
    `federation.ts`, `messaging.ts`, `oauth.ts` — all migrated.
  - **F2**: same XFF-leftmost-token spoof as Item 9 found in 4 more
    callsites (view dedup x2 + session audit ipAddress x2) — all
    migrated to `getClientIp`.

Sections below preserved for historical context.

## Why one plan

The SSRF cluster and the inbound HTTP-signature/digest defects live in
the same dormant federation surface, share the `@commonpub/protocol`
ownership question, and must be tested together against two real
instances. Bundle them.

## Part 1 — SSRF cluster

### 1. DNS-rebinding (pinned-lookup undici dispatcher)
`packages/server/src/import/ssrf.ts:101-125` `isPrivateUrl` is
hostname-string-based; `fetchWithRedirectValidation:182-220` re-checks
per hop then calls global `fetch` (`:198`) which re-resolves DNS —
classic check↔connect TOCTOU.
**Fix:** new `packages/protocol/src/ssrf/pinnedAgent.ts` — undici
`Agent({ connect: { lookup } })`; `lookup` does
`dns.lookup(host,{all:true,verbatim:true})`, runs every resolved
address through `isPrivateIp()` (fail-closed on ANY private addr — do
not filter), passes validated IPs to undici so it connects to the
checked address. Plug into `safeFetch`/`safeFetchBinary` via
`dispatcher`. Keep per-hop string check too. Extend `isPrivateIp` v6
branch with explicit 6to4 `2002::/16` + NAT64 `64:ff9b::/96`.

### 2. Unauth SSRF amplification
`layers/base/server/api/federation/remote-actor.get.ts:10-11` &
`search.post.ts:11-12` lack `requireAuth` (unlike
`resolve-uri.post.ts:14`). Global IP limiter already caps
`/api/federation/*` 60/min. **Recommended:** add `requireAuth(event)`
to both (no anonymous product need). **Alt:** keep optional-user +
add a strict `federation-lookup` rate tier.

### 3. `content/import.post.ts:10` missing feature flag
Has `requireAuth`, no `requireFeature` (CLAUDE.md rule #2). **Fix:**
add `contentImport: z.boolean().default(true)` to
`config/src/schema.ts` featureFlagsSchema (+ types.ts + useFeatures
flat list + admin UI), gate `import.post.ts` first line.

### 4. Unguarded raw `fetch` of remote URIs (verified sites)
`hubMirroring.ts` 174/189(2nd-order `actorJson.followers`)/222/1172
(`nextPage`)/1461(`collectionUri`); `delivery.ts:181` (signed POST
to resolved inbox); `timeline.ts:549`; `federation.ts:178` &
`inboxHandlers.ts:1267` (have string-`isPrivateUrl` guard, upgrade
transitively). **Fix:** route all through `safeFetch`/`safeFetchBinary`
(+ a `safeFetchJson` wrapper). Signed-GET/POST need request
signature headers/body carried — **extend `SafeFetchOptions`** with
`method`/`headers`/`body` (or accept a `Request`). Host unchanged by
IP pinning so signatures stay valid.

### 5. protocol vs server `isPrivateUrl` divergence
`protocol/src/actorResolver.ts:52-79` has a private, non-exported
string-only copy missing the `net.isIP`/IPv4-mapped handling
`server/src/import/ssrf.ts:60-75,121-122` has. DAG is
`server → protocol`, so the shared module **must live in
`@commonpub/protocol`**; `@commonpub/server` re-exports the existing
public names (`isPrivateUrl`/`safeFetch`/`safeFetchBinary`/
`SafeFetchOptions` — stable since 2.48.0, must not break consumers).
Port the SSRF test suite to protocol + add divergence cases.

## Part 2 — inbound HTTP-signature / digest

### 6. Digest verified against re-serialized JSON (interop break)
`layers/base/server/utils/inbox.ts:95-96` `readBody` parses then
`JSON.stringify(body)` to rebuild the verify-Request;
`keypairs.ts:72-81` re-hashes that vs the sender's `Digest` over the
ORIGINAL raw bytes. `JSON.stringify(JSON.parse(x)) !== x` (whitespace,
\uXXXX, number/key formatting) → **every signed inbound activity with
a digest header 401s** (fail-closed; not a bypass). **Fix:** capture
`readRawBody(event)` once; hash the raw string for digest; `JSON.parse`
a copy for the handler; build the verify-Request from the raw string.
Applies to all three inboxes (shared/user/hub).

### 7. Signature coverage policy
`keypairs.ts:60,72` trusts the attacker-supplied `headers=` set; no
minimum-coverage requirement. `inbox.ts:83` skips skew when `Date`
absent. **Fix:** reject if request has a body and `digest` ∉ signed
set; require `(request-target)`, `host`, `date` ∈ signed set; require
`Date` present + recent + signed.

## Part 3 — outbound session minting (added session 147)

### 8. Hand-minted session cookies are unsigned / wrong-named
`layers/base/server/api/auth/federated/callback.get.ts`,
`auth/mastodon/callback.get.ts`, `auth/federated/link.post.ts` set
`setCookie(event, 'better-auth.session_token', token, …)` with the
bare token. Better Auth (1.6.4 / better-call 1.3.5) `getSession`
reads via `getSignedCookie` — requires `${token}.${HMAC}` format and
the `__Secure-` cookie-name prefix in production. A bare token →
`getSignedCookie` returns null → the "already-linked → log in"
outcome of federated/Mastodon SSO produces a **non-authenticating
session** (redirect to /dashboard, next request is anonymous).
Fail-closed (no bypass) but a complete functional break of the
flagged auth flows; both flags OFF in prod so dormant — same
second-instance-blocking class as Parts 1–2, hence tracked here.
`auth/delete-user.post.ts:52` has the matching prefix bug
(`deleteCookie('better-auth.session_token')` won't clear the prod
`__Secure-` cookie).
**Fix:** mint the session through Better Auth so it sets its own
signed, correctly-prefixed cookie (drive linked-user login via the
`auth.api`-issued cookie), or replicate `setSignedCookie` using the
same `AUTH_SECRET` HMAC + `__Secure-` prefix logic
(`better-auth/dist/cookies/index.mjs`). Needs the actual flow
exercised against a real linked account (why it is NOT a hasty
in-audit patch). Verified against pinned better-auth source
(session 147 audit).

### 9. Rate-limit key from spoofable X-Forwarded-For (needs-confirmation)
`layers/base/server/middleware/security.ts:57-59` keys the IP limiter
on the leftmost `x-forwarded-for` token — client-supplied — so an
attacker rotating XFF gets a fresh bucket per request, defeating the
`auth:{limit:5}` brute-force tier. Bounded only if the reverse proxy
overwrites XFF (deployment-dependent — confirm the commonpub.io /
deveco.io proxy contract). **Fix:** use the rightmost
(proxy-appended) XFF entry or a configured trusted-proxy depth, and
document the proxy contract. Distinct from the documented
per-process rate-limit deferral.

## Sequencing
5 (consolidate) → 1 (pinned dispatcher) → 4 (migrate fetches, incl.
`safeFetch` signed-Request API) → 6 (raw-body digest) → 7 (coverage
policy). 2 & 3 are independent one-liners (ship anytime).

## Republish set (when implemented)
`@commonpub/config` (minor: new flag) → `@commonpub/protocol` (minor:
new ssrf module + actorResolver) → `@commonpub/server` (minor:
re-export + federation edits + inbox raw-body) → `@commonpub/layer`
(patch: remote-actor/search auth, import flag wiring, inbox util).
Then `tools/create-commonpub` pin bumps + cargo; then deveco/heatsync
`@commonpub/layer` bump; commonpub.io builds from source. No schema
change (migration count stays 5).

## Test plan
- Unit: `pinnedLookup` (mocked `dns.lookup` → RFC1918/IPv4-mapped/
  mixed sets → reject); signature coverage matrix; raw-body digest
  round-trip with non-ASCII + reordered keys.
- Integration: localhost server + stub resolver → `safeFetch` of a
  "public" host that resolves to 127.0.0.1 is refused (canonical
  DNS-rebind regression).
- **Two-instance interop**: stand up two CommonPub instances (or
  CommonPub ↔ Mastodon fixture) and prove signed inbound activities
  with a Digest header verify (catches the Part-2 regression that
  unit tests alone will miss).

## Product decisions — RESOLVED (session 147, by maintainer)

1. **Item 2 (remote-actor/search auth):** DO NOT require auth — keep
   public/optional-user. Maintainer: "don't want to restrict this too
   much." Rely on the existing global federation IP rate-limit
   (60/min/IP, `infra/security.ts` `DEFAULT_TIERS.federation`); do NOT
   add `requireAuth` and do NOT add an aggressive per-route tier.
   Revisit only if abuse is observed in practice.
2. **Item 3 (import flag):** new top-level flag **`contentImport`**,
   default **`true`** (added to `config/src/schema.ts` +
   types.ts + `useFeatures` flat list + admin UI; gate
   `import.post.ts` first line).
3. **Item 4 (safeFetch API):** **extend `SafeFetchOptions`** to carry
   `method`/`headers`/`body` (or accept a `Request`) — single
   hardened path for signed AP GET/POST.
4. **Item 5 (SSRF module owner):** **`@commonpub/protocol`** owns the
   consolidated module; `@commonpub/server` re-exports the existing
   public names (`isPrivateUrl`/`safeFetch`/`safeFetchBinary`/
   `SafeFetchOptions`) so no consumer breaks.

Implementation gate is now CLEARED. Sequencing unchanged (5→1→4→6→7,
+2/3 parallel); note Item 2 becomes a no-op (no code change — the
existing global rate limit stands) per decision 1.
