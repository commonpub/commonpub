# Session 204 — Deep Audit Round 2 (wider + deeper) + fixes

> **Date:** 2026-06-18. Branch `audit-203-fixes`. Six parallel agents on surfaces the
> round-1 audit (`203-full-codebase-audit.md`) didn't reach — plus an **adversarial
> re-review of the 203 fixes themselves**. Every load-bearing finding re-read against
> source and cited `path:line`. Full test suite green at baseline (33/33 tasks, ~5000 tests).

## Agents
1. Adversarial review of the 203 fixes (regressions/incomplete fixes)
2. Security (IDOR, session/CSRF, SSRF, XSS sinks, SQLi, rate-limit coverage, CSP, mass-assignment)
3. DB & performance (N+1, indexes, COUNT, OFFSET, transaction completeness)
4. Frontend / a11y / design-system (WCAG, hardcoded colors/fonts, SSR, CSS scope, reactivity)
5. Infra / CI / deploy / CLI (workflows, Docker, scripts, multi-replica, Rust CLI)
6. Federation protocol correctness (inbox/outbox state machine, signatures, visibility, mirroring)

---

## FIXED this session (committed)

### P0 — security (live)
- **Private/members content leak over ActivityPub** — the AP object middleware served any
  `published` item to unauthenticated `Accept: application/activity+json` with **no
  visibility filter**. Added `eq(visibility,'public')` (`content-ap.ts`).
- **Unauthenticated SSRF via the inbox** — `inbox.ts` resolved the attacker-controlled
  `keyId` actor with **raw global `fetch`** (no pinned dispatcher) *before* signature
  verification → DNS-rebind to internal/metadata. Now uses `createSafeActorFetchFn()`
  (exported from `@commonpub/server`).
- **SSRF via Mastodon-login host** (flag-gated off in prod) — `isValidHost` accepted IP
  literals incl. `169.254.169.254`; megalodon's axios bypasses the pinned dispatcher.
  Added an `isPrivateUrl()` gate. (Residual DNS-rebind-via-hostname needs a global pinned
  dispatcher — see backlog.)

### P1
- **Stored XSS via Custom-HTML homepage section** — `CustomHtmlSection.vue` rendered
  admin-authored `v-html` with **no sanitizer** on the public homepage (CSP allows
  unsafe-inline). Now runs through `sanitizeRichHtml`.
- **Undo(Like) uuid-form asymmetry** (federation) — `onLike` matched local content by uuid
  OR slug but `onUndo` only by slug, so a uuid-form Undo never decremented → `like_count`
  **and** the new `remote_like_count` inflated permanently (reconcile folds remote in, so
  the 203 fix had made the drift unrecoverable). Added the uuid-by-id branch to `onUndo`.
- **Re-like after unlike was a silent no-op** — `onUndo` never deleted the inbound Like
  activity that `onLike`'s idempotency guard keys on. Now deletes it.
- **Federated links lost `target`** (regression from the 203 sanitizer switch) — restored
  `target` on the `a` allowlist + re-added `figure`/`figcaption` (`protocol/sanitize.ts`).
- **Deploy masked DB-migration failure** — `db-migrate.mjs | tee … || exit 1` saw `tee`'s
  exit 0. Added `set -o pipefail` (`deploy.yml`).
- **Unauthenticated version-history leak** — `content/[id]/versions.get.ts` had no auth/
  ownership check. Now `requireAuth` + `ownerOrPermission(…, 'content.moderate')`.
- **Abuse-reporting wrongly gated behind `social`** — un-gated `report.post.ts`.

Also fixed in 203 (F2): the AP middleware shipped stringified JSON as `content`; now passes
blocks through so `contentToArticle` renders HTML.

---

## REMAINING BACKLOG (verified, not yet fixed)

### P1 — security / correctness (architectural or needs a decision)
- **No global SSRF-pinned dispatcher.** Any library with its own HTTP client (megalodon/
  axios) or raw `fetch`/`$fetch` bypasses SSRF protection. Recommend `setGlobalDispatcher`
  with a pinned undici dispatcher as a backstop, in addition to call-site fixes. Remaining
  raw-fetch SSRF surfaces: `sso.ts:29-40` OAuth discovery (allowlisted, flag-off),
  megalodon factory (`mastodonFactory.ts:82`, authenticated self-host).
- **No CSRF defense on cookie-auth `/api/*`** (`SameSite=lax` is the only barrier; Better
  Auth CSRF covers only `/api/auth/*`). Add a global middleware verifying `Origin`/`Referer`
  for unsafe-method cookie-auth requests; forbid state-changing GET (`mastodon/start.get.ts`
  already writes on GET).
- **Inbox has no activity-level replay/dedup.** Within the 5-min signature window the same
  signed POST replays; `onCreate` reply `commentCount`/`localCommentCount`, and several
  handlers (onAccept re-fires backfill) double-apply. Add a seen-activity dedup keyed on
  `activity.id` (needs a table/unique index → migration).
- **`createContentVersion` race** — read-max-then-insert with **no `unique(contentId,
  version)`** → duplicate version numbers under concurrent publish (migration + onConflict).
- **`mirrorMaxItems` quota not enforced** (`mirroring.ts:537`) — inbound mirror push is
  unbounded; `contentCount` overcounts (increments on update/replay too).

### P1 — DB / data integrity
- **Delivery follower N+1** (`delivery.ts:416,440,371,395,306`) — one `remoteActors` SELECT
  per follower per activity. Batch with `inArray` + shared-inbox dedup. (Hottest fan-out path.)
- **Non-transactional multi-writes:** `forkContent` (insert+insert+counter), `enroll`/
  `unenroll` (check+insert+counter, no `onConflictDoNothing`), `deletePost` (delete+counter),
  `advanceContestStage` (N per-row updates), `transitionContestStatus`+rank-calc. Wrap in tx.

### P1 — frontend
- **Silent data loss:** the two main editors (`u/[…]/edit.vue`, `docs/[…]/edit.vue`) guard
  only `beforeunload`, not `onBeforeRouteLeave` — SPA nav discards unsaved work.
- **Swallowed upload errors** — `ProjectEditor`/`ExplainerEditor`/`ArticleEditor` cover/banner
  uploads `.catch(() => {})`; surface via the existing `uploadError` ref.
- **a11y blockers** — `role="radiogroup"` wrapping `aria-pressed` buttons (FormatToggle,
  AdminLayoutsToolbar); `role="menu"` dropdowns (default.vue avatar, NavDropdown) lack the
  keyboard contract; `RemoteFollowDialog` has no accessible name.

### P2
- **Pagination tiebreakers still missing ~9 offset queries** (the 203 sweep's list was
  incomplete): `contentSearch.ts:208,211,236`, `outboxQueries.ts:196`, `federation.ts:927`,
  `docs.ts:43`, `moderation.ts:172,298`, `members.ts:191`, `messaging.ts:45`, `events.ts:285`.
- **COUNT(*) every page** (not gated to page-1): `notification.ts:140` (client never reads
  total — drop it), `timeline.ts`, `events`, `product`, `contentSearch`.
- **Search fallback = double full seq scan** — no `pg_trgm`/GIN index on content title/desc;
  leading-wildcard ILIKE. Add a trigram index (migration).
- **Missing composite indexes** on hot reads: `(authorId,status)`, `(type,status,publishedAt)`,
  `(userId,createdAt desc,id desc)` for notifications.
- **`/api/content` main feed still offset-based** (keyset endpoint exists at `/feed`); deep
  load-more re-scans both local+federated per page.
- **Multi-replica duplication** (latent — prod is single-replica): `notification-email`
  digest + `federation-hub-sync` lack an atomic cross-instance claim (digest → N× emails,
  hub-sync → N× remote fetches). Use the `publishDueScheduled`/delivery claim pattern.
- **Security P2s:** private hub metadata leaked to non-members (`getHubBySlug`); hub
  vote/poll skips membership+ban check (`voting.ts`); `x-admin-secret` non-constant-time
  compare (`refederate.post.ts:30`); email verification sent-but-not-enforced; contest/event
  "Full HTML" mode uses the regex `sanitizeRichHtml` (mXSS risk) → route through DOMPurify.
- **Federation P2s:** AP Article `content` stringified (FIXED above); delivery `markDelivered`
  on partial success re-POSTs to already-2xx'd inboxes on retry (no per-recipient ledger);
  circuit-open-only deliveries never dead-letter (`delivery.ts:216`) → pending grows forever.
- **Frontend P2s:** undefined tokens `--accent-contrast`/`--accent-text` (5 sites) →
  hardcoded `#fff` → contrast failure; use `--color-on-accent`. Undefined `--badge-color-*`.
  profile skills/experience `v-for` index-key + splice → data desync (stable keys). prose
  `img` global leaks into `BlockImageView`/`BlockGalleryView` scoped styles. 3 modals not
  `<Teleport>`ed. `cookies.vue` wall-clock date (hydration mismatch).

### P3
- Code-block colors hardcoded GitHub-dark (`prose.css`); `noscript`/`figure` allowlist edges;
  `'dev-secret-change-me'` fallback keyed on `NODE_ENV`; ConsoleEmailAdapter logs reset links
  in prod fallback; CSP `unsafe-inline` (nonce migration); dead scripts (`db-push.mjs`,
  `migrate-blog-to-article.sql`); dead `tools/worker` (incoherent `@commonpub/schema ^0.13`
  pin); `apps/shell` config divergence; CLI `template.rs:40` stale doc-comment (pins current).

---

## Verified CLEAN (do not re-raise)
SQL injection (all bind-param; the two `sql.raw` use an FTS-lang allowlist); mass-assignment
(all spreads are post-Zod allowlists); rate-limit coverage (global tiered middleware on all
non-static routes); IDOR on the main mutation surface (owner/role-scoped); session controls
(httpOnly+secure+sameSite-lax+`__Secure-` prefix, single-use CSPRNG tokens, no fixation);
outbox visibility gating + deterministic ids + loop prevention; DM classification (no timeline
leak); no missing-`where` on any UPDATE/DELETE; `listLayouts` N+1 fixed; the 203 transaction/
counter/sanitizer/uuid-guard fixes verified correct (except the Undo asymmetry fixed above).

---

## Round 3 (same day) — backlog REMEDIATED + discovery audit of under-covered domains

A third pass audited the domains rounds 1–2 covered least (messaging/events/videos/products/
learning/explainer/docs/theme-studio/apps) and then **fixed the entire verified backlog above**
plus the new discovery findings. Full suite green throughout (33/33 tasks, ~5000 tests; build
16/16, typecheck 28/28). Migration **0027** added (additive: `processed_activities` +
`digest_runs` tables, composite hot-read indexes; validated on real Postgres).

**Discovery audit verdicts:** messaging, learning, theme-studio, and search/FTS = CLEAN
(verified — DM participant checks, server-side quiz grading, theme CSS sink guards, allowlist
tsquery). New P1s found + fixed (below).

**FIXED this round (committed on `audit-203-fixes`):**
- **Security/leaks (P0/P1):** product create-in-any-hub IDOR (membership now enforced in
  `createProduct`); explainer export XSS (denylist → shared allowlist sanitizer + heading
  clamp); docs draft/archived pages world-readable (public reads now `publishedOnly`, editor
  keeps drafts); event draft/cancelled readable by slug + attendee-roster leak (gated to
  creator/admin); inbox replay dedup (`processed_activities`); CSRF origin-check middleware
  for cookie-auth `/api/*`; constant-time admin-secret compare; private-hub-metadata redaction
  for non-members; hub vote/poll membership+ban enforcement.
- **Data integrity:** `createContentVersion` `FOR UPDATE` (no dup versions); transactions for
  `forkContent`/`enroll`/`unenroll`/`deletePost`/`advanceContestStage`/`transitionContestStatus`;
  delivery follower N+1 → one batched `inArray`; `syncContentProducts` FK-safe filtering;
  `createEvent`/`createVideoCategory` slug de-dup (was a 500); product delete owner-or-moderator.
- **Perf:** hot-read composite indexes (migration 0027); page-1 COUNT gating; remaining ~9
  pagination tiebreakers.
- **Ops:** atomic cross-replica claims for the digest + hub-sync workers (`digest_runs` +
  compare-and-claim).
- **Frontend/a11y:** editor route-leave guards; surfaced upload errors; `role=radiogroup`/
  `role=menu` fixes + dialog names; undefined `--accent-contrast`/`--accent-text` → `--color-on-accent`;
  stable `v-for` keys; block-image prose leak; modal `<Teleport>`; cookies.vue hydration date.

**STILL DEFERRED (need a product decision / larger effort, documented for follow-up):**
global SSRF-pinned dispatcher (megalodon/axios bypass the per-call safe-fetch; flag-gated paths);
search `pg_trgm` GIN index (extension/ops decision); `/api/content` main feed → keyset; the big
structural refactors from 203 (field-cascade DRY, homepage 3-path consolidation, content-view
dedup, monolith file splits); shell `db:push` footgun + shell env-flag map; user-block model.

---

## Round 4 — Test-quality / mutation-testing pass

The earlier rounds proved the fixes by *reading* the code; this pass proves them by **test**:
for each fix, a test must go RED when the fix is reverted (mutation testing) — otherwise the
"passing" test is hollow. Audit of the existing suite found many fixes had **no proving test**
(they only "passed CI" because nothing exercised them): the content-ap visibility P0, products
IDOR, hub-vote ban, hub-metadata redaction, docs/event draft gating, CSRF, inbox dedup,
`isValidHost`, `toggleFederatedHubPostLike`, etc.

**Added 48 proving tests** (server 1388→1410, layer 1043→1069; full suite 33/33), each
exercising the REAL path (PGlite + real server fns / real route+middleware handlers / component
render — no tautological mocks) and **each mutation-verified** (revert the fix → RED → restore →
GREEN). Mutation evidence captured per fix, e.g.:
- content-ap P0: drop `visibility='public'` → middleware returns a full Article for a private item
  (`expected {…} to be undefined`).
- products IDOR: drop membership check → `createProduct` resolves instead of rejecting.
- private-hub redaction: drop branch → `expected 'Members-only description' to be null`.
- docs publishedOnly: drop filter → `expected [...] not to include 'Draft Guide'`.
- CSRF: drop origin throw → cross-origin cookie POST returns null instead of 403.
- `isValidHost`: drop `isPrivateUrl` → `isValidHost('169.254.169.254')` true instead of false.
- `remoteLikeCount`: drop the inbox increment → `expected 0 to be 1`.
- editor + protocol + normalizePagination: validated first-hand (no-op/denylist/`??`-NaN reverts
  all go red).

**Honestly NOT fully provable by a unit/integration test (documented, not faked):**
- `toggleFederatedHubPostLike` / `createContentVersion` / `enroll` **concurrency** gates — PGlite
  uses one serialized connection, so a true concurrent double-call can't be reproduced; the
  deterministic part (clamped/gated counter, sequential versions) is tested, the race is
  reasoned-only. A real-Postgres concurrency harness would be needed to prove the race.
- inbox-dedup **route wiring** is invoked from the reference-app layer (not unit-invocable from
  the server package); `recordActivitySeen`'s true-then-false contract is proven at the DB level
  and the wiring is grep-verified at the 4 call sites.
- inbox **SSRF** (the pinned `createSafeActorFetchFn`) — proving DNS-rebind blocking needs network
  control; the call-site swap is verified by code, and `isValidHost` (the Mastodon path) IS tested.
- migration 0027 + the reconcile recompute — validated against real Postgres (rolled-back tx),
  not via the PGlite suite (which uses `pushSchema`, not the migration files).
- multi-replica digest/hub-sync claims, deploy `pipefail` — environmental (N processes / CI YAML);
  the claim logic is reasoned, not unit-tested.

Net: every security/correctness fix with a deterministic, observable behavior now has a test that
provably fails without the fix; the residual unprovable items are concurrency/network/CI-env and
are explicitly listed rather than papered over with green-but-hollow tests.

---

## Round 5 — close the "unprovable" gaps elegantly (real-Postgres harness)

The round-4 residual gaps shared one root cause: PGlite is a single serialized connection, so
concurrency/claim races are no-ops there, and the suite never exercised migrations. The elegant
fix is the right harness, not more mocks: **`packages/server/src/__tests__/helpers/realpgdb.ts`** —
a multi-connection `pg.Pool` against a throwaway database, populated by **running the committed
migrations** (so it also proves the 0000→0027 chain end-to-end). Gated by `realPgReachable()`:
skips in PGlite-only envs, runs locally (docker :5433) and in any CI with a Postgres service.
(`pg` added as a server devDep.)

`concurrency.integration.test.ts` (5 tests) — **mutation-verified**:
- `createContentVersion` FOR UPDATE lock: 10 concurrent creates → 10 distinct versions; with the
  lock removed → duplicates (observed 3/10 distinct). *This is the proof PGlite could never give.*
- gated counters (`enroll`/`toggleFederatedHubPostLike`): counter == actual rows under 10-way
  concurrency (the `enroll` early-idempotent-return is itself a mitigation that narrows its race —
  noted, not claimed as mutation-caught).
- `digest_runs` atomic claim: 5 concurrent claims → exactly one winner (multi-replica safety).
- migration chain: 0026/0027 artifacts (`processed_activities`, `digest_runs`, `remote_like_count`)
  present after migrate().
`safeActorFetch.test.ts` — `createSafeActorFetchFn` (the inbox's SSRF-safe fetch) rejects
private/loopback/metadata targets.

Also closed (small, safe): **shell** `db:push`→`db:migrate` footgun + `events`/`contentImport`
added to its env-flag map. Full suite green 33/33 (server 1420, layer 1069).

---

## Round 6 — last raw-fetch SSRF closed; global-dispatcher rejected on audit

Audited the "global SSRF dispatcher" idea and **rejected it**: a global private-IP-blocking
undici dispatcher would break legit internal-URL services (e.g. Meilisearch at
`http://meilisearch:7700`) AND wouldn't affect megalodon (axios, not undici) — so it's both
risky and ineffective. The correct fix is per-call safe-fetch, now extended to the **last
uncovered raw-fetch SSRF**: the federated-login route's WebFinger discovery + dynamic-client
registration POST (a trusted domain could otherwise redirect the registration to an internal
address) now use `createSafeActorFetchFn`. Also fixed a parallel-load flake in the 3 DB-backed
layer route tests (30s setup timeout; verified stable over repeated full runs) and the shell
footguns (round 5). Full suite green 33/33.

**STILL genuinely deferred (each its own PR; not bundled):** `pg_trgm` search GIN index (PGlite
can't create it → schema-vs-migration drift; needs an ops/extension decision); megalodon
DNS-rebind residual (needs an axios-transport guard; flag-gated off in prod); `/api/content` →
keyset feed; the 203 structural refactors (field-cascade DRY, homepage 3-path consolidation,
content-view dedup, monolith splits); user-block model (a feature, not a fix).

---

## Round 7 — structural backlog worked down

Continued the backlog on-branch. Done + green (full suite 33/33):
- **field-cascade DRY** (#1 architectural finding): `createContent`/`updateContent` now share one
  compile-checked `CONTENT_PASSTHROUGH_FIELDS` list, so a new field can't be wired into one path
  and dropped from the other (the 199/200 silent-field-drop class). Special-cased fields stay explicit.
- **validators.ts monolith split** into `validators/<domain>.ts` + barrel + back-compat shim;
  export parity verified IDENTICAL (121 const / 104 type / 1 fn), no cycles.
- **inboxHandlers dedup**: `UUID_RE`(×5)/hub-URI/Announce-lookup extracted to `inboxParsing.ts`.
- **megalodon DNS-rebind SSRF**: `assertPublicHost` (DNS-resolve + `isPrivateIp`, fail-closed) at
  all 3 user-host entry points; mutation-verified; TOCTOU residual documented.
- **Flake fixes**: editor 2k-node parse test + server `testTimeout` 15s→30s (DB-heavy suite under
  the new real-PG concurrency load).

Corrected / re-classified:
- **`/api/content` → keyset is ALREADY DONE** (not a gap): `useContentFeed.ts` transparently routes
  recency feeds to `/api/content/feed` (keyset) and keeps offset `/api/content` only for
  `popular`/`featured`/`editorial` — sorts whose keys mutate mid-scroll and genuinely can't keyset.
- **pg_trgm search index — attempted then REVERTED**: the index/migration/harness wiring works in
  the *server* vitest env, but the `@electric-sql/pglite/contrib/pg_trgm` extension fails to load
  in the *layer* vitest runtime (`a.arrayBuffer is not a function`) — the shared PGlite testdb
  helper isn't portable across both. Reverted (it was breaking 3 layer tests). Still an ops item:
  needs a portable extension-load (or prod-only raw migration + a drift exception).

**TRUE remainder (each needs its own effort — NOT bundled, by design):**
- **content-view dedup** — in progress this round, done TEST-FIRST (add view smoke tests, then
  extract `ContentAvatar` moving its scoped CSS; the views had zero tests + this is the scoped-CSS-
  extraction trap, so a safety net is mandatory).
- **homepage 3-path consolidation** — requires a 2-phase coordinated deploy: seed a default layout
  on all 3 instances FIRST, then remove the legacy hardcoded `index.vue` fallback. Removing the
  fallback without the seed = blank homepages. Not a safe single-branch change.
- **user-block model** — a net-new feature (table + block/unblock API + enforcement + UI), not
  audit remediation. Request it as a feature with the UX decisions.
- **monolith file splits** beyond validators/inbox (docs `[siteSlug]/edit.vue` own autosave,
  ProjectView size) — maintainability refactors for their own PRs.
