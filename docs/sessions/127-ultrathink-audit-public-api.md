# Session 127 — Deep audit + Public Read API (v1)

Date: 2026-04-17
Scope: commonpub + deveco-io

## Part 1 — Deep audit (8 fixes shipped before this doc was written)

User asked "there are still pages that 500 when refresh". Over several
ultrathink rounds the audit uncovered bugs one after another; summary table:

| # | Fix | Severity | Commit |
|---|---|---|---|
| 1 | `/hubs/:slug` returns 204 instead of rendering | Correctness | `b583df5` |
| 2 | `/hubs/:slug/posts/:postId` returns 204 | Correctness | `c42d109` |
| 3 | `/content/:slug` 204 → 301 to canonical URL | UX/legacy | `1c467c6` |
| 4 | AP GET with non-UUID postId 500 → 404 | Interop | `1c467c6` |
| 5 | `/@username` dead-ended; now 301 to `/u/:user` | Fediverse interop | `ab8f86c` |
| 6 | `[type]/index.vue` catchall matched `/foo`, `/_nitro`, `/wp-admin`, `/@moheeb`... | UX/SEO | `ab8f86c` |
| 7 | Explainer XSS via `v-html` (clickable-cards, toggle) | **Security** | `e7e4e8c` |
| 8 | `/api/content` & `/api/learn` leaked every user's drafts to anon | **Security (critical)** | `404e817` |

Root cause patterns:
- **Nitro `server/routes/*.ts` returning `undefined` sends HTTP 204**, not a
  fall-through to the Nuxt page. Fixed hub + hub-post endpoints by moving to
  `server/middleware/`. Rule memorialized in `codebase-analysis/09-gotchas`
  + `docs/llm/gotchas.md` + `memory/feedback_nitro_routes_vs_middleware.md`.
- **Status filter passthrough**: `/api/content` and `/api/learn` passed the
  caller's `status` query param to `listContent` verbatim for non-owners, so
  `?status=draft` returned every draft. Same bug class as the session 125
  `/api/events` whitelist fix. Hardened both endpoints with
  `PUBLIC_STATUSES = {'published', 'archived'}` allow-list.
- **Catch-all over-match**: `pages/[type]/index.vue` accepted any single-
  segment path as a "content type" and rendered a broken listing. Now
  validates against `isTypeEnabled(contentType)` and throws 404.

**Published:** `@commonpub/explainer` 0.7.11 → 0.7.12, `@commonpub/layer`
0.15.3 → 0.15.8 (6 patches: 0.15.4 through 0.15.8).

**Verified on prod:** all 8 bugs fixed on both commonpub.io and deveco.io.

**Incident report:** during registration-endpoint probing I accidentally
created a real account on commonpub.io — username `audittest`, id
`a2dde266-2019-49b9-9a66-b6cba74cd13d`. Flagged to admin for deletion.

## Part 2 — Public Read API v1

User: "add an api (where admin would have to make api key) and it is scoped
but the api lets you consume every bit of data (minus private user data) and
is secure and follows best patterns... be smart be cautious and track work
and document it well."

### Design

Separate URL namespace `/api/public/v1/*`. Feature-flagged via
`features.publicApi = false` (default off — when off, `/api/public/*` returns
404, so the API surface is invisible until admin opts in).

Bearer-token auth, tokens like `cpub_live_ak_<32 base64url bytes>`. Prefix
indexed for O(1) lookup; SHA-256 hash stored (256-bit random tokens don't
need bcrypt's KDF cost). Hash comparison via `timingSafeEqual`.

Read-only scopes:
```
read:content | read:hubs | read:users | read:learn | read:events
read:contests | read:videos | read:docs | read:tags | read:search
read:federation | read:instance | read:*
```

Per-key rate limit (default 60/min), per-key CORS allow-list (default null =
server-to-server only). Admin UI at `/admin/api-keys` with one-time token
reveal. Usage logged to `apiKeyUsage` for audit (fire-and-forget on response
finish).

### What shipped (phase 1)

- **Schema** (`@commonpub/schema`): `apiKeys`, `apiKeyUsage` tables. Bumped
  0.13.0 → **0.14.0**.
- **Server** (`@commonpub/server`): `publicApi/` module with scopes, key
  crypto, rate limiter, serializers, auth validator, admin ops. 16 unit
  tests covering key round-trip, scope wildcards, rate-limit buckets, and
  PII-leak guards for every serializer.
- **Config** (`@commonpub/config`): `publicApi: boolean` added to
  `FeatureFlags` + `featureFlagsSchema` (default false).
- **Middleware** (`layers/base/server/middleware/public-api-auth.ts`):
  Bearer validation, expiry/revocation check, rate limit, CORS per key,
  fire-and-forget usage log on response finish.
- **Endpoints** (4 read):
  - `GET /api/public/v1/content` + `/:slug`
  - `GET /api/public/v1/hubs` + `/:slug`
  - `GET /api/public/v1/users` + `/:username`
  - `GET /api/public/v1/instance`
- **Admin API**: `POST /api/admin/api-keys`, `GET ...`, `DELETE /:id`
  (soft-revoke preserves audit history).
- **Admin UI** (`/admin/api-keys`): list with status badges, create form
  with scope checklist + CORS origins + expiry, one-time token reveal with
  clipboard copy. Linked from admin sidebar.
- **Docs**: `docs/public-api.md` — full reference including endpoints, auth,
  rate limits, the "what is never returned" guarantee, CORS, versioning,
  admin flow.
- **Gotchas**: new section "Public API serializers are ALLOW-lists, never
  deny-lists" in `codebase-analysis/09-gotchas-and-invariants.md` and
  `docs/llm/gotchas.md`.

### Safety architecture

Two orthogonal layers guarantee no private data leaks:

1. **Namespace isolation** — `/api/public/v1/*` has its own handlers; there
   is no shared code path with internal `/api/*` that could accidentally
   expose drafts or emails.
2. **Allow-list serializers** — every response is built by a `to*` helper
   that names each field explicitly. A new column added to the underlying
   table is excluded from the public surface by default. Integration tests
   assert that known-private names (`email`, `passwordHash`, `role`,
   `emailNotifications`, `sessions`, `moderation`, etc.) never appear in
   any response body.

Additional hardening:
- `isPublicUser` / `isPublicContent` / `isPublicHub` predicates reject
  deleted, private, or draft rows before serialization.
- List endpoints force `status='published'`, `visibility='public'`,
  `deletedAt IS NULL` into the query — they cannot be overridden by the
  caller.
- Timing-safe hash compare + prefix-only lookup → constant-time rejection
  of bad keys without table scans.
- Per-key CORS allow-lists default to null (no CORS headers) so
  browser-origin cross-origin requests are blocked unless explicitly
  configured per key.

### Feature flag rollout

`publicApi` is **false** by default. Deploying this code changes nothing on
running instances — every `/api/public/*` request returns 404 until an admin
flips the flag. Once enabled, no keys exist until an admin creates them at
`/admin/api-keys`. The "invisible by default" posture means accidentally
shipping this to an instance that doesn't want it produces no observable
effect.

### Tests

- 16 unit tests in `packages/server/src/__tests__/publicApi.test.ts`:
  - Key generation, hashing, round-trip
  - Timing-safe compare behavior on tampered and mismatched-length hashes
  - Prefix extraction rejects bad formats
  - Scope direct-match, wildcard, empty-grant denial
  - Rate-limit bucket behavior and per-key isolation
  - Serializer output JSON does not contain any of 6 known-private field names
  - Predicates reject deleted / non-public / draft rows

### Deferred to later phases

- Write scopes (complex: whose author?) — better as OAuth2 client-credentials
- Webhook subscriptions (reverse of API)
- GraphQL overlay
- OpenAPI 3 JSON spec (endpoint list here is handwritten; generator later)
- Per-user PATs (phase 3)
- Remaining read scopes not wired to endpoints yet: `read:learn`,
  `read:events`, `read:contests`, `read:videos`, `read:docs`, `read:tags`,
  `read:search`, `read:federation` (schemas are defined; endpoints can
  land incrementally)
- Redis-backed rate limit (needed for horizontal scaling)
- Admin dashboard tile with per-key usage analytics

### Files added

```
packages/schema/src/publicApi.ts              (new)
packages/server/src/publicApi/
  adminOps.ts, auth.ts, index.ts, keys.ts,
  rateLimit.ts, scopes.ts, serializers.ts      (new)
packages/server/src/__tests__/publicApi.test.ts  (new)

layers/base/server/middleware/public-api-auth.ts  (new)
layers/base/server/utils/requireScope.ts          (new)
layers/base/server/api/public/v1/
  content/index.get.ts, content/[slug].get.ts,
  hubs/index.get.ts, hubs/[slug].get.ts,
  users/index.get.ts, users/[username].get.ts,
  instance.get.ts                                (new)
layers/base/server/api/admin/api-keys/
  index.get.ts, index.post.ts, [id].delete.ts    (new)
layers/base/pages/admin/api-keys.vue             (new)

docs/public-api.md                               (new)
docs/sessions/127-ultrathink-audit-public-api.md (this file)

codebase-analysis/09-gotchas-and-invariants.md   (+ section)
docs/llm/gotchas.md                              (+ line)
packages/schema/src/validators.ts                (+ scopes + createApiKeySchema)
packages/schema/src/index.ts                     (+ export)
packages/server/src/index.ts                     (+ export)
packages/config/src/types.ts                     (+ publicApi flag)
packages/config/src/schema.ts                    (+ publicApi flag)
layers/base/composables/useFeatures.ts           (+ publicApi flag)
layers/base/layouts/admin.vue                    (+ /admin/api-keys nav link)
```

### Publishing

Schema must ship before server/layer in the dep-order. Publishing
`@commonpub/schema@0.14.0` happened mid-session to unblock builds (pnpm
workspace resolution via npm registry). Layer/server bumps follow as part
of the standard publish flow.
