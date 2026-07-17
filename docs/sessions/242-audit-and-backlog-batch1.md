# Session 242 — Audit session-241 hardening + backlog batch 1

Two-phase audit-and-continue session. Phase 1 adversarially re-audited the LIVE session-241
hardening; Phase 2 continued the review backlog. Both ran through the proven loop
(fix → full suite + tsc → adversarial audit workflow → apply findings → roll exact-pin chain).

## Baseline re-verified (2026-07-17, before any change)

LIVE on all 3 (commonpub.io / deveco.io / heatsynclabs.io) — health ok, 37 flags, migration 0042:
server 2.116.0 / layer 0.106.5 / editor 0.13.0 / protocol 0.15.0 / auth 0.11.0 / schema 0.59 /
config 0.33 / ui 0.13.2 / infra 0.17 / docs 0.6.3. All trees clean. Matched the handoff exactly.

## Phase 1 — Adversarial audit of session-241 hardening

Fanned out 6 read-only skeptic reviewers (onCreate/onAnnounce bindings, crawl-binding + mirror cap,
SSO actor-host + roleGuard, HTTP-sig, contest/v-html CSS) + adversarial verification of every finding.

**Clean areas (hardening holds):** onAnnounce attributedTo binding, HTTP-signature (request-target)
covers query + case-insensitive digest, SSO actor-host binding, roleGuard. The mirror-page table
finding was correctly REFUTED (remote HTML is coerced to a block array before the v-html sink).

**Confirmed defects (6):**
1. **[P2 LIVE — regression]** Object-form `actor` bypasses the onCreate attribution binding.
   `assertActorMatchesSigner` extracts `.id` from `{actor:{id}}` and passes; `processInboxActivity`
   then forwarded the raw OBJECT, so `new URL(actorUri)` in the binding threw and fell OPEN, letting a
   signed peer squat a third party's `object.id`. Also defeated backfill's ownerHost binding.
2. **[P2 LIVE]** `mirrorMaxItems` cap not enforced on the backfill/crawl path (`createInboxHandlers`
   built without `federationConfig`) — the exact dead-wiring class session 241's audit caught once.
3. **[P2 LIVE]** `.cpub-prose table` had no mobile overflow containment — federated hub posts render
   remote HTML via `.cpub-prose`, so a wide remote table forced sideways page scroll on mobile
   (sibling of the session-241 `.cpub-md-html` fix).
4. **[P3 LIVE]** Undo(Like) decremented counters with no prior-Like check (= backlog #11).
5. **[P3 LIVE]** `.cpub-block-fallback` (+ `.cpub-md-quote`) lacked table/pre/img containment.
6. **[P3 not-live]** Mastodon `returnTo` open redirect (flag `signInWithRemote` OFF in prod).

## Phase 2 — Backlog closed this batch

- **#11** Undo(Like): delete the inbound Like row with `.returning()` FIRST; decrement only if a row
  was removed (onLike inserts exactly one row per actor/object and dedups, so it's the authoritative
  "had a prior Like" signal). Minimal-diff `if (removedLike.length > 0) try {…}`.
- **#22** `createComment` parentId: load the parent, reject if missing or `targetType/targetId` differ
  (before insert / before count increment).
- **#24** editor `table` block: added `tableContentSchema` `{header, rows}`, registered `table`,
  added a `table` preview case (+ containment CSS) in `MarkdownBlock.vue`.

## Fixes shipped (all 6 confirmed + returnTo)

- **#1** protocol `inbox.ts`: `extractActorId()` normalizes `actor` to its string id (string / `{id}`;
  rejects array + non-string id) at dispatch, fixing ALL handlers + the backfill path. Server onCreate
  binding catch flipped to fail-CLOSED.
- **#2** backfill `federationConfig` threaded → `createInboxHandlers` (backfill.ts + inbox auto-backfill
  + `approveMirrorRequest` + both layer admin routes).
- **#3 / #5** CSS: `.cpub-prose table` left UNCHANGED (shared local-prose class — the first attempt's
  display:block+nowrap was a **desktop regression**, caught by the batch audit); added an opt-in
  `.cpub-html-contain` containment class applied ONLY to the federated hub post page. `.cpub-block-fallback`
  + `.cpub-md-quote` got `:deep()` containment (narrow remote-only surfaces).
- **returnTo**: first attempt was a regex (`/^\/(?![/\\])/`) — the batch audit found a TAB bypass
  (`/\t/evil.com` → browser strips tab → `//evil.com`). Replaced with a robust
  `new URL(rt,'https://cpub.invalid')` same-origin check returning only `pathname+search+hash`.

**Batch audit caught 2 real defects** (returnTo TAB bypass, shared-`.cpub-prose` desktop regression) that
green unit tests missed — do NOT skip it. Both re-fixed + re-verified clean.

## Validation

protocol tsc✓ tests 431✓ · server tsc✓ tests 1732✓ · editor tsc✓ tests 256✓ · ui tests 271✓.
New regression tests: protocol object-form/array actor normalization; editor `table` validateBlock;
server Undo(Like)-without-prior-Like no-op; server createComment cross-target reject.

## Roll

Exact-pin chain: protocol 0.15.1 → editor 0.14.0 → ui 0.13.3 → server 2.117.0 → layer 0.107.0; forks
bump the `@commonpub/layer` pin to bust the Docker `npm install` cache. No migration this batch.

## Open / next

- **Deferred to a separate roll:** schema FK migration #19 (`federated_hub_post_replies.parent_id`
  self-FK) + #20 (`conversations.participants` FK sweep) — needs a migration guarding orphans.
- **Build-pipeline gap:** `layers/base` has no typecheck/lint/build; `packages/infra` no lint.
- **Open PRODUCT decision (operator):** §2b(ii) federated-content storage policy — subscribed-only vs
  open. A behavior choice, not a bug.
- Dedicated PII/GDPR pass still worthwhile.
