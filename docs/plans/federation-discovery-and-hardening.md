# Federation discovery & hardening + lock-down-before-adoption gap fixes

> **Living plan.** Update the checkboxes as each phase ships; cross-check against session logs
> (session logs win on conflict, per `codebase-analysis/10-doc-audit.md`). Approved 2026-06-02.

## Why

CommonPub runs on 3 live instances (commonpub.io, deveco.io, heatsynclabs.io), all auto-deploying
from one `main`, operated by one person. We're finishing/hardening the platform **now, while one
operator controls every instance** — once third parties adopt it, pushing schema/protocol changes
across many independently-run instances is hard. Two goals: (1) fix verified non-destructive gaps,
(2) make federation correct, bounded, and usable (the live propagation bug, overload-prevention,
admin UX, consent-based push, and a discovery registry).

## Verified facts (session 182, 2026-06-02)

- **Live bug:** instance `/actor/outbox` is projected over the `activities` delivery-queue
  filtered to `status='delivered'` → content published before a mirror followed (or whose delivery
  stalled) is invisible forever → backfill retrieves nothing. heatsync `/actor/outbox` `totalItems:2`
  for 8 posts. Live delivery to instance-followers works (deveco is in heatsync's `/actor/followers`).
- **Forward-only mirroring is correct by design** — auto-pulling an instance's entire history would
  overload. The need is *bounded, opt-in* history (pick how far back), not "import everything."
- `backfillFromOutbox` already has `maxItems` (default 500) + cursor resume, NO date bound.
  `createMirror` triggers no backfill. `refederate` re-federates ALL published content, unbounded.
- `push` mirror direction is dead code (schema + createMirror param only); reframed as a
  consent-based mirror-request ("ask them to pull me").

## Phases

### Phase 0 — Federation correctness + bounded opt-in history  ✅ (code+tests done; not yet published/deployed)
- [x] Project `/actor/outbox` + per-user outbox over published `contentItems` via the shared
      `contentToCreateActivity` (protocol); deterministic activity id `<object id>#create`.
- [x] **Security:** projection gates `status='published'` AND `visibility='public'`; content-type
      filter unneeded (every `contentTypeEnum` value federates). Regression test asserts no
      draft/members/private leak. ALSO closed the outbound leak in `federateContent`/`federateUpdate`
      (they now gate `visibility='public'`, not just status).
- [x] Kept `activities` as the `pending`-polled delivery queue (did NOT mark delivered early).
- [x] No new index needed — reuses migration 0012 `idx_content_items_feed_recency`; `?page=1` route path confirmed.
- [x] `since?` bound in `BackfillOptions` (+ `maxItems`, ceiling `mirrorMaxItems`); forward-only default kept.
      Backfill admin route accepts `{sinceDays,maxItems}` (fresh crawl, no stale cursor).
- [x] Bound + idempotent `refederate` (`{sinceDays,limit,all,contentId}`, defaults last 30d / 1000 cap, not all-by-default).
- [x] Tests: outbox projection (9, incl. security + deterministic id) + backfill `since` (5); 122 federation-area tests green; protocol+server+reference typecheck clean.
- [ ] Docs + codebase-analysis + session log (in progress).
- [ ] Publish (schema unchanged → server + protocol + layer) + deploy + live curl verify on the 3 instances.

### Phase 1 — Safe non-destructive gap fixes  ✅ (code+tests done; not yet published/deployed)
- [x] `leaveHub` + `submitContestEntry` wrapped in `db.transaction`.
- [x] `scripts/reconcile-counters.mjs` (idempotent, `--check`; 10 counters).
- [x] `listContent` total only when `offset===0` (else `-1`); federated branch preserves the sentinel.
- [x] `error.vue` injects `cpub-theme-inline` token CSS (mirrors the theme plugin).
- [x] Emit 5 dead hooks (content:liked/unliked, hub:content:shared, federation:hub:post:received,
      user:registered via createAuth `databaseHooks` → layer) + `docs/reference/guides/hooks.md`.
- [x] Self-ref FK migration `0013_black_lorna_dane` (orphan-null → `ADD CONSTRAINT … ON DELETE SET NULL`)
      on comments/hubPostReplies/docsPages.parentId + hubs.parentHubId; schema `.references()` added.
- [x] Tests: hooks-integration (+3 cases), self-ref-fk (2); transaction/content/social suites green; all touched packages + reference typecheck clean.
- [x] codebase-analysis 02/03/06 + events-validation correction; this plan; session log 183.

### Phase 2 — Federation admin UX full overhaul  ⬜
- [ ] Create form: direction + content-type/tag filters + history depth picker + one-directional help.
- [ ] Mirror list: direction/filters/lastSync/errorCount; `MirrorDetailModal.vue` (resume, re-backfill w/ depth).
- [ ] Backfill + refederate: depth picker, progress, result toast, filter dry-run preview.
      **Required:** "Re-federate All" button must send `{ all: true }` (or depth) — Phase 0 made
      `refederate` default to last-30-days/cap, so the button under-does its label until rewired.
- [ ] "Instances mirroring you" panel (from `/actor/followers`).
- [ ] Status legend + what-happens-next explainer; expose direction/filters in GET mirrors API.
- [ ] Component + axe tests; docs + codebase-analysis + session log.

### Phase 3 — Push = consent-based mirror-request  ⬜
- [ ] `createMirror` push branch → signed cpub-namespaced mirror-request to target inbox.
- [ ] `inboxHandlers` handles inbound request; "Requests to mirror you" admin inbox.
- [ ] Approve → create pull mirror of requester (B's own depth/filters) + accept their Follow; reject → rejected.
- [ ] `api/admin/federation/mirror-requests/*` + admin tab; two-instance e2e.
- [ ] Docs + codebase-analysis + session log.

### Phase 4 — Registry / instance directory  ⬜
- [ ] `features.actAsRegistry` (default OFF) + `instance.registryUrl` (default `https://commonpub.io`).
- [ ] Signed, rate-limited `POST /api/registry/ping` heartbeat + plugin.
- [ ] `registry_instances` table (lastSeenAt, software, stats, derived active/inactive) + abuse controls.
- [ ] Directory browse/search UI: per-entry "Mirror this instance" (pull + depth) + "Request they mirror me".
- [ ] Docs + codebase-analysis + session log.

## Cross-cutting — docs, tracking, codebase-analysis (every phase)

- Update this plan's checkboxes as each ships.
- Per-phase `docs/sessions/NNN-*.md` (what/why/decisions/next).
- `docs/federation.md` + new `docs/reference/guides/mirroring.md` + `…/hooks.md`; refresh `docs/llm/{facts,gotchas}.md`.
- `codebase-analysis/` updates: `02` (registry table, FK additions, enums), `03` (outbox projection,
  transactions, mirroring/registry fns), `04` (routes), `05` (components/composables), `08`
  (`actAsRegistry`), `09` (gotchas: outbox visibility gate, bounded backfill, mark-pending-not-delivered).
  Also correct the prior overstatement that events are "unvalidated" (they validate inline in `index.post.ts`).

## Release discipline

Order 0→1→2→3→4, each independently shippable. TDD. Publish **schema → server → ui → layer**
polling `npm view`; layer only via `pnpm run publish:layer`; hand-edit caret pins across 0.x minors;
**never trust `gh run` — `curl /api/health` + a real route per instance**; migrations via committed
SQL + `db-migrate.mjs`; no AI attribution in commits.
