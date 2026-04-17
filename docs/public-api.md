# Public Read API

A scoped, admin-provisioned REST API for reading CommonPub data from outside the instance — analytics, aggregators, mirror sites, third-party clients, bots.

## Contents
1. [Status and scope](#status-and-scope)
2. [Authentication](#authentication)
3. [Scopes](#scopes)
4. [Rate limiting](#rate-limiting)
5. [Endpoints](#endpoints)
6. [Errors](#errors)
7. [What is NEVER returned](#what-is-never-returned)
8. [CORS](#cors)
9. [Versioning and deprecation](#versioning-and-deprecation)
10. [Creating a key (admin)](#creating-a-key-admin)
11. [Revoking a key (admin)](#revoking-a-key-admin)

## Status and scope

- **v1** — read-only.
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
| `read:content` | `/content`, `/content/:slug` |
| `read:hubs` | `/hubs`, `/hubs/:slug` |
| `read:users` | `/users`, `/users/:username` |
| `read:instance` | `/instance` |
| `read:learn` | (future) `/learn/*` |
| `read:events` | (future) `/events/*` |
| `read:contests` | (future) `/contests/*` |
| `read:videos` | (future) `/videos/*` |
| `read:docs` | (future) `/docs/*` |
| `read:tags` | (future) `/tags/*` |
| `read:search` | (future) `/search` |
| `read:federation` | (future) federated content and instance metadata |
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

By default, no `Access-Control-Allow-Origin` headers are sent on actual (non-preflight) responses — the API is designed for server-to-server use, and browsers will block cross-origin calls.

Per-key CORS allow-lists can be configured at creation time (`allowedOrigins: ["https://app.example.com"]`). When a real request's `Origin` matches, the server reflects it in `Access-Control-Allow-Origin` and advertises `Vary: Origin`. Leave this blank unless you explicitly need browser access.

Preflight (`OPTIONS`) requests bypass authentication (they have to — the browser doesn't include the `Authorization` header on preflight), and echo any `Origin` so the browser can decide whether to proceed to the real request. The real request then goes through the per-key allow-list check.

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

## Audit trail

Every `POST /api/admin/api-keys` and `DELETE /api/admin/api-keys/:id` writes to the instance `audit_logs` table with actions `api_key.create` and `api_key.revoke`. The token itself is never audited — only `id`, `name`, `scopes`, and (for create) `expiresAt` + `rateLimitPerMinute` land in the audit metadata. Per-request traffic goes to a separate `api_key_usage` table for analytics; that table only records the key id, endpoint path (no query string), HTTP status, and latency.
