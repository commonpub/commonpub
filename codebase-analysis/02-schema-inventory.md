# 02 — Schema Inventory

Source: `packages/schema/src/*.ts`. As of session 125 (2026-04-16).
**Headline counts re-verified session 150 (2026-05-19): 79
tables, 41 enums. Now ~80+ tables after the 4 layout-engine tables
landed (sessions 155 + 157, migration 0005).** The file list below is
missing `publicApi.ts` (session 127 — api_keys + api_key_usage tables).
Migration set has grown to 0000–0008 (0001 docs unstringify, 0002
session-130 constraints, 0003 notifications dedup, 0004 federated OAuth
tokens in session 137, **0005 `0005_wonderful_blue_marvel` — layout
engine tables, session 155/157**, **0006 contest `judging_criteria`,
0007 contest `eligible_content_types` + `max_entries_per_user`,
0008 contest `visibility`/`visible_to_roles` + `contest_stakeholders` table —
sessions 171/172/174**). 9 migrations total; latest is
`0008_contest_visibility_stakeholders`. Individual tables added since 125 —
federated_accounts + oauth_codes for cross-instance identity (session
137) — are reflected in pgTable() counts but NOT yet enumerated in the
per-file list below.

**~80+ tables, 41 enums, 50+ Zod validators.** Drizzle ORM on PostgreSQL 16. Core table count verified against both production DBs on 2026-04-17; +4 layout-engine tables (migration 0005) since.

## Files

```
packages/schema/src/
├── enums.ts         all pgEnums
├── auth.ts          users, sessions, accounts, organizations, members, federatedAccounts, verifications
├── content.ts       contentItems, contentCategories, contentVersions, contentForks, contentBuilds, tags, contentTags
├── social.ts        likes, follows, comments, bookmarks, notifications, reports, conversations, messages, messageReads
├── hub.ts           hubs, hubMembers, hubPosts, hubPostReplies, hubPostLikes, hubBans, hubInvites, hubShares, hubActorKeypairs, hubFollowers, hubResources
├── product.ts       products, contentProducts
├── learning.ts      learningPaths, learningModules, learningLessons, enrollments, lessonProgress, certificates
├── docs.ts          docsSites, docsVersions, docsPages
├── video.ts         videos, videoCategories
├── contest.ts       contests, contestEntries, contestJudges, contestStakeholders
├── events.ts        events, eventAttendees
├── voting.ts        hubPostVotes, pollOptions, pollVotes, contestEntryVotes
├── federation.ts    remoteActors, activities, followRelationships, actorKeypairs, federatedContent, federatedContentBuilds, instanceMirrors, instanceHealth, federatedHubs, federatedHubPosts, federatedHubMembers, federatedHubPostReplies, federatedHubResources, federatedHubProducts, userFederatedHubFollows
├── files.ts         files
├── admin.ts         instanceSettings, auditLogs
├── layout.ts        layouts, layoutRows, layoutSections, layoutVersions (session 155)
├── validators.ts    Zod schemas (50+)
├── sectionConfigs.ts per-section Zod schemas + SECTION_CONFIG_SCHEMAS lookup map (17 sections, session 161)
├── index.ts         barrel
└── openapi.ts       OpenAPI generator
```

## Enums (47)

| Enum | Values |
|---|---|
| userRoleEnum | member, pro, verified, staff, admin |
| userStatusEnum | active, suspended, deleted |
| profileVisibilityEnum | public, members, private |
| contentStatusEnum | draft, published, archived |
| contentTypeEnum | project, article, blog, explainer |
| difficultyEnum | beginner, intermediate, advanced |
| contentVisibilityEnum | public, members, private |
| likeTargetTypeEnum | project, article, blog, explainer, comment, post, video |
| commentTargetTypeEnum | project, article, blog, explainer, post, lesson, video |
| bookmarkTargetTypeEnum | project, article, blog, explainer, learning_path |
| reportTargetTypeEnum | project, article, blog, post, comment, user, explainer |
| reportReasonEnum | spam, harassment, inappropriate, copyright, other |
| reportStatusEnum | pending, reviewed, resolved, dismissed |
| notificationTypeEnum | like, comment, follow, mention, contest, event, certificate, hub, system, fork, build |
| hubTypeEnum | community, product, company |
| hubPrivacyEnum | public, unlisted, private |
| hubRoleEnum | owner, admin, moderator, member |
| hubJoinPolicyEnum | open, approval, invite |
| hubMemberStatusEnum | pending, active |
| postTypeEnum | text, link, share, poll, discussion, question, showcase, announcement |
| resourceCategoryEnum | documentation, tools, tutorials, community, hardware, software, other |
| productStatusEnum | active, discontinued, preview |
| productCategoryEnum | microcontroller, sbc, sensor, actuator, display, communication, power, mechanical, software, tool, other |
| lessonTypeEnum | article, video, quiz, project, explainer |
| contestStatusEnum | upcoming, active, judging, completed, cancelled |
| contestVisibilityEnum | public, unlisted, private (session 174) |
| judgeRoleEnum | **lead, judge, guest** (session 124) |
| judgingVisibilityEnum | **public, judges-only, private** (session 124) |
| voteDirectionEnum | **up, down** (session 124) |
| eventStatusEnum | **draft, published, active, completed, cancelled** (session 124) |
| eventTypeEnum | **in-person, online, hybrid** (session 124) |
| eventAttendeeStatusEnum | **registered, waitlisted, cancelled, attended** (session 124) |
| videoPlatformEnum | youtube, vimeo, other |
| filePurposeEnum | cover, content, avatar, banner, attachment |
| activityDirectionEnum | inbound, outbound |
| activityStatusEnum | pending, delivered, failed, processed |
| followRelationshipStatusEnum | pending, accepted, rejected |
| mirrorStatusEnum | pending, active, paused, failed |
| mirrorDirectionEnum | pull, push |
| hubFollowStatusEnum | pending, joined |
| docsPageStatusEnum | draft, published, archived |
| tagCategoryEnum | platform, language, framework, topic, general |

## Tables by domain

### Auth (7)

| Table | Purpose | Notable |
|---|---|---|
| users | Accounts + profile | soft delete, JSONB socialLinks/skills/experience, role/status enums |
| sessions | Better Auth sessions | token unique |
| accounts | OAuth / password providers | per-user, multi-provider |
| organizations | Team/org | name + unique slug |
| members | Org membership | — |
| federatedAccounts | External AP identities linked to local user | actorUri unique |
| verifications | Email/phone codes | — |
| (oauthClients, oauthCodes exist but no Zod validators) | | |

### Content (7)

| Table | Purpose | Notable |
|---|---|---|
| contentItems | project / article / blog / explainer | unique(authorId, type, slug); counters (viewCount, likeCount, forkCount, buildCount…); soft delete; JSONB content (BlockTuple[]), parts, sections |
| contentCategories | Taxonomy | isSystem flag — can't be deleted |
| contentVersions | Full snapshots | — |
| contentForks | fork lineage (self-ref) | — |
| contentBuilds | "I built this" | unique(userId, contentId) |
| tags | Global tag registry | name + slug unique |
| contentTags | Junction | — |

### Social (6) + Messaging (3)

| Table | Purpose | Notable |
|---|---|---|
| likes | Polymorphic | unique(userId, targetType, targetId) |
| follows | User follows | unique(followerId, followingId) |
| comments | Threaded (self-ref parentId) | polymorphic target |
| bookmarks | Polymorphic | unique(userId, targetType, targetId) |
| notifications | In-app | index(userId, read); 11 types |
| reports | Moderation | workflow status |
| conversations | DM threads | participants JSONB; GIN index |
| messages | DMs | — |
| messageReads | Read receipts | unique(messageId, userId) |

### Hubs (9) + Hub Federation (2 in hub.ts)

| Table | Purpose | Notable |
|---|---|---|
| hubs | Communities/products/companies | hubType enum; self-hierarchical parentHubId; soft delete; apActorId for Group actor |
| hubMembers | Membership | composite PK (hubId, userId); role enum |
| hubPosts | Feed posts | authorId nullable for federated posts; voteScore denormalized; remoteActorUri |
| hubPostReplies | Threaded replies | nullable author, remoteActorUri |
| hubPostLikes | Tracking | unique(postId, userId) |
| hubBans | User bans | expiresAt nullable (permanent if null) |
| hubInvites | Invite tokens | reusable, time-limited |
| hubShares | Content shared into hub | unique(hubId, contentId) |
| hubActorKeypairs | Per-hub RSA key for Group actor | unique hubId |
| hubFollowers | Remote AP followers of local hub | unique(hubId, followerActorUri) |
| hubResources | Curated links per hub | sortOrder; category enum |

### Products (2)

| Table | Purpose | Notable |
|---|---|---|
| products | Hub-scoped catalog | category enum; JSONB specs/alternatives/pricing |
| contentProducts | BOM: content ↔ product | quantity, role, required |

### Learning (6)

| Table | Purpose | Notable |
|---|---|---|
| learningPaths | Courses | enrollmentCount, completionCount, averageRating |
| learningModules | Sections | sortOrder |
| learningLessons | Lessons | unique(moduleId, slug); lessonType enum; contentItemId optional link |
| enrollments | User enrollments | unique(userId, pathId); progress 0–100 |
| lessonProgress | Per-lesson completion | unique(userId, lessonId); quizScore |
| certificates | Completion certs | verificationCode unique; unique(userId, pathId) |

### Docs (3)

| Table | Purpose | Notable |
|---|---|---|
| docsSites | Docs site instances | themeTokens JSONB |
| docsVersions | Version branches | unique(siteId, version); isDefault |
| docsPages | Pages (BlockTuple[] format) | unique(versionId, slug); self-hierarchical parentId |

### Videos (2)

| Table | Purpose | Notable |
|---|---|---|
| videos | Video catalog | platform enum; denormalized counters |
| videoCategories | Taxonomy | — |

### Contests (4) — sessions 124 / 171–174

| Table | Purpose | Notable |
|---|---|---|
| contests | Contests | status enum (5 states, lifecycle); JSONB `prizes` (place AND/OR category) + `judgingCriteria` rubric (0006); `judgingVisibility` + `communityVotingEnabled`; `eligibleContentTypes` + `maxEntriesPerUser` (0007); **`visibility` (public/unlisted/private) + `visibleToRoles` role-gate (0008)**. **`judges` jsonb is deprecated/dead — judges live in `contestJudges`.** |
| contestEntries | Submissions | unique(contestId, userId, contentId); JSONB judgeScores (incl. per-criterion `criteriaScores`); `score` (avg, gated by `shouldRevealScores`) + `rank` (RANK(), scored entries only) |
| contestJudges | Judge roster (THE source of truth; `contests.judges` jsonb is dead) | unique(contestId, userId); role enum (lead/judge/guest); invitedAt/acceptedAt — scoring needs accepted + non-guest; can't judge own entry |
| contestStakeholders | View-only reviewers (0008) | unique(contestId, userId); grants `canViewContest` access to private/unpublished contests without judge/admin rights |

### Events (2) — session 124 added

| Table | Purpose | Notable |
|---|---|---|
| events | Events | status/type enums; slug unique; hubId nullable; capacity + attendeeCount denormalized |
| eventAttendees | Registrations | status enum (registered/waitlisted/cancelled/attended); no unique constraint — possible dup risk |

### Voting (4) — session 124 added

| Table | Purpose | Notable |
|---|---|---|
| hubPostVotes | Up/down on hub posts | unique(postId, userId); direction enum |
| pollOptions | Options for poll-type hub posts | voteCount denormalized |
| pollVotes | Per-user poll vote | unique(postId, userId) — one vote per poll, not per option |
| contestEntryVotes | Community votes on entries | unique(entryId, userId) |

### Federation (8 in federation.ts) + (7 more for federated hubs)

Core AP:

| Table | Purpose | Notable |
|---|---|---|
| remoteActors | Cache of remote AP actors | actorUri unique |
| activities | Inbound/outbound AP activity queue | direction+status enums; lockedAt for worker coordination; deadLetteredAt |
| followRelationships | AP follows | activityUri stored for Undo |
| actorKeypairs | Per-user RSA | unique userId |
| federatedContent | Remote content mirrored locally | cpubType + cpubBlocks preserve CommonPub fidelity; soft delete; objectUri unique |
| federatedContentBuilds | "I built this" on remote | unique(userId, federatedContentId) |
| instanceMirrors | Mirror configs | direction (pull/push); status; backfillCursor; filterContentTypes JSONB |
| instanceHealth | Circuit breaker per remote domain | circuitOpenUntil, consecutiveFailures |

Federated hubs:

| Table | Purpose | Notable |
|---|---|---|
| federatedHubs | Remote hub cache | actorUri unique; status enum; localPostCount vs remotePostCount |
| federatedHubPosts | Remote hub posts | objectUri unique; soft delete; remote vs local engagement counters |
| federatedHubMembers | Remote members discovered in hub | unique(federatedHubId, remoteActorId); discoveredVia enum |
| federatedHubPostReplies | Replies to remote posts | hybrid local/remote authorId; self-ref parent |
| federatedHubPostLikes | Remote likes on hub posts | unique(postId, userId) |
| federatedHubResources | Mirrored resource links | objectUri unique |
| federatedHubProducts | Mirrored products | objectUri unique |
| userFederatedHubFollows | Per-user join tracking | unique(userId, federatedHubId); status (pending/joined) |

### Admin / Audit / Files (3)

| Table | Purpose | Notable |
|---|---|---|
| instanceSettings | Key-value config (JSONB value) | key unique; used for homepage sections, nav items, theme, federation policy |
| auditLogs | Append-only action log | action field uses `verb.noun` naming |
| files | Uploads | purpose enum; polymorphic context (contentId OR hubId OR none) |

### Layout engine (4 — session 155 + session 157, migration 0005)

| Table | Purpose | Notable |
|---|---|---|
| layouts | One per route/virtual/custom-page scope | `unique(scope_type, scope_key)`; `state in (draft, published)`; `published_version_id` is a **soft FK** to `layout_versions` (no constraint — avoids the circular FK with cascade-delete) |
| layoutRows | Rows within a zone of a layout | `unique(layout_id, zone, position)`; cascades from layouts |
| layoutSections | Sections within a row | `unique(row_id, position)`; `CHECK col_span between 1 and 12`; `responsive` + `visibility` are JSONB; `schema_version` for per-type config migrations; cascades from layoutRows |
| layoutVersions | Immutable publish snapshots | `unique(layout_id, version)`; full nested `LayoutRecord` in JSONB `snapshot`; revert copies snapshot back to current — version row itself untouched |

Consumed by `packages/server/src/layout/layout.ts` (Phase 1 server CRUD, session 157). Read via `<LayoutSlot>` Vue component once `features.layoutEngine` flips ON. **Instance-local — these 4 tables never federate** (ADR 027 / CLAUDE.md federation-scope table); they never serialize through `@commonpub/protocol`.

## Zod validators

Live in `packages/schema/src/validators.ts`. All user-facing writes go through these.

Coverage by domain: auth (7 validators), content (8), social (3 for comments/likes/reports), hubs (16), products (5), contests (5), videos (3), learning (7), messaging (2), docs (5), admin (4), federation (7), filters (3).

**Tables without validators** (intentional — system-generated or internal):
sessions, accounts, organizations, members, verifications, contentVersions, contentForks, contentBuilds, tags, contentTags, follows, bookmarks, notifications, hubMembers, hubPostLikes, hubFollowers, hubActorKeypairs, events (missing — should have one), eventAttendees (missing — should have one), enrollments, lessonProgress, certificates, pollVotes, hubPostVotes, contestEntryVotes, auditLogs, files, instanceMirrors, remoteActors, federatedContent, federatedHub* (all), instanceHealth.

**Gaps worth closing:** `events`, `eventAttendees` — currently unvalidated despite user-facing API.

## Invariants / patterns

- **Soft delete**: users, contentItems, hubs, federatedContent, federatedHubPosts use `deletedAt`. Everything else is hard delete (often via CASCADE).
- **Denormalized counters**: many tables carry counters that are updated in transaction with the source write (likeCount, voteScore, entryCount, attendeeCount, memberCount, etc.). Backfill script exists in scripts/ for reconciliation.
- **Polymorphic targets**: likes, comments, bookmarks, reports use (targetType, targetId). Target types are enumerated.
- **Self-hierarchy**: hubs.parentHubId, comments.parentId, hubPostReplies.parentId, federatedHubPostReplies.parentId, docsPages.parentId.
- **Federation cleanliness**: `hubPosts.authorId` is nullable so that federated posts (where the author isn't local) can coexist with local posts without a synthetic user.
- **CommonPub extensions**: federated content carries `cpubType` + `cpubBlocks` so two CommonPub instances preserve full BlockTuple fidelity; Mastodon/Lemmy fall back to HTML + AP type.

## Foreign-key caveats

- `federatedContent.mirrorId` — NO DB-level FK. Enforced in app code only. Known debt.
- Most other FKs use `ON DELETE CASCADE` where the relationship is ownership (user → session, content → version, hub → post, etc.).
- Parent self-refs (hubs.parentHubId, comments.parentId) are `ON DELETE SET NULL` to avoid catastrophic tree drop.

## Schema deploy workflow (session 128+)

Schema changes go through committed migrations, not `drizzle-kit push`.
Workflow:

1. Edit `packages/schema/src/*.ts`.
2. `pnpm --filter=@commonpub/schema db:generate` (requires TTY) → creates `migrations/000N_*.sql` + snapshot.
3. **Commit** the `.ts` change, the `.sql` migration, and the updated `meta/_journal.json` + `meta/000N_snapshot.json` together.
4. Bump `@commonpub/schema` version; publish if downstream consumers (e.g. deveco) pin it.
5. Push to main. CI runs `scripts/db-migrate.mjs` which calls `drizzle-orm/node-postgres/migrator.migrate()` against the committed migrations. State is tracked in `drizzle.__drizzle_migrations`.

`drizzle-kit push` is **no longer used** in CI because it blocks on TTY prompts for populated-table constraint changes, varchar→enum conversions, and rename detection — when it throws, it silently drops ALL queued DDL. This caused the session-128 docs outage (two columns on `docs_pages` never got applied for weeks). See `docs/sessions/128-docs-and-learn-audit.md`.
