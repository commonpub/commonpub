# 04 — API Route Inventory

Nitro server routes in `layers/base/server/api/` and ActivityPub/site
routes in `layers/base/server/routes/`. Re-verified session 181
(2026-06-01): **311 `.ts` files under `server/api/` (305 route handlers +
6 colocated test files) + 22 files under `server/routes/`.** These are
*files*, not method/path pairs — some paths have multiple method files
(`index.get.ts` + `index.post.ts`), and several `routes/` files dispatch
multiple AP methods internally.

Major groups added since the original (session-125) inventory and now
folded into the tables below:
- `/api/content/feed` — keyset/cursor feed (session 179; see Content)
- `/api/auth/mastodon/start` + `/api/auth/mastodon/callback` (session 139, Mastodon SSO; flag `identity.signInWithRemote`)
- `/api/auth/federated/link.post` + `callback.get` — Phase 1b/2b
- `/api/admin/api-keys/*` — public-API key issuance (4 routes; see Admin)
- `/api/admin/storage/backfill-cdn-urls` (session 149)
- `/api/content/import` (session 148, gated `contentImport`)
- `/api/public/v1/**` — **20 route files** (session 127; gated `publicApi`)
- `/api/realtime/stream` + `/api/messages/:conversationId/stream` (session 130)
- `/api/contests/:slug/stakeholders/*` — view-only reviewers (3 routes; sessions 171–174)
- `/api/users/:username/follow` (POST/DELETE — local follow)
- `/api/features` runtime resolver

There is **no `/api/identity/*` route group** — identity runtime is a
Nitro startup plugin (`plugins/identity-startup.ts`), not REST routes.
RBAC (session 175) is enforced via middleware/role checks on existing
routes (e.g. `admin/users/:id/role.put`) plus the `admin/api-keys/*`
scoped-key surface — there is no `/api/rbac/*` group either.

Route-group file counts (session 181 spot-count, `server/api/`, test files excluded):

| Group | Files | Group | Files | Group | Files |
|---|---|---|---|---|---|
| admin | 65 | learn | 18 | videos | 7 |
| hubs | 38 | content | 17 | messages | 6 |
| federation | 23 | docs | 16 | federated-hubs | 6 |
| contests | 20 | auth | 12 | products | 5 |
| public (v1) | 20 | users | 9 | notifications | 4 |
| events | 8 | social | 8 | files | 4 |
| search/profile | 3 each | (single-file: features, health, me, stats, openapi, image-proxy, cert, categories, homepage, navigation, layouts, realtime, user) | | |

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
| POST | /api/auth/federated/link | pub* | Link federated account — *NOT session-gated; authenticates via body `identity`+`password` + a single-use server-side `linkToken` (like sign-in), then links + sets the session cookie. Gated by `requireFeature('federation')`. |
| GET | /api/auth/oauth2/authorize | auth | OAuth2 authorize (requireAuth — returns consent params for the logged-in user) |
| POST | /api/auth/oauth2/authorize | auth | Grant |
| POST | /api/auth/oauth2/register | pub | Dynamic client register |
| POST | /api/auth/oauth2/token | pub | Token exchange |

## Profile / user

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/me | pub* | Current session — *reads `event.context.auth`, returns `{user:null,session:null}` (not 401) when anon; used by the client to detect session state |
| GET | /api/profile | auth | Me, full profile |
| PUT | /api/profile | auth | Update profile |
| PUT | /api/profile/theme | auth | Save theme pref |
| GET | /api/users | pub | List |
| GET | /api/users/:username | pub | Public profile |
| GET | /api/users/:username/content | pub | Published content |
| GET | /api/users/:username/feed.xml | pub | User RSS |
| GET | /api/users/:username/followers | pub | — |
| GET | /api/users/:username/following | pub | — |
| POST | /api/users/:username/follow | auth | Follow user |
| DELETE | /api/users/:username/follow | auth | Unfollow |
| GET | /api/users/:username/learning | pub | Enrollments (public) |
| GET | /api/user/hubs | auth | My hubs |

## Content

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/content | pub | List — OFFSET pagination `{items,total}` (filters, popular/featured/editorial sorts) |
| GET | /api/content/feed | pub | Keyset/cursor feed `{items,nextCursor}` — recency order, no COUNT (session 179) |
| POST | /api/content | auth | Create draft |
| GET | /api/content/:id | pub | Detail |
| PUT | /api/content/:id | owner | Update |
| DELETE | /api/content/:id | owner | Soft delete |
| GET | /api/content/:id/versions | pub | Version history |
| GET | /api/content/:id/products | pub | BOM |
| POST | /api/content/:id/products | owner | Link product |
| DELETE | /api/content/:id/products/:productId | owner | Unlink |
| POST | /api/content/:id/products-sync | owner | Replace the content's product links — takes an explicit `items` array in the body (delete-all-then-insert via `syncContentProducts`); does NOT itself read partsList blocks (that derivation, if any, is client-side) |
| POST | /api/content/:id/publish | owner | draft → published |
| POST | /api/content/:id/build | auth | Toggle "I built this" |
| POST | /api/content/:id/fork | auth | Fork |
| POST | /api/content/:id/report | auth | Report |
| POST | /api/content/:id/view | pub | Log view |
| POST | /api/content/import | auth | Import from URL |

## Events (session 124–125)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/events | pub | List — filter flags `upcoming`, `featured`, `myEvents` (+ `hubId`, status whitelist). NOTE: there is no `past` filter, and the "my events" flag is `myEvents=true`, not `mine`. |
| POST | /api/events | auth | Create |
| GET | /api/events/:slug | pub | Detail |
| PUT | /api/events/:slug | owner/admin | Update (creator or admin — `isAdmin` override) |
| DELETE | /api/events/:slug | owner/admin | Delete (creator or admin) |
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
| DELETE | /api/contests/:slug | owner/admin | Delete (`ownerOrPermission(…'contest.manage')` — owner OR admin; flag-on, a `contest.manage` role) |
| POST | /api/contests/:slug/transition | owner | Change state |
| GET | /api/contests/:slug/entries | pub | List entries |
| POST | /api/contests/:slug/entries | auth | Submit entry |
| DELETE | /api/contests/:slug/entries/:entryId | owner | Withdraw |
| POST | /api/contests/:slug/entries/:entryId/vote | auth | Community vote |
| DELETE | /api/contests/:slug/entries/:entryId/vote | auth | Retract |
| GET | /api/contests/:slug/votes | pub | Batch vote leaderboard |
| GET | /api/contests/:slug/judges | pub (if judgingVisibility=public) | List |
| POST | /api/contests/:slug/judges | owner/admin | Add judge (`ownerOrPermission(…'contest.manage')`) |
| POST | /api/contests/:slug/judges/accept | auth | Accept invite |
| DELETE | /api/contests/:slug/judges/:userId | owner/admin | Remove (`ownerOrPermission`) |
| POST | /api/contests/:slug/judge | judge | Submit scores |
| GET | /api/contests/:slug/stakeholders | owner/admin | List view-only reviewers (session 174) |
| POST | /api/contests/:slug/stakeholders | owner/admin | Add stakeholder (`ownerOrPermission`) |
| DELETE | /api/contests/:slug/stakeholders/:userId | owner/admin | Remove stakeholder (`ownerOrPermission`) |

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
| POST | /api/learn/:slug/lessons | owner | Add lesson (POST only — there is NO `lessons.get`; lessons come via the path-detail endpoint) |
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

**ActivityPub + site routes** live in `layers/base/server/routes/` (22 files, NOT under `/api/`):
- Discovery: `/.well-known/webfinger`, `/.well-known/nodeinfo`, `/nodeinfo/2.1`
- Instance Service actor: `/actor`, `/actor/followers`, `/actor/following`, `/actor/outbox`, and the shared instance `/inbox`
- User actors: `/users/:username` + `/users/:username/{inbox,outbox,followers,following}`
- Hub Group actors: `/hubs/:slug/{inbox,outbox,followers,products,resources}`
- Content as AP object: `/content/:slug` (Article)
- Site: `/feed.xml` (site RSS), `/sitemap.xml`, `/robots.txt`

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
| POST | /api/federation/remote-follow | auth | Mastodon-style (requireAuth) |
| POST | /api/federation/resolve-uri | auth | requireAuth |
| POST | /api/federation/search | pub | — |
| GET | /api/federation/hub-follow-status | pub | Optional-auth: returns `{joined:false,status:null}` for anon (no 401); gated by `federateHubs` |
| POST | /api/federation/hub-follow | auth | Follow federated group |
| POST | /api/federation/hub-post / hub-post-reply / hub-post-like | auth | — |
| GET | /api/federation/hub-post-likes | auth | requireAuth |
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

Federation followers (session 184): GET `/api/admin/federation/followers` → `listInstanceFollowers` — remote instances that follow our instance Service actor ("who is mirroring you"). Backfill route (`mirrors/[id]/backfill.post.ts`) + `refederate.post.ts` now accept bounded depth params (`sinceDays`/`maxItems`; refederate `{sinceDays,limit,all}`) — session 183.

Public-API keys (RBAC-era): GET/POST `/api/admin/api-keys`, DELETE `/api/admin/api-keys/:id`, GET `/api/admin/api-keys/:id/usage` — issue/revoke scoped bearer tokens for the public read API (gated `publicApi`).

Storage: POST `/api/admin/storage/backfill-cdn-urls` (session 149 — backfill DO Spaces CDN URLs).

Content mod: PATCH `/api/admin/content/:id`, DELETE `/api/admin/content/:id`, POST `/api/admin/content/bulk-editorial`. (There is NO `GET /api/admin/content` — admin content listing reuses the public `/api/content` with admin-visible filters.)

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
- Mirrors: full CRUD (`index.get/post`, `[id].get/put/delete`) + backfill
- Hub mirrors: `index.get/post` + `[id]/backfill` ONLY (no PUT/DELETE/`[id].get`)
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
- **Public read API** `/api/public/v1/**` (20 files; gated `publicApi`): content (list+detail), contests, docs, events, hubs, learn, users, videos (each list+detail), plus `instance`, `search`, `tags`, `openapi.json`. Admin-issued bearer tokens, 12 read scopes.
- **GET /api/layouts/by-route?path=/some-path** (session 157, Phase 1 of the layout engine) — resolves the active layout for an SSR page. Gated by `features.layoutEngine` (default OFF) — returns `404 "Layout engine not enabled"` when the flag's off so the legacy `HomepageSectionRenderer` stays in charge during the migration window. Module-level 60s cache keyed by `${tier}:${path}` (tier = admin/members/anon — trifurcated to prevent draft leakage). Returns slim shape `{ zones, pageMeta, state }`. **Session 158**: cache lifted into `server/utils/layoutCache.ts` so the admin write API can invalidate it cleanly. `by-route.get.ts` re-exports `invalidateLayoutsByRouteCache` for backwards compat.

**Admin layout write API** (session 158, Phase 1c; backs the `/admin/layouts/:id` editor, sessions 160–169) — 10 routes under `/api/admin/layouts/*`, all gated on `requireFeature('admin') + requireFeature('layoutEngine') + requirePermission(event, 'layout.manage')` (RBAC — NOT a bare `requireAdmin`; the whole admin surface is `requirePermission`-gated: api-keys→`apikeys.manage`, themes→`theme.manage`, features/settings→`settings.manage`, etc.). Every write handler calls `invalidateLayoutsByRouteCache()` before returning (statically enforced by `handlers-contract.test.ts`):
- `GET    /api/admin/layouts` — list (optional `?scope=route|virtual|custom-page`)
- `POST   /api/admin/layouts` — create (409 if scope already exists)
- `GET    /api/admin/layouts/[id]`
- `PUT    /api/admin/layouts/[id]` — update; rejects scope change (400)
- `DELETE /api/admin/layouts/[id]` — cascade through rows + sections + versions
- `POST   /api/admin/layouts/[id]/publish` — snapshot + flip state=published
- `GET    /api/admin/layouts/[id]/versions` — version history
- `POST   /api/admin/layouts/[id]/versions/[versionId]/revert` — restore from snapshot (snapshot itself never touched; immutable)
- `POST   /api/admin/layouts/seed-homepage` — idempotent bootstrap for the homepage canary (creates + publishes a default hero + content-feed layout at `('route', '/')` if none exists)
- `POST   /api/admin/layouts/migrate-homepage` — migrate the legacy configurable-homepage sections into a layout-engine layout (`force=true` updates in place via `saveLayout` rather than `deleteLayout`, preserving `layout_versions` — session 161 R4 P1 fix)

## Gotchas worth remembering

- `GET /api/events` whitelists the `status` query to `PUBLIC_STATUSES = {published, active, completed}` (security fix; an attacker can't list `draft`/`cancelled`). Separately, `upcoming`, `featured`, and `myEvents` are **boolean filter flags** (e.g. `?upcoming=true`), NOT status values. (There is **no** `past` filter, and the my-events flag is `myEvents`, not `mine` — an earlier version of this doc claimed both, incorrectly.)
- `GET /api/contests/:slug/judges` visibility depends on `contest.judgingVisibility`.
- `GET /api/contests/:slug/votes` returns an **array** of `{ entryId, count, voted }` (`ContestEntryVoteInfo[]` — per-entry tally + the current user's own vote flag), NOT a map and not just counts.
- `POST /api/content/:id/publish` always triggers federation if enabled; no separate "federate" endpoint.
- `POST /api/files/upload` requires multipart; `upload-from-url` does SSRF checks in server/import/ssrf.ts before fetching.
- `:username` lookups are **exact-match** (`eq(users.username, username)`); usernames are normalized to lowercase only on WRITE (Better Auth's `username()` plugin). A mixed-case URL like `/api/users/JohnDoe` 404s — the routes are NOT case-insensitive at read time.
- `GET /api/me` returns null (not 401) if unauthenticated — used by the client to detect session state.
