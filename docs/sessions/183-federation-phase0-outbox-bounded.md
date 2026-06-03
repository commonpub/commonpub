# Session 183 — Federation Phase 0: outbox correctness + bounded opt-in history

2026-06-02. First implementation phase of `docs/plans/federation-discovery-and-hardening.md`
(approved this session). Branch `feat/federation-discovery-and-hardening`. Code + tests done;
NOT yet published or deployed.

## The bug (diagnosed session 182, fixed here)

deveco.io pull-mirrors heatsynclabs.io, but only one recent post ever appeared; backfill +
refederate brought no history. Root cause: the instance `/actor/outbox` was projected over the
`activities` delivery queue filtered to `status='delivered'`. A post only entered the outbox
after its Create was delivered to a follower, so anything published before deveco followed (or
whose delivery stalled) was invisible forever — heatsync's `/actor/outbox` reported
`totalItems: 2` for 8 posts. deveco's backfill crawled an almost-empty outbox. Live delivery
worked (deveco is in heatsync's `/actor/followers`), which is why one recent post propagated.

## What was done

- **Outbox is now a projection over published+public content** (`outboxQueries.ts`): instance +
  per-user content outboxes SELECT from `content_items WHERE status='published' AND
  visibility='public'`, ordered `published_at DESC NULLS LAST, id DESC` (reuses migration 0012
  `idx_content_items_feed_recency` — no new index). Hub outbox stays Announce/queue-derived.
- **Shared deterministic builder** `contentToCreateActivity` (protocol `contentMapper.ts`):
  Create id = `<object id>#create` (stable, vs `buildCreateActivity`'s random uuid) and
  `published` = the content's real date (vs `now`). Both load-bearing — stable id for crawl
  de-dup, real date for date-bounded backfill. `federateContent` now uses it too, so live
  delivery and backfill emit the same de-dupable activity.
- **Closed an outbound leak:** `federateContent`/`federateUpdate` now gate `visibility='public'`
  (previously only `status`), so members/private content never federates. The public outbox
  applies the same gate.
- **Bounded, opt-in history** (forward-only stays the default):
  - `BackfillOptions.since?: Date` — stops crawling once it pages past the cutoff (newest-first).
  - Backfill admin route accepts `{ sinceDays, maxItems }` (capped by `mirrorMaxItems`); fresh
    crawl each run (no stale cursor skew on a depth-picked run).
  - `refederate` route bounded by default (last 30 days, 1000-item cap, newest-first); only
    re-delivers everything on explicit `all:true`. Idempotent (federateContent skips an already-
    pending Create for the same object).

## Decisions

- Did NOT mark activities `delivered` early (a tempting "fix") — the worker polls `status='pending'`;
  that would starve delivery. Outbox draws from content; the queue stays the delivery ledger.
- No new index — the 0012 partial feed index already covers the projection's ORDER BY.
- Deterministic Create id is a wire change for NEW activities only; existing delivered activities
  keep their ids; consumer de-dup is by `object.id`, so no conflict.

## Tests

- `outboxQueries.test.ts` rewritten (9): projection counts, per-user vs instance, **security**
  (no draft/members/private leak), deterministic id, stability across renders, pagination/order.
- `backfill-since.test.ts` (5): publish-date extraction + cutoff comparison.
- 122 federation-area integration tests green; `federation-hooks` Create-id assertion updated to
  the deterministic contract. protocol + server + reference app typecheck clean.

## Open questions / next steps

- **Publish + deploy + live-verify** (Phase 0 not done until verified live): server + protocol +
  layer bump, then `curl https://heatsynclabs.io/actor/outbox` should show ~8 public posts and
  `?page=1` list them; deveco bounded backfill should pull the window; heatsync must still have
  zero deveco content (one-directional intact).
- Then **Phase 1** (safe gap fixes) → Phase 2 (admin UX: depth picker + "who mirrors you") →
  Phase 3 (push = mirror-request) → Phase 4 (registry). See the living plan.
- Schema unchanged this phase (no migration).
