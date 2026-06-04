# Public Read API

A scoped, admin-provisioned REST API for reading CommonPub data from outside the instance — analytics, aggregators, mirror sites, third-party clients, bots.

## Contents
1. [Status and scope](#status-and-scope)
2. [Authentication](#authentication)
3. [Scopes](#scopes)
4. [Rate limiting](#rate-limiting)
5. [Endpoints](#endpoints)
6. [Metrics](#metrics)
7. [Metrics privacy contract](#metrics-privacy-contract)
8. [Errors](#errors)
9. [What is NEVER returned](#what-is-never-returned)
10. [CORS](#cors)
11. [Versioning and deprecation](#versioning-and-deprecation)
12. [Creating a key (admin)](#creating-a-key-admin)
13. [Revoking a key (admin)](#revoking-a-key-admin)

## Status and scope

- **v1** — read-only, phase 2 expanded coverage.
- Feature-flagged off by default. Admin must enable `features.publicApi = true` in `commonpub.config.ts` or via the admin settings panel before any `/api/public/v1/*` route responds.
- When the flag is off, every endpoint returns `404 Not Found` — the API surface is invisible on instances that haven't opted in.
- Write scopes, webhook subscriptions, and GraphQL are explicitly deferred to later phases.

## Authentication

Every request must include an `Authorization: Bearer <token>` header. Tokens look like:

```
cpub_live_ak_xF9kMpQ2...
```

- Keys are admin-created at `/admin/api-keys`.
- The raw token is shown **once** at creation and never again — the server only stores a SHA-256 hash. Copy it somewhere safe before closing the reveal panel.
- Revoked keys return `401`.
- Expired keys return `401` with `API key expired` so consumers can distinguish rotation-required from invalid.

### Example

```bash
curl -H "Authorization: Bearer cpub_live_ak_xF9kMpQ2..." \
     https://commonpub.io/api/public/v1/instance
```

Never put the token in a query string — it will end up in access logs, referrers, and browser history. Header only.

## Scopes

Scopes are read-only in v1. A key must hold the listed scope for each endpoint. `read:*` is a shortcut for all read scopes but should be reserved for trusted internal consumers.

| Scope | Allows |
|---|---|
| `read:content` | `/content`, `/content/:slug`, `/search` |
| `read:hubs` | `/hubs`, `/hubs/:slug` |
| `read:users` | `/users`, `/users/:username` |
| `read:instance` | `/instance` |
| `read:learn` | `/learn`, `/learn/:slug` |
| `read:events` | `/events`, `/events/:slug` (feature-gated) |
| `read:contests` | `/contests`, `/contests/:slug` (feature-gated) |
| `read:videos` | `/videos`, `/videos/:id` (feature-gated) |
| `read:docs` | `/docs`, `/docs/:slug` (feature-gated) |
| `read:tags` | `/tags` |
| `read:search` | `/search` |
| `read:analytics` | `/metrics/overview`, `/metrics/content/top`, `/metrics/tags/trending`, `/metrics/contributors/top`, `/metrics/engagement` |
| `read:federation` | `/metrics/federation` (also needs `features.publicApiMetricsFederation`) |
| `read:*` | every `read:...` scope |

A wrong-scope request returns `403 Missing scope: <scope>`.

## Rate limiting

Every key has a per-minute request limit (default 60, admin-configurable per key). Responses include:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 52
X-RateLimit-Reset: 1776458223
```

Exceeding the limit returns `429 Rate limit exceeded`. The `Reset` field is a Unix timestamp in seconds.

Limits are per-key; rotating keys does not reset a window (each key has its own bucket). Multi-instance web-tier deployments currently run per-process limits — migrate to Redis before scaling horizontally.

## Endpoints

All responses are `application/json; charset=utf-8`. Timestamps are ISO 8601 strings in UTC.

### `GET /api/public/v1/content`

Scope: `read:content`. List published content items.

Query parameters:
- `type` — `project`, `blog`, or `explainer`
- `tag` — tag slug
- `authorId` — UUID
- `categoryId` — UUID
- `difficulty` — `beginner` | `intermediate` | `advanced`
- `sort` — `recent` (default), `popular`, `featured`
- `limit` — 1..100 (default 20)
- `offset` — default 0

Response:
```json
{
  "items": [
    {
      "id": "cf0a91a0-...",
      "type": "blog",
      "title": "Airboat with Arduino Uno Q",
      "slug": "airboat-with-arduino-uno-q",
      "description": "Remote-Controlled Airboat...",
      "coverImageUrl": "https://...",
      "difficulty": null,
      "publishedAt": "2026-04-15T01:10:49.840Z",
      "updatedAt": "2026-04-15T01:11:08.607Z",
      "viewCount": 18,
      "likeCount": 2,
      "commentCount": 0,
      "author": {
        "id": "...",
        "username": "jeremybobbin",
        "displayName": "Jeremy",
        "avatarUrl": null
      },
      "canonicalUrl": "https://commonpub.io/u/jeremybobbin/blog/airboat-with-arduino-uno-q"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

### `GET /api/public/v1/content/:slug`

Scope: `read:content`. Single content detail including block content and tags.

Optional query: `author=<username>` to disambiguate user-scoped slugs.

Drafts, unlisted, and private content always return `404`.

### `GET /api/public/v1/hubs`

Scope: `read:hubs`. List hubs.

Query: `type` (`community` | `product` | `company`), `limit`, `offset`.

### `GET /api/public/v1/hubs/:slug`

Scope: `read:hubs`. Hub detail.

### `GET /api/public/v1/users`

Scope: `read:users`. List public-profile active users.

Query: `q` (search username/displayName), `limit`, `offset`.

Users with `profileVisibility != 'public'`, deleted users, and suspended accounts are filtered out.

### `GET /api/public/v1/users/:username`

Scope: `read:users`. Single user public profile.

### `GET /api/public/v1/learn`, `/learn/:slug`

Scope: `read:learn`. Requires `features.learning`. List published learning paths or fetch a single one. Fields: id, title, slug, description, coverImageUrl, difficulty, lessonCount, enrollmentCount, publishedAt, createdAt, author, canonicalUrl.

### `GET /api/public/v1/events`, `/events/:slug`

Scope: `read:events`. Requires `features.events`. Non-owner status filter whitelisted to `{published, active, completed}`; anything else coerces to no filter (same pattern as the internal `/api/events` hardening). Fields include eventType, status, location, locationUrl, startAt, endAt, timezone, capacity, attendeeCount, waitlistCount, hubId, host, canonicalUrl.

### `GET /api/public/v1/contests`, `/contests/:slug`

Scope: `read:contests`. Requires `features.contests`. Only `upcoming`/`active`/`judging`/`completed` statuses are returned; draft and cancelled are excluded.

### `GET /api/public/v1/videos`, `/videos/:id`

Scope: `read:videos`. Requires `features.video`. Detail requires a UUID id; returns url, embedUrl, thumbnailUrl, duration, category, view/like counts, author, canonicalUrl.

### `GET /api/public/v1/docs`, `/docs/:slug`

Scope: `read:docs`. Requires `features.docs`. Returns docs sites with pageCount, versionCount, defaultVersion, owner. Individual page contents are not exposed in v1 — phase 2b if there's demand.

### `GET /api/public/v1/tags`

Scope: `read:tags`. All tags ordered by `usageCount DESC` then name. Paginated.

### `GET /api/public/v1/search?q=...`

Scope: `read:search`. Content search (Meilisearch with Postgres fallback). Returns `PublicContentSummary[]` ordered by the search backend's relevance.

### `GET /api/public/v1/openapi.json`

Requires any valid key. Returns an OpenAPI 3.1 spec for the entire API — import into Postman, Insomnia, Swagger UI, or an SDK generator.

### `GET /api/public/v1/instance`

Scope: `read:instance`. Instance metadata — name, counts, enabled features, software version, discovery links.

```json
{
  "name": "CommonPub",
  "description": "Open platform for maker communities",
  "domain": "commonpub.io",
  "software": { "name": "commonpub", "version": "1.0.0" },
  "users": { "total": 3, "activeMonth": 3 },
  "content": { "total": 17 },
  "hubs": { "total": 12 },
  "features": { "content": true, "hubs": true, "federation": true, ... },
  "openRegistrations": true,
  "links": {
    "nodeinfo": "https://commonpub.io/nodeinfo/2.1",
    "webfinger": "https://commonpub.io/.well-known/webfinger",
    "api": "https://commonpub.io/api/public/v1"
  }
}
```

## Metrics

Aggregate, privacy-respecting analytics for DevRel and community reporting. All metrics endpoints are read-only and return aggregates only (never per-user activity). See the [Metrics privacy contract](#metrics-privacy-contract).

### `GET /api/public/v1/metrics/overview`

Scope: `read:analytics`. Instance scorecard: lifetime totals (users, contributors, content by type, hubs, tags, cumulative engagement) plus 7-day and 30-day growth deltas derived from timestamps.

```json
{
  "domain": "commonpub.io",
  "generatedAt": "2026-06-04T00:00:00.000Z",
  "totals": {
    "users": 3, "contributors": 2,
    "content": { "total": 17, "byType": { "project": 9, "blog": 6, "explainer": 2 } },
    "hubs": 12, "tags": 40,
    "engagement": { "views": 1820, "likes": 96, "comments": 14 }
  },
  "recent": {
    "newUsers": { "last7d": 1, "last30d": 3 },
    "newContent": { "last7d": 2, "last30d": 8 },
    "activeContributors": { "last7d": 1, "last30d": 2 }
  },
  "notes": ["..."]
}
```

Per-day engagement time-series (not just cumulative totals) arrives with the Phase 3 daily rollups.

### `GET /api/public/v1/metrics/content/top`

Scope: `read:analytics`. Leaderboard of published, public content. Query: `metric` (`views` | `likes` | `comments`, default `views`), `type` (`project` | `blog` | `explainer`), `limit` (1..100, default 20). Items are `PublicContentSummary` objects with author attribution and canonical URLs.

### `GET /api/public/v1/metrics/tags/trending`

Scope: `read:analytics`. Tags ranked by lifetime `usageCount` (unused tags excluded). Query: `limit`.

### `GET /api/public/v1/metrics/contributors/top`

Scope: `read:analytics`. Public-profile, active users ranked by published, public content, with engagement received. Private, suspended, and deleted profiles are excluded.

```json
{
  "items": [
    { "user": { "id": "...", "username": "alice", "displayName": "Alice", "avatarUrl": null },
      "publishedContent": 9, "totalViews": 1200, "totalLikes": 64,
      "canonicalUrl": "https://commonpub.io/u/alice" }
  ],
  "limit": 20
}
```

### `GET /api/public/v1/metrics/engagement`

Scope: `read:analytics`. Aggregate engagement ratios and funnels: content likes/comments-per-view and average views per item; learning enroll to complete; event capacity to attendance; contest entries. Feature-gated sections (`learning`, `events`, `contests`) are present only when that feature is enabled.

### `GET /api/public/v1/metrics/federation`

Scope: `read:federation`. Federation reach: known instances, active mirrors, accepted followers, and inbound content by origin domain (domain-level only). Query: `limit`.

Opt-in: requires both `features.federation` and `features.publicApiMetricsFederation` (default OFF). When either is off the endpoint returns `404`, keeping the surface invisible. This exposes network-topology data about third-party instances, so enabling it is a deliberate operator decision on top of granting the `read:federation` scope.

## Metrics privacy contract

These rules are enforced in the serializers and queries, not just documented:

- **Aggregates and intentional public leaderboards only.** No endpoint returns per-individual-user activity (no "who viewed or liked what").
- **No new PII, no tracking.** Every metric derives from columns that already exist (denormalized counters, timestamps). No IP, user-agent, email, referrer, or cookie is read, stored, or returned.
- **Public entities only.** Aggregations count only `status='published'`, `visibility='public'`, non-deleted content, and only active, public-profile, non-deleted users, filtered at the SQL level.
- **Contributor attribution is already-public information.** Leaderboards rank only public-profile users by their already-public published content.
- **Federation reach is opt-in and domain-level.** Never per-user; gated by a config flag that defaults OFF.
- **k-anonymity is ready for Phase 3.** Phase 2 exposes only non-pivotable instance aggregates and the intentional contributor leaderboard, so no suppression applies yet; the `METRICS_MIN_BUCKET` threshold guards the user-pivotable breakdowns added with Phase 3 rollups.

## Errors

All errors are JSON bodies:

```json
{ "error": true, "statusCode": 401, "statusMessage": "Invalid API key", "message": "..." }
```

| Code | Meaning |
|---|---|
| `400 Bad Request` | Query parameters or body failed validation |
| `401 Unauthorized` | Missing/invalid/expired key |
| `403 Forbidden` | Key is valid but lacks the required scope |
| `404 Not Found` | Resource not found, feature flag off, or draft/private content requested |
| `429 Too Many Requests` | Key exceeded its per-minute limit |

## What is NEVER returned

This is the core safety guarantee. Serializers for every public endpoint are allow-lists — a new column in the underlying DB table is excluded by default until explicitly added to the `to*` helper. Forbidden categories:

- **Auth**: `email`, `emailVerified`, `passwordHash`, session tokens, 2FA state
- **Role/moderation**: `role`, `status`, admin flags, moderation reports, audit log
- **Private content**: drafts (`status != 'published'`), unlisted (`visibility != 'public'`), deleted (`deletedAt IS NOT NULL`)
- **Private messaging**: all `messages.*` rows, group chats, DMs
- **Feature internals**: instance settings, feature-flag overrides, OAuth2 client secrets
- **Federation internals**: instance keypairs, delivery queues, pending activities
- **Other keys**: API keys themselves (prefix or hash)

If you notice a response leaking any of the above, treat it as a security bug and report it via `GET /api/public/v1/instance` → `instance.links.nodeinfo` → instance contact.

## CORS

By default, no `Access-Control-Allow-Origin` headers are sent on actual (non-preflight) responses. The API is designed for server-to-server use, and browsers will block cross-origin calls until a key opts in.

Each key has a CORS allow-list (`allowedOrigins`) of **origin patterns**. The only wildcard metacharacter is `*`:

| Pattern | Matches |
|---|---|
| `*` | Any origin (wildcard-all). Responds with `Access-Control-Allow-Origin: *`. |
| `localhost` | `http://localhost` and `https://localhost` on any port (shorthand). |
| `https://app.example.com` | That exact origin. |
| `http://localhost:*` | Any port on `http://localhost`. |
| `https://*.example.com` | Any subdomain of `example.com` over https. |
| `*://localhost:*` | Any scheme and any port on localhost. |

When a real request's `Origin` matches a non-wildcard pattern, the server reflects it in `Access-Control-Allow-Origin` and advertises `Vary: Origin`. When the list contains `*`, it responds with the literal `*` (no `Vary`). Only `http`/`https` (or `*`) schemes are accepted; `javascript:`, `data:`, and the like are rejected at key-creation time.

### Why `*` is safe here

This API authenticates with `Authorization: Bearer <token>`, **not cookies**. There are no ambient credentials, and the server never sends `Access-Control-Allow-Credentials`. So `Access-Control-Allow-Origin: *` cannot leak anything: a cross-origin page still cannot obtain a key it does not already possess. CORS here only *enables* legitimate browser clients; the Bearer token is what protects the data. Set `["*"]` when you want a fully open, read-only browser API, or `["localhost"]` for local development.

### Origin validation

The server only reflects an `Origin` that is a syntactically valid web origin (`scheme://host[:port]`, no path, query, whitespace, or control characters). Requests whose `Origin` header is malformed or carries control characters receive no CORS headers, which closes off response-header injection. IPv6-literal hosts (`http://[::1]`) and the `null` origin are not supported.

### Preflight

Preflight (`OPTIONS`) requests bypass authentication (they have to, because the browser does not include the `Authorization` header on preflight) and echo any `Origin` so the browser can proceed to the real request. The real request then goes through the per-key allow-list check above, which is the actual gate.

## Versioning and deprecation

- v1 is stable; breaking changes ship as `/api/public/v2/*` with at least 6 months of overlap.
- Additive changes (new fields, new filter params) can land in v1 without a major bump.
- Response fields are documented as a contract — removing or renaming a field is a breaking change.

## Creating a key (admin)

1. Navigate to `/admin/api-keys` on the instance.
2. Click **New key**. Pick a name, check scopes, optionally set an expiry and CORS origins.
3. Submit. The raw token appears in a green reveal panel at the top of the page — copy it now.
4. Share the token with the consumer through a secure channel (1Password, SSO vault, encrypted email). Do not paste it into a chat that logs messages.

## Revoking a key (admin)

Click **Revoke** in the key table. Soft-delete — the `apiKeyUsage` history is preserved; the key is immediately rejected on next request.

Rotation: revoke, then create a new key and hand it off. There's no in-place "rotate" button because atomic rotation requires cutover coordination with the consumer; explicit revoke-and-issue is safer.

## Per-key usage analytics

`GET /api/admin/api-keys/:id/usage?windowDays=7` (admin-only) returns:

```json
{
  "windowDays": 7,
  "totalRequests": 142,
  "errorCount": 3,
  "errorRate": 0.021,
  "requestsByDay": [{ "day": "2026-04-17", "count": 42 }],
  "topEndpoints": [{ "endpoint": "/api/public/v1/content", "count": 88, "p95LatencyMs": 120 }]
}
```

Rendered inline in the admin table under each key's **Usage** button. Default window is 7 days, max 90. The underlying SQL uses conditional aggregation + `percentile_cont(0.95)` — narrow, indexed query on `(keyId, timestamp)`.

## Audit trail

Every `POST /api/admin/api-keys` and `DELETE /api/admin/api-keys/:id` writes to the instance `audit_logs` table with actions `api_key.create` and `api_key.revoke`. The token itself is never audited — only `id`, `name`, `scopes`, and (for create) `expiresAt` + `rateLimitPerMinute` land in the audit metadata. Per-request traffic goes to a separate `api_key_usage` table for analytics; that table only records the key id, endpoint path (no query string), HTTP status, and latency.
