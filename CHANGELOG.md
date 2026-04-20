# Changelog

All notable changes to CommonPub are documented here.

Per-package versions move independently; the entries below are grouped by
monorepo working period. For session-level detail, see [`docs/sessions/`](./docs/sessions/).

---

## Unreleased (sessions 108–134, through 2026-04-19)

Monorepo state at time of writing: schema 0.14.4, server 2.47.4, config 0.11.0,
layer 0.18.3, ui 0.8.5, protocol 0.9.9, editor 0.7.9, explainer 0.7.12,
learning 0.5.2, docs 0.6.2, auth 0.5.1, infra 0.6.2, test-utils 0.5.3.

### Session 134 — Mobile responsive on /videos index + detail + npm release (2026-04-19)

**Published to npm:** `@commonpub/infra@0.6.2`, `@commonpub/server@2.47.4`,
`@commonpub/layer@0.18.3`. Cleans up the session-133 carryover where
infra + server's workspace source held uncommitted additive changes
(new `createStructuredLogger` export + wiring) at unchanged version
numbers. All three bumps are additive-only — no removed exports, no
API changes. `deveco-io` pins `@commonpub/layer@^0.18.1` and will
pick up 0.18.3 (with the mobile CSS) on next install; nothing else
changes for external consumers beyond the new symbol availability.



**Continues the session 133 mobile audit with the next two highest-impact
pages (per the 133 handoff's candidate list — 127 + 123 scoped CSS lines
with zero `@media` queries).**

- **`pages/videos/index.vue`**: single `@media (max-width: 768px)` block.
  The load-bearing fix is collapsing `.cpub-main-grid`'s hard
  `grid-template-columns: 1fr 300px` to `1fr` on mobile — at 375px the
  old layout gave the content column ~17px (gap + 300px sidebar ate
  the viewport). Also: `.cpub-video-grid` 2-col → 1-col, hero padding
  `32px 32px` → `24px 16px`, title 28px → 22px, hero row flex-wrap so
  title + Beta tag stack cleanly, filter-bar + page-wrap 32px → 16px
  horizontal padding.

- **`pages/videos/[id].vue`**: single `@media` block. Primary fix is
  `.cpub-video-meta { flex-wrap: wrap; row-gap: 6px }` — 4 meta items
  × 16px gap overflowed 375px. Also: title 20px → 18px, info padding
  20px → 16px, player margin-bottom 20px → 16px.

- **`apps/reference/e2e/responsive.spec.ts`**: new `Videos page
  responsive` describe block with two tests mirroring the session 133
  `/learn` pattern — desktop 1280 sidebar-to-right-of-grid, mobile 375
  sidebar-stacked-below and hero width ≤ viewport. Both use
  `{ waitUntil: 'networkidle' }` for hydration safety.

- **Deferred local verification**: port 3000 was occupied by a
  different project at session time, so Playwright's dev server
  couldn't start locally. Typecheck + reference unit suite (82/82)
  green. Selectors were verified by reading the template at the
  known-good state; each (`.cpub-video-hero`, `.cpub-main-grid`,
  `.cpub-videos .cpub-sidebar`) exists in the file. CI will run the
  responsive suite end-to-end against a clean dev server.

- `@commonpub/layer` bumped `0.18.2` → `0.18.3`. `deveco-io` pins
  `^0.18.1`, so it picks this up on its next install without a
  coordinated release.

### Session 133 — Quiz UI rebuild + hero-banner fix + Redis flip + observability + /learn mobile + CI trace artifacts (2026-04-19)

**Observability, cleanup, and mobile — closes items #4, #5, #6
(partial):**

- **audittest user cleanup (#5):** Claude-self-flagged user from
  session 127 deleted cleanly. 1 account + 1 session + user row in a
  single transaction; zero FK references elsewhere to worry about.

- **Redis fail-open → structured JSON logs (#4):**
  `@commonpub/infra` now exports
  `createStructuredLogger({ component, level?, write? })` which emits
  one JSON line per event to stdout (Docker-default log stream,
  parseable by any aggregator without regex). Falls back to
  console.warn on circular meta. 5 new unit tests. Wired into
  `apiKeyRateLimit` (workspace-resolved inside server) and inlined for
  the layer's IP rate limiter (to avoid a cross-package publish cycle
  — layer is npm-pinned in the reference app and re-exporting
  createStructuredLogger through server would require coordinated
  bumps). Event shape identical in both call sites; a comment in
  security.ts points at the infra helper.

- **Mobile breakpoint on /learn index (#6 — partial):** Pre-133 had
  155 lines of scoped CSS and 0 @media queries. On 375px the
  fixed-width 240px sidebar forced content into a ~135px column,
  crushing path cards + my-path rows. Added
  `@media (max-width: 768px)` that stacks the sidebar below content,
  shrinks outer padding, and flex-columns the path + my-path rows.
  Two new Playwright tests in `responsive.spec.ts` verify desktop
  side-by-side + mobile stacked layouts. This is ONE page; the audit
  of other candidates (videos, admin, docs edit, federation profile)
  is a follow-up — each atomic but many.



**Redis flipped on prod** (late-session bonus, closes open-item #1):

- commonpub.io: synced droplet compose to repo (picked up the
  `--requirepass` flag that never shipped to the droplet despite being
  in the repo since session 131). Generated hex password; added
  `REDIS_PASSWORD` + `NUXT_REDIS_URL=redis://:<hex>@redis:6379` to the
  droplet's `.env` (literal, since `env_file` doesn't interpolate).
  Recreated redis + app. 8 `cpub:ratelimit:*` keys live, fail-open
  count = 1 (the expected ioredis startup-race on the app recreate;
  no ongoing fail-opens).
- deveco.io: already wired by a prior session — `NUXT_REDIS_URL=redis://redis:6379`
  (no auth; relies on `expose: 6379` container-network isolation). 6
  live keys, zero fail-opens in the last 10 minutes. MEMORY.md's
  "unset on both" claim was outdated.
- Caught compose-file drift: the deploy workflow only ships the image
  tarball, not `docker-compose.prod.yml`. Any compose changes in the
  repo are no-ops for running instances until manually synced. Flagged
  in the session log as a follow-up.

See `docs/sessions/133-redis-flip.md` for the full operational
writeup + rollback procedure.



Late-session addition: closed open-item #2 (hero-banner dismiss flake)
as well. Root cause was test-side: the hero-banner test called
`page.goto('/')` without a hydration beacon, while its passing
siblings in the same file pass `{ waitUntil: 'networkidle' }`. Clicks
racing Nuxt hydration landed on un-listener'd DOM. Matched the sibling
pattern, converted "1 flaky" → clean pass. Sessions 131 (useState
persistence) + 132 (explicit handler) + 133's test fix together are
the full story.

Also shipped Playwright trace-artifact upload in CI
(`.github/workflows/ci.yml` e2e job): `playwright-report/` +
`test-results/` uploaded with 14-day retention on any non-cancelled
completion (including flaky passes, which `if: failure()` would have
silently dropped). Future e2e flakes will land with a downloadable
trace.zip instead of evaporating with the runner.

Quiz UI rebuild (the session's primary goal):



Finishes the server-side quiz grading thread from session 129. The learn-lesson
Vue pages had lagged behind the new API: the editor emitted a legacy
`{correctIndex, options: string[]}` shape and the viewer graded locally against
the (now-redacted) `correctOptionId`. First author to ship a real quiz would
have gotten a 400.

**`@commonpub/learning` 0.5.2:**
- `QuizGrade` now carries `results: QuizQuestionResult[]` — per-question
  breakdown with `{ questionId, selectedOptionId, correctOptionId, correct,
  explanation? }` in content order. Unanswered questions report
  `selectedOptionId: null`. Aggregate fields (`correct`, `total`, `score`,
  `passed`) unchanged. Additive — no caller of `gradeQuiz` breaks.
- 4 new unit tests for `results` (order, selected vs. correct, unanswered
  nulls, explanation passthrough only when present).

**`@commonpub/server` 2.47.3:**
- `markLessonComplete` returns `quiz.results` (flows through from
  `gradeQuiz`). Integration test asserts per-question results on a 2-question
  pass.

**`@commonpub/layer` 0.18.2 — Vue UI rebuild:**
- **Editor** (`pages/learn/[slug]/[lessonSlug]/edit.vue`): canonical
  `{type, passingScore, questions:[{id, options:[{id,text}], correctOptionId}]}`
  on save. New "Passing Score %" field. Legacy migration on load: numeric
  `correctIndex` + string options get ids auto-assigned and `correctOptionId`
  derived from the former index. Option removal reassigns `correctOptionId`
  if the deleted option was the correct one.
- **Viewer** (`pages/learn/[slug]/[lessonSlug]/index.vue`): draft-answer model
  — pick freely, "Submit Quiz" posts all answers at once. After grading:
  per-question correct/wrong indicators + explanations (from server `results`),
  aggregate score card with pass/fail styling, "Try Again" clears state on
  fail. Mark-complete footer button hidden for quiz lessons (Submit Quiz is
  the completion path). Unauthed users see a "sign in to submit" hint.

### Session 132 — Hero banner punt + session 131 docs correction (2026-04-18→19)

Short follow-up to 131. The hero-banner dismiss e2e spec needed a
second repair attempt (explicit `dismissHero()` handler to sidestep Vue
template auto-unwrap-on-write ambiguity); landed fine but CI still saw
the banner visible after the click. Marked `test.fixme` with notes on
both theories tried so a future session can start from a Playwright
trace. Session 131 log + handoff + CHANGELOG + MEMORY.md corrected to
reflect **3/4 flakes closed** instead of 4/4. No package republishes.

### Session 131 — DB constraints + CI flakes + Redis observability (2026-04-18)

**Data integrity — migration 0002:**
- UNIQUE `(event_id, user_id)` on `event_attendees`. `rsvpEvent` uses
  `ON CONFLICT DO NOTHING + .returning()` so double-click races resolve
  to "already registered" instead of a 500.
- FK on `federated_content.mirror_id` → `instance_mirrors(id)` with
  `ON DELETE SET NULL`. Orphan-cleanup UPDATE runs before the ALTER
  (commonpub.io: 3 orphans nulled; deveco.io: 0).

**Redis observability:**
- New `createRedisFailOpenLogger({ scope })` in `@commonpub/infra`.
  Rate-limited: first event in a window logs immediately, subsequent
  events roll up into a 60s summary. Wired at both the IP middleware
  and per-API-key limiter with `ratelimit:ip` / `ratelimit:apikey`
  scope prefixes.
- Fix: Redis pub/sub subscriber's `enableOfflineQueue: false` inherited
  from the publisher was silently dropping SUBSCRIBE during reconnects.
  Factory now duplicates with `enableOfflineQueue: true,
  maxRetriesPerRequest: null` for the subscriber.

**CI:**
- Redis sidecar (`redis:7-alpine`) added to the check job with
  `REDIS_URL_TEST=redis://localhost:6379`. Turbo 2.x's env-strict mode
  meant the var never reached vitest workers; fixed by declaring
  `env: [..., "REDIS_URL_TEST", ...]` on the test task in `turbo.json`.
  Integration suite now runs (4 tests, ~2s) on every PR against real
  Redis.
- Three long-standing e2e flakes fixed: `/contests` console errors
  (feature flags enabled in e2e env + filter known-benign CSP +
  H3Error strings), register form input + advanced filters toggle
  (hydration races — wait for networkidle + "enabled" beacon). The
  hero-banner dismiss spec is marked `test.fixme` after two failed
  repair attempts (useState for remount-persistence + explicit
  dismissHero() handler both landed but still didn't stick in CI);
  dismiss works in local dev, no user-facing bug.

**Docs FTS:**
- Search dropdown in `pages/docs/[siteSlug]/index.vue` +
  `[...pagePath].vue` now renders the `ts_headline` snippet below the
  title with match tokens bolded. New `layers/base/utils/highlightSnippet.ts`
  escapes all HTML then restores only bare `<b>`/`</b>`. 7 unit tests
  covering the XSS defense matrix.

### Session 130 — Redis integration for horizontal scaling (2026-04-17)

**Rate-limit store abstraction:**
- New `RateLimitStore` interface in `@commonpub/infra`; `MemoryRateLimitStore`
  is the default in-process implementation. `RedisRateLimitStore` is the
  new Redis-backed implementation using atomic `INCR` + `PEXPIRE NX`.
- `createRateLimitStore({ redisUrl })` factory picks memory vs Redis from
  `NUXT_REDIS_URL`. Unset → memory (byte-identical to pre-0.6.0). Lazy
  initialization so no top-level await leaks into consumers.
- Fail-open: if Redis is unreachable mid-request, the limiter returns
  `allowed: true` and surfaces the fallback via `onRedisError`. Rate limits
  must not become a liveness hazard.

**Public-API key limiter:**
- `ApiKeyRateLimit` (`packages/server/src/publicApi/rateLimit.ts`) now
  wraps a `RateLimitStore` and defaults to the Redis-or-memory factory.
  Two Nitro processes sharing Redis enforce the same per-key window.
- `check()` is now async; the Nitro middleware awaits it.

**SSE pub/sub:**
- New `RealtimePubSub` abstraction in `@commonpub/infra` with
  `MemoryRealtimePubSub` (EventEmitter, single-process) and
  `RedisRealtimePubSub` (Redis pub/sub, cross-process) backends.
- `@commonpub/server` exposes `publishSseEvent(userId, payload)` and
  `subscribeSseEvents(userId, handler)`. `createNotification` and
  `sendMessage` fire-and-forget publish; the SSE stream subscribes once
  per connection.
- `/api/realtime/stream` now reacts to pub/sub events instead of
  exclusively polling. Polling is retained at 30 s as a safety net for
  missed publishes.

**Breaking (type-level):**
- `checkRateLimit()` is now `async`. Callers that don't `await` will see
  `Promise<{ result, headers }>` instead of the object directly.
- `RateLimitStore.check()` returns a Promise. The class export
  `new RateLimitStore()` is preserved as an alias for
  `MemoryRateLimitStore`, so `new RateLimitStore()` still works at
  runtime; direct callers of `.check()` must `await`.

**Deployment:**
- Redis is opt-in via `NUXT_REDIS_URL`. Deploys are byte-identical while
  the env var is unset. Production compose (`deploy/docker-compose.prod.yml`)
  already runs Redis; flip the env to enable after this release lands.

### Session 129 — Quiz security + docs FTS + jsonb fix (2026-04-17)

**Security — learning paths:**
- `POST /api/learn/:slug/:lessonSlug/complete` no longer accepts client-supplied
  `quizScore` / `quizPassed`. Quiz lessons now take `{answers: {questionId: optionId}}`
  and the server grades against `correctOptionId` via new `gradeQuiz()` in
  `@commonpub/learning`.
- `GET /api/learn/:slug/:lessonSlug` now strips `correctOptionId` and
  `explanation` from quiz questions for non-authors via new `redactQuizAnswers()`.
- Passed lessons latch — a subsequent failing attempt never regresses progress.

**Docs FTS — snippets over block text:**
- `searchDocsPages` rewritten as a `LEFT JOIN LATERAL` that extracts block
  text (html/text/code/title with HTML tags stripped) and feeds clean prose
  to `to_tsvector` and `ts_headline`. No more raw JSON in search snippets.

**Root-cause bug fix — `docs_pages.content` double-stringification:**
- `createDocsPage` / `updateDocsPage` was `JSON.stringify`-ing content before
  handing to drizzle, which also stringifies jsonb. Content landed in the DB
  as a jsonb STRING containing the JSON text of a BlockTuple array. The app
  worked via drizzle's read-time double-parse, but SQL couldn't reach blocks.
- Fix: pass content through directly.
- Migration `0001_docs_content_unstringify.sql` unwraps existing rows whose
  value looks like JSON (starts with `[` or `{`). Legacy plain-markdown
  strings are left alone.

**Published:** `@commonpub/schema@0.14.3`, `@commonpub/server@2.46.1`,
`@commonpub/learning@0.5.1`. Consumer pins bumped across workspace + deveco.

**Tests:** +26 (15 quiz unit + 7 validator + 4 integration for quiz lifecycle;
7 integration for docs search). 912 server tests + 97 learning tests green.

**Known gap:** Vue quiz UI (`pages/learn/[slug]/[lessonSlug]/index.vue`) sends
no answers body. For non-quiz lessons this is fine; for quiz lessons it now
returns 400. Zero quiz lessons exist in prod today. Rebuild needed before
anyone ships a real quiz — the Vue uses a non-canonical `correctIndex`
shape that predates the schema.

### Session 128 — Docs unblock + migrate workflow + schema drift cleanup (2026-04-17)

**User-reported bug fixed — "can't add pages" on docs:**
- `docs_pages` on commonpub.io was missing `sidebar_label` and `description`
  columns (added in schema commit `7bffcef`, Apr 13). Every endpoint using
  `db.select().from(docsPages)` or `.returning()` expanded to SELECT-star and
  500'd on both list and write paths. Fixed by applying the missing columns
  via SQL and verified end-to-end.

**Root cause — CI deploy was silently dropping schema changes for weeks:**
- `drizzle-kit push` (invoked by `scripts/db-push.mjs`) blocked on an
  interactive prompt because `instance_mirrors` had a unique-constraint name
  mismatch (PG default `_key` vs drizzle's `_unique`) and a populated table.
  CI has no TTY → `pgSuggestions` throws before any DDL is applied. Every
  deploy since Mar 29 silently skipped all queued schema changes.

**Systemic fix — switched to committed migrations:**
- New `packages/schema/migrations/0000_session128_baseline.sql` captures the
  full current schema (79 tables, 41 enums, 112 FKs, 54 unique constraints,
  114 indexes explicit + backing indexes).
- `scripts/db-migrate.mjs` now calls `drizzle-orm/node-postgres/migrator.migrate()`
  directly (NOT `drizzle-kit migrate` — its CLI spinner exits non-zero on
  success and swallows error output). Deploys fail hard on migration errors.
- Both production DBs pre-seeded with `drizzle.__drizzle_migrations` containing
  the baseline as applied, so the first post-switch deploy was a verified no-op.
- `@commonpub/schema` 0.14.2 publishes `migrations/` in `files`; deveco consumes
  it from npm; both Dockerfiles copy the migration folder into the runtime.
- GitHub Actions deploy workflows on both repos now call `db-migrate.mjs`.

**Schema drift audit + cleanup on deveco:**
- 40 FK constraints renamed from PG default `_fkey` to drizzle's `_fk` form.
- 3 missing enum values added: `comment_target_type.video`,
  `contest_status.cancelled`, `like_target_type.video`.
- 10 missing performance indexes created (`idx_bookmarks_user_id`,
  `idx_fedcontent_*`, `idx_files_hub_id`, `idx_hub_followers_fed_hub`,
  `idx_hub_post_likes_user_id`, `idx_lesson_progress_user_id`).
- `hub_followers_fed.status` converted from varchar to `follow_relationship_status` enum.
- Extra constraints dropped (`content_items_slug_unique`, `idx_fedhubposts_object_uri`).
- Post-audit both DBs byte-for-byte equivalent in columns/enums/indexes/FK semantics.

**Learn audit (findings deferred):**
- `POST /api/learn/:slug/:lessonSlug/complete` accepts `quizScore`/`quizPassed`
  from the client body without server-side grading — certificate-gaming vector.
- `GET /api/learn/:slug/:lessonSlug` returns lesson content verbatim, leaking
  `correctOptionId` for quiz questions.
- Both tracked as P2 for a dedicated security fix.

**Docs overhauled** to reflect the migrate workflow:
- `docs/llm/{gotchas,facts,task-recipes}.md`, `docs/{quickstart,building-with-commonpub,deployment}.md`,
  `docs/guides/developers.md`, `codebase-analysis/{01,02,06,09}.md` all updated.
- Session log at `docs/sessions/128-docs-and-learn-audit.md` (includes deep-audit follow-up).

**Packages:** `@commonpub/schema@0.14.2` (adds migrations/ to npm tarball).

### Session 127 — Deep audit + Public Read API (2026-04-17)

**Security (critical):**
- `/api/content` and `/api/learn` no longer leak drafts to anonymous callers
  when `?status=draft` is passed. Non-owner status values are whitelisted to
  `{published, archived}`, same pattern as the session-125 `/api/events` fix.
- Stored-XSS in `@commonpub/explainer` `clickable-cards` and `toggle` Viewer
  components patched — both now call `sanitizeHtml()` at render.

**Correctness — 204/500 fixes on refresh:**
- `/hubs/:slug` and `/hubs/:slug/posts/:postId` no longer return HTTP 204
  (Nitro `server/routes/*.ts` returning undefined sends 204, not a
  fall-through — both moved to `server/middleware/`).
- `/content/:slug` now 301-redirects browsers to canonical
  `/u/:author/:type/:slug`; AP peers still get Article JSON-LD.
- `/@username` (WebFinger profile URL) now 301-redirects to `/u/:user` or
  `/hubs/:slug` instead of rendering a broken catchall.
- `pages/[type]/index.vue` catchall now 404s on paths that aren't enabled
  content types (`/foo`, `/wp-admin`, `/_nitro`, `/.env`).
- AP GET `/hubs/:slug/posts/:postId` with non-UUID postId returns 404, not
  500.

**Added — Public Read API v1 (`features.publicApi`, default OFF):**
- Admin-provisioned Bearer-token API at `/api/public/v1/*`. Deploying this
  code changes nothing on running instances until an admin opts in.
- Schema: `api_keys` + `api_key_usage` tables. Prefix 24 chars (11 random)
  for astronomically-unlikely collisions; auth loop still iterates prefix
  matches defensively.
- 13 read-only scopes plus `read:*` wildcard.
- **Phase 1 endpoints**: content list/detail, hubs list/detail, users
  list/detail, instance metadata.
- **Phase 2 endpoints**: learn + /:slug, events + /:slug, contests + /:slug,
  videos + /:id, docs + /:slug, tags, search, openapi.json. Feature-gated
  endpoints 404 when the underlying feature is disabled on the instance.
- `PublicContentSummary` carries `source` (`'local'` | `'federated'`),
  `sourceDomain`, and `sourceUri` so consumers can distinguish mirrored
  content and dereference the authoritative URL.
- OpenAPI 3.1 spec served at `GET /api/public/v1/openapi.json`.
- Per-key usage analytics endpoint `GET /api/admin/api-keys/:id/usage`
  returning counts, error rate, requests-by-day, top endpoints with p95
  latency — rendered inline under the admin key table.
- Admin UI at `/admin/api-keys`: one-time token reveal with clipboard copy,
  scope checklist, per-key rate limit, optional CORS allow-list, usage
  panel.
- Safety: allow-list serializers — every response field is explicitly named,
  new DB columns excluded until someone edits the `to*` helper. 39 tests
  including a constructed prefix-collision scenario and PII-leak guards
  for every phase-1 and phase-2 shape.
- See [`docs/public-api.md`](./docs/public-api.md) for the reference.

**New gotchas documented** (`codebase-analysis/09-gotchas-and-invariants.md`
+ `docs/llm/gotchas.md`):
- Nitro `server/routes/*.ts` returning `undefined` sends HTTP 204, not
  fall-through — use `server/middleware/` for content-negotiated paths
  that share a URL with a Nuxt page.
- Public API serializers are ALLOW-lists. Never spread rows into responses;
  integration tests assert known-private field names never appear.
- Every `v-html` in `@commonpub/explainer` must wrap with `sanitizeHtml()`
  at the render site.

## Previously tracked (sessions 108–125, through 2026-04-16)

Monorepo state at end of session 125: schema 0.13.0, server 2.43.0, config 0.10.0,
layer 0.15.2, ui 0.8.5, protocol 0.9.9, editor 0.7.9, explainer 0.7.11,
learning 0.5.0, docs 0.6.2, auth 0.5.1, infra 0.5.1, test-utils 0.5.3.

### Added — Major features

- **Events system** (session 124–125) — events + eventAttendees tables, RSVP
  with auto-waitlist, capacity limits, status/type/attendee enums, 8 API
  routes, EventCard + EventCalendar components, `/events/**` pages with
  pagination and filters (upcoming/featured/past/mine). Gated by `events`
  feature flag (default OFF).
- **Voting system** (session 124) — hubPostVotes (up/down), pollOptions,
  pollVotes, contestEntryVotes tables. voteDirectionEnum. Denormalized
  `voteScore` on hubPosts. PostVoteButtons + PollDisplay components. Toggle
  and flip logic with transaction-safe score adjustment.
- **Contest judge permissions** (session 124) — contestJudges junction table
  with role enum (lead/judge/guest), invite/accept workflow. judgingVisibility
  enum (public/judges-only/private) on contests. `communityVotingEnabled` flag
  on contests. ContestJudgeManager component. 4 judges API routes.
- **Admin-configurable nav** (session 124) — instanceSettings-backed nav
  items (link/dropdown/external) with feature gates, role visibility.
  NavRenderer, NavDropdown, MobileNavRenderer, NavLink components.
  `/admin/navigation` page. Dropdowns auto-hide when all children are
  feature-gated out.
- **Configurable homepage** (session 123) — instanceSettings-backed homepage
  sections with drag-to-reorder, type-specific editors (hero, content grid,
  editorial, stats, contests, hubs, custom HTML). `/admin/homepage`.
- **Editorial curation** (session 123) — staff picks, editorial badges,
  homepage editorial section. `editorial` feature flag.
- **Hub resources** (session 122) — curated links per hub with categories,
  sort order. HubResources component.
- **Hub products** (session 122) — products scoped to hubs; federatedHubProducts
  for mirrored catalogs.
- **Contest system** (session 117) — contests, contestEntries with judging,
  prize management, 5-phase workflow.
- **Video social** (session 118) — videos with categories, comments, likes.
- **Password reset** (session 118) — full reset flow with email tokens.
- **Admin reports workflow** (session 118) — reports list, resolution,
  audit trail.
- **Comment threading** (session 113) — nested replies on content, hubs,
  federated content.
- **Article → Blog merge** (session 116) — `article` legacy-normalized to
  `blog` in contentTypeEnum.
- **Destination transformation** — 7-phase project across sessions 123–125
  combining quick-fixes, editorial, runtime flags, configurable homepage,
  nav, events, voting, judge permissions.

### Added — Federation

- **Hub federation (FEP-1b12)** — hubs act as AP Group actors; cross-instance
  membership and posting; `federateHubs` feature flag.
- **Seamless federation** (session 123) — `seamlessFederation` flag merges
  federated content into local browse/search/feed.
- **Content mirroring** — instanceMirrors with direction (pull/push),
  filterContentTypes, backfillCursor, circuit breaker per domain.
- **OAuth federation fixes** (session 121) — 3 CSRF/security bugs fixed in
  AP Actor SSO flow.
- **Signed backfill** (session 119) — outbox crawl now signs requests to
  protected outboxes.

### URL restructure (session 108)

- Canonical content URLs: `/u/{username}/{type}/{slug}`
- Legacy URL redirects via `content-redirect.ts`, `blog-redirect.ts` middleware

### Security

- **Session 119** — Group chat read receipts (`messageReads` table);
  signed backfill fetches for protected outboxes; email-disclosure fixes;
  admin input validation. (HTML sanitizer hardening + SSRF-protection
  extensions actually landed in the v0.2.0 release, not session 119 —
  earlier CHANGELOG rows referenced them as "session 119" in error.)
- **Session 121** — OAuth federation bug fixes, auth middleware fix,
  validation hardening (Zod on more routes), loading states; extracted
  `resolveIdentityToEmail` helper; Dockerfile non-root user + healthcheck
  for deveco-io.

### Testing & quality

- Session 120: test audit (−71 flaky, +49 new), architecture fixes, a11y
  improvements, loading states.
- Session 122: deep audit, hub resources/products, a11y polish, contest
  notifications — 16 outstanding v1.0 tasks completed.
- Session 125: events UI polish, contest voting UI with optimistic updates,
  error.vue SSR theme fix, API status whitelist hardening. 8/8 typecheck,
  30/30 focused tests, 865 tests in wider runs.

### Schema changes (enum additions)

- `judgeRoleEnum` (lead/judge/guest)
- `judgingVisibilityEnum` (public/judges-only/private)
- `voteDirectionEnum` (up/down)
- `eventStatusEnum` (draft/published/active/completed/cancelled)
- `eventTypeEnum` (in-person/online/hybrid)
- `eventAttendeeStatusEnum` (registered/waitlisted/cancelled/attended)
- `notificationTypeEnum` gained `event`

### Documentation overhaul (session 126)

- Added `codebase-analysis/` — 12-file exhaustive inventory (tables, routes,
  components, feature flags, state diagrams, gotchas).
- Added `docs/guides/users.md` and `docs/guides/developers.md`.
- Added `docs/llm/` — Claude Code / agent-facing context (facts,
  conventions, gotchas, task recipes).
- Archived 9 obsolete top-level docs to `docs/archive/`.
- Rewrote top-level README.

### Known deferred

- `federatedContent.mirrorId` has no DB-level FK (app-enforced only).
- ~70 layer components lack `@media` breakpoints — mobile polish outstanding.
- 3 skipped integration tests for PGlite incompatibility.
- `events` + `eventAttendees` lack Zod validators (gaps).

---

## v0.2.0 — Audit Repairs & Test Hardening (2026-03-23)

### Added
- Contest creation permissions: `contestCreation` config option ('open' | 'staff' | 'admin')
- `canCreateContest()` permission helper in `@commonpub/server`
- Admin & permissions documentation (`docs/reference/guides/admin-and-permissions.md`)
- Stryker mutation testing infrastructure with per-package configs
- 506 new tests (1,433 → 1,939) from mutation analysis
- Building with CommonPub guide (`docs/building-with-commonpub.md`)
- LLM contributor guide (`docs/llm-contributor-guide.md`)
- SSRF protection for all RFC private IP ranges, CGN, benchmarking, TEST-NET

### Fixed
- IPv6 SSRF protection: bracketed hostnames now correctly detected
- Test timeout stability across server, protocol, docs packages
- 37 TypeScript errors in UI test files
- 158 pre-existing type errors in reference app
- Unused editor dependencies removed (lowlight, code-block-lowlight, starter-kit)

### Security
- HTML sanitizer mutation score improved to 72% (58 surviving mutants remaining)
- SSRF boundary tests cover all private IP ranges + CGN + TEST-NET + IPv6

---

## v0.1.0 — Initial npm Release (2026-03-23)

### Added
- All 12 `@commonpub` packages published to npm under AGPL-3.0-or-later
- Full test suite: 1,433 tests across 12 packages
- 0 TypeScript errors, 0 lint errors across all packages
- Reference Nuxt 3 app with vue-tsc type checking
- `@tiptap/*` and `zod` dependencies declared in reference app

---

## Pre-release Development Phases

### Reference App UI Full Build (2026-03-11)

- Expanded `@commonpub/editor` from 6 to 19 block types: gallery, video, embed, markdown, divider, partsList, buildStep, toolList, downloads, quiz, interactiveSlider, checkpoint, mathNotation
- Created TipTap Node extensions for all 13 new blocks with full serialization round-trip
- Built `CpubEditor.vue` — Vue TipTap wrapper with BlockTuple bidirectional sync
- Built 3-pane editor UI: `EditorBlockLibrary` (left), `EditorToolbar` (center top), `EditorPropertiesPanel` (right)
- Block library filters by content type (project-only blocks, explainer-only interactive blocks)
- Properties panel with type-specific metadata (article SEO, project difficulty/cost, explainer objectives)
- Rewrote `pages/[type]/[slug]/edit.vue` with full-screen editor layout, Write/Preview/Code mode tabs
- Rewrote `pages/[type]/[slug].vue` with cover image, ContentTypeBadge, AuthorRow, EngagementBar, AuthorCard, related content grid
- Created reusable view components: ContentTypeBadge, AuthorRow, EngagementBar, AuthorCard, ContentCard
- Added `packages/ui/theme/prose.css` — comprehensive prose stylesheet matching unified-v2 mockups
- Rewrote homepage with personalized hero, trending projects grid, for-you feed
- Enhanced search page with filter chips, sort options, ContentCard grid
- Rewrote community detail page with hero banner, tabbed interface, post composer, sidebar
- Rewrote profile page with hero, stats bar, tabbed content, follow button
- Enhanced learning pages with difficulty filters, expandable curriculum, sidebar stats
- Created new pages: contests (browse + detail), video hub, notifications, messages (list + thread), settings/profile
- Enhanced admin dashboard with offset-shadow stat cards and quick actions
- Updated default layout with Contests, Videos nav items and notification/message icons
- All 69 editor tests passing, all 27 test suites green, full project builds successfully

### Repo Cleanup & Documentation Overhaul (2026-03-11)

- Restructure completion: all packages rebuilt as framework-agnostic TypeScript, reference app running on Nuxt 3
- Archived Svelte-era docs, research notes, and sessions 001–020 to `archive/`
- Rewrote README, CONTRIBUTING, coding standards for Vue 3 / Nuxt 3
- Added convenience scripts: `dev:infra`, `dev:app`, `db:push`
- Fixed `.env.example` ports to match `docker-compose.yml` (5433/6380/7701)
- Created `apps/reference/.env.example` for Nuxt runtimeConfig
- Added `docs/quickstart.md` with full clone-to-run instructions
- Expanded `docs/deployment.md` with 4 deployment options
- Updated all docs to remove stale SvelteKit references

### Token Debt, Admin Polish, Editor & Composer (2026-03-11)

- Fixed 32 non-contract tokens in `packages/ui/src/` (25 font-size→text, 7 surface-elevated→surface-alt/raised)
- Admin pages: replaced raw HTML inputs/buttons with `@commonpub/ui` Input, Textarea, Button components
- Added `name` prop to Input and Textarea components for form submission
- PostComposer: added share (content ID + comment) and poll (dynamic options, multi-select) post types
- Added `votePoll` form action with JSON-in-content poll storage
- Editor toolbar: added strikethrough, link editing (inline URL input), bullet/ordered lists
- Editor slash menu: added bullet list, numbered list, divider commands
- Serialization: added list, divider, strike support to BlockTuple ↔ ProseMirror round-trip

### CSS Token Contract Alignment (2026-03-11)

- Extended token contract with 8 new semantic tokens across all 5 themes (on-primary, on-accent, surface-hover, success/warning/error/info-bg, bg-subtle)
- Renamed ~852 non-contract token references across 73 reference app files to match contract (spacing, font-size, surface, font-weight)
- Zero remaining non-contract tokens in reference app; all themes at full parity

### QA Audit (2026-03-10)

- Fixed 23 TypeScript errors across reference app (parent() in actions, null safety, type mismatches)
- Fixed landing app build failure (missing favicon for prerender)
- Fixed `onContentLiked` missing userId argument
- Created ESLint 9 flat config (`eslint.config.js`), eliminated all lint errors
- Cleaned up 17 unused imports across reference app and auth package
- Applied Prettier formatting to 258 files, updated `.prettierignore`
- All 902 unit tests passing across 13 packages
- 0 typecheck errors, 0 lint errors, 0 format issues

### Phase 12: Polish & Launch

- Meilisearch-powered docs search with `SearchAdapter` interface and Postgres FTS fallback
- Static landing page at `apps/landing/` with adapter-static (3 routes, 5 components)
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Rate limiting: sliding window per-IP, tiered by route (auth/API/general)
- Matrix CI: Node 22/23, ubuntu/macos, Rust CI, E2E in pipeline, dependency audit
- A11y E2E tests with `@axe-core/playwright` across 4 themes
- Lighthouse CI performance budgets (perf 90, a11y 95, SEO 95)
- README, CHANGELOG, launch checklist documentation

### Phase 11: CLI & Deployment

- `create-commonpub` Rust CLI with `new` and `init` subcommands
- Multi-stage Dockerfile (node:22-alpine, non-root user)
- Production docker-compose with health checks
- DigitalOcean App Platform spec and droplet setup script
- CI/CD: build, docker push to ghcr.io, deploy on release
- E2E test scaffolds for auth, content, theme, admin flows
- Deployment documentation

### Phase 10: Theming Engine & Admin

- `data-theme` attribute switching with 4 themes (base, deepwood, hackbuild, deveco)
- Theme resolution cascade: user pref → instance default → 'base'
- SSR flash prevention via cookie + `transformPageChunk`
- Admin panel with user management, role assignments, content moderation
- Audit logging with `verb.noun` action naming
- Instance settings via key-value store
- Feature flag: `FEATURE_ADMIN`

### Phase 9: Docs Module

- `@commonpub/docs` package with markdown rendering pipeline
- CodeMirror 6 editor integration
- Versioned documentation with copy-on-create snapshots
- Hierarchical navigation (JSONB structure + fallback)
- Postgres FTS search with headline extraction
- 101 tests covering rendering, navigation, versioning, search

### Phase 8: Federation

- ActivityPub protocol integration via Fedify
- 4 schema tables: remoteActors, activities, followRelationships, actorKeypairs
- 9 activity types: Create, Update, Delete, Follow, Accept, Reject, Undo, Like, Announce
- Content mapper, actor resolver, RSA 2048 keypairs
- Inbox/outbox processing, 13 AP routes
- OAuth2 SSO for cross-instance authentication
- Federation dashboard, multi-instance dev setup
- Feature flag: `FEATURE_FEDERATION`

### Phase 7: Community System

- Community CRUD with membership and role-based permissions
- Weight-based hierarchy: owner (4) > admin (3) > mod (2) > member (1)
- Posts, replies, pinned content, content sharing, likes
- Join flows: open (instant), approval/invite (token-gated)
- Ban management with temporary and permanent options
- 12 components, 50+ new tests

### Phase 6: Learning System

- `@commonpub/learning` package with learning path engine
- Normalized modules and lessons (not nested JSON)
- Lesson content types: article, video, quiz, project, explainer
- Enrollment, progress tracking, auto-certificate at 100%
- Certificate verification with SNAP-{base36}-{hex8} codes
- 75 tests, 7 route groups, 10 components

### Phase 5: Explainer System

- `@commonpub/explainer` package with three-layer architecture
- Section types: text, code, quiz, comparison, timeline, checklist
- Quiz engine with deterministic shuffle (mulberry32 seeded PRNG)
- Progress tracker as pure state machine
- Self-contained HTML export with inlined CSS + vanilla JS
- 127 tests (originally built with Svelte components; later rebuilt as framework-agnostic TypeScript)

### Phase 4: Reference App & Content System

- Reference app with content CRUD (originally SvelteKit; later rebuilt on Nuxt 3 per ADR 025)
- Rich block editor with 6 block types
- Social features: likes, comments, follows
- SEO: JSON-LD structured data, OpenGraph meta, sitemap
- Dashboard with content management
- Slug generation with collision handling
- 35 tests

### Phase 3: Core UI Kit & Block Editor

- `@commonpub/ui` -- headless components (originally Svelte 5; later rebuilt as Vue 3 per ADR 025)
- `@commonpub/editor` -- TipTap extensions with BlockTuple serialization
- 4 theme CSS files with CSS custom properties
- axe-core a11y testing on all components
- 116 UI tests, 69 editor tests

### Phase 2: Auth & Protocol

- `@commonpub/auth` — Better Auth wrapper with guards and hooks
- `@commonpub/protocol` — Fedify wrapper with AP types
- `@commonpub/test-utils` — Shared test helpers
- AP Actor SSO (Model B) design
- 42 auth tests, 42 protocol tests, 14 test-utils tests

### Phase 1: Schema & Config

- `@commonpub/schema` — 43 tests, Drizzle tables + Zod validators
- `@commonpub/config` — 17 tests, `defineCommonPubConfig()` factory
- CSS token surface — 4 themes (base, deepwood, hackbuild, deveco)
- UUID PKs, timestamps with timezone, Drizzle relations

### Phase 0: Foundation

- Monorepo scaffold with Turborepo + pnpm
- CI/CD pipeline with GitHub Actions
- Docker dev environment (Postgres, Redis, Meilisearch)
- 8 initial Architecture Decision Records
- TypeScript strict mode, ESLint 9, Prettier
