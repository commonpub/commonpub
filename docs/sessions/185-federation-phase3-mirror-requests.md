# Session 185 — Federation Phase 3: consent-based mirror requests ("push")

2026-06-02. Phase 3 of `docs/plans/federation-discovery-and-hardening.md`, branch
`feat/federation-discovery-and-hardening`. Code + tests + docs done; **NOT published/deployed**
(release is batched — task #7).

## What "push" means now

`direction:'push'` was dead code. Reframed as a **consent-based mirror request**: instance A asks
instance B to pull-mirror A ("please mirror me"). B can only get A's content by pulling A, so A
"pushing" = A requesting B set up a pull mirror. CommonPub↔CommonPub only — non-CommonPub instances
receive an `Offer` they don't process and ignore it.

## Flow

1. **A** `requestMirror()` (route branches `createMirror` push → here) → inserts a `mirror_requests`
   `{direction:'outgoing', status:'pending', offerActivityUri}` row + queues a signed
   **`Offer(Follow)`** (`buildMirrorRequestActivity`, marked `cpub:mirrorRequest:true`) to B's inbox.
2. **B** inbox `Offer` → `onMirrorRequest` → upsert `{direction:'incoming', status:'pending'}`.
   Surfaces under **"Requests to mirror you"** + admin notification.
3. **B approve** (modal: depth + filters) → `approveMirrorRequest`: `createMirror(A,'pull',filters)`
   (sends the real `Follow` B→A) + optional bounded backfill + `Accept(Offer)`; marks incoming
   `approved`, links `resultingMirrorId`. Idempotent if a pull mirror of A already exists.
4. **A** gets B's `Follow` (`onFollow`, auto-accepted → B enters A's instance-followers) **and**
   B's `Accept(Offer)` (`onAccept` **extended** → flips A's outgoing request `approved`).
5. **B reject** → `Reject(Offer)`; incoming `rejected`. A's `onReject` (**extended**) → outgoing
   `rejected`. Both extensions correlate by the stored `offerActivityUri`.

Only **one** new inbound dispatch branch (`Offer` → `onMirrorRequest`); Accept/Reject reuse existing
callbacks. Content then flows over the normal pull path (Create → `matchMirrorForContent`).

## Decisions

- **Storage:** ONE unified `mirror_requests` table for both directions (incoming|outgoing) with its
  own status enum (pending|approved|rejected). `instanceMirrors` stays **pull-only** — `createMirror`
  push now throws (use `requestMirror`); this avoids overloading `mirrorStatusEnum` and sidesteps the
  `unique(remote_domain)` collision (a domain can be both pulled and asked-to-mirror-you). The old
  dead `↑`-push rendering in the mirror list was removed; outgoing requests live in their own panel.
- **Wire shape:** AP `Offer` whose object is `Follow{actor:target, object:requester}` (standard AS2
  "request to be followed") + a `cpub:mirrorRequest` literal key (same convention as `cpub:type`).
  Approve replies `Accept(Offer)`, reject replies `Reject(Offer)`. `Offer` routes like `Follow` in
  delivery (to the target actor's inbox).
- **Approve UX:** a modal where B picks history depth (None forward-only / 7d / 30d / 90d / 200 /
  All) + content-type/tag filters, applied to the pull mirror B creates. Default = forward-only.

## Changed by package (extends the session-184 release table)

- **@commonpub/schema** → migration **0014** (`mirror_requests` table + 2 enums); `approveMirrorRequestSchema`.
- **@commonpub/protocol** → `APOffer`, `CPUB_MIRROR_REQUEST`, `buildMirrorRequestActivity`,
  `onMirrorRequest` optional callback + `Offer` dispatch. **Wire-protocol change.**
- **@commonpub/server** → `requestMirror`, `listMirrorRequests`, `getMirrorRequest`,
  `approveMirrorRequest`, `rejectMirrorRequest`; `createMirror` pull-only; `onMirrorRequest` +
  `onAccept`/`onReject` extensions; `Offer` delivery routing.
- **@commonpub/layer** → 3 `mirror-requests/*` routes + RBAC keys; create-form direction selector;
  "Requests to mirror you" + "Requests you've sent" panels; `MirrorRequestApproveModal.vue`.

## Tests

- protocol: `Offer`+cpub-marker → `onMirrorRequest`, non-cpub Offer → unsupported, no-handler →
  unsupported (3); `buildMirrorRequestActivity` shape (1). 423 protocol tests green.
- server: `mirror-request.integration.test.ts` (11) — `requestMirror` queues Offer not Follow +
  no instance_mirrors row; idempotent re-request; `createMirror` push throws; **two-instance e2e**
  (request → approve → bounded pull → alice's content ingested under the approval mirror) + loop
  guard + no reverse-Follow loop; reject path both sides. 1227 server tests green.
- layer: `MirrorRequestApproveModal` component+axe (9); route-keys completeness map. 887 layer green.
- Full-workspace `pnpm typecheck` **26/26** (incl. reference app's strict consumer typecheck).

## Next

- Phase 4 (registry) then the batched release (task #7): publish schema→protocol→server→ui→layer,
  migration 0014 via `db-migrate.mjs`, deploy 3 instances, live-verify. **Browser-smoke**
  `/admin/federation` Mirrors tab (direction selector + both request panels + approve modal were
  vue-tsc + component-tested, NOT browser-verified). Two CommonPub instances are needed to verify
  the request round-trip live — single-instance smoke only covers the UI + local persistence.

## Deferred (non-blocking)

- NodeInfo "is-CommonPub" pre-check before sending an Offer (graceful failure already covers
  non-CommonPub targets — the request just stays pending). Outgoing-request manual cancel/retry UI.
