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

---

## Phase 1 — safe non-destructive gap fixes (same session)

Verified each gap wasn't intentional before fixing (self-ref FKs: the schema comments claimed
"constraint added via migration" but none existed — an oversight, safe to add).

- **Transactions:** `leaveHub` (members.ts) + `submitContestEntry` (contest.ts) now wrap their
  delete/insert + counter update in `db.transaction` (mirrors `joinHub`). A duplicate entry
  (onConflictDoNothing) no longer increments.
- **`scripts/reconcile-counters.mjs`** — idempotent recompute of 10 denormalized counters
  (hub member/post, contest entry, event attendee, poll, comment/content likes, fork/build)
  from source tables; `--check` reports drift (exit 1), default fixes. Only UPDATEs rows that
  already disagree. (Fixed: content_forks uses `source_id`, not `parent_id`.)
- **`listContent`** computes `COUNT(*)` only on page 1 (`offset===0`), else `total=-1`
  (pagination-scalability phase B); federated branch preserves the `-1` sentinel.
- **`error.vue`** now injects the `cpub-theme-inline` token CSS (not just `data-theme`), so a
  DB-stored custom theme renders correctly on error pages.
- **5 dead hooks now emitted:** `content:liked`/`content:unliked` (toggleLike, content-item
  targets only), `hub:content:shared` (shareContent), `federation:hub:post:received`
  (hubMirroring), `user:registered` (bridged via a new `createAuth` `onUserCreated` callback →
  Better Auth `databaseHooks.user.create.after`, since the auth pkg can't import the server bus).
  New guide `docs/reference/guides/hooks.md`.
- **Self-ref FKs** (migration `0013_black_lorna_dane`): added `ON DELETE SET NULL` FKs on
  `comments.parent_id`, `hub_post_replies.parent_id`, `docs_pages.parent_id`, `hubs.parent_hub_id`
  (+ schema `.references()`); migration nulls any pre-existing dangling pointers first (0002
  pattern). `federatedHubPostReplies.parentId` left app-managed.

### Decisions
- `user:registered` bridged via callback rather than emitted from `@commonpub/auth` (dependency
  direction: auth must not import server). Best-effort: handler errors don't break registration.
- Self-ref onDelete = SET NULL (child survives, promoted to top-level) not CASCADE (would delete
  reply/page subtrees) — matches the codebase's "child survives" SET NULL pattern.

### Tests
- hooks-integration +3 (content:liked/unliked + negative for post-likes; hub:content:shared);
  new `self-ref-fk.integration.test.ts` (2 — SET NULL on parent delete + valid nesting accepted).
- Transaction/content/keyset/social/contest/hub suites green; schema+auth+server+protocol+reference typecheck clean.

### Next
- Migration count 13 → **14**. Still on the branch (release batched). Phase 2 next (admin UX).

---

## Phase 0+1 deep audit + testing review (same session)

Adversarial self-audit of the Phase 0/1 changes + a review of test adequacy. Findings:

**Real fix made**
- **Outbox now also filters `isNull(deletedAt)`** (`outboxQueries.ts`). Not a live leak today
  (both `deleteContent` and admin `removeContent` set `status='archived'`, which the
  `status='published'` gate already excludes), but the offset-path `listContent` and
  `getContentBySlug` defensively filter `deletedAt` — the public, crawlable outbox should match,
  guarding any future moderation path that nulls `deletedAt` without touching status.

**Verified NOT a problem**
- **`emitHook` isolates handler errors** (try/catch per handler, logs + continues) — so the 5 new
  emits can't break `toggleLike`/`shareContent`/registration post-commit.
- **`listContent` `total=-1` on offset>0 is safe for all current consumers**: `tags/[slug].vue`
  reads `total` only from its page-0 `useFetch` (loadMore is a separate `$fetch` that never
  reassigns `total`); `admin/content.vue` destructures only `{ items }`; `search.vue` uses
  `/api/search` (different endpoint). Contract is now locked by a test. (Fragile if a future
  consumer fetches offset>0 as its initial load AND reads total — documented in code.)

**Testing review — gaps found and closed**
- I had claimed "closed the outbound leak" (federateContent visibility gate) with NO direct test.
  Added `federate-visibility-gate.integration.test.ts`. Writing it surfaced a **test bug**:
  `createContent` hard-codes `status='draft'` (ignores `input.status`), so my "published" fixtures
  were drafts and the public case queued nothing — the members/private cases were false-positives
  (expected 0 trivially). Rewrote to publish explicitly + assert the DELTA in outbound Creates
  (public +1, members/private +0). This is the real verification.
- Added `listcontent-count.test.ts` (total real on page 1, `-1` on offset>0) and a
  `federation:hub:post:received` hook assertion in `hub-mirroring.integration.test.ts`.
- Full server suite: **1214 passed / 3 skipped / 0 failed** (84 files).

**Still untested (acceptable; documented)**: `user:registered` (needs a Better Auth integration
harness), `reconcile-counters.mjs` (no DB in unit tests — column names grep-verified, SQL not
runtime-checked), `error.vue` inline-CSS re-apply (SSR error-page). Verify at release.

**Cross-phase note for Phase 2**: `refederate` now defaults to last-30-days / 1000-cap; the admin
"Re-federate All" button must be updated to send `{ all: true }` (or a depth choice) so its label
matches behavior. Also `backfill.post.ts` uses `.catch(() => ({}))` on body parse — swallows
validation errors into defaults (admin-only, low risk); tighten when reworking the UI.
