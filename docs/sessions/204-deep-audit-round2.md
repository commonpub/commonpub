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
