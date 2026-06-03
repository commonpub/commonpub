# Session 187 — Deep audit of Phases 3 & 4 + fixes

2026-06-02. Adversarial deep audit (two independent reviewer agents + self-verification) of the
Phase 3 (mirror requests) and Phase 4 (registry) code on branch
`feat/federation-discovery-and-hardening`. Found real security + correctness bugs the tests missed;
fixed the genuine ones, hardened coincidental tests, documented the rest. Still NOT
published/deployed.

## Fixed (security / correctness)

1. **Inbox actor↔signer binding (P1 security, federation-wide).** The 3 inbox routes discarded the
   verified `actorUri` from `verifyInboxRequest` and let `processInboxActivity` trust the unsigned
   `body.actor`. A validly-signed request from instance X could carry `actor: https://victim/actor`
   → spoofed mirror requests/Accepts (Phase 3), federated content attributed to others, like/boost
   tampering. **Fix:** `assertActorMatchesSigner(actorUri, body, label)` in `utils/inbox.ts`, called
   in all three inbox routes (shared/user/hub) — 401s on host mismatch. +6 unit tests. This is a
   pre-existing federation gap (not Phase-3-specific); closing it now while one operator controls
   every instance is exactly the "lock down before adoption" goal.

2. **`approveMirrorRequest` reuse-existing-mirror path (P1).** When a pull mirror already existed for
   the requester's domain, approval just linked it — it did NOT re-activate a paused/failed mirror,
   apply the approver's filters, or re-queue a Follow. The requester got an Accept but
   `matchMirrorForContent` (requires `status='active'`) ingested nothing. **Fix:** reuse path now
   re-activates, applies filters, and re-follows if no accepted follow exists. Extracted
   `queueInstanceFollow` (shared with `createMirror`). + a reuse-paused-mirror test (the branch had
   zero coverage).

3. **`approveMirrorRequest` unique-constraint race (P1).** Concurrent approvals / a directory
   "Mirror" click between the SELECT and `createMirror`'s INSERT threw an unhandled 500 on
   `instance_mirrors.remote_domain` UNIQUE. **Fix:** catch the violation, re-select the row that won.

4. **Registry heartbeat domain source (P2 correctness).** The plugin derived its signing domain from
   `siteUrl`, but the served actor `id` uses `instance.domain`; `verifyInboxRequest` requires
   keyId-host == actor.id-host, so on any instance where those differ every ping 401s. **Fix:** use
   `config.instance.domain`. Also **skip + warn when `features.federation` is off** (the registry
   can't resolve our `/actor`, which is federation-gated, so pings would be unverifiable).

5. **Registry blocked-instance race (P2).** `recordRegistryPing` did SELECT-status then upsert; an
   admin block landing between them still refreshed stats. **Fix:** `setWhere: ne(status,'blocked')`
   on the conflict-update.

6. **Dead config defaults (P2).** `config.federation` was `.optional()` with no default, so the
   schema-level `registryUrl`/`registryPingIntervalMs` defaults never applied (only the heartbeat's
   hardcoded fallbacks saved it). **Fix:** `federation` now `.default()`; added `federation` to the
   `defineCommonPubConfig` input type so operators can override `registryUrl`. +2 config tests.

## Hardened (coincidental tests)

- **Anti-SSRF same-host test** passed whether or not the guard existed (the evil href wasn't in the
  stub, so removing the check just made the stub throw → null → still green). Now the evil href IS
  resolvable in the stub + asserts it's never fetched — removing the guard fails the test.
- Added the pre-verification per-IP rate-limit on `/api/registry/ping` (the per-domain limit ran
  AFTER `verifyInboxRequest`'s network actor-resolution; an unauthenticated caller could fan that
  out). Coarse 20/min/IP before verification; 3/5min per verified domain after.
- ENV_FLAG_MAP in both apps now includes the registry flags (`FEATURE_ACT_AS_REGISTRY` etc.).

## Documented, not fixed (low severity)

- `approveMirrorRequest` isn't transactional → a duplicate `Accept(Offer)` is possible on
  partial-failure retry. Harmless: the receiver's `onAccept` matches `status='pending'`, so a second
  Accept is a no-op.
- `onMirrorRequest` admin-notify queries `users.role=='admin'` — under RBAC a `staff`/custom role
  with `federation.manage` gets no notification (the admin-console badge still surfaces it).
- The ping route's module-level rate-limit store starts a timer on first hit even when
  `actAsRegistry` is off (same pattern as the always-on global security middleware).

## Verification

`pnpm typecheck` **26/26**; config **25**, protocol **424**, server **1245**, layer **907** green.
The inbox signer-binding doesn't regress existing tests (integration tests call `processInboxActivity`
directly; the binding is route-level). New gotchas in `codebase-analysis/09` + `docs/llm/gotchas.md`.

## Next

Unchanged: the batched release (task #7) — see `185-kickoff-next.md`. The two-instance live verify
now also covers the actor↔signer binding (a cross-instance Accept must carry a matching actor).
