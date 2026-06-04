# Session 190 — Flexible public-API CORS (Phase 1)

**Date:** 2026-06-04
**Scope:** `@commonpub/schema`, `@commonpub/server`, `layers/base` (public-API middleware + admin UI), docs.

## Context

The admin-provisioned public read API (`/api/public/v1/*`) could not have its CORS
set to `*` or `localhost`: the create validator was `allowedOrigins: z.array(z.string().url())`
(`.url()` rejects `*` and bare `localhost`) and the middleware matched origins by exact
string (`key.allowedOrigins.includes(origin)`) with no wildcard support. This was Phase 1
of the broader plan at `docs/plans/public-api-cors-and-metrics.md` (CORS flexibility +
DevRel/analytics metrics).

## What was done

Per-key wildcard CORS, end to end, test-first:

1. **Validator** (`packages/schema/src/validators.ts`): new exported `originPatternSchema`
   accepting `*`, `localhost`, exact origins, and `*` wildcards for scheme/subdomain/port;
   only `http`/`https`/`*` schemes (rejects `javascript:`/`data:`/etc). Swapped into
   `createApiKeySchema.allowedOrigins`.
2. **Matcher** (`packages/server/src/publicApi/cors.ts`, new): pure `matchOrigin()` +
   `expandOriginPatterns()`, exported from the barrel. Compiles patterns to anchored
   regexes (escape-then-`[^/]*`, so dots stay literal and a wildcard can't cross `/`).
   `localhost` expands to 4 patterns (default-port + any-port over http/https). `*` returns
   a literal `*` with `wildcard:true`; pattern matches reflect the origin.
3. **Middleware** (`layers/base/server/middleware/public-api-auth.ts`): replaced the
   exact-match block with `matchOrigin(key.allowedOrigins, origin)`; sets `ACAO` to `*`
   (no `Vary`) or the reflected origin (with `Vary: Origin`). Never sends
   `Access-Control-Allow-Credentials`.
4. **Admin UI** (`layers/base/pages/admin/api-keys.vue`): CORS preset radiogroup
   (Server-to-server / Allow any `*` / Localhost / Custom) with per-preset help text and
   client-side `originPatternSchema` validation of custom patterns.
5. **Docs** (`docs/public-api.md`): rewrote the CORS section with the pattern table, the
   "why `*` is safe here" reasoning (Bearer auth, no cookies, no credentials), and preflight.

## Tests (all green)

- `packages/server/src/__tests__/cors.test.ts` — 22 unit tests (wildcard-all, exact, dot-literal,
  localhost lookalikes, port/subdomain/scheme wildcards, anchoring, slash-smuggling, credentials invariant).
- `packages/schema/src/__tests__/validators.test.ts` — origin-pattern accept/reject matrix +
  `createApiKeySchema.allowedOrigins` (wildcard mix, scheme smuggling, null/omitted, 50-cap).
- `packages/server/src/__tests__/publicApi.integration.test.ts` — 3 round-trips proving wildcard
  patterns persist create → DB → authenticate and drive the matcher on the real row.
- Full server suite 1284 passed / 3 skipped. Schema 256 passed. `nuxt typecheck` (vue-tsc) clean.
  Server + schema lint: 0 errors (pre-existing warnings only, none in changed files).

## Decisions

- **`*` is safe for this API.** Auth is a Bearer token, not a cookie; no ambient credentials,
  and `Access-Control-Allow-Credentials` is never sent. So `ACAO: *` cannot leak anything a
  cross-origin attacker couldn't already fetch server-side. CORS here only enables browser clients.
- **Instance-level `defaultAllowedOrigins` deferred to Phase 2.** The chosen posture was "keep
  closed; add presets + wildcards" (per-key), which is fully delivered. Deferring the config-level
  default avoids cross-package coupling and the consumer-`config.ts`-spread risk; it lands with the
  `publicApiSettings` object that Phase 2 adds for metrics anyway.
- **`localhost` shorthand = 4 patterns** (no-port + any-port, http + https) so `http://localhost`
  (port 80) matches too, not just `http://localhost:3000`.

## Adversarial self-audit (same session) + fixes

Audited the Phase 1 code by tracing the untrusted `Origin` header to its sinks. Three real findings, all fixed + regression-tested:

1. **HIGH — header injection via reflected Origin.** Both reflect points (the authenticated actual-request match and the *unauthenticated* preflight echo) wrote the raw `Origin` into `Access-Control-Allow-Origin`. The matcher's `*`→`[^/]*` compilation matches newlines (negated class), and regex `$` (no `m` flag) matches before a trailing newline, so `https://app.example.com\n` or `https://evil\r\nSet-Cookie:…example.com` would be reflected → CRLF / response-splitting. Node's header validation only throws (unhandled 500); it is a backstop, not the gate (the "validate domain, not shape" lesson). **Fix:** new exported `isWellFormedOrigin()` (scheme://host[:port], explicit control-char rejection incl. trailing-newline) gates both reflect paths; wildcard tightened `[^/]*`→`[^/\s]*` as defense in depth. The `*` wildcard-all path is unaffected (it returns the literal `*`, never reflects).
2. **LOW — case split-brain.** The validator accepts `LOCALHOST` (case-insensitive) but `expandOriginPatterns` only expanded lowercase `localhost`, producing a dead literal pattern that silently never matched. **Fix:** lowercase-compare the shorthand.
3. **DEFENSE — ReDoS.** Tightened the wildcard class and confirmed the validator's single-`*`-per-position grammar prevents adjacent dot-separated wildcards (the catastrophic-backtracking shape). Added a 2000-char origin length cap.

Sibling-sink sweep: the only `Access-Control-Allow-Origin` writers in the layer are the two now-guarded public-API sinks. `sign-in-username.post.ts` uses the Origin on an *outbound* internal request, not a client-facing reflection.

Tests grew from 22 → 42 in `cors.test.ts` (isWellFormedOrigin accept/reject matrix, CRLF/trailing-newline/control-char known-bad payloads against matchOrigin, `LOCALHOST` case). Full server suite 1304 passed / 3 skipped. Lint 0 errors. `nuxt typecheck` clean.

## Phase 2 — DevRel / analytics metrics (same session)

Added an aggregate, privacy-respecting analytics surface to the public API.

**Plumbing:** new `read:analytics` scope + activated `read:federation` (`PUBLIC_API_SCOPES`). New opt-in feature flag `publicApiMetricsFederation` (default OFF) wired through all mirrors: config schema/types, `layers/base/nuxt.config.ts` runtimeConfig, reference + shell `ENV_FLAG_MAP`, the `useFeatures` client mirror + `DEFAULT_FLAGS`, and the `mockConfig` / `health.test` fixtures. The admin features endpoint self-registers it via `Object.keys(config.features)`.

**Server (`packages/server/src/publicApi/metrics.ts`):** six aggregate query functions, all reading existing counters/timestamps (no new PII, no event tracking):
- `getMetricsOverview` — totals (users, contributors, content by type, hubs, tags, cumulative engagement) + 7d/30d deltas.
- `getTopContent` — leaderboard by views/likes/comments (reuses `toPublicContentSummary`).
- `getTrendingTags` — by lifetime usage (reuses `toPublicTag`).
- `getTopContributors` — public-profile active users by public content (INNER JOIN on the public-content predicate).
- `getEngagementMetrics` — content ratios + learning/events/contests funnels (feature-gated sections).
- `getFederationReach` — peers, mirrors, followers, inbound-by-domain (opt-in).

**Routes:** `layers/base/server/api/public/v1/metrics/{overview,content/top,tags/trending,contributors/top,engagement,federation}.get.ts`. Federation is double-gated: `requireFeature('federation')` + `requireFeature('publicApiMetricsFederation')` (404 when off) + `read:federation` scope. OpenAPI spec + `docs/public-api.md` (scopes table, Metrics section, **Metrics privacy contract**, TOC) updated.

**Privacy contract (enforced, not just documented):** aggregates and intentional public leaderboards only; only published/public/non-deleted content and active public-profile users counted at the SQL level; no IP/UA/email/referrer; federation reach is opt-in + domain-level; `METRICS_MIN_BUCKET` reserved for Phase 3 user-pivotable breakdowns.

**Tests:** `metrics.integration.test.ts` (10) seeds real data through PGlite and verifies every metric incl. the privacy exclusions (draft/private/deleted content, private-profile contributor) and the int4-overflow regression. Config + schema tests extended. Full server suite 1314 passed / 3 skipped. Reference `nuxt typecheck` clean. Lint 0 errors.

### Phase 2 audit + fixes
- **Scale bug (fixed): int4 overflow.** Every counter `sum(...)::int` would throw `integer out of range` once a cumulative `sum(view_count)` passed 2.1B, 500-ing `/overview`, `/engagement`, `/contributors/top`. Switched the 13 SUMs to `::float8` (exact for integer sums to 2^53, returned as a JS number; counts stay `::int`). Added a regression test seeding two 2e9 rows (sum 4e9) that would have thrown under `::int`.
- **Latent data bug (fixed during impl): `PUBLIC_EVENT_STATUSES`** wrongly included `upcoming`/`past`, which aren't values of the events status enum; typecheck on `inArray` surfaced it. Narrowed to `published`/`active`/`completed` (matches the events route's own public filter).
- **Verified, no change:** deleted users' content is archived (`status='archived'`) so excluded from all metrics; suspended users are excluded from contributors via `status='active'`; top-content author exposure matches the existing `/content` surface; all sums are bound params (no injection); `read:*` covers the new scopes; the federation flag defaults closed even under consumer-config drift.

## Release (Phases 1+2) — LIVE on all 3 (2026-06-04)

schema 0.34.0 / config 0.19.0 / server 2.81.0 / layer 0.61.0. No migration. Published npm (schema→config→server→layer), pushed commonpub.io (local layer), bumped + pushed deveco + heatsync pins. Verified live: `publicApiMetricsFederation` appears in `/api/features` on all 3 (the flag only exists in the new config+layer, so this confirms the deploy). Published tarballs verified complete in deveco node_modules (new server exports, schema scope, six metrics routes — no drift).

## Phase 3 — daily rollups + time-series (same session)

- **Schema:** `metrics_daily` (`packages/schema/src/metrics.ts`, migration `0020_spooky_gideon`). One row per (day, metric, dimension); `dimension` is NOT NULL default `''` (NOT nullable) so the unique index stays idempotent — NULLs are distinct in a Postgres unique index, which would silently allow duplicate global rows.
- **Server (`metricsRollup.ts`):** `runDailyRollup(db, day)` (idempotent upsert of cumulative snapshots + the day's flow + engagement sums via `::float8`), `backfillMetricsDaily(db)` (deterministic survivorship history from `created_at`/`published_at` via window-sum; engagement sums NOT backfilled — no per-day history), `getMetricsTimeseries(db, opts)` (day/week/month JS bucketing: flow=sum, cumulative=last; day-over-day delta; `since`).
- **Plugin (`metrics-rollup.ts`):** opt-in on `features.publicApi`, backfills if the table is empty, then refreshes today's snapshot every 6h; clean teardown. Modeled on `registry-heartbeat`.
- **Route:** `GET /metrics/timeseries` (scope `read:analytics`, metric/interval/from/to, 90-day default, 2-year span clamp). OpenAPI + docs updated.
- **Tests:** `metricsRollup.integration.test.ts` (10) seeds controlled dates and verifies backfill flow+cumulative, idempotency, the no-engagement-backfill rule, the snapshot, and day/week/month bucketing. Server suite 1324 passed. Reference typecheck clean. Lint 0 errors.

## Open questions / next steps

- **Release Phase 1:** bump `@commonpub/schema` (validator) + `@commonpub/server` (matcher) +
  `@commonpub/layer` (middleware + admin UI) minors; publish config/schema → server → layer; deploy;
  curl-verify a key with `allowedOrigins:['*']` returns `Access-Control-Allow-Origin: *`. No migration.
- **Phase 2 (metrics):** `read:analytics` scope, instantaneous metrics endpoints (overview, content/top,
  tags/trending, contributors/top, engagement, federation), privacy contract, `publicApiSettings` config
  (incl. the deferred `defaultAllowedOrigins`). Phase 3 adds `metrics_daily` rollups (migration 0020) +
  time-series. See the plan doc.
