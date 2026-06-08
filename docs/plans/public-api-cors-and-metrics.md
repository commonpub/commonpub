# Public API: Flexible CORS + DevRel/Analytics Metrics

**Status:** Phases 1 (CORS) + 2 (metrics) RELEASED + verified live on all 3 instances 2026-06-04 (schema 0.34 / config 0.19 / server 2.81 / layer 0.61). Phase 3 (rollups + time-series) implemented + tested 2026-06-04 (migration 0020). Phase 4 deferred.
**Owner:** —
**Created:** 2026-06-04
**Scope:** `@commonpub/schema`, `@commonpub/config`, `@commonpub/server`, `layers/base` (public API routes, middleware, admin UI), `docs/public-api.md`

## 1. Goals

Two independent but related improvements to the admin-provisioned public read API (`/api/public/v1/*`):

1. **CORS you can actually set to anything** — today you cannot enter `*` or `localhost`. Make CORS configurable to any origin (wildcard-all, localhost, port wildcards, subdomain wildcards), per-key and instance-wide, without weakening the security model.
2. **DevRel / company analytics metrics** — expose aggregate, privacy-respecting statistics useful to developer-relations and to companies that want to report on community health: growth, content/engagement leaderboards, trending topics, contributor activity, funnels, and (opt-in) federation reach.

### Locked decisions (from kickoff)

| Decision | Choice |
|---|---|
| Time-series collection | **Rollups now, events later.** Ship privacy-safe daily aggregate rollups; design schema so an optional, flag-gated, dimension-stripped event table can follow. |
| Federation reach metrics | **Behind `read:federation` scope + config flag, default OFF.** Domain-level aggregates only, never per-user. |
| Contributor leaderboards | **Public by default, public-profile users only.** Counts already-public content; suspended/deleted/private excluded. |
| Default CORS posture | **Keep closed.** Default stays server-to-server. Add presets + wildcard matcher; openness is an explicit per-key or instance-level opt-in. |

### Standing-rules compliance

- **Rule 2 (no feature without a flag):** `features.publicApi` already gates the surface. New work adds `publicApi.metrics` (default ON when API on) and `publicApi.metricsFederation` (default OFF). CORS needs no new feature flag — it is configuration of an already-flagged surface.
- **Rule 11 (TDD):** every section below leads with the test list.
- **Rule 12 (a11y):** admin-UI changes (CORS presets) keep keyboard nav + ARIA.
- **No em dashes in user-facing copy** ([[feedback_no_em_dashes_in_copy]]) — admin labels/help text use commas/periods.
- **Migrations via deploy path** ([[feedback_use_deploy_migrations_not_ssh]]) — new table ships as committed migration `0020`, applied by `db-migrate.mjs`, curl-verified.
- **Declare new runtimeConfig keys** ([[feedback_nuxt_env_only_declared_keys]]) — any new `publicApi.*` config must be added to `layers/base/nuxt.config.ts` `runtimeConfig`, or it is silently dropped.

---

## 2. Current state (inventory)

### Public API surface
- Middleware: `layers/base/server/middleware/public-api-auth.ts` — flag gate (404 when off), OPTIONS preflight, Bearer auth, per-key rate limit, per-key CORS, usage logging.
- Routes: `layers/base/server/api/public/v1/*` (20 files: content, hubs, users, learn, events, contests, videos, docs, tags, search, instance, openapi.json).
- Server logic: `packages/server/src/publicApi/` — `auth.ts`, `keys.ts`, `adminOps.ts`, `rateLimit.ts`, `scopes.ts`, `usage.ts`, `serializers.ts` (670 lines, allow-list serializers), `index.ts` (barrel).
- Scope gate: `layers/base/server/utils/requireScope.ts` → `requireApiScope(event, scope)`.
- Scopes list: `packages/schema/src/validators.ts:790` `PUBLIC_API_SCOPES` (note `read:federation` is already reserved but unused).
- Key schema: `packages/schema/src/publicApi.ts` (`api_keys`, `api_key_usage`).
- Create validator: `packages/schema/src/validators.ts:809` `createApiKeySchema`.
- Admin endpoints: `layers/base/server/api/admin/api-keys/` (index.get/post, `[id].delete`, `[id]/usage.get`).
- Admin UI: `layers/base/pages/admin/api-keys.vue` (464 lines).
- Docs: `docs/public-api.md`.
- Feature flag: `packages/config/src/{schema.ts:39,types.ts:37}` `features.publicApi`.

### CORS today (the exact limitation)
- Validator `createApiKeySchema.allowedOrigins = z.array(z.string().url()).max(50)`. `*` fails `.url()`. Bare `localhost` fails `.url()`. Only fully-qualified URLs accepted.
- Matching is exact: `key.allowedOrigins.includes(origin)` in `public-api-auth.ts:92`. No wildcards, no port/subdomain ranges. `http://localhost:3000` and `http://localhost:5173` are two distinct entries.
- Preflight (`public-api-auth.ts:43-56`) already echoes any origin (auth-less, no data) — fine and standard.
- Real-request CORS only emits headers when the list is non-empty and the origin matches exactly.

**Why `*` is safe here:** the API authenticates with `Authorization: Bearer` (a header the caller must explicitly set), not cookies. There are no ambient credentials, and we never send `Access-Control-Allow-Credentials: true`. So `Access-Control-Allow-Origin: *` cannot leak anything a cross-origin attacker couldn't already fetch server-side. CORS here *enables* legit browser apps; the token is what protects data. This is the load-bearing reasoning for allowing wildcard-all.

### Data available for metrics (from deep inventory)
- **Denormalized counters (instantaneous):** `content_items.{viewCount,likeCount,commentCount,forkCount,buildCount,boostCount}`, `videos.{viewCount,likeCount,commentCount}`, `learning_paths.{enrollmentCount,completionCount,reviewCount}`, `hubs.{memberCount,postCount}`, `events.attendeeCount`, `tags.usageCount`, plus federation `local*Count`/`remote*Count`.
- **Timestamps (backfillable history):** `users.createdAt`, `content_items.{createdAt,publishedAt}` (indexed: `idx_content_items_published_at`), contest/event/path created dates.
- **No time-series exists.** `viewCount` etc. are cumulative; there is no per-day view history. View increments dedupe by IP **in memory only** (`view.post.ts`) — no IP is persisted. This is a privacy strength we must not regress.
- **Existing stats:** `getPlatformStats` (`packages/server/src/admin/admin.ts:176`), `/api/stats`, `/api/admin/stats`, `/api/admin/federation/stats`, `/api/search/trending`. None are exposed to external API keys; all are either admin-gated or unscoped internal.
- **Privacy-sensitive (never aggregate into re-identifying public output):** `sessions.{ipAddress,userAgent}`, `audit_logs.{ipAddress,metadata}`, `users.email`, OAuth tokens, `activities.payload`, notification rows.

### Scheduler mechanism
- Background work runs as Nitro server plugins with `setInterval` + clean `nitro.hooks.hook('close')` teardown, opt-in by flag. Model: `layers/base/server/plugins/registry-heartbeat.ts`. The metrics rollup will follow this exact pattern.

### Latest migration: `0019_regular_tinkerer.sql` → new table ships as **`0020`**.

---

## Part 1 — Flexible CORS

### 1.1 Origin-pattern model

Replace the "array of URLs, exact match" model with an **origin-pattern** model. A pattern is one of:

| Pattern | Meaning | Example |
|---|---|---|
| `*` | Any origin (wildcard-all) | `*` |
| exact origin | scheme + host + optional port, matched verbatim | `https://app.example.com`, `http://localhost:3000` |
| port wildcard | any port on a host | `http://localhost:*` |
| subdomain wildcard | any subdomain | `https://*.example.com` |
| scheme wildcard | any scheme | `*://localhost:*` |
| `localhost` shorthand | expands to `http://localhost:*` **and** `https://localhost:*` | `localhost` |

`*` is the only metacharacter. It is never allowed to span the `://` boundary except as the standalone `*`. No path component is ever matched (origins have no path).

### 1.2 Validator (`packages/schema/src/validators.ts`)

Add an exported origin-pattern validator and swap it into `createApiKeySchema`:

```ts
// Accepts: '*', 'localhost', or <scheme-or-*>://<host-with-optional-*>[:<port-or-*>]
const ORIGIN_PATTERN = /^(?:\*|localhost|(?:https?|\*):\/\/(?:\*\.)?[a-z0-9.-]+(?::(?:\d{1,5}|\*))?)$/i;

export const originPatternSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine((v) => ORIGIN_PATTERN.test(v), {
    message: 'Must be "*", "localhost", or an origin like https://app.example.com (wildcards * allowed for scheme/subdomain/port)',
  });

// in createApiKeySchema:
allowedOrigins: z.array(originPatternSchema).max(50).optional().nullable(),
```

Guardrails baked into the regex:
- Reject `javascript:`, `data:`, `file:` and any non-http(s) scheme (only `https?` or `*`). Mirrors the URL-scheme-refinement lesson ([[feedback_editor_security_patterns]]).
- Avoid the empty-alternation trap ([[feedback_regex_empty_alternation]]) — the leading `\*|localhost|...` branches are all non-empty; the anchored `^...$` plus `min(1)` means no zero-width accept.
- `*` standalone is its own branch, not a sub-pattern, so `**` / `*foo*` don't sneak through.

> No DB migration: `api_keys.allowed_origins` is already `jsonb<string[]>`. Only the **validation** of the strings changes.

### 1.3 Matcher (`packages/server/src/publicApi/cors.ts`, new)

A pure, unit-tested function — no I/O — so the security logic is fully covered:

```ts
export interface CorsDecision {
  allowed: boolean;
  /** Value to send in Access-Control-Allow-Origin, or null if not allowed. */
  headerValue: string | null;
  /** True when the value is the literal '*' (cacheable, no Vary needed). */
  wildcard: boolean;
}

export function expandOriginPatterns(patterns: readonly string[]): string[] {
  // 'localhost' -> ['http://localhost:*','https://localhost:*']; pass others through
}

export function matchOrigin(patterns: readonly string[], origin: string | undefined): CorsDecision {
  // 1. no patterns -> { allowed:false, headerValue:null }
  // 2. patterns includes '*' -> { allowed:true, headerValue:'*', wildcard:true }
  // 3. no Origin header -> not allowed (nothing to reflect)
  // 4. each expanded pattern -> compile to anchored RegExp:
  //    escape all regex metachars, then replace the escaped '*' with '[^/]*',
  //    anchor ^...$, case-insensitive. If any matches origin ->
  //    { allowed:true, headerValue: origin, wildcard:false }  // reflect + Vary
  // 5. else not allowed
}
```

Compilation detail: escape the pattern with a standard regex-escape, then turn the (escaped) `\*` back into `[^/]*`. `[^/]*` keeps the wildcard from crossing `://` (which contains `/`), so `https://*.example.com` cannot match `https://evil.com/.example.com`. Cache compiled regexes per process (small `Map`) to avoid recompiling on every request; the pattern set per key is tiny and bounded by `.max(50)`, so ReDoS surface is negligible, but the `[^/]*` (no nested quantifiers) is linear anyway.

**Hard security invariant (assert in code + test):** when the decision is `wildcard:true` (`*`), the middleware MUST NOT also set `Access-Control-Allow-Credentials`. A literal `*` with credentials is both spec-illegal and a real vulnerability. Since the public API has no cookie auth, we simply never emit that header — but a comment + a test pin it so a future write/cookie API can't quietly break it.

**Origin-reflection invariant (added in the 2026-06-04 audit):** any path that reflects the raw `Origin` header into `Access-Control-Allow-Origin` (the actual-request match AND the unauthenticated preflight echo) MUST first pass `isWellFormedOrigin()` — a strict `scheme://host[:port]` check that explicitly rejects control characters (incl. the trailing-newline `$` quirk). Reflecting an unvalidated header is a CRLF / response-splitting sink; Node's header validation is only a backstop. The `*` wildcard-all path never reflects (it returns the literal `*`), so it is exempt. The matcher's wildcard compiles to `[^/\s]*` (no slash, no whitespace) as defense in depth.

### 1.4 Instance-level default (`@commonpub/config`) — DEFERRED to Phase 2

> **Implementation note (2026-06-04):** Phase 1 shipped per-key wildcard CORS only. The user's chosen CORS posture was "keep closed; add presets + wildcards" (per-key), which the validator + matcher + admin UI fully deliver: an admin creates a key with `allowedOrigins: ['*']` or `['localhost']`. The instance-level `defaultAllowedOrigins` below is moved to Phase 2 (where the `publicApiSettings` config object is added for metrics anyway). Deferring it avoids cross-package config coupling and the consumer-`config.ts`-spread risk (a consumer whose `server/utils/config.ts` does not spread `...config` would drop the new key). When added, the middleware must read it defensively: `config.publicApiSettings?.defaultAllowedOrigins ?? []`.

`features.publicApi` stays a boolean gate. Add a sibling **config object** (not a feature flag) for public-API settings, mirroring how `federation` is its own object:

```ts
// packages/config/src/schema.ts
publicApiSettings: z.object({
  defaultAllowedOrigins: z.array(originPatternSchema).max(50).default([]),
  // metrics settings live here too (Part 2)
  metrics: z.object({
    enabled: z.boolean().default(true),
    federation: z.boolean().default(false),
    minBucketSize: z.number().int().min(1).max(1000).default(5),
  }).default(() => ({ enabled: true, federation: false, minBucketSize: 5 })),
}).default(() => ({ defaultAllowedOrigins: [], metrics: { enabled: true, federation: false, minBucketSize: 5 } })),
```

- Mirror in `packages/config/src/types.ts`.
- **Declare in `layers/base/nuxt.config.ts` `runtimeConfig`** or env overrides are silently dropped ([[feedback_nuxt_env_only_declared_keys]]).
- Default `[]` preserves today's server-to-server behavior exactly (locked decision).

Effective origins for a request = `union(key.allowedOrigins ?? [], config.publicApiSettings.defaultAllowedOrigins)`. So an operator who sets `defaultAllowedOrigins: ['*']` opens the whole instance, while a single key can still be opened with `['http://localhost:*']` for a dev app.

### 1.5 Middleware changes (`public-api-auth.ts`)

Replace the inline exact-match block (lines 90-98) with the matcher, and apply the **same matcher on preflight** so OPTIONS reflects the real policy instead of echoing any origin:

```ts
import { matchOrigin } from '@commonpub/server';

const effectiveOrigins = [
  ...(key.allowedOrigins ?? []),
  ...config.publicApiSettings.defaultAllowedOrigins,
];
const decision = matchOrigin(effectiveOrigins, getRequestHeader(event, 'origin'));
if (decision.allowed && decision.headerValue) {
  setResponseHeader(event, 'Access-Control-Allow-Origin', decision.headerValue);
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS');
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (!decision.wildcard) appendResponseHeader(event, 'Vary', 'Origin');
}
// NB: never set Access-Control-Allow-Credentials.
```

Preflight subtlety: OPTIONS has no `Authorization` header, so we cannot run the per-key matcher there (we don't know the key). Two acceptable options:
- **(a) Keep the current permissive preflight** (echo any origin; the real request still enforces the per-key matcher). Simplest, standard, and safe because no data flows on preflight. **Recommended** — keep as-is, only add a short comment that the actual-request matcher is the gate.
- (b) Apply `config.publicApiSettings.defaultAllowedOrigins` on preflight (instance-level only). More "correct" but rejects legitimate per-key origins at preflight, breaking browser apps whose origin is allowed per-key but not instance-wide. Reject (a) is better UX; the real request still enforces correctly.

Go with **(a)**.

### 1.6 Admin UI (`pages/admin/api-keys.vue`)

- Replace the free-text "Allowed CORS origins" input help with a **preset selector** + custom field:
  - `Server-to-server only` (empty, default)
  - `Allow any origin (*)` (sets `*`)
  - `Localhost (dev)` (sets `localhost`)
  - `Custom...` (reveals the text field, comma/whitespace separated)
- Update placeholder/help copy: `e.g. *, localhost, https://app.example.com, https://*.example.com, http://localhost:*` (no em dashes).
- Inline client-side validation reusing `originPatternSchema` so a bad pattern is caught before submit (server still re-validates).
- Show a small note when `*` is selected: "Any website can call this key from a browser. The Bearer token still controls access." (reassures, since `*` looks scary).
- Keyboard + ARIA on the preset radio group (Rule 12).
- Optional: surface `config.publicApiSettings.defaultAllowedOrigins` read-only ("Instance default: ...") so admins know what every key already inherits.

### 1.7 Tests (write first)

`packages/server/src/__tests__/cors.test.ts` (new):
- `*` → `headerValue:'*'`, `wildcard:true`, no Vary.
- `localhost` shorthand matches `http://localhost:3000` and `https://localhost:8080`, rejects `http://localhost.evil.com`.
- `http://localhost:*` matches any port, rejects `https://localhost:3000` (scheme differs).
- `https://*.example.com` matches `https://a.example.com`, rejects `https://example.com` (no subdomain) and `https://a.example.com.evil.com` (anchored) and `https://evil.com/.example.com` (`[^/]*` can't cross `/`).
- exact `https://app.example.com` matches only itself.
- empty list → not allowed; no Origin header → not allowed.
- regex-escape safety: a pattern containing `.` matches a literal dot, not "any char" (`https://a.example.com` must not match `https://axexample.com`).
- **credentials invariant:** assert matcher never returns anything that would imply credentials; middleware test asserts `Access-Control-Allow-Credentials` is never set even with `*`.

`packages/schema` validator tests: accept `*`,`localhost`,`http://localhost:3000`,`https://*.x.com`,`*://localhost:*`; reject `javascript:alert(1)`, `data:...`, `notaurl`, `''`, `*foo`, `http://`, 300-char garbage.

Integration (`publicApi.integration.test.ts`): preflight returns permissive headers; actual GET with allowed `*` returns `ACAO:*`; per-key list still enforced when no `*`; instance-default merges with per-key.

---

## Part 2 — DevRel / Analytics Metrics

### 2.1 Privacy contract (the guardrails)

A dedicated `## Metrics privacy contract` section in `docs/public-api.md`, enforced in code:

1. **Aggregates only.** Every metric is a count, sum, ratio, or rank over public entities. No endpoint returns per-individual-user activity (no "who viewed/liked what").
2. **No new PII, no tracking.** Rollups derive from columns that already exist. No IP, user-agent, email, referrer, cookie, or fingerprint is collected, stored, or returned. The in-memory-only view dedup stays in memory.
3. **Public entities only.** Aggregations count only `status='published'`, `visibility='public'`, non-deleted content; only `profileVisibility='public'`, non-suspended, non-deleted users. Same `is*` allow-list predicates already in `serializers.ts`.
4. **k-anonymity on breakdowns.** Any *dimensioned* breakdown (per-tag, per-domain, per-contributor) suppresses or buckets rows whose count `< config.publicApiSettings.metrics.minBucketSize` (default 5). Suppressed mass is reported as an `"other"` bucket or omitted with an `omitted: N` note. Top-N totals are unaffected.
5. **Contributor attribution = already-public info.** Leaderboards rank only public-profile users by their already-public published-content counts (locked decision). A later opt-out column is noted as future work.
6. **Federation reach is opt-in.** `/metrics/federation` requires `read:federation` AND `config.publicApiSettings.metrics.federation === true`; otherwise 404. Domain-level only.
7. **Allow-list serializers.** Same pattern as existing `to*` helpers — a new column is never exposed until explicitly added to a metrics serializer.

### 2.2 New scopes

`packages/schema/src/validators.ts` `PUBLIC_API_SCOPES`:
- Add `read:analytics`.
- `read:federation` already exists (reserved) — activate it.
- `read:*` continues to cover both.

### 2.3 Architecture: rollups now, events later

**Phase 2 (no new table):** endpoints that read existing counters/timestamps directly — instantaneous "lifetime" and timestamp-derived growth. Ships value immediately, zero new infra, zero privacy surface.

**Phase 3 (rollup table):** `metrics_daily` + nightly rollup plugin for true daily time-series of counters that have no history (views/likes).

**Future (events, deferred):** schema designed so an optional `content_view_events`-style table (flag-gated, dimension-stripped: coarse referrer host only, no UA/IP, k-anon enforced) can be added without reworking the metrics API. Not built now.

#### `metrics_daily` table (migration `0020`)

```ts
// packages/schema/src/metrics.ts (new)
export const metricsDaily = pgTable('metrics_daily', {
  id: uuid('id').defaultRandom().primaryKey(),
  day: date('day').notNull(),                 // UTC calendar day
  metric: varchar('metric', { length: 64 }).notNull(), // e.g. 'content.views.total'
  dimension: varchar('dimension', { length: 64 }),     // e.g. content type, or null for global
  value: bigint('value', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uq_metrics_daily_day_metric_dim').on(t.day, t.metric, t.dimension),
  index('idx_metrics_daily_metric_day').on(t.metric, t.day),
]);
```

Metric keys (initial set): `users.total`, `users.new`, `contributors.active`, `content.published.total`, `content.new` (dim=type), `content.views.total`, `content.likes.total`, `content.comments.total`, `hubs.total`, `tags.usage.total` (dim=tag, top-N only). Snapshots store **cumulative totals**; daily deltas are computed at query time (`day.total - prevDay.total`).

#### Rollup plugin (`layers/base/server/plugins/metrics-rollup.ts`, new)

Modeled on `registry-heartbeat.ts`:
- Skip in test env; opt-in via `config.publicApiSettings.metrics.enabled`.
- On boot, compute ms to next 00:05 UTC, then `setInterval` 24h. Clean teardown on `close`.
- Each run: one transaction of `INSERT ... ON CONFLICT (day,metric,dimension) DO UPDATE` (idempotent — safe to re-run; pins [[feedback_test_populates_both_sources]] single-source discipline).
- Computes snapshots from the same queries `getPlatformStats` uses plus `SUM(view_count)` etc.
- **Backfill on first run / via admin button:** metrics derivable from `createdAt`/`publishedAt` (`users.new`, `content.new`, cumulative `users.total`, `content.published.total`) are backfilled for all history with `date_trunc('day', ...)` group-bys. Cumulative engagement (`content.views.total` etc.) **cannot** be backfilled (only current cumulative value exists) — those series start at deploy. Document the "engagement metrics available since `<first rollup day>`" caveat in the API response (`since` field) and docs.

### 2.4 Endpoints (`layers/base/server/api/public/v1/metrics/`)

All require the relevant scope via `requireApiScope`, validate query with Zod (400 on bad input), return allow-list serialized JSON, and are covered by the OpenAPI spec. Heavier endpoints get a short server-side cache (see 2.6).

| Route | Scope | Phase | Returns |
|---|---|---|---|
| `GET /metrics/overview` | `read:analytics` | 2 | Scorecard: totals + 7d/30d deltas for users, active contributors, content (by type), hubs, total views/likes/comments, aggregate engagement rate. Deltas use rollups when present, else timestamp-derived where possible. |
| `GET /metrics/timeseries` | `read:analytics` | 3 | `?metric=&interval=day|week|month&from=&to=` series from `metrics_daily`. Returns `{ metric, interval, points:[{date,value,delta}], since }`. |
| `GET /metrics/content/top` | `read:analytics` | 2 | `?metric=views|likes|comments&type=&limit=` lifetime leaderboard of public content (title, slug, author attribution, counts, canonicalUrl). Reuses `PublicContentSummary` shape. |
| `GET /metrics/tags/trending` | `read:analytics` | 2 (lifetime), 3 (windowed) | Top tags by `usageCount` (Phase 2) / by new-usage delta (Phase 3). k-anon applied. |
| `GET /metrics/contributors/top` | `read:analytics` | 2 | Top public-profile contributors by published-content count + engagement received. Public users only. |
| `GET /metrics/engagement` | `read:analytics` | 2 | Aggregate ratios + funnels: likes/views, comments/views; learning enroll→complete; events capacity→attendance; contest entries. All instance-aggregate. |
| `GET /metrics/federation` | `read:federation` (+ `metrics.federation` flag) | 2 | Reach: peer-instance count, active mirrors, hub/follower counts, content received/sent by **domain** (k-anon). 404 when flag off. |

`limit` bounded 1..100; default 20. All counts exclude private/draft/deleted/suspended at the SQL `WHERE` level (not post-filtered) so indexes are used ([[feedback_editor_db_perf_patterns]]: an index is only used if the WHERE references it). Reuse `idx_content_items_feed_popular (viewCount DESC, id DESC)` for `content/top?metric=views`; add composite indexes only if EXPLAIN shows a scan.

### 2.5 Serializers (`packages/server/src/publicApi/serializers.ts`)

Add allow-list serializers + row/response interfaces: `MetricsOverview`, `MetricsTimeseries`, `MetricsTopContent` (reuse `PublicContentSummary`), `MetricsTopTag`, `MetricsTopContributor` (reuse `Pick<PublicUser,...>`), `MetricsEngagement`, `MetricsFederationReach`. Export from `index.ts`. Each is a pure mapper from a query-result row to the documented wire shape — no new columns leak.

### 2.6 Rate limiting + caching

- Metrics endpoints are heavier than item fetches. Add a small **per-process cache** (LRU/Map with TTL) keyed by `(route, queryHash)` for rollup-backed endpoints (`overview`, `timeseries`, `tags/trending`) — data changes at most daily, so a 5-minute TTL is safe and cheap. Bound the cache (e.g. 200 entries) to avoid unbounded growth ([[feedback_editor_db_perf_patterns]]).
- Keep the existing per-key minute bucket; no change needed (`apiKeyRateLimit`). If metrics prove expensive, a future `weight` param on the limiter is the lever (note, not built).

### 2.7 OpenAPI + docs

- Extend `layers/base/server/api/public/v1/openapi.json.get.ts` with the new paths, the `read:analytics`/`read:federation` scopes, and the new response schemas. Verify load-bearing values against the real serializers ([[feedback_verify_loadbearing_values]]).
- `docs/public-api.md`: new `## Metrics` section (endpoint reference), the `## Metrics privacy contract`, expanded `## CORS` section (patterns + `*` safety reasoning + presets), and the new scopes in the scope table.

### 2.8 Tests (write first)

- **Rollup:** snapshot values match a hand-seeded DB; backfill reconstructs `content.new`/`users.new` from timestamps; `ON CONFLICT` re-run is idempotent (same row count, updated value); engagement series has no pre-deploy points.
- **k-anonymity:** a dimension with count `< minBucketSize` is suppressed/bucketed; sum is preserved in `other`/`omitted`.
- **Privacy/exclusion (regression guards):** draft/unlisted/deleted content not counted; suspended/private users excluded from contributors and totals; `/metrics/federation` returns 404 when `metrics.federation` off; metrics return 404 when `features.publicApi` off.
- **Scope gating:** wrong scope → 403; missing key → 401 (middleware); `read:*` covers analytics + federation.
- **Validation:** bad `interval`/`metric`/`limit`/date → 400.
- **Full output path** ([[feedback_integration_test_full_output_path.md]]): assert the serialized HTTP response, not just the helper output, including framework JSON serialization. Add a negative regression for each privacy rule.
- **vue-tsc strict** on touched packages before push ([[feedback_vue_tsc_strict_vs_vitest]]).

---

## Part 3 — Sequencing, versioning, deployment

### Phasing
1. **Phase 1 — CORS** (DONE 2026-06-04, self-contained): `originPatternSchema` validator + swap into `createApiKeySchema`; pure `cors.ts` matcher (`matchOrigin`/`expandOriginPatterns`); middleware uses matcher per-key; admin UI presets (Server-to-server / Allow any `*` / Localhost / Custom) + client validation; `docs/public-api.md` CORS section rewrite. Tests: `cors.test.ts` (22), validator block (origin patterns + `createApiKeySchema.allowedOrigins`), 3 integration round-trips. No migration. Instance-level `defaultAllowedOrigins` deferred to Phase 2. **SHIPPED + LIVE on all 3 (session 190).**
   - `localhost` shorthand expands to 4 patterns: `http://localhost`, `http://localhost:*`, `https://localhost`, `https://localhost:*` (covers default-port and any-port over both schemes).
2. **Phase 2 — Instantaneous metrics** (DONE 2026-06-04, no new table): `read:analytics` scope + activated `read:federation`; opt-in `publicApiMetricsFederation` flag (default OFF); `packages/server/src/publicApi/metrics.ts` (overview, content/top, tags/trending, contributors/top, engagement, federation) reading existing counters/timestamps; six routes under `metrics/`; OpenAPI + docs (Metrics section + privacy contract); `metrics.integration.test.ts` (10) seeding real data. Audit fix: counter SUMs use `::float8` (int4-overflow safe), and `PUBLIC_EVENT_STATUSES` corrected to enum-valid values. Caching deferred (direct queries fine at current volume; per-key rate limit caps abuse). **SHIPPED + LIVE on all 3 (session 190).**
3. **Phase 3 — Rollups + time-series** (DONE 2026-06-04): `metrics_daily` table (migration `0020`, `dimension` NOT NULL `''` to keep the unique index idempotent), `metricsRollup.ts` (`runDailyRollup` idempotent upsert, `backfillMetricsDaily` deterministic survivorship history from timestamps, `getMetricsTimeseries` with day/week/month JS bucketing — flow=sum, cumulative=last), `metrics-rollup` Nitro plugin (backfill-if-empty + 6h refresh, opt-in on `publicApi`), `GET /metrics/timeseries` route. Engagement (views/likes/comments) series begin at first rollup (no backfillable history); count-based series backfilled fully. `metricsRollup.integration.test.ts` (10). Windowed deltas in overview/tags deferred (the timeseries endpoint covers the need).
4. **Phase 4 (deferred, design-only here) — Event tracking:** flag-gated, dimension-stripped event table for hourly/source granularity, if demanded.

Each phase is independently shippable and independently valuable.

### Package version bumps
- `@commonpub/schema` — minor (new validator + `metrics_daily` table in Phase 3).
- `@commonpub/config` — minor (`publicApiSettings`).
- `@commonpub/server` — minor (`cors.ts`, metrics serializers, rollup query helpers).
- `@commonpub/layer` (base) — minor (routes, middleware, plugin, admin UI). Mind caret-semver across `0.x` minor boundary ([[feedback_caret_semver_0x_minor_bump]]); verify each package actually changed before publish ([[feedback_verify_packages_changed_before_publish]]).
- Publish order: config/schema → server → layer. Poll npm before consumer install ([[feedback_npm_propagation_lag]]); `pnpm publish:layer` for the layer ([[feedback_pnpm_publish_layer]]).

### Migration + deploy
- Phase 3 only: migration `0020_*` (generate via drizzle-kit, commit). Applied by `db-migrate.mjs` on deploy; never hand-edit over SSH ([[feedback_use_deploy_migrations_not_ssh]]). curl `/api/health` + a metrics endpoint after deploy; deploy health checks are warn-only ([[feedback_deploy_health_check_warn_not_fail]]).
- Verify flag state empirically before claiming dormant ([[feedback_verify_flag_state]]): `curl /api/features` and the metrics endpoints on each instance post-deploy.

### Session log
- Log under `docs/sessions/NNN-*.md` (Rule 13) and refresh `docs/STATUS.md` ([[reference_status_runbook]]).

---

## Open questions / future work (non-blocking)
1. **Contributor opt-out column** — leaderboards are public-by-default now; add `users.excludeFromLeaderboards` later if requested (migration + profile toggle).
2. **Event-tracking dimensions** — when Phase 4 is taken up, decide the exact stripped dimension set (referrer host only? coarse country via privacy-preserving geo?) and retention window.
3. **Per-endpoint rate-limit weighting** — only if metrics queries prove hot under real keys.
4. **Materialized view for `instance`/`overview`** — current per-request counts are fine at commonpub/deveco volume; revisit if hot.
