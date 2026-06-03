# 03 — Server Modules

`@commonpub/server` — framework-agnostic business logic. Every module takes a Drizzle
DB handle, performs writes in transactions where correctness requires, and emits
lifecycle hooks. Pure TypeScript. No Nuxt dependency.

Source: `packages/server/src/`. Re-verified session 181 (2026-06-01).
**25 module directories + 11 top-level `.ts` files** (10 utilities — email, hooks, image, oauthCodes, query, security, storage, theme, types, utils — plus `index.ts` the package barrel).

Modules beyond the original (session-125) mapping, now folded into the directory map below:
- `identity/` — cross-instance identity (Phase 1a foundation + Phase 1b runtime, sessions 136–140). Files: `fediClient.ts`, `health.ts`, `index.ts`, `mastodonFactory.ts`, `router.ts`. Behind `features.identity.*` flags.
- `publicApi/` — read-only public API (session 127). Bearer-token auth (`api_keys`), **12 read scopes**, OpenAPI 3.1. Files: `adminOps.ts`, `auth.ts`, `keys.ts`, `rateLimit.ts`, `scopes.ts`, `serializers.ts`, `usage.ts`, `index.ts`.
- `realtime/` — SSE pub/sub abstraction (session 130). Exports `publishSseEvent`, `subscribeSseEvents`, `realtimeChannel`, `resetRealtimeForTests` against `@commonpub/infra`'s `RealtimePubSub`.
- `rbac/` — RBAC phase 0/1 (sessions 175–177). `resolveUserPermissions` (`rbac/resolver.ts`) with a 30s-TTL cache; admin `*` grant deliberately NOT cached (fresh `users.role` floor). Behind `features.rbac` (default OFF).
- `federation/mastodonLogin.ts` — Mastodon SSO server-side (session 139).
- `federation/safeFetchFn.ts` — `createSafeActorFetchFn` for SSRF-safe `resolveActor` (session 150).

`@commonpub/server` re-exports `safeFetch`, `safeFetchBinary`,
`safeFetchResponse`, `safeFetchSigned`, `isPrivateUrl`,
`SafeFetchOptions`, `SafeFetchResponseResult` (from `@commonpub/protocol`
via `import/ssrf.ts`) plus `getClientIp`, `GetClientIpOptions` (from the
local `security.ts`) — see 06-other-packages.

## Directory map

```
packages/server/src/
├── admin/           admin.ts            platform stats, users, reports, instance settings, audit entries
├── auth/            identity.ts         email/username resolution, session helpers; index.ts re-exports resolveIdentityToEmail
├── identity/        fediClient.ts, health.ts, mastodonFactory.ts, router.ts  cross-instance identity (Phase 1a/1b, behind features.identity.*)
├── content/         content.ts          CRUD, versions, forks, publish, build-marks, keyset feed
│                    categories.ts       category CRUD
├── contest/         contest.ts          contest CRUD, entries, judging, rank calc, state transitions
│                    judges.ts           invite/accept workflow for contestJudges
│                    stakeholders.ts     view-only reviewers (contest_stakeholders, session 174)
├── docs/            docs.ts             sites + versions + pages (BlockTuple[] content)
├── events/          events.ts           events + RSVP with auto-waitlist logic
├── federation/      federation.ts       core AP actors + content federation
│                    hubFederation.ts    Group actor + hub federation
│                    hubMirroring.ts     federated-hub ingestion
│                    mirroring.ts        instanceMirror config
│                    inboxHandlers.ts    inbound routing
│                    delivery.ts         outbound queue worker
│                    backfill.ts         outbox crawl + resume cursor
│                    circuitBreaker.ts   instance health tracking
│                    messaging.ts        federated DM routing
│                    oauth.ts            OAuth2 authorization server
│                    outboxQueries.ts    pagination helpers
│                    timeline.ts         federated content timeline query
├── homepage/        homepage.ts         homepage-section config (stored in instanceSettings)
├── layout/          layout.ts           layout engine CRUD: zones→rows→sections + versions (session 157)
│                    seed.ts             seedHomepageLayout
│                    migrate-homepage.ts migrateHomepageSectionsToLayout
│                    path-normalize.ts   pathNormalize + RESERVED_PREFIXES/RESERVED_EXACT
│                    custom-page-validate.ts validateCustomPageScope + FILE_ROUTE_PREFIXES
├── hub/             hub.ts              hub CRUD
│                    members.ts          join/leave/kick/role, remote member merge
│                    moderation.ts       bans, invites
│                    posts.ts            posts, replies, likes, shares
│                    resources.ts        hub resources CRUD
├── import/          importer.ts         content import from URL with SSRF protection
│                    generic.ts          generic scraper
│                    images.ts           resolveContentImages (lazy-loaded image resolution)
│                    ssrf.ts             RFC private-IP block (IPv4+IPv6); re-exports protocol safeFetch*
│                    types.ts            import types
│                    platforms/hackster.ts platform-specific extractor
├── learning/        learning.ts         paths, modules, lessons, enrollment, progress, certificates (the pure helpers `calculatePathProgress`/`gradeQuiz`/`generateVerificationCode` are imported FROM `@commonpub/learning`, not defined here; only `index.ts` + `learning.ts` exist in this module)
├── messaging/       messaging.ts        conversations, messages, read receipts
├── navigation/      navigation.ts       nav items config (stored in instanceSettings)
├── notification/    notification.ts     notifications + email prefs + digest
├── product/         product.ts          hub-scoped products, content-product linking
├── profile/         profile.ts          user profile view + update
│                    export.ts           GDPR data export
├── publicApi/       auth.ts, keys.ts, scopes.ts, serializers.ts, rateLimit.ts, usage.ts, adminOps.ts  public read API (12 scopes; behind features.publicApi)
├── rbac/            resolver.ts         resolveUserPermissions (30s-TTL cache; behind features.rbac)
├── realtime/        index.ts            publishSseEvent / subscribeSseEvents / realtimeChannel / resetRealtimeForTests
├── search/          contentSearch.ts    Meilisearch + Postgres FTS fallback
├── social/          social.ts           likes, follows, comments, bookmarks, reports
│                    mentions.ts         parse + resolve @mentions
├── video/           video.ts            videos + categories
├── voting/          voting.ts           hub post votes, polls, contest entry votes
├── email.ts                             adapters (SMTP, Resend, console)
├── hooks.ts                             lifecycle event bus (on/emit/clear)
├── image.ts                             processImage, variant selection
├── oauthCodes.ts                        auth-code storage with TTL
├── query.ts                             pagination, slug uniqueness, escapeLike, USER_REF_SELECT, cursor helpers (encode/decode/asDateUuidCursor/keysetWhere), countRows, path builders
├── security.ts                          CSP builder, rate limit store, nonce, getClientIp
├── storage.ts                           Local + S3 adapters
├── theme.ts                             user theme resolution + custom-theme CRUD (session 154)
├── types.ts                             cross-module types (UserRef, ContentDetail, etc.)
└── utils.ts                             generateSlug, hasPermission, canManageRole
```

## Module reference

### content/

**content.ts** — contentItems + related tables

- `listContent(db, filters, opts)` — OFFSET-paginated `{ items, total }` (per-request `COUNT(*)`); filter by type/status/author. Backs `GET /api/content` (numbered/admin lists, search, popular/featured/editorial sorts).
- `listContentKeyset(db, {...filters, cursor}, opts)` — keyset/cursor pagination `{ items, nextCursor }` (recency order `published_at DESC NULLS LAST, id DESC`, O(limit)/page, no COUNT). Backs `GET /api/content/feed` (infinite scroll); federated case = keyset-merge across sources. Sessions 178–179; backed by migration 0012 partial indexes.
- `getContentBySlug(db, username, type, slug)`
- `incrementViewCount(db, contentId)`
- `createContent(db, input)` — sanitizes HTML blocks
- `updateContent(db, id, userId, input)` — author-only status/field write (NO hook/federation here — those are in the `onContent*` wrappers below)
- `publishContent(db, id, userId)` — `createContentVersion` snapshot, then delegates to `updateContent(..., { status: 'published' })`. It does NOT itself emit a hook or federate.
- `deleteContent(db, id, userId)` — soft-delete UPDATE only (no hook/federation here)
- `onContentPublished` / `onContentUpdated` / `onContentDeleted` — the side-effect wrappers the API routes call AFTER the CRUD fn: these emit `content:published`/`content:updated`/`content:deleted` and call `federateContent`/`federateUpdate`/`federateDelete`. (This is where the hooks + AP activities actually fire.)
- `forkContent(db, id, userId)` — local fork (counter + forks row)
- `forkFederatedContent(db, federatedContentId, userId)`
- `toggleBuildMark(db, contentId, userId)` — "I built this"; `isBuildMarked(db, contentId, userId)`
- `toggleFederatedBuildMark(db, federatedContentId, userId)`; `isFederatedBuildMarked(...)`
- `listContentVersions`, `createContentVersion`
- Hooks emitted (from the `onContent*` wrappers, not the CRUD fns): `content:published`, `content:updated`, `content:deleted`

### contest/

**contest.ts**

- `listContests(db, filters)`
- `getContestBySlug(db, slug)` — returns rules, prizes, `judgingCriteria`, `judgingVisibility`, `communityVotingEnabled`, `eligibleContentTypes`, `maxEntriesPerUser` (NOT `judges` — that jsonb is dead; use `/judges`)
- `createContest(db, input, options?)` — checks `canCreateContest(userRole, policy)` **only when `options.userRole` is supplied** (no options → the permission check is skipped); seeds the `contestJudges` table from `input.judges`
- `transitionContestStatus(db, id, userId, newStatus)` — enforces FSM; runs `calculateContestRanks` on completion
- `submitContestEntry(db, contestId, contentId, userId)` — enforces published + ownership + `eligibleContentTypes` + `maxEntriesPerUser`
- `judgeContestEntry(db, entryId, score, judgeId, feedback?)` — accepted, non-guest judges only; recomputes the average
- `calculateContestRanks(db, contestId)` — `RANK()` over scored entries only (ties share a rank; unscored → null rank). Community votes do NOT affect ranking.
- `shouldRevealScores(visibility, status, privileged)` — pure helper gating aggregate-score exposure by `judgingVisibility`
- `canViewContest(db, contest, user)` — access gate (public/unlisted open; private → owner/admin/stakeholder/judge/role). Used by every read endpoint (404 on block).
- `judgeContestEntry` — accepted non-guest judges only; can't judge own entry; row-locked merge
- `withdrawContestEntry(db, entryId, userId)`

**stakeholders.ts** (session 174) — view-only reviewers (`contest_stakeholders` table)

- `listContestStakeholders` / `addContestStakeholder` / `removeContestStakeholder` / `isContestStakeholder`

**judges.ts** — session 124 replaced the legacy `judges` JSONB array

- `listContestJudges(db, contestId)` — with invitedAt/acceptedAt
- `addContestJudge(db, contestId, userId, role?)` — sends notification
- `updateJudgeRole(db, contestId, userId, role)`
- `removeContestJudge(db, contestId, userId)`
- `acceptJudgeInvite(db, contestId, userId)`
- `isContestJudge(db, contestId, userId)`

### events/

**events.ts** — session 124 added

- `listEvents(db, filters)` — upcoming / featured / past / mine / hub-scoped
- `getEventBySlug(db, slug)`
- `createEvent(db, input)` — default status `published`
- `updateEvent(db, slug, userId, input, isAdmin?)` — creator/admin
- `deleteEvent(db, eventId, userId, isAdmin?)`
- `listEventAttendees(db, eventId, opts?)`
- `rsvpEvent(db, eventId, userId)` — **transaction**: if capacity is full, status becomes `waitlisted`; else `registered`
- `cancelRsvp(db, eventId, userId)` — **transaction**: if the cancelling user was `registered`, promote oldest `waitlisted` to `registered`
- `getUserRsvpStatus(db, eventId, userId)`

### voting/

**voting.ts** — session 124 added

Hub post voting (score = up − down, denormalized on `hubPosts.voteScore`):

- `voteOnPost(db, postId, userId, direction)` — transaction
  - Same-direction re-vote: removes vote, adjusts score by −1 (up) or +1 (down)
  - New vote: inserts, adjusts score by +1 or −1
  - Flip (up↔down): adjusts score by ±2
- `getUserPostVote(db, postId, userId)`

Polls (one vote per user per poll, not per option):

- `createPollOptions(db, postId, labels)` — created inline with a poll-type post
- `getPollOptions(db, postId)`
- `voteOnPoll(db, postId, optionId, userId)`
- `getUserPollVote(db, postId, userId)`

Contest entry community votes:

- `voteOnContestEntry(db, entryId, userId)` — only if `communityVotingEnabled`
- `removeContestEntryVote(db, entryId, userId)`
- `getContestEntryVoteCount(db, entryId)`
- `hasVotedOnContestEntry(db, entryId, userId)`

### hub/

**hub.ts** — CRUD. Creator gets `hubRole: owner`. The schema supports 3 hub types (community/product/company), but `createHub` does NOT accept a `hubType` param — new hubs always default to `community` (the schema default).

**members.ts** — `joinHub` respects `joinPolicy` (open/approval/invite); `changeRole` enforces weight hierarchy (owner > admin > moderator > member). `listRemoteMembers` is a standalone query returning the hub's remote `hubFollowers` (it does NOT merge them into the local member list — any merge is at the call site).

**posts.ts** — post CRUD + threaded replies + likes + shareContent; emits `hub:post:created`. `hub:content:shared` is declared but not yet emitted.

**moderation.ts** — bans (mods = temporary only, admins = permanent), invite tokens with maxUses + expiry.

**resources.ts** — curated links per hub with sortOrder.

### learning/

**learning.ts** — paths → modules → lessons. Enrollment, `markLessonComplete` updates `lessonProgress` + recomputes `enrollments.progress`. Certificates auto-issued at 100%, verification code format `CPUB-{timestamp_base36}-{random_hex8}` (prefix configurable via `generateVerificationCode(prefix)` — defaults to `CPUB`).

### docs/

**docs.ts** — versioned docs sites. New pages store `content` as BlockTuple[]; legacy markdown supported on read (converted on edit). Search delegates to Meilisearch (via `@commonpub/docs` adapter) with Postgres FTS fallback.

### federation/ (15 files: 14 domain + index)

- **federation.ts** — keypair lifecycle, remote-actor resolve+cache, Create/Update/Delete/Like/Follow activity builders. `federateContent`/`federateUpdate` gate BOTH `status='published'` AND `visibility='public'` (session 183 — members/private content never leaves the instance); `federateContent` uses protocol's `contentToCreateActivity` (deterministic Create id, shared with the outbox projection) + skips an already-pending Create for the same object (idempotent refederate).
- **delivery.ts** — worker polls `activities` where `status='pending'`, delivers via HTTP Signature, updates status, increments attempts, writes errors. Respects instance circuit-breaker state.
- **circuitBreaker.ts** — tracks `instanceHealth.consecutiveFailures`, opens the circuit on threshold, schedules resume via `circuitOpenUntil`
- **inboxHandlers.ts** — inbound routing: dispatches Follow/Accept/Undo/Create/Update/Delete/Announce/Like/Reject to correct handler
- **hubFederation.ts** — Group actor lifecycle, hub post federation, follower management
- **hubMirroring.ts** — ingests federated hub posts/members/resources/products; de-dupes by objectUri
- **mirroring.ts** — mirror config CRUD: `createMirror` (**PULL-ONLY since Phase 3 — throws on `'push'`**), `activateMirror`, `pauseMirror`, `resumeMirror`, `cancelMirror`, `listMirrors`, `getMirror`, `matchMirrorForContent`, `recordMirrorError`, **`listInstanceFollowers(db, domain)`** (session 184 — accepted followers of our instance Service actor = "who is mirroring you", with derived domains). **Phase 3 consent-based mirror requests (session 185):** `requestMirror(db, remoteDomain, remoteActorUri, localDomain)` (push: stores an outgoing `mirrorRequests` row + queues a signed `Offer(Follow)`), `listMirrorRequests(db, direction?)`, `getMirrorRequest`, `approveMirrorRequest(db, id, localDomain, {sinceDays?, maxItems?, filterContentTypes?, filterTags?})` (creates/reuses a pull mirror of the requester + optional bounded backfill + `Accept(Offer)`), `rejectMirrorRequest(db, id, localDomain)` (`Reject(Offer)`). Inbound: `inboxHandlers.onMirrorRequest` stores an incoming request (loop-guards own domain, gates target=instance actor); `onAccept`/`onReject` extended to flip the requester's outgoing request by `offerActivityUri`. Protocol: `buildMirrorRequestActivity` + `CPUB_MIRROR_REQUEST` marker; `Offer` dispatch in `processInboxActivity`; `Offer` routes like `Follow` in `delivery.ts`.
- **backfill.ts** — `backfillFromOutbox(db, remoteActorUri, domain, opts?)` walks a remote outbox with pagination + resume cursor + signed requests for protected outboxes (session 119 hardening). `BackfillOptions` now has `since?: Date` (session 183) — stops crawling once it pages past the cutoff (newest-first outbox), so an operator can pick "how far back" instead of pulling an entire instance. `maxItems` (default 500) is the count ceiling; exported `activityPublishedMs` reads top-level/`object` published. Paired `backfillHubFromOutbox(db, federatedHubId, domain)` in `hubMirroring.ts` for hub-post variants.
- **messaging.ts** — federated DMs via AP Create+Note with direct audience
- **oauth.ts** — OAuth2 auth server endpoints for AP Actor SSO (Model B)
- **outboxQueries.ts** — Collection/OrderedCollection pagination. **The instance + per-user content outboxes are a PROJECTION over `content_items` (status='published' AND visibility='public'), NOT a scan of the `activities` delivery queue** (session 183 fix). Previously queue-derived (`status='delivered'`), so any post published before a mirror followed was invisible → backfill got nothing (heatsync showed 2 of 8 posts live). Now reflects the real catalogue. Builds each Create via protocol's `contentToCreateActivity` (deterministic id `<object id>#create` + real `published`). SECURITY: gates `status='published' AND visibility='public' AND deletedAt IS NULL` so the public outbox never leaks members/private/soft-deleted content (matches `listContent`/`getContentBySlug`). Hub outbox stays Announce/queue-derived. Ordering `published_at DESC NULLS LAST, id DESC` reuses migration 0012's `idx_content_items_feed_recency`.
- **timeline.ts** — timeline query merging local contentItems + federatedContent with filters
- **mastodonLogin.ts** — Mastodon SSO server-side (session 139)
- **safeFetchFn.ts** — `createSafeActorFetchFn` for SSRF-safe `resolveActor` (session 150)

### social/

**social.ts** — polymorphic likes, follows, comments (threaded), bookmarks, reports. Federates likes/unlike and comments (Note + inReplyTo) for federated content. Hooks emitted: `comment:created`. `content:liked` / `content:unliked` are declared in the hooks registry but not currently emitted.

**mentions.ts** — regex extraction + bulk resolution to users.

### messaging/

**messaging.ts** — instance-local DMs. `findOrCreateConversation(db, participants)` reuses an existing conversation matching the **exact participant set** (sorted `@>` + `jsonb_array_length` equality) — works for any set, not only 1-to-1. `conversations.participants` is JSONB string array with GIN index.

### notification/

**notification.ts** — notification CRUD + email preferences. Email sending is pluggable via `setNotificationEmailSender(sender)` — server module stays framework-agnostic. Digest aggregation handled by `plugins/notification-email.ts` in the layer.

### admin/

**admin.ts** — `getPlatformStats`, `listUsers`, `updateUserRole/Status`, `deleteUser`, `listReports`, `resolveReport`, `removeContent(Federated)`, `getInstanceSettings/setInstanceSetting` (audit logged), `createAuditEntry`, `listAuditLogs`.

### navigation/ + homepage/

Both are thin CRUD over `instanceSettings` JSONB keys:

- `nav.items` — list of `NavItem` (link/dropdown/external) with visibility + feature gates
- `homepage.sections` — array of section configs (hero, grid, editorial, stats, custom html, etc.)

### layout/ (session 157 — Phase 1 of the layout engine)

The `layout/` module is **5 files**; `layout.ts` carries the 8 CRUD
exports below, with `seed.ts` (`seedHomepageLayout`),
`migrate-homepage.ts` (`migrateHomepageSectionsToLayout`),
`path-normalize.ts` (`pathNormalize` + `RESERVED_PREFIXES`/`RESERVED_EXACT`),
and `custom-page-validate.ts` (`validateCustomPageScope` + `FILE_ROUTE_PREFIXES`)
alongside.

**layout.ts** — full CRUD for the new layout engine, which replaces
`homepage.sections` once `features.layoutEngine` flips ON (Phase 4
adoption). 8 exports across 4 tables (`layouts`, `layout_rows`,
`layout_sections`, `layout_versions` — migration 0005). Consumed by the
layer's `/api/admin/layouts/*` write routes + the public
`/api/layouts/by-route` read route:

- `listLayouts(db, opts?)` — optionally filter by scope_type
- `getLayoutByScope(db, scope)` — primary read path; returns full nested
  `LayoutRecord` (zones → rows → sections) — the shape `<LayoutSlot>` needs
- `getLayoutById(db, id)` — by-uuid variant
- `saveLayout(db, input, opts?)` — **atomic** "replace whole layout"
  semantics. Wraps upsert + child-rewrite in `db.transaction(...)` so
  concurrent admin saves can't interleave delete + insert and hit the
  unique-(layout_id, zone, position) constraint. Renormalizes
  `position` to {0..n} per zone/row. Preserves caller-supplied `id`
  on rows + sections so reorders don't churn UUIDs.
- `deleteLayout(db, id)` — cascades through rows + sections + versions
- `publishLayout(db, id, opts)` — snapshots current state into
  `layout_versions` (immutable), sets `published_version_id`,
  transitions state → 'published'
- `listLayoutVersions(db, layoutId)` — newest first
- `revertToVersion(db, layoutId, versionId, opts)` — rewrites current
  layout from a snapshot; version row never modified

**Soft FK**: `layouts.published_version_id` references
`layout_versions(id)` but as a soft pointer (no DB constraint) — would
create a circular FK with cascade-delete chicken-and-egg. Read-side
tolerates stale id by treating as "no published version".

**Tests**: `packages/server/src/__tests__/layout-server.integration.test.ts`
— 24 PGlite integration tests covering CRUD round-trip, position
normalization, cascade DELETE, all 3 scope variants, version
immutability, revert.

### import/

**importer.ts** — URL → content with block extraction. Uses Readability-style parsing.

**ssrf.ts** — `packages/server/src/import/ssrf.ts` is now a **re-export shim** ("Do not add logic here — edit `packages/protocol/src/ssrf.ts`"). The actual blocklist (in `@commonpub/protocol`) hard-blocks: RFC1918 (10/8, 172.16/12, 192.168/16), loopback (127/8, ::1), CGN (100.64/10), link-local (169.254/16, fe80::/10), IPv6 unique-local (fc00::/7), **6to4 (2002::/16) AND NAT64 (64:ff9b::/96) — both ARE blocked** (the old "6to4 is a gap" note is obsolete), benchmarking (198.18/15), reserved, TEST-NET 1/2/3, blocked hostnames (localhost, metadata.google.internal, metadata.internal), and numeric-encoding bypasses (hex/octal). (Note: `security.ts`/`image.ts`/`email.ts`/`storage.ts` listed below are likewise re-export shims from `@commonpub/infra`.)

### infra utilities (file-level, not domain modules)

- **email.ts** — SMTP, Resend, Console adapters. `emailTemplates` exports: verification, passwordReset, notificationDigest, notificationInstant, contestAnnouncement, certificateIssued.
- **storage.ts** — Local + S3 adapters, `createStorageFromEnv()` auto-detection
- **image.ts** — Sharp-backed variants: thumb (150), small (300), medium (600), large (1200) — widths in px
- **security.ts** — CSP directive builder, rate-limit store: 6 tiers via `DEFAULT_TIERS` (auth=5/min, upload=10/min, social=30/min, federation=60/min, api=60/min, general=120/min), route-to-tier mapping in `getTierForPath()`, nonce generation
- **theme.ts** — theme resolution + custom-theme CRUD.
  - `resolveTheme(db, userId?)` — user preference > instance default > `base` (silent fallback on unknown ids so a deleted custom theme doesn't break SSR).
  - `setUserTheme(db, userId, themeId)` — persists `users.theme` with a structural-only check (slug regex + custom-prefix). The actual cross-check against available themes happens at the API layer.
  - `getCustomTokenOverrides(db)` — reads the legacy `theme.token_overrides` JSON record (ad-hoc overrides applied on top of whichever theme is active).
  - Custom-theme CRUD (session 154): `listCustomThemes`, `getCustomTheme`, `saveCustomTheme`, `deleteCustomTheme`. Storage: single row in `instance_settings` keyed `theme.custom` holding a JSON array of `CustomThemeRecord`. Atomic upsert — the whole array is rewritten on each save.
  - Helpers: `customThemeDataAttr(id) → 'cpub-custom-<id>'`, `parseCustomThemeId(attr) → 'id' | null`. Constant: `CUSTOM_THEME_PREFIX = 'cpub-custom-'`.
  - **Browser duplication**: the prefix + parse helper are re-declared in `layers/base/utils/themeIds.ts` because this server module imports drizzle + schema and isn't browser-safe. Both definitions are pinned by `custom-themes.integration.test.ts`.

### Cross-cutting

**hooks.ts** — consumer extension bus. `onHook('content:published', handler)` registers; `emitHook('content:published', { contentId })` fires all handlers sequentially. Used by the layer's server plugins for email, search indexing, federation delivery.

**query.ts** — DRY helpers. `ensureUniqueSlugFor`, `normalizePagination`, `escapeLike`, `buildPartialUpdates`, `countRows`, `USER_REF_SELECT` (+ `_WITH_BIO_`/`_WITH_HEADLINE_` variants), the content path builders (`buildContentPath`/`buildContentUrl`/`buildContentEditPath`/`buildContentNewPath`), and the **keyset cursor helpers** (sessions 178–179): `encodeCursor`/`decodeCursor` (opaque base64url of `{v,id}`; `decodeCursor` returns null on bad input → page-1 fallback), `asDateUuidCursor` (domain-narrows to date-or-null `v` + uuid `id` — the crafted-cursor DoS fix, session 180), and `keysetWhere(sortCol, idCol, cursor)` (NULLS-LAST predicate).

### rbac/ + identity/ + publicApi/ + realtime/

- **rbac/resolver.ts** — `resolveUserPermissions(db, userId, { rbacEnabled, primaryRole? })`: a PURE, uncached core that resolves role→permission grants (PGlite-testable). The admin `*` grant is deliberately NOT baked into the returned set; admin access rides a gate-time floor over the fresh `users.role` so demotion is immediate (INV-1, session 175). **The 30s-TTL bounded cache lives in the LAYER wrapper `layers/base/server/utils/permissions.ts` (`PERMISSIONS_CACHE_TTL_MS = 30_000`), NOT in this resolver.** Behind `features.rbac` (default OFF). See also `@commonpub/auth`'s `hasPermissionPure`.
- **identity/** — cross-instance identity runtime (`fediClient.ts`, `mastodonFactory.ts`, `router.ts`, `health.ts`). Behind `features.identity.*`. Token I/O requires `CPUB_FED_TOKEN_KEY`.
- **publicApi/** — bearer-token public read API: `auth.ts` (token verify), `keys.ts` (issue/revoke), `scopes.ts` (**12** read scopes), `serializers.ts`, `rateLimit.ts`, `usage.ts`, `adminOps.ts`. Behind `features.publicApi` (default OFF).
- **realtime/** — `publishSseEvent` / `subscribeSseEvents` / `realtimeChannel` / `resetRealtimeForTests` over `@commonpub/infra`'s `RealtimePubSub` (memory or Redis via `NUXT_REDIS_URL`).

**utils.ts** — `generateSlug(text)` (lowercase + `replace(/[^\w\s-]/g,'')` + hyphenate; appends a timestamp only on a `RESERVED_SLUGS` match — NOT on general collision, and there is NO `.normalize('NFD')`; general slug-collision handling lives in `ensureUniqueSlugFor`, query.ts), `hasPermission(role, permission)`, `canManageRole(actorRole, targetRole)`.

## Transactions

Places that must be transactional (correctness, not perf). **Verified `db.transaction(...)`-wrapped:**

- `voteOnPost` — atomic vote insert/delete + score update
- `voteOnPoll` — atomic vote + option count update
- `rsvpEvent` — atomic capacity check + status assignment
- `cancelRsvp` — atomic cancel + waitlist promotion
- `joinHub` — atomic member row + memberCount update
- `createPost` — member row + post + denormalized hub.postCount
- `judgeContestEntry` — `SELECT … FOR UPDATE` on the entry row + judgeScores read-modify-write
- **`submitContestEntry`** — insert(contestEntries) + entryCount increment wrapped in `db.transaction` (session 183); a duplicate (onConflictDoNothing → no row) never increments.
- **`leaveHub`** — delete(hubMembers) + memberCount decrement wrapped in `db.transaction` (session 183; mirrors `joinHub`).

Caveats (NOT wrapped):

- **`publishContent`** — a thin wrapper: `createContentVersion` then delegates to `updateContent(..., { status: 'published' })`; the status write happens there, not in a transaction opened by `publishContent` itself.

## Permission hierarchy

Role weights (server/utils.ts):

```
owner     4
admin     3
moderator 2
member    1
```

Actual `PERMISSION_MAP` in `packages/server/src/utils.ts`:

| Permission | Min role | Weight |
|---|---|---|
| `editHub` | admin | 3 |
| `manageMembers` | admin | 3 |
| `banUser` | moderator | 2 |
| `kickMember` | moderator | 2 |
| `deletePost` | moderator | 2 |
| `pinPost` | moderator | 2 |
| `lockPost` | moderator | 2 |
| `manageResources` | moderator | 2 |

Unknown permission names return `Infinity`, so they always fail. Add new
permission names to `PERMISSION_MAP` when you need them.

`canManageRole(actor, target)` — strict: actor weight must be strictly greater than target (an admin can't demote another admin).

## Lifecycle hooks (events on the bus)

Events are defined in `hooks.ts`. Below, "emitted" reflects what the code
actually fires today (verified via grep of `emitHook(` calls); unemitted
events are declared in the type registry but nothing calls them yet.

| Event | Status | Source |
|---|---|---|
| content:published | **emitted** | `content/content.ts` (`onContentPublished`, not `publishContent`) |
| content:updated | **emitted** | `content/content.ts` (`onContentUpdated`, not `updateContent`) |
| content:deleted | **emitted** | `content/content.ts` (`onContentDeleted`, not `deleteContent`) |
| comment:created | **emitted** | `social/social.ts` (`createComment`) |
| hub:post:created | **emitted** | `hub/posts.ts` (`createPost`) |
| hub:member:joined | **emitted** | `hub/members.ts` (`joinHub`) |
| hub:member:left | **emitted** | `hub/members.ts` (`leaveHub`) |
| federation:content:received | **emitted** | `federation/inboxHandlers.ts` |
| content:liked / content:unliked | **emitted** (session 183) | `social/social.ts` (`toggleLike`; content-item targets only — not post/comment/video) |
| hub:content:shared | **emitted** (session 183) | `hub/posts.ts` (`shareContent`) |
| user:registered | **emitted** (session 183) | bridged via `createAuth` `databaseHooks.user.create.after` → layer `middleware/auth.ts` `onUserCreated` (auth pkg can't import the server bus) |
| federation:hub:post:received | **emitted** (session 183) | `federation/hubMirroring.ts` (on genuinely-new federated hub post) |

**Current subscriptions** (layer server plugins):
- `plugins/search-index.ts` — subscribes to `content:published`, `content:updated`, `content:deleted` (indexes Meilisearch/FTS).
- Other plugins (`federation-delivery`, `notification-email`, `auto-admin`, `federation-hub-sync`) use direct `defineNitroPlugin` + timers/callbacks instead of the hook bus.

Consumer apps can register additional handlers via `onHook()` in their own server plugins.

## What's missing / known issues

- Some tables lack Zod validators (see schema inventory). `events` + `eventAttendees` are the notable gaps.
- `federatedContent.mirrorId` now HAS a DB-level FK (`ON DELETE SET NULL`, migration 0002 `session130_constraints`) — the old "app-enforced only" note is obsolete.
- A few PGlite-skipped integration tests (partial-index limitations per memory).
- No dedicated module for `files/` CRUD beyond storage adapter — handled inline in the layer's upload API route.
