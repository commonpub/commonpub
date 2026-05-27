# 04 — API Route Inventory

Nitro server routes in `layers/base/server/api/` and federation routes in
`layers/base/server/routes/`. **257 routes as of session 125; ~284 as
of session 150.**

**Routes added since 125 (not yet enumerated below)**:
- `/api/auth/mastodon/start` + `/api/auth/mastodon/callback` (session 139, Phase 2a Mastodon SSO; flag `identity.signInWithRemote`)
- `/api/auth/federated/link.post` + (existing `callback.get`) — Phase 1b/2b
- `/api/admin/storage/backfill-cdn-urls` (session 149)
- `/api/content/import` (session 148, gated `contentImport`)
- `/api/public/v1/**` (session 127, ~13+ routes; gated `publicApi`)
- `/api/realtime/stream` + `/api/messages/:id/stream` (session 130)
- `/api/features` runtime resolver
- `/api/identity/*` routes (Phase 1b runtime; flag-gated)

The auth tables below reflect session-125 state for `/api/auth/*` —
new federated/mastodon entries are documented inline in the source
files (`layers/base/server/api/auth/{federated,mastodon}/`).

Auth column:
- **pub** — public, no auth required
- **auth** — requires authenticated user (`useAuth()` session)
- **owner** — authenticated + resource owner
- **mod** — hub moderator or higher
- **admin** — role ≥ admin (or hub admin for hub-scoped resources)
- **judge** — contestJudges role for the specific contest

## Authentication (Better Auth + AP SSO)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/sign-in-username | pub | Email/username + password |
| POST | /api/auth/sign-up/email | pub | Register |
| POST | /api/auth/delete-user | auth | GDPR delete |
| GET | /api/auth/export-data | auth | GDPR export |
| GET | /api/auth/federated/callback | pub | OAuth callback |
| POST | /api/auth/federated/login | pub | Start AP SSO |
| POST | /api/auth/federated/link | auth | Link federated account |
| GET | /api/auth/oauth2/authorize | pub | OAuth2 authorize |
| POST | /api/auth/oauth2/authorize | auth | Grant |
| POST | /api/auth/oauth2/register | pub | Dynamic client register |
| POST | /api/auth/oauth2/token | pub | Token exchange |

## Profile / user

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/me | auth | Current session |
| GET | /api/profile | auth | Me, full profile |
| PUT | /api/profile | auth | Update profile |
| PUT | /api/profile/theme | auth | Save theme pref |
| GET | /api/users | pub | List |
| GET | /api/users/:username | pub | Public profile |
| GET | /api/users/:username/content | pub | Published content |
| GET | /api/users/:username/feed.xml | pub | User RSS |
| GET | /api/users/:username/followers | pub | — |
| GET | /api/users/:username/following | pub | — |
| GET | /api/users/:username/learning | pub | Enrollments (public) |
| GET | /api/user/hubs | auth | My hubs |

## Content

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/content | pub | List (filters, pagination) |
| POST | /api/content | auth | Create draft |
| GET | /api/content/:id | pub | Detail |
| PUT | /api/content/:id | owner | Update |
| DELETE | /api/content/:id | owner | Soft delete |
| GET | /api/content/:id/versions | pub | Version history |
| GET | /api/content/:id/products | pub | BOM |
| POST | /api/content/:id/products | owner | Link product |
| DELETE | /api/content/:id/products/:productId | owner | Unlink |
| POST | /api/content/:id/products-sync | owner | Sync from partsList blocks |
| POST | /api/content/:id/publish | owner | draft → published |
| POST | /api/content/:id/build | auth | Toggle "I built this" |
| POST | /api/content/:id/fork | auth | Fork |
| POST | /api/content/:id/report | auth | Report |
| POST | /api/content/:id/view | pub | Log view |
| POST | /api/content/import | auth | Import from URL |

## Events (session 124–125)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/events | pub | List (upcoming/featured/past/mine, status whitelist) |
| POST | /api/events | auth | Create |
| GET | /api/events/:slug | pub | Detail |
| PUT | /api/events/:slug | owner | Update |
| DELETE | /api/events/:slug | owner | Delete |
| GET | /api/events/:slug/attendees | pub | RSVP list |
| POST | /api/events/:slug/rsvp | auth | RSVP (auto-waitlist) |
| DELETE | /api/events/:slug/rsvp | auth | Cancel (promote from waitlist) |

## Contests

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/contests | pub | List |
| POST | /api/contests | auth* | Create (gated by `contestCreation` policy) |
| GET | /api/contests/:slug | pub | Detail |
| PUT | /api/contests/:slug | owner | Update |
| DELETE | /api/contests/:slug | admin | Delete |
| POST | /api/contests/:slug/transition | owner | Change state |
| GET | /api/contests/:slug/entries | pub | List entries |
| POST | /api/contests/:slug/entries | auth | Submit entry |
| DELETE | /api/contests/:slug/entries/:entryId | owner | Withdraw |
| POST | /api/contests/:slug/entries/:entryId/vote | auth | Community vote |
| DELETE | /api/contests/:slug/entries/:entryId/vote | auth | Retract |
| GET | /api/contests/:slug/votes | pub | Batch vote leaderboard |
| GET | /api/contests/:slug/judges | pub (if judgingVisibility=public) | List |
| POST | /api/contests/:slug/judges | owner | Add judge |
| POST | /api/contests/:slug/judges/accept | auth | Accept invite |
| DELETE | /api/contests/:slug/judges/:userId | owner | Remove |
| POST | /api/contests/:slug/judge | judge | Submit scores |

*Gate: `contestCreation: 'open' | 'staff' | 'admin'` from `commonpub.config.ts`.

## Hubs

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/hubs | pub | List |
| POST | /api/hubs | auth | Create |
| GET | /api/hubs/:slug | pub | Detail |
| PUT | /api/hubs/:slug | admin | Update |
| DELETE | /api/hubs/:slug | admin | Delete |
| GET | /api/hubs/:slug/members | pub | Members |
| POST | /api/hubs/:slug/join | auth | Join |
| POST | /api/hubs/:slug/leave | auth | Leave |
| PUT | /api/hubs/:slug/members/:userId | admin | Change role |
| DELETE | /api/hubs/:slug/members/:userId | admin | Kick |
| GET/POST | /api/hubs/:slug/invites | admin | Invite tokens |
| GET/POST | /api/hubs/:slug/bans | mod (temp) / admin (perm) | Ban |
| DELETE | /api/hubs/:slug/bans/:userId | mod | Unban |
| GET | /api/hubs/:slug/posts | pub | Feed |
| POST | /api/hubs/:slug/posts | auth+member | Post |
| GET | /api/hubs/:slug/posts/:postId | pub | Detail |
| PUT | /api/hubs/:slug/posts/:postId | owner | Edit |
| DELETE | /api/hubs/:slug/posts/:postId | owner/mod | Delete |
| POST | /api/hubs/:slug/posts/:postId/like | auth | Like |
| POST | /api/hubs/:slug/posts/:postId/vote | auth | Up/down vote |
| POST | /api/hubs/:slug/posts/:postId/pin | mod | Pin |
| POST | /api/hubs/:slug/posts/:postId/lock | mod | Lock |
| GET | /api/hubs/:slug/posts/:postId/poll-options | pub | — |
| POST | /api/hubs/:slug/posts/:postId/poll-vote | auth | Vote |
| GET | /api/hubs/:slug/posts/:postId/replies | pub | — |
| POST | /api/hubs/:slug/posts/:postId/replies | auth+member | Reply |
| GET | /api/hubs/:slug/gallery | pub | Media gallery |
| GET/POST | /api/hubs/:slug/products | pub / admin | — |
| GET/POST | /api/hubs/:slug/resources | pub / admin | — |
| PUT/DELETE | /api/hubs/:slug/resources/:id | admin | — |
| POST | /api/hubs/:slug/resources/reorder | admin | — |
| POST | /api/hubs/:slug/share | auth | Share content to hub |
| GET | /api/hubs/:slug/feed.xml | pub | RSS |

## Learning

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/learn | pub | List paths |
| POST | /api/learn | auth | Create path |
| GET | /api/learn/:slug | pub | Detail |
| PUT/DELETE | /api/learn/:slug | owner | — |
| POST | /api/learn/:slug/enroll / unenroll | auth | — |
| POST | /api/learn/:slug/publish | owner | — |
| GET/POST | /api/learn/:slug/lessons | pub / owner | — |
| PUT/DELETE | /api/learn/:slug/lessons/:lessonId | owner | — |
| GET | /api/learn/:slug/:lessonSlug | pub | Lesson |
| POST | /api/learn/:slug/:lessonSlug/complete | auth | Mark done |
| GET | /api/learn/enrollments | auth | My enrollments |
| GET | /api/learn/certificates | auth | My certs |
| POST | /api/learn/:slug/modules | owner | Add module |
| PUT/DELETE | /api/learn/:slug/modules/:moduleId | owner | — |

## Docs

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET/POST | /api/docs | pub / auth | Sites |
| GET/PUT/DELETE | /api/docs/:siteSlug | pub / owner | — |
| GET | /api/docs/:siteSlug/nav | pub | Tree |
| GET/POST | /api/docs/:siteSlug/pages | pub / owner | — |
| GET/PUT/DELETE | /api/docs/:siteSlug/pages/:pageId | pub / owner | — |
| POST | /api/docs/:siteSlug/pages/:pageId/duplicate | owner | — |
| POST | /api/docs/:siteSlug/pages/reorder | owner | — |
| GET | /api/docs/:siteSlug/search | pub | Meilisearch / FTS |
| POST | /api/docs/:siteSlug/versions | owner | — |
| POST | /api/docs/migrate-content | owner | Legacy md → BlockTuple |

## Videos / Products / Files / Social

**Videos**: GET/POST `/api/videos`, GET `/api/videos/:id`, GET `/api/videos/categories`, POST/PUT/DELETE admin.

**Products**: GET list + slug, GET `/api/products/:slug/content`, PUT/DELETE owner/admin.

**Files**: POST `/api/files/upload` (authed), POST `/api/files/upload-from-url`, DELETE `/api/files/:id` (owner), GET `/api/files/mine`.

**Social**: GET/POST `/api/social/like`, `/api/social/bookmark`, GET `/api/social/bookmarks`, GET `/api/social/comments`, POST comments, DELETE `/api/social/comments/:id`.

## Messaging / Notifications / Realtime

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET/POST | /api/messages | auth | Conversations |
| GET/POST | /api/messages/:conversationId | auth | Thread |
| GET | /api/messages/:conversationId/info | auth | — |
| GET | /api/messages/:conversationId/stream | auth | SSE stream |
| GET | /api/notifications | auth | List |
| GET | /api/notifications/count | auth | Unread count |
| POST | /api/notifications/read | auth | Mark read |
| DELETE | /api/notifications/:id | auth | Dismiss |
| GET | /api/realtime/stream | auth | SSE updates |

## Federation (flag: `federation: true`)

Inbound/outbox: `/.well-known/webfinger`, `/.well-known/nodeinfo`, `/users/:username`, `/users/:username/inbox`, `/users/:username/outbox`, `/users/:username/followers`, `/users/:username/following`, `/actor` (instance Service actor), plus Group actor routes for hubs.

User-facing federation API:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/federation/health | pub | Health |
| GET | /api/federation/timeline | pub | Federated + local timeline |
| GET | /api/federation/content/:id | pub | Detail |
| POST | /api/federation/content/:id/build | auth | Build mark |
| POST | /api/federation/content/:id/fork | auth | Fork remote |
| GET | /api/federation/content/:id/replies | pub | — |
| POST | /api/federation/content/:id/view | pub | Log view |
| GET | /api/federation/remote-actor | pub | Resolve actor |
| POST | /api/federation/follow / unfollow | auth | — |
| POST | /api/federation/like / boost | auth | — |
| POST | /api/federation/reply | auth | — |
| POST | /api/federation/dm | auth | — |
| POST | /api/federation/remote-follow | pub | Mastodon-style |
| POST | /api/federation/resolve-uri | pub | — |
| POST | /api/federation/search | pub | — |
| GET | /api/federation/hub-follow-status | auth | — |
| POST | /api/federation/hub-follow | auth | Follow federated group |
| POST | /api/federation/hub-post / hub-post-reply / hub-post-like | auth | — |
| GET | /api/federation/hub-post-likes | pub | — |
| GET | /api/federated-hubs/:id | pub | Federated hub detail |
| GET | /api/federated-hubs/:id/feed.xml | pub | RSS feed |
| GET | /api/federated-hubs/:id/posts | pub | — |
| GET | /api/federated-hubs/:id/posts/:postId | pub | — |
| GET | /api/federated-hubs/:id/posts/:postId/replies | pub | — |
| GET | /api/federated-hubs/:id/members | pub | — |

Note: federated-hubs lives at `/api/federated-hubs/...` (top-level under
`api/`), **not** under `/api/federation/`. The `/api/federation/` endpoints
are cross-instance actions (follow, like, boost, reply, dm, hub-follow,
search, resolve-uri); federated content lookups live at `/api/federation/
content/*` while federated-hub entity lookups live at `/api/federated-hubs/*`.

## Admin (flag: `admin: true`)

User mgmt: GET `/api/admin/users`, PUT `/api/admin/users/:id/role`, PUT `/api/admin/users/:id/status`, DELETE `/api/admin/users/:id`.

Content mod: GET `/api/admin/content`, PATCH `/api/admin/content/:id`, DELETE `/api/admin/content/:id`, POST `/api/admin/content/bulk-editorial`.

Categories: CRUD at `/api/admin/categories`.

Reports + audit: GET `/api/admin/reports`, POST `/api/admin/reports/:id/resolve`, GET `/api/admin/audit`.

Settings: GET/PUT `/api/admin/settings`, GET `/api/admin/stats`.

Themes (session 154):
| Verb | Path | Notes |
|---|---|---|
| GET | `/api/admin/themes` | Returns `{ builtIn, registered, custom }` — unified theme list for the admin picker |
| POST | `/api/admin/themes` | Create a DB-stored custom theme (`customThemeSchema`); 409 on built-in or duplicate id |
| GET | `/api/admin/themes/:id` | Fetch one custom theme (404 if absent) |
| PUT | `/api/admin/themes/:id` | Update (id in URL must match body) |
| DELETE | `/api/admin/themes/:id` | Delete; resets `theme.default` to `base` if the deleted theme was active (returns `resetDefault: true`) |
| GET | `/api/admin/themes/discover` | Returns `{ defaults }` — canonical base values for every `TOKEN_SPECS` key, used client-side to diff against `getComputedStyle(:root)` |

All theme writes call `invalidateThemeCache()` so the SSR middleware picks up changes within the next request.

Features: GET/PUT `/api/admin/features` (runtime overrides). **As of layer 0.23.2 (session 158)**: PUT persists overrides verbatim — the previous dedup loop compared against `config.features` (already-merged) and silently deleted "matching" overrides, causing flips to revert on next read. Now the user's explicit override is always stored. A future "reset to default" should be a separate DELETE handler.

Search: POST `/api/admin/search/reindex` — rebuild the Meilisearch index from Postgres.

Homepage: GET/PUT `/api/admin/homepage/sections`.

Navigation (session 124): GET/PUT `/api/admin/navigation/items`.

Federation admin (extensive):
- Stats, clients (register OAuth), activity log, pending, retry, refederate, repair-types
- Mirrors: full CRUD + backfill
- Hub mirrors: full CRUD + backfill
- Trusted instances: list/add/remove

## Public/utility

- GET /api/features — client-side feature flags
- GET /api/navigation/items — nav config for NavRenderer
- GET /api/categories
- GET /api/search (local)
- GET /api/search/federated
- GET /api/search/trending
- GET /api/stats
- GET /api/health
- GET /api/openapi — generated OpenAPI 3 spec
- GET /api/image-proxy — image CORS proxy
- GET /api/cert/:code — verify learning certificate
- **GET /api/layouts/by-route?path=/some-path** (session 157, Phase 1 of the layout engine) — resolves the active layout for an SSR page. Gated by `features.layoutEngine` (default OFF) — returns `404 "Layout engine not enabled"` when the flag's off so the legacy `HomepageSectionRenderer` stays in charge during the migration window. Module-level 60s cache keyed by path. Returns slim shape `{ zones, pageMeta, state }`. **Session 158**: cache lifted into `server/utils/layoutCache.ts` so the admin write API can invalidate it cleanly. `by-route.get.ts` re-exports `invalidateLayoutsByRouteCache` for backwards compat.

**Admin layout write API** (session 158, Phase 1c) — 9 routes under `/api/admin/layouts/*`, all gated on `requireFeature('admin') + requireFeature('layoutEngine') + requireAdmin(event)`. Every write handler calls `invalidateLayoutsByRouteCache()` before returning (statically enforced by `handlers-contract.test.ts`):
- `GET    /api/admin/layouts` — list (optional `?scope=route|virtual|custom-page`)
- `POST   /api/admin/layouts` — create (409 if scope already exists)
- `GET    /api/admin/layouts/[id]`
- `PUT    /api/admin/layouts/[id]` — update; rejects scope change (400)
- `DELETE /api/admin/layouts/[id]` — cascade through rows + sections + versions
- `POST   /api/admin/layouts/[id]/publish` — snapshot + flip state=published
- `GET    /api/admin/layouts/[id]/versions` — version history
- `POST   /api/admin/layouts/[id]/versions/[versionId]/revert` — restore from snapshot (snapshot itself never touched; immutable)
- `POST   /api/admin/layouts/seed-homepage` — idempotent bootstrap for the homepage canary (creates + publishes a default hero + content-feed layout at `('route', '/')` if none exists)

## Gotchas worth remembering

- `GET /api/events` accepts `status` query but is whitelisted — only `published`, `active`, `upcoming`, `past`, `featured`, `mine` are honored (security fix in session 125).
- `GET /api/contests/:slug/judges` visibility depends on `contest.judgingVisibility`.
- `GET /api/contests/:slug/votes` returns a batch map `entryId → count` (built for the list view, not individual fetches).
- `POST /api/content/:id/publish` always triggers federation if enabled; no separate "federate" endpoint.
- `POST /api/files/upload` requires multipart; `upload-from-url` does SSRF checks in server/import/ssrf.ts before fetching.
- All `:username` routes are case-insensitive (usernames normalized).
- `GET /api/me` returns null (not 401) if unauthenticated — used by the client to detect session state.
