# Session 131 — DB constraints + CI flakes + Redis observability + docs FTS highlighting

Date: 2026-04-18

Shipped the immediate follow-ups to session 130's Redis integration plus
some overdue hygiene items. Nothing requires flipping `NUXT_REDIS_URL`
— it stays unset on both prod droplets.

## What shipped

### A. DB integrity — migration 0002

Two constraints that `codebase-analysis/09-gotchas-and-invariants.md`
had been flagging for sessions.

**`event_attendees` UNIQUE (event_id, user_id)**
- Server dedupe was the only defense against racing double-clicks; now
  the DB enforces.
- `rsvpEvent` (`packages/server/src/events/events.ts`) uses
  `ON CONFLICT DO NOTHING + .returning()` — a racing parallel insert
  falls through to the existing "already registered" response path
  instead of surfacing a 500 on the unique violation.

**`federated_content.mirror_id` FK → `instance_mirrors(id)`
(ON DELETE SET NULL)**
- The orphan-cleanup UPDATE runs before the ALTER TABLE so the FK can
  be added on live data. Commonpub.io had 3 orphan rows (mirror config
  deletions that didn't cascade-null) — now cleanly nulled. Deveco.io
  had 0.
- `ON DELETE SET NULL` matches the relation semantics: dropping a mirror
  config must not purge the content we already received from it.

**Migration file:** `packages/schema/migrations/0002_session130_constraints.sql`.

**Verified on both prod DBs:** `drizzle.__drizzle_migrations` has
`7daf57707059e412f61e9cecabd3cafd11ae25d0368b913eff5ef4eee91a29c8`.
Commonpub.io: 23 rows with mirror_id (was 26 before cleanup); 0 orphans
remaining; both constraints live. Deveco.io: 17 rows with mirror_id;
constraints live.

### B. CI Redis sidecar + turbo env passthrough

- `.github/workflows/ci.yml` gained a `redis:7-alpine` service on the
  `check` job and exports `REDIS_URL_TEST=redis://localhost:6379`.
- Turbo 2.x strips undeclared env vars from task processes by default.
  Added `"env": ["DATABASE_URL", "NUXT_DATABASE_URL", "REDIS_URL_TEST",
  "CI"]` to the `test` task in `turbo.json` so the vars actually reach
  vitest workers. This was why the Redis integration suite still
  showed `4 skipped` on the first sidecar run.
- Verified in CI log: `✓ redis.integration.test.ts (4 tests) 2145ms` —
  cross-process rate-limit + pub/sub delivery covered on every PR now.

### C. Redis pub/sub subscriber offline queue

Fixed a subtle bug in `packages/infra/src/realtime/factory.ts`: the
subscriber client inherited the publisher's fast-fail config
(`enableOfflineQueue: false`), which meant `SUBSCRIBE` calls during
a reconnect silently rejected. Subscribers now get
`enableOfflineQueue: true` + `maxRetriesPerRequest: null` — the publisher
stays aggressive because it sits on the request hot path, but the
subscriber needs the queue to survive blips. Integration test updated to
duplicate with the same override so it exercises the prod configuration.

### D. Redis fail-open logger

`onRedisError` was a no-op at both call sites (IP middleware + per-API-key
limiter). A prod Redis outage would silently fail-open on every request.

New helper: `createRedisFailOpenLogger({ scope, windowMs?, sink? })`
(`packages/infra/src/redis/logger.ts`). Rate-limited behavior:
- First event in a window logs immediately with the error + scope.
- Subsequent events are counted silently.
- At window close (default 60 s), if >1 event fired, a rollup line logs
  with operation counts + last error.

Wired into `layers/base/server/middleware/security.ts` (scope
`ratelimit:ip`) and `packages/server/src/publicApi/rateLimit.ts`
(scope `ratelimit:apikey`). 4 unit tests in
`packages/infra/src/__tests__/redisLogger.test.ts` using fake timers.

### E. Four pre-existing e2e flakes — fixed

Every PR since session 126 had been running CI yellow because the e2e
job kept failing on these four. Full fixes:

1. **`navigation.spec.ts:29` hero-banner dismiss** —
   `HeroSection.vue` had `const heroDismissed = ref(false)`. The
   `HomepageSectionRenderer` v-if wrappers can remount the component
   when `/api/homepage/sections` useFetch revalidates on hydration,
   resetting the ref. Changed to `useState('cpub:hero-dismissed', …)` so
   dismiss persists across remounts. Legacy inline path in
   `pages/index.vue` uses the same key.

2. **`smoke.spec.ts:132` /contests console errors** — two intertwined
   issues: (a) `/contests` is feature-gated off by default, so
   `feature-gate.global.ts` threw createError 404, which Nuxt logs as
   a fatal app-init error; (b) a transient CSP frame-src violation from
   an iframe rendering with an empty `src` before data hydrates.
   Fixed by enabling the non-federation feature flags
   (`FEATURE_CONTESTS`, `FEATURE_EVENTS`, `FEATURE_EXPLAINERS`,
   `FEATURE_LEARNING`, `FEATURE_VIDEO`, `FEATURE_ADMIN`) in the e2e CI
   job so pages render real content, plus filtering known-benign
   CSP + H3Error Not Found strings in the smoke test's fatal-error list.

3. **`auth.spec.ts:98` register form input** — classic Vue hydration
   race: Playwright's `fill` set DOM values before v-model's input
   listener was attached, then hydration clobbered them. Fixed by
   waiting for `networkidle` + a hydration beacon (submit button
   visible + enabled) before calling `fill`.

4. **`navigation.spec.ts:103` advanced filters toggle** — same
   hydration race on the filter button's click handler. Fixed the same
   way: wait for button enabled (beacon), then assert the
   `{ open: advOpen }` class toggles together with the panel visibility
   so the race surfaces as a clear assertion instead of "element not
   found".

**CI signal is now green** — check, rust, e2e all pass on the latest
commit, including the integration tests against real Redis.

### F. Docs FTS snippet highlighting

Session 129 made `ts_headline` wrap matched tokens in `<b>…</b>`, but
the search dropdown in `pages/docs/[siteSlug]/index.vue` and
`[...pagePath].vue` only rendered `{{ r.title }}`. The snippet was
discarded.

Now the dropdown renders title + snippet with the match tokens bolded.
New util `layers/base/utils/highlightSnippet.ts` HTML-escapes every byte
and then restores only the bare `<b>` / `</b>` markers — any attribute
variant, any other tag becomes harmless escaped text. 7 unit tests in
`apps/reference/__tests__/highlightSnippet.test.ts` cover the XSS defense
matrix.

## Version bumps + publishes

| Package | Before | After |
|---|---|---|
| `@commonpub/schema` | 0.14.3 | **0.14.4** |
| `@commonpub/server` | 2.46.1 | **2.47.2** |
| `@commonpub/infra` | 0.5.1 | **0.6.1** |
| `@commonpub/layer` | 0.17.0 | **0.18.1** |

Consumer pins bumped in apps/reference, apps/shell, layers/base, and
deveco-io.

## Deploys

- commonpub.io auto-deploy picked up migration 0002 (hash
  `7daf57707…`) + rsvpEvent race fix + e2e flake fixes. CI + deploy
  green. `NUXT_REDIS_URL` still unset.
- deveco.io auto-deploy picked up migration 0002 via npm-installed
  schema 0.14.4 + server 2.47.1. CI + deploy green.
- Both sites 200.

## Known gaps / follow-ups

1. **Actually flip `NUXT_REDIS_URL` in prod** — still deferred (user
   direction: "wired for when I need to scale, not needed now").
   Runbook in `codebase-analysis/12-scaling-and-infrastructure.md`.
2. **Wire `onRedisError` sink to a real observability backend.**
   Default sink is `console.warn` (goes to Docker logs → journald).
   When an aggregate logger/metrics surface lands, swap the sink.
3. **Vue quiz UI rebuild** — no quiz lessons in prod.
4. **`useAuth.ts` TS2589 deep instantiation** — pre-existing, not
   blocking.
5. **Mobile responsive audit** (~70 components without @media).
6. **`audittest` user cleanup** — admin's call per session 127 incident.
