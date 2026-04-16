# 03 — Server Modules

`@commonpub/server` — framework-agnostic business logic. Every module takes a Drizzle
DB handle, performs writes in transactions where correctness requires, and emits
lifecycle hooks. Pure TypeScript. No Nuxt dependency.

Source: `packages/server/src/`. As of session 125 (2026-04-16).

## Directory map

```
packages/server/src/
├── admin/           admin.ts            platform stats, users, reports, instance settings, audit entries
├── auth/            identity.ts         email/username resolution, session helpers
├── content/         content.ts          CRUD, versions, forks, publish, build-marks
│                    categories.ts       category CRUD
├── contest/         contest.ts          contest CRUD, entries, judging, rank calc, state transitions
│                    judges.ts           invite/accept workflow for contestJudges
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
├── hub/             hub.ts              hub CRUD
│                    members.ts          join/leave/kick/role, remote member merge
│                    moderation.ts       bans, invites
│                    posts.ts            posts, replies, likes, shares
│                    resources.ts        hub resources CRUD
├── import/          importer.ts         content import from URL with SSRF protection
│                    generic.ts          generic scraper
│                    ssrf.ts             RFC private-IP block (IPv4+IPv6)
├── learning/        learning.ts         paths, modules, lessons, enrollment, certificates
├── messaging/       messaging.ts        conversations, messages, read receipts
├── navigation/      navigation.ts       nav items config (stored in instanceSettings)
├── notification/    notification.ts     notifications + email prefs + digest
├── product/         product.ts          hub-scoped products, content-product linking
├── profile/         profile.ts          user profile view + update
│                    export.ts           GDPR data export
├── search/          contentSearch.ts    Meilisearch + Postgres FTS fallback
├── social/          social.ts           likes, follows, comments, bookmarks, reports
│                    mentions.ts         parse + resolve @mentions
├── video/           video.ts            videos + categories
├── voting/          voting.ts           hub post votes, polls, contest entry votes
├── email.ts                             adapters (SMTP, Resend, console)
├── hooks.ts                             lifecycle event bus (on/emit/clear)
├── image.ts                             processImage, variant selection
├── oauthCodes.ts                        auth-code storage with TTL
├── query.ts                             pagination, slug uniqueness, escapeLike, USER_REF_SELECT
├── security.ts                          CSP builder, rate limit store, nonce
├── storage.ts                           Local + S3 adapters
├── theme.ts                             user theme resolution
├── types.ts                             cross-module types (UserRef, ContentDetail, etc.)
└── utils.ts                             generateSlug, hasPermission, canManageRole
```

## Module reference

### content/

**content.ts** — contentItems + related tables

- `listContent(db, filters)` — paginated, filter by type/status/author
- `getContentBySlug(db, username, type, slug)`
- `createContent(db, input)` — sanitizes HTML blocks
- `updateContent(db, id, userId, input)` — author-only; federates Update
- `publishContent(db, id, userId)` — draft → published; emits `content:published` hook; federates Create
- `deleteContent(db, id, userId)` — soft delete; federates Delete
- `forkContent(db, id, userId)` — local fork (counter + forks row)
- `forkFederatedContent(db, federatedContentId, userId)`
- `toggleBuildMark(db, contentId, userId)` — "I built this"
- `toggleFederatedBuildMark(db, federatedContentId, userId)`
- `listContentVersions`, `createContentVersion`
- Hooks emitted: `content:published`, `content:updated`, `content:deleted`

### contest/

**contest.ts**

- `listContests(db, filters)`
- `getContestBySlug(db, slug)` — returns rules, prizes, judges, voting status, `communityVotingEnabled`, `judgingVisibility`
- `createContest(db, userId, input)` — checks `canCreateContest(userRole, config.instance.contestCreation)`
- `transitionContestStatus(db, id, newStatus, userId)` — enforces workflow
- `submitContestEntry(db, contestId, contentId, userId)`
- `judgeContestEntry(db, entryId, judgeId, score, feedback?)` — judge-role only
- `calculateContestRanks(db, contestId)` — averages judge scores + community votes
- `withdrawContestEntry(db, entryId, userId)`

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

**hub.ts** — CRUD. Creator gets `hubRole: owner`. Supports 3 types (community/product/company).

**members.ts** — `joinHub` respects `joinPolicy` (open/approval/invite); `changeRole` enforces weight hierarchy (owner > admin > moderator > member). `listRemoteMembers` merges `hubFollowers` for federated views.

**posts.ts** — post CRUD + threaded replies + likes + shareContent; emits `hub:post:created`. `hub:content:shared` is declared but not yet emitted.

**moderation.ts** — bans (mods = temporary only, admins = permanent), invite tokens with maxUses + expiry.

**resources.ts** — curated links per hub with sortOrder.

### learning/

**learning.ts** — paths → modules → lessons. Enrollment, `markLessonComplete` updates `lessonProgress` + recomputes `enrollments.progress`. Certificates auto-issued at 100%, verification code format `CPUB-{timestamp_base36}-{random_hex8}` (prefix configurable via `generateVerificationCode(prefix)` — defaults to `CPUB`).

### docs/

**docs.ts** — versioned docs sites. New pages store `content` as BlockTuple[]; legacy markdown supported on read (converted on edit). Search delegates to Meilisearch (via `@commonpub/docs` adapter) with Postgres FTS fallback.

### federation/ (10 files)

- **federation.ts** — keypair lifecycle, remote-actor resolve+cache, Create/Update/Delete/Like/Follow activity builders
- **delivery.ts** — worker polls `activities` where `status='pending'`, delivers via HTTP Signature, updates status, increments attempts, writes errors. Respects instance circuit-breaker state.
- **circuitBreaker.ts** — tracks `instanceHealth.consecutiveFailures`, opens the circuit on threshold, schedules resume via `circuitOpenUntil`
- **inboxHandlers.ts** — inbound routing: dispatches Follow/Accept/Undo/Create/Update/Delete/Announce/Like/Reject to correct handler
- **hubFederation.ts** — Group actor lifecycle, hub post federation, follower management
- **hubMirroring.ts** — ingests federated hub posts/members/resources/products; de-dupes by objectUri
- **mirroring.ts** — mirror config CRUD; `backfillMirror(db, id)` walks remote outbox with resume cursor
- **backfill.ts** — outbox crawl primitives, pagination, signed requests for protected outboxes (session 119 added)
- **messaging.ts** — federated DMs via AP Create+Note with direct audience
- **oauth.ts** — OAuth2 auth server endpoints for AP Actor SSO (Model B)
- **outboxQueries.ts** — helpers for building Collection/OrderedCollection pagination
- **timeline.ts** — timeline query merging local contentItems + federatedContent with filters

### social/

**social.ts** — polymorphic likes, follows, comments (threaded), bookmarks, reports. Federates likes/unlike and comments (Note + inReplyTo) for federated content. Hooks emitted: `comment:created`. `content:liked` / `content:unliked` are declared in the hooks registry but not currently emitted.

**mentions.ts** — regex extraction + bulk resolution to users.

### messaging/

**messaging.ts** — instance-local DMs. `findOrCreateConversation(db, participants)` deduplicates 1-to-1. `conversations.participants` is JSONB string array with GIN index.

### notification/

**notification.ts** — notification CRUD + email preferences. Email sending is pluggable via `setNotificationEmailSender(sender)` — server module stays framework-agnostic. Digest aggregation handled by `plugins/notification-email.ts` in the layer.

### admin/

**admin.ts** — `getPlatformStats`, `listUsers`, `updateUserRole/Status`, `deleteUser`, `listReports`, `resolveReport`, `removeContent(Federated)`, `getInstanceSettings/setInstanceSetting` (audit logged), `createAuditEntry`, `listAuditLogs`.

### navigation/ + homepage/

Both are thin CRUD over `instanceSettings` JSONB keys:

- `nav.items` — list of `NavItem` (link/dropdown/external) with visibility + feature gates
- `homepage.sections` — array of section configs (hero, grid, editorial, stats, custom html, etc.)

### import/

**importer.ts** — URL → content with block extraction. Uses Readability-style parsing.

**ssrf.ts** — hard block on RFC1918, loopback, CGN (100.64/10), link-local, 6to4, TEST-NET, IPv6 private (fc00::/7, fe80::/10, ::1, bracketed hostnames). Hardened in v0.2.0 audit.

### infra utilities (file-level, not domain modules)

- **email.ts** — SMTP, Resend, Console adapters. `emailTemplates` exports: verification, passwordReset, notificationDigest, notificationInstant, contestAnnouncement, certificateIssued.
- **storage.ts** — Local + S3 adapters, `createStorageFromEnv()` auto-detection
- **image.ts** — Sharp-backed variants: thumb (150), small (300), medium (600), large (1200) — widths in px
- **security.ts** — CSP directive builder, rate-limit store: 6 tiers via `DEFAULT_TIERS` (auth=5/min, upload=10/min, social=30/min, federation=60/min, api=60/min, general=120/min), route-to-tier mapping in `getTierForPath()`, nonce generation
- **theme.ts** — user theme preference storage on `users`

### Cross-cutting

**hooks.ts** — consumer extension bus. `onHook('content:published', handler)` registers; `emitHook('content:published', { contentId })` fires all handlers sequentially. Used by the layer's server plugins for email, search indexing, federation delivery.

**query.ts** — DRY helpers. `ensureUniqueSlugFor`, `normalizePagination`, `escapeLike`, `buildPartialUpdates`, `USER_REF_SELECT` (standard Drizzle select shape for user references).

**utils.ts** — `generateSlug(text)` (lowercase + NFD strip + hyphen + timestamp on collision), `hasPermission(role, permission)`, `canManageRole(actorRole, targetRole)`.

## Transactions

Places that must be transactional (correctness, not perf):

- `voteOnPost` — atomic vote insert/delete + score update
- `voteOnPoll` — atomic vote + option count update
- `rsvpEvent` — atomic capacity check + status assignment
- `cancelRsvp` — atomic cancel + waitlist promotion
- `submitContestEntry` — atomic entry insert + contest entryCount update
- `joinHub` / `leaveHub` — atomic member row + memberCount update
- `createPost` / `deletePost` — member row + post + denormalized hub.postCount
- `publishContent` — status change + federation activity enqueue

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
| content:published | **emitted** | `content/content.ts` (`publishContent`) |
| content:updated | **emitted** | `content/content.ts` (`updateContent`) |
| content:deleted | **emitted** | `content/content.ts` (`deleteContent`) |
| comment:created | **emitted** | `social/social.ts` (`createComment`) |
| hub:post:created | **emitted** | `hub/posts.ts` (`createPost`) |
| hub:member:joined | **emitted** | `hub/members.ts` (`joinHub`) |
| hub:member:left | **emitted** | `hub/members.ts` (`leaveHub`) |
| federation:content:received | **emitted** | `federation/inboxHandlers.ts` |
| content:liked / content:unliked | declared, not emitted | (add to `social/social.ts` `toggleLike` when needed) |
| hub:content:shared | declared, not emitted | (add to `hub/posts.ts` `shareContent`) |
| user:registered | declared, not emitted | (register in Better Auth after-register hook) |
| federation:hub:post:received | declared, not emitted | (add to `federation/hubMirroring.ts`) |

**Current subscriptions** (layer server plugins):
- `plugins/search-index.ts` — subscribes to `content:published`, `content:updated`, `content:deleted` (indexes Meilisearch/FTS).
- Other plugins (`federation-delivery`, `notification-email`, `auto-admin`, `federation-hub-sync`) use direct `defineNitroPlugin` + timers/callbacks instead of the hook bus.

Consumer apps can register additional handlers via `onHook()` in their own server plugins.

## What's missing / known issues

- Some tables lack Zod validators (see schema inventory). `events` + `eventAttendees` are the notable gaps.
- `federatedContent.mirrorId` has no FK — enforced in app code only.
- 3 skipped tests (PGlite limitations per memory).
- No dedicated module for `files/` CRUD beyond storage adapter — handled inline in the layer's upload API route.
