# Federation discovery & hardening + lock-down-before-adoption gap fixes

> **Living plan.** Update the checkboxes as each phase ships; cross-check against session logs
> (session logs win on conflict, per `codebase-analysis/10-doc-audit.md`). Approved 2026-06-02.
>
> **SHIPPED 2026-06-03 (session 188):** Phases 0–4 released — schema 0.26.0, config 0.17.0,
> protocol 0.13.0, auth 0.8.0, server 2.73.0, layer 0.44.0 (ui unchanged) published; all 3 instances
> deployed (migrations 0013/0014/0015 applied). **P0 outbox projection verified LIVE** (heatsync
> `/actor/outbox` totalItems 2→8, deveco 23, `#create` ids). Remaining: P3/P4 interactive
> round-trips (admin auth + 2 instances) and the registry-activation decision — see session 188.

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

### Phase 0 — Federation correctness + bounded opt-in history  ✅ (SHIPPED + LIVE on all 3, session 188)
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
- [x] Docs + codebase-analysis + session log.
- [x] Published (schema 0.26.0 / config 0.17.0 / protocol 0.13.0 / auth 0.8.0 / server 2.73.0 /
      layer 0.44.0) + deployed all 3 + live curl verified (session 188). P0 outbox projection LIVE.

### Phase 1 — Safe non-destructive gap fixes  ✅ (SHIPPED + LIVE on all 3, session 188)
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

### Phase 2 — Federation admin UX full overhaul  ✅ (SHIPPED + LIVE on all 3, session 188)
- [x] Create form: pull + content-type/tag filters + history depth picker (None/7d/30d/90d/200/All)
      + one-directional explainer + what-happens-next toast. (Direction selector is pull-only for
      now; the push/request option arrives in Phase 3 — not shipping a non-functional control.)
- [x] Mirror list: direction arrow, filter chips, lastSync, errorCount; clickable name → new
      `MirrorDetailModal.vue` (full facts, last error, bounded re-backfill w/ depth, two-step delete).
- [x] Refederate: bounded scope selector (7d/30d/Everything) sending `{sinceDays}` or `{all:true}`
      — closes the cross-phase requirement. (Live backfill/refederate progress = in-flight state +
      result toast; streaming progress + filter dry-run preview DEFERRED — see note.)
- [x] "Instances mirroring you" panel + new `GET /api/admin/federation/followers` (`listInstanceFollowers`).
- [x] Status legend + explainer. (GET mirrors API already returned direction/filters — no change needed.)
- [x] Tests: `MirrorDetailModal` component+axe (10), `listInstanceFollowers` server (2),
      RBAC route-keys map updated. reference `vue-tsc` clean; layer 872 + server 1216 green.
- [~] DEFERRED to a follow-up: live streaming backfill progress (needs polling) + filter dry-run
      preview (needs a remote-outbox probe). Not blocking; noted in session 183.

### Phase 3 — Push = consent-based mirror-request  ✅ (SHIPPED + LIVE on all 3, session 188)
- [x] Push branch → `requestMirror()` sends a signed `Offer(Follow)` + `cpub:mirrorRequest` marker
      to the target inbox (protocol `buildMirrorRequestActivity`; `createMirror` push now throws —
      push is no longer a mirror row). `Offer` routes like `Follow` in delivery.
- [x] `inboxHandlers.onMirrorRequest` stores an 'incoming' request (loop-guard own domain, gate
      target = our instance actor, admin notification); protocol `Offer` dispatch (cpub-marked only,
      else unsupported → non-CommonPub ignores). "Requests to mirror you" admin panel.
- [x] Approve → `approveMirrorRequest` creates a pull mirror of the requester (approver's own
      depth/filters), optional bounded backfill, `Accept(Offer)`; idempotent if a mirror already
      exists. Reject → `rejectMirrorRequest` sends `Reject(Offer)`. `onAccept`/`onReject` extended
      to flip the requester's OUTGOING request by offer-uri correlation.
- [x] **Storage:** one unified `mirror_requests` table (incoming|outgoing), migration **0014**;
      `instanceMirrors` stays pull-only. Zod `approveMirrorRequestSchema`.
- [x] `api/admin/federation/mirror-requests/{index.get, [id]/approve.post, [id]/reject.post}` +
      RBAC route-keys map; create-form direction selector + "Requests sent/received" panels +
      `MirrorRequestApproveModal.vue` (depth+filters, axe).
- [x] Tests: protocol Offer dispatch (3) + builder (1); server unit + **two-instance e2e**
      (request→approve→bounded pull→content, +no-loop assertion) (11); modal component+axe (9).
      Full `pnpm typecheck` 26/26; server 1231 + layer 888 + protocol 424 green (post-audit).
- [x] Docs + codebase-analysis (02/03/04/09 + llm gotchas) + session log 185. Audit fixes:
      correlation tightened (offer-id AND sender) + 5 coincidental-pass tests hardened.

### Phase 4 — Registry / instance directory  ✅ (SHIPPED + LIVE on all 3, session 188)
- [x] `features.actAsRegistry` + `features.announceToRegistry` (both default OFF; separate announce
      flag = no phone-home until opted in) + `federation.registryUrl` (default `https://commonpub.io`)
      + `federation.registryPingIntervalMs` (6h). nuxt runtimeConfig features declares both flags.
- [x] Signed, rate-limited `POST /api/registry/ping` (reuses `verifyInboxRequest`; per-domain
      rate-limit; gated `actAsRegistry`) + `registry-heartbeat.ts` Nitro plugin (`announceToRegistry`).
- [x] `registry_instances` table + `registry_instance_status` enum (active/hidden/blocked), migration
      **0015**. **Decision: auto-list verified pings, admin hide/block** (no approval queue). Stats are
      **pulled from the pinger's public NodeInfo** (`fetchInstanceNodeInfo`, SSRF-guarded, same-host
      href) — not self-reported. Online/offline derived from `lastPingAt`.
- [x] Admin directory UI: `RegistryDirectory.vue` (search + per-entry Mirror/Request-mirror reusing
      Phase 3 + Hide/Unhide/Block) in a new federation "Registry" tab (shown when `actAsRegistry`).
      Public read API `GET /api/registry/instances` (allow-list serializer) + admin list/status routes.
- [x] Tests: config defaults (2); server `registry.integration` (13 — NodeInfo pull incl anti-SSRF
      href, ping record/re-ping/blocked-no-op/hidden-preserved, list public-vs-admin/search/paginate,
      signed-ping builder); `RegistryDirectory` component+axe (9); route-keys map. Full `pnpm
      typecheck` 26/26 (reference caught the h3 `Retry-After`-is-number gap); config 24, protocol 424,
      server 1244, layer 901 green.
- [x] Docs + codebase-analysis + session log 186.

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
