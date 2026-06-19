# 02 — Schema Inventory

Source: `packages/schema/src/*.ts`. Re-verified session 191 (2026-06-07); counts/migrations refreshed session 203 (2026-06-18).

**90 tables (`grep -c pgTable`), 46 enums (`grep -c pgEnum`), 118 `*Schema`
exports in `validators.ts`.** Drizzle ORM on PostgreSQL 16. (+3 tables / +3 enums
since session 181: `mirror_requests` (0014) + `registry_instances` +
`registry_instance_status` (0015) federation discovery work, sessions 185/186;
`metrics_daily` (0020) public-API time-series rollups, session 190;
`contest_entries.stage_submissions` (0021) per-stage artifacts, session 194.)

**28 migrations, 0000–0027; latest `0027_audit204_indexes_dedup`** (session 204 — hot-read composite
indexes on `content_items` `(author_id,status)` + `(type,status,published_at)` + notifications
`(user_id,created_at,id)`, AND two new tables: `processed_activities` (inbox replay dedup,
`activity_id` PK) + `digest_runs` (multi-replica digest claim, `digest_date` PK); `0026_remote_like_count`
= `content_items`/`hub_posts`.`remote_like_count` column + backfill so reconcile can't wipe federated
likes. Both additive. Applied on commonpub.io only — deveco/heatsync still at 0025 until npm publish.
**`validators.ts` is now a re-export shim; the 118 `*Schema` exports live in `validators/<domain>.ts`.**
Prior: `0025_round_malice` = `contest_stakeholders.role`
reviewer\|editor + seeds 5 RBAC system roles/permission sets/`user_roles` backfill, session 201;
`0021_thick_speed` = `contest_entries.stage_submissions`
jsonb — per-stage submission artifacts, session 194; `0020_spooky_gideon` = `metrics_daily` table —
public-API Phase 3 analytics time-series, session 190; `0019_regular_tinkerer` =
`contest_entries.stage_state` jsonb — Phase B2 per-entry cohort outcome, session 189;
`0018_clean_the_hunter` = `contests.stages` jsonb + `contests.current_stage_id` —
Phase B1, session 189; `0017_exotic_lyja` = `contest_status` enum `+draft,+paused` and
`contests.show_prizes`, session 189). Full list:

| # | File | What it added |
|---|---|---|
| 0000 | `session128_baseline` | Baseline snapshot (session 128 migrate switch) |
| 0001 | `docs_content_unstringify` | **data-only** UPDATE (no DDL) — unwraps double-stringified `docs_pages.content` rows (a jsonb STRING holding JSON text) back to proper BlockTuple jsonb. The column-TYPE change is a separate manual `ALTER … TYPE jsonb` (see CLAUDE.md), not this migration. |
| 0002 | `session130_constraints` | FK/constraint hardening (incl. `federated_content.mirror_id` FK, `event_attendees` unique) |
| 0003 | `notifications_dedup` | notification dedup — a plain (full) `CREATE UNIQUE INDEX` on `(user_id,type,actor_id,link)` (NOT partial; the only `WHERE` in the file is on the DELETE backfill) |
| 0004 | `federated_oauth_tokens` | OAuth token columns ON `federated_accounts` (`access_token_ciphertext`/`_iv`, `scopes`, `software_kind`, `revoked_at`, `last_verified_at`) — cross-instance identity, session 137. (The `federated_accounts` table itself is in baseline 0000.) |
| 0005 | `wonderful_blue_marvel` | Layout-engine tables `layouts`/`layout_rows`/`layout_sections`/`layout_versions` (sessions 155/157) |
| 0006 | `contest_voting_visibility_criteria` | contest `judging_criteria` column (jsonb rubric) only — despite the drizzle filename, `community_voting_enabled` + `judging_visibility` were already in baseline 0000 |
| 0007 | `contest_entry_eligibility` | contest `eligible_content_types` + `max_entries_per_user` |
| 0008 | `contest_visibility_stakeholders` | contest `visibility`/`visible_to_roles` + `contest_stakeholders` table |
| 0009 | `rbac_roles_permissions` | RBAC `roles`/`role_permissions`/`user_roles` (session 175) |
| 0010 | `powerful_doctor_faustus` | contest `subheading` column (`varchar(300)`) |
| 0011 | `green_lorna_dane` | contest `prizes_description` column (`text`) |
| 0012 | `true_nicolaos` | Two PARTIAL composite feed indexes `idx_content_items_feed_recency` + `idx_content_items_feed_popular` (keyset pagination, session 179) |
| 0013 | `black_lorna_dane` | Self-referential FK constraints (ON DELETE SET NULL) on `comments.parent_id`, `hub_post_replies.parent_id`, `docs_pages.parent_id`, `hubs.parent_hub_id` (session 183). Nulls any pre-existing dangling pointers first, then adds the constraints — same "null orphans then enforce" pattern as 0002. |
| 0014 | `great_meltdown` | `mirror_requests` table (consent-based push: incoming\|outgoing mirror requests, offer-uri correlation, depth/filters) — Phase 3 federation, session 185. |
| 0015 | `cloudy_zodiak` | `registry_instances` table + `registry_instance_status` enum (active\|hidden\|blocked) — Phase 4 instance directory, session 186. Stats pulled from each pinger's NodeInfo. |
| 0016 | `smooth_firestar` | `contests.cover_image_url` (nullable text) — optional card/thumbnail cover, distinct from the wide `banner_url` hero. Listing cards fall back to a contained banner then a trophy. Session 188. |
| 0017 | `exotic_lyja` | `contest_status` enum `ADD VALUE 'draft' BEFORE 'upcoming'` + `'paused' BEFORE 'judging'`; `contests.show_prizes` boolean default true. Contest Phase A — stage lifecycle (draft/paused + bidirectional transitions) + Prizes-tab off-switch. Session 189. |
| 0018 | `clean_the_hunter` | `contests.stages` jsonb (default `'[]'`, NOT NULL) + `contests.current_stage_id` text. Contest Phase B1 — explicit ordered stage timeline (`[]` ⇒ server synthesizes the classic Submissions → Judging → Results). Additive. Session 189. |
| 0019 | `regular_tinkerer` | `contest_entries.stage_state` jsonb (default `'[]'`, NOT NULL). Contest Phase B2 — per-entry cohort outcome (`advanced`/`eliminated` + snapshot score/rank per review stage); empty ⇒ active cohort. Additive. Session 189. |
| 0020 | `spooky_gideon` | `metrics_daily` table (`day` date, `metric` varchar, `dimension` varchar default `''`, `value` bigint) + `UNIQUE(day,metric,dimension)` (`uq_metrics_daily_day_metric_dim`) + index `idx_metrics_daily_metric_day` on `(metric,day)`. Public-API Phase 3 time-series rollups (`metrics-rollup` plugin backfills then refreshes every 6h). Additive. Session 190. |
| 0021 | `thick_speed` | `contest_entries.stage_submissions` jsonb (default `'[]'`, NOT NULL). Per-stage submission artifacts (`{stageId, fields, submittedAt}[]` — the filled `submissionTemplate` values for each `submission` stage, upserted while the stage is open). Additive. Session 194. |
| 0022 | `wide_sumo` | contest `content_format` column + `contest_content_format` enum (markdown\|html). Session 197. **DEPRECATED/inert** — superseded by the per-field `*_format` columns in 0023; retained for backward compat. |
| 0023 | `tense_dust` | Per-field contest format columns `description_format` / `rules_format` / `prizes_description_format` (each `contest_content_format`) — granular per-field markdown/html selection replacing the single `content_format`. Session 197. |
| 0024 | `motionless_northstar` | `content_status` enum `ADD VALUE 'scheduled'` + `content_items.scheduled_at` timestamp — scheduled publishing. Session 199. |
| 0025 | `round_malice` | `contest_stakeholders.role` column (`reviewer`\|`editor`) granting per-contest edit; seeds 5 RBAC system roles + permission sets + `user_roles` backfill. Session 203. |

## Files

```
packages/schema/src/
├── enums.ts         all pgEnums (46)
├── auth.ts          users, sessions, accounts, organizations, members, federatedAccounts, oauthClients, oauthCodes, verifications (9)
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
├── federation.ts    remoteActors, activities, followRelationships, actorKeypairs, federatedContent, federatedContentBuilds, instanceMirrors, instanceHealth, federatedHubs, federatedHubPosts, federatedHubMembers, federatedHubPostLikes, federatedHubPostReplies, federatedHubResources, federatedHubProducts, userFederatedHubFollows, mirrorRequests, registryInstances (18)
├── files.ts         files
├── admin.ts         instanceSettings, auditLogs
├── layout.ts        layouts, layoutRows, layoutSections, layoutVersions (session 155)
├── rbac.ts          roles, rolePermissions, userRoles (session 175, migration 0009)
├── publicApi.ts     apiKeys, apiKeyUsage (session 127)
├── metrics.ts       metricsDaily (session 190, migration 0020)
├── permissions.ts   permission catalog (no tables; permission-string constants for RBAC)
├── validators.ts    Zod schemas (118 `*Schema` exports; now incl. theme-studio recipe/font validators `themeRecipeSchema` + `fonts`)
├── sectionConfigs.ts per-section Zod schemas + SECTION_CONFIG_SCHEMAS lookup map (17 sections, session 161)
├── index.ts         barrel
└── openapi.ts       OpenAPI generator
```

## Enums (46)

| Enum | Values |
|---|---|
| userRoleEnum | member, pro, verified, staff, admin |
| userStatusEnum | active, suspended, deleted |
| profileVisibilityEnum | public, members, private |
| contentStatusEnum | draft, scheduled, published, archived (0024 added scheduled, enums.ts:9) |
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
| contestStatusEnum | draft, upcoming, active, paused, judging, completed, cancelled (0017 added draft/paused; transitions are bidirectional) |
| contestVisibilityEnum | public, unlisted, private (session 174) |
| contestContentFormatEnum | markdown, html (enums.ts:154, 0022/0023) |
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
| mirrorRequestDirectionEnum | **incoming, outgoing** (0014, session 185) |
| mirrorRequestStatusEnum | **pending, approved, rejected** (0014, session 185) |
| registryInstanceStatusEnum | **active, hidden, blocked** (0015, session 186) |
| hubFollowStatusEnum | pending, joined |
| docsPageStatusEnum | draft, published, archived |
| tagCategoryEnum | platform, language, framework, topic, general |

## Tables by domain

### Auth (9)

| Table | Purpose | Notable |
|---|---|---|
| users | Accounts + profile | soft delete, JSONB socialLinks/skills/experience, role/status enums |
| sessions | Better Auth sessions | token unique |
| accounts | OAuth / password providers | per-user, multi-provider |
| organizations | Team/org | name + unique slug |
| members | Org membership | — |
| federatedAccounts | External AP identities linked to local user | actorUri unique |
| oauthClients | Registered OAuth/AP clients | no Zod validator (system-managed) |
| oauthCodes | Short-lived OAuth authorization codes | no Zod validator (system-managed) |
| verifications | Email/phone codes | — |

### Content (7)

| Table | Purpose | Notable |
|---|---|---|
| contentItems | project / article / blog / explainer | unique(authorId, type, slug); counters (viewCount, likeCount, forkCount, buildCount…); soft delete; JSONB content (BlockTuple[]), parts, sections; `scheduledAt` timestamp (0024) — scheduled publishing with status `scheduled` |
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

### Contests (4) — sessions 124 / 171–174 / 188–189

| Table | Purpose | Notable |
|---|---|---|
| contests | Contests | status enum (**7 states** since 0017: draft, upcoming, active, paused, judging, completed, cancelled — bidirectional transitions); JSONB `prizes` (place AND/OR category) + `judgingCriteria` rubric (0006); `judgingVisibility` + `communityVotingEnabled`; `eligibleContentTypes` + `maxEntriesPerUser` (0007); **`visibility` (public/unlisted/private) + `visibleToRoles` role-gate (0008)**; `coverImageUrl` (0016); `showPrizes` boolean default true (0017); **`stages` jsonb + `currentStageId` (0018)** = explicit ordered stage timeline (`[]` ⇒ server synthesizes Submissions → Judging → Results) — each ContestStage carries `criteria` / `advanceCount` / `submissionTemplate`; per-stage filled values land in `contestEntries.stageSubmissions`; per-field format columns **`descriptionFormat` / `rulesFormat` / `prizesDescriptionFormat`** (`contest_content_format`, 0023); **`contentFormat` (0022) is deprecated/inert** — superseded by the per-field columns. **`judges` jsonb is deprecated/dead — judges live in `contestJudges`.** |
| contestEntries | Submissions | unique(contestId, userId, contentId); JSONB judgeScores (incl. per-criterion `criteriaScores` + per-round `roundId`); `score` (avg, gated by `shouldRevealScores`) + `rank` (RANK(), scored + non-eliminated entries only); **`stageState` jsonb (0019)** = per-entry cohort outcome (`advanced`/`eliminated` + snapshot score/rank per review stage); empty ⇒ active cohort; **`stageSubmissions` jsonb (0021)** = per-stage artifacts (`{stageId, fields, submittedAt}[]` filled from the stage's `submissionTemplate`; privilege-gated in reads) |
| contestJudges | Judge roster (THE source of truth; `contests.judges` jsonb is dead) | unique(contestId, userId); role enum (lead/judge/guest); invitedAt/acceptedAt — scoring needs accepted + non-guest; can't judge own entry |
| contestStakeholders | Per-contest reviewers/editors (0008) | unique(contestId, userId); grants `canViewContest` access to private/unpublished contests without judge/admin rights; **`role` column (reviewer\|editor, contest.ts:273, migration 0025)** — `editor` grants per-contest edit |

### Events (2) — session 124 added

| Table | Purpose | Notable |
|---|---|---|
| events | Events | status/type enums; slug unique; hubId nullable; capacity + attendeeCount denormalized |
| eventAttendees | Registrations | status enum (registered/waitlisted/cancelled/attended); `unique(eventId, userId)` (migration 0002) — `rsvpEvent` relies on it with `ON CONFLICT DO NOTHING` |

### Voting (4) — session 124 added

| Table | Purpose | Notable |
|---|---|---|
| hubPostVotes | Up/down on hub posts | unique(postId, userId); direction enum |
| pollOptions | Options for poll-type hub posts | voteCount denormalized |
| pollVotes | Per-user poll vote | unique(postId, userId) — one vote per poll, not per option |
| contestEntryVotes | Community votes on entries | unique(entryId, userId) |

### Federation (18 in federation.ts: 10 core AP + 8 federated-hub)

Core AP:

| Table | Purpose | Notable |
|---|---|---|
| remoteActors | Cache of remote AP actors | actorUri unique |
| activities | Inbound/outbound AP activity queue | direction+status enums; lockedAt for worker coordination; deadLetteredAt |
| followRelationships | AP follows | activityUri stored for Undo |
| actorKeypairs | Per-user RSA | unique userId |
| federatedContent | Remote content mirrored locally | cpubType + cpubBlocks preserve CommonPub fidelity; soft delete; objectUri unique |
| federatedContentBuilds | "I built this" on remote | unique(userId, federatedContentId) |
| instanceMirrors | Mirror configs (PULL only since Phase 3) | direction stays pull; status; backfillCursor; filterContentTypes JSONB |
| mirrorRequests | Consent-based mirror requests (Phase 3) | unique(direction, remoteDomain); direction incoming\|outgoing; status pending\|approved\|rejected; offerActivityUri correlates Accept/Reject; resultingMirrorId FK→instanceMirrors (set null) |
| registryInstances | Registry directory entries (Phase 4) | domain unique; status active\|hidden\|blocked; stats (user/activeMonth/localPost counts) + features jsonb + software pulled from NodeInfo on each ping; lastPingAt (online derived); idx on status + lastPingAt |
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

### RBAC (3 — session 175, migration 0009)

| Table | Purpose | Notable |
|---|---|---|
| roles | Named role definitions | behind `features.rbac` (default OFF); the legacy `users.role` enum is still the floor |
| rolePermissions | Role → permission-string grants | permission catalog in `permissions.ts` |
| userRoles | User → role assignments | resolved by `packages/server/src/rbac/resolver.ts` with a 30s-TTL cache (admin `*` grant deliberately NOT cached — fresh `users.role` floor) |

### Public API (2 — session 127)

| Table | Purpose | Notable |
|---|---|---|
| apiKeys | Admin-issued bearer tokens for the public read API | 13 read scopes + `read:*` wildcard (incl. `read:analytics`/`read:federation`, session 190); per-key `allowedOrigins` CORS patterns (`originPatternSchema`, session 190); behind `features.publicApi` (default OFF) |
| apiKeyUsage | Per-key request usage log | rate-limit + audit |

### Metrics (1 — session 190, migration 0020)

| Table | Purpose | Notable |
|---|---|---|
| metricsDaily | Daily analytics rollups for `/api/public/v1/metrics/timeseries` | `(day, metric, dimension)` unique; `value` bigint; populated by the `metrics-rollup` plugin (backfill-from-timestamps then 6h refresh); opt-in on `features.publicApi` |

## Zod validators

Live in `packages/schema/src/validators.ts` (1254 LOC, 118 `*Schema` exports — now including theme-studio recipe/font validators `themeRecipeSchema` + `fonts`). All user-facing writes go through these. Per-section config schemas live separately in `sectionConfigs.ts`.

Coverage by domain (approximate): auth (~7), content (~8), social (~3 for comments/likes/reports), hubs (~16), products (~5), contests (~5), videos (~3), learning (~7), messaging (~2), docs (~5), admin (~4), federation (~7), theme (~8), layout (~10), publicApi (~2), plus 6 `*FiltersSchema` list-filter validators (`content`/`hub`/`learningPath`/`video`/`contest`/`hubPost`).

**Tables without validators** (intentional — system-generated or internal):
sessions, accounts, organizations, members, verifications, oauthClients, oauthCodes, contentVersions, contentForks, contentBuilds, tags, contentTags, follows, bookmarks, notifications, hubMembers, hubPostLikes, hubFollowers, hubActorKeypairs, events, eventAttendees, enrollments, lessonProgress, certificates, pollVotes, hubPostVotes, contestEntryVotes, contestStakeholders, auditLogs, files, instanceMirrors, remoteActors, federatedContent, federatedHub* (all), instanceHealth, roles, rolePermissions, userRoles, apiKeyUsage, layout* (CRUD-validated via layout schemas, not row validators).

**Note (corrected session 182/183):** `events` is NOT an unvalidated user-facing endpoint — `POST /api/events` validates with a thorough inline `createEventSchema` (`layers/base/server/api/events/index.post.ts`: length bounds, `.datetime()`, `.url()`, end>start refine). RSVP takes only path `eventId` + session `userId` (no body). The only real gap is centralization: there is no *shared* event validator in `validators.ts` (validation is decentralized inline) — a consistency nit, not a security hole.

## Invariants / patterns

- **Soft delete**: users, contentItems, hubs, federatedContent, federatedHubPosts use `deletedAt`. Everything else is hard delete (often via CASCADE).
- **Denormalized counters**: many tables carry counters updated alongside the source write (likeCount, voteScore, entryCount, attendeeCount, memberCount, etc.), now all in a transaction (see 03 Transactions — `leaveHub` and `submitContestEntry`, the two former non-transactional exceptions, have since been wrapped). Drift from crashes / manual edits is repaired by **`scripts/reconcile-counters.mjs`** (`--check` reports + exits 1; no-arg fixes; idempotent; safe on prod).
- **Polymorphic targets**: likes, comments, bookmarks, reports use (targetType, targetId). Target types are enumerated.
- **Self-hierarchy**: hubs.parentHubId, comments.parentId, hubPostReplies.parentId, federatedHubPostReplies.parentId, docsPages.parentId.
- **Federation cleanliness**: `hubPosts.authorId` is nullable so that federated posts (where the author isn't local) can coexist with local posts without a synthetic user.
- **CommonPub extensions**: federated content carries `cpubType` + `cpubBlocks` so two CommonPub instances preserve full BlockTuple fidelity; Mastodon/Lemmy fall back to HTML + AP type.

## Foreign-key caveats

- **130 `.references()` FKs total: 107 `ON DELETE CASCADE`, 23 `ON DELETE SET NULL`, 0 RESTRICT** (every FK sets an explicit `onDelete`; the 4 self-ref FKs added in migration 0013 are SET NULL).
- CASCADE is used where the relationship is ownership (user → session, content → version, hub → post, etc.).
- SET NULL is used for **nullable cross-table references** so the child row survives when the referenced entity is deleted: `contentItems.categoryId`, `events.hubId`, `files.contentId`/`files.hubId`, `federatedContent.mirrorId` (added in migration 0002 — the old "no FK, app-enforced" note is obsolete), `federated*.remoteActorId`, `learningLessons.contentItemId`, `mirrorRequests.resultingMirrorId` (→ `instanceMirrors`, migration 0014), and "who-did-X" user refs (`updatedBy`/`grantedBy`/`revokedBy`/`reviewedById`/`actorId`/`publishedBy`).
- **Self-ref parent columns: 4 now have a real FK (ON DELETE SET NULL), as of migration 0013 (session 183)** — `hubs.parentHubId`, `comments.parentId`, `hubPostReplies.parentId`, `docsPages.parentId` `.references()` their own table with `onDelete: 'set null'` (deleting a parent promotes children to top-level, never cascades/orphans). Their schema comments previously claimed "constraint added via migration" but none existed; 0013 closed that gap. **`federatedHubPostReplies.parentId` still has NO DB FK** (federated-replies tree integrity stays app-managed).

## Schema deploy workflow (session 128+)

Schema changes go through committed migrations, not `drizzle-kit push`.
Workflow:

1. Edit `packages/schema/src/*.ts`.
2. `pnpm --filter=@commonpub/schema db:generate` (requires TTY) → creates `migrations/000N_*.sql` + snapshot.
3. **Commit** the `.ts` change, the `.sql` migration, and the updated `meta/_journal.json` + `meta/000N_snapshot.json` together.
4. Bump `@commonpub/schema` version; publish if downstream consumers (e.g. deveco) pin it.
5. Push to main. CI runs `scripts/db-migrate.mjs` which calls `drizzle-orm/node-postgres/migrator.migrate()` against the committed migrations. State is tracked in `drizzle.__drizzle_migrations`.

`drizzle-kit push` is **no longer used** in CI because it blocks on TTY prompts for populated-table constraint changes, varchar→enum conversions, and rename detection — when it throws, it silently drops ALL queued DDL. This caused the session-128 docs outage (two columns on `docs_pages` never got applied for weeks). See `docs/sessions/128-docs-and-learn-audit.md`.
