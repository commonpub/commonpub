# @commonpub/schema

> Drizzle ORM tables, PostgreSQL enums, and Zod validators for the entire CommonPub data model.

**npm**: `@commonpub/schema`
**Source**: `packages/schema/src/`
**Entry**: `packages/schema/src/index.ts` (re-exports all sub-modules)

---

## Overview

The schema package is the foundation of CommonPub — every other package and app depends on it. It defines:

- **41 database tables** across 13 sub-modules
- **24 PostgreSQL enums** for type-safe domain values
- **35+ Zod validators** for input validation at system boundaries

All tables use UUID primary keys, `timestamp with timezone` for dates, and Drizzle's query builder API.

---

## Source File Index

```
packages/schema/src/
├── index.ts          → Re-exports everything
├── enums.ts          → 24 pgEnum definitions
├── auth.ts           → users, sessions, accounts, organizations, members, federatedAccounts, oauthClients, verifications
├── content.ts        → contentItems, contentForks, tags, contentTags
├── social.ts         → likes, follows, comments, bookmarks, notifications, reports
├── community.ts      → communities, communityMembers, communityPosts, communityPostReplies, communityBans, communityInvites, communityShares
├── learning.ts       → learningPaths, learningModules, learningLessons, enrollments, lessonProgress, certificates
├── docs.ts           → docsSites, docsVersions, docsPages, docsNav
├── federation.ts     → remoteActors, activities, followRelationships, actorKeypairs
├── admin.ts          → instanceSettings, auditLogs
├── video.ts          → videos, videoCategories
├── contest.ts        → contests, contestEntries
├── files.ts          → files
└── validators.ts     → All Zod schemas
```

---

## Enums (24)

All enums are `pgEnum` from `drizzle-orm/pg-core`.

### Auth & Users

| Export | Enum Name | Values |
|--------|-----------|--------|
| `userRoleEnum` | `user_role` | `member`, `pro`, `verified`, `staff`, `admin` |
| `userStatusEnum` | `user_status` | `active`, `suspended`, `deleted` |
| `profileVisibilityEnum` | `profile_visibility` | `public`, `members`, `private` |

### Content

| Export | Enum Name | Values |
|--------|-----------|--------|
| `contentStatusEnum` | `content_status` | `draft`, `published`, `archived` |
| `contentTypeEnum` | `content_type` | `project`, `article`, `guide`, `blog`, `explainer` |
| `difficultyEnum` | `difficulty` | `beginner`, `intermediate`, `advanced` |
| `contentVisibilityEnum` | `content_visibility` | `public`, `members`, `private` |

### Social

| Export | Enum Name | Values |
|--------|-----------|--------|
| `likeTargetTypeEnum` | `like_target_type` | `project`, `article`, `blog`, `explainer`, `comment`, `post`, `guide` |
| `commentTargetTypeEnum` | `comment_target_type` | `project`, `article`, `blog`, `explainer`, `post`, `lesson` |
| `bookmarkTargetTypeEnum` | `bookmark_target_type` | `project`, `article`, `blog`, `explainer`, `learning_path` |
| `reportTargetTypeEnum` | `report_target_type` | `project`, `article`, `blog`, `post`, `comment`, `user`, `explainer` |
| `reportReasonEnum` | `report_reason` | `spam`, `harassment`, `inappropriate`, `copyright`, `other` |
| `reportStatusEnum` | `report_status` | `pending`, `reviewed`, `resolved`, `dismissed` |
| `notificationTypeEnum` | `notification_type` | `like`, `comment`, `follow`, `mention`, `contest`, `certificate`, `community`, `system` |

### Community

| Export | Enum Name | Values |
|--------|-----------|--------|
| `communityRoleEnum` | `community_role` | `owner`, `admin`, `moderator`, `member` |
| `communityJoinPolicyEnum` | `community_join_policy` | `open`, `approval`, `invite` |
| `postTypeEnum` | `post_type` | `text`, `link`, `share`, `poll` |

### Learning

| Export | Enum Name | Values |
|--------|-----------|--------|
| `lessonTypeEnum` | `lesson_type` | `article`, `video`, `quiz`, `project`, `explainer` |

### Contest

| Export | Enum Name | Values |
|--------|-----------|--------|
| `contestStatusEnum` | `contest_status` | `upcoming`, `active`, `judging`, `completed` |

### Video

| Export | Enum Name | Values |
|--------|-----------|--------|
| `videoPlatformEnum` | `video_platform` | `youtube`, `vimeo`, `other` |

### Files

| Export | Enum Name | Values |
|--------|-----------|--------|
| `filePurposeEnum` | `file_purpose` | `cover`, `content`, `avatar`, `banner`, `attachment` |

### Federation

| Export | Enum Name | Values |
|--------|-----------|--------|
| `activityDirectionEnum` | `activity_direction` | `inbound`, `outbound` |
| `activityStatusEnum` | `activity_status` | `pending`, `delivered`, `failed`, `processed` |
| `followRelationshipStatusEnum` | `follow_relationship_status` | `pending`, `accepted`, `rejected` |

### Tags

| Export | Enum Name | Values |
|--------|-----------|--------|
| `tagCategoryEnum` | `tag_category` | `platform`, `language`, `framework`, `topic`, `general` |

---

## Tables (41)

### Auth & User Management (8 tables)

#### `users`

Primary user table. Mapped to Better Auth's user model.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, DEFAULT random() |
| `email` | varchar(255) | NOT NULL, UNIQUE |
| `emailVerified` | boolean | DEFAULT false, NOT NULL |
| `username` | varchar(64) | NOT NULL, UNIQUE |
| `displayUsername` | varchar(64) | NULLABLE |
| `displayName` | varchar(128) | NULLABLE |
| `bio` | text | NULLABLE |
| `headline` | varchar(255) | NULLABLE |
| `location` | varchar(128) | NULLABLE |
| `website` | varchar(512) | NULLABLE |
| `avatarUrl` | text | NULLABLE |
| `bannerUrl` | text | NULLABLE |
| `socialLinks` | jsonb | NULLABLE — `{github?, twitter?, linkedin?, youtube?, instagram?, mastodon?, discord?}` |
| `role` | user_role | DEFAULT 'member', NOT NULL |
| `status` | user_status | DEFAULT 'active', NOT NULL |
| `profileVisibility` | profile_visibility | DEFAULT 'public', NOT NULL |
| `skills` | jsonb | NULLABLE — `string[]` |
| `theme` | varchar(64) | NULLABLE |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |
| `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

**Relations**: → many sessions, accounts, members, federatedAccounts

#### `sessions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, DEFAULT random() |
| `userId` | UUID | NOT NULL, FK → users.id CASCADE |
| `token` | varchar(512) | NOT NULL, UNIQUE |
| `expiresAt` | timestamp(tz) | NOT NULL |
| `ipAddress` | varchar(45) | NULLABLE |
| `userAgent` | text | NULLABLE |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `accounts`

OAuth provider accounts linked to users.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, DEFAULT random() |
| `userId` | UUID | NOT NULL, FK → users.id CASCADE |
| `providerId` | varchar(32) | NOT NULL |
| `accountId` | varchar(255) | NOT NULL |
| `accessToken` / `refreshToken` | text | NULLABLE |
| `password` | text | NULLABLE |
| `expiresAt` | timestamp(tz) | NULLABLE |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `organizations`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | varchar(128) | NOT NULL |
| `slug` | varchar(128) | NOT NULL, UNIQUE |
| `logoUrl` | text | NULLABLE |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `members`

Organization membership (Better Auth model).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `organizationId` | UUID | FK → organizations.id CASCADE |
| `userId` | UUID | FK → users.id CASCADE |
| `role` | varchar(32) | DEFAULT 'member', NOT NULL |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `federatedAccounts`

Links local users to remote AP actor identities (for SSO).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id CASCADE |
| `actorUri` | text | NOT NULL, UNIQUE |
| `instanceDomain` | varchar(255) | NOT NULL |
| `preferredUsername` | varchar(64) | NULLABLE |
| `displayName` | varchar(128) | NULLABLE |
| `avatarUrl` | text | NULLABLE |
| `lastSyncedAt` | timestamp(tz) | NULLABLE |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `oauthClients`

Registered OAuth2 clients (other CommonPub instances).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `clientId` | varchar(255) | NOT NULL, UNIQUE |
| `clientSecret` | varchar(512) | NOT NULL |
| `redirectUris` | jsonb | NOT NULL — `string[]` |
| `instanceDomain` | varchar(255) | NOT NULL |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `verifications`

Email verification tokens, magic links, etc.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `identifier` | varchar(255) | NOT NULL |
| `value` | text | NOT NULL |
| `expiresAt` | timestamp(tz) | NOT NULL |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

### Content Management (4 tables)

#### `contentItems`

Unified content table. All content types (project, article, guide, blog, explainer) share this table with a `type` enum discriminator.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `authorId` | UUID | FK → users.id CASCADE |
| `type` | content_type | NOT NULL |
| `title` | varchar(255) | NOT NULL |
| `slug` | varchar(255) | NOT NULL, UNIQUE |
| `subtitle` | varchar(255) | NULLABLE |
| `description` | text | NULLABLE |
| `content` | jsonb | NULLABLE — BlockTuple[] |
| `coverImageUrl` | text | NULLABLE |
| `category` | varchar(64) | NULLABLE |
| `difficulty` | difficulty | NULLABLE |
| `buildTime` | varchar(64) | NULLABLE |
| `estimatedCost` | varchar(64) | NULLABLE |
| `status` | content_status | DEFAULT 'draft', NOT NULL |
| `visibility` | content_visibility | DEFAULT 'public', NOT NULL |
| `isFeatured` | boolean | DEFAULT false, NOT NULL |
| `seoDescription` | varchar(320) | NULLABLE |
| `previewToken` | varchar(64) | NULLABLE |
| `parts` | jsonb | NULLABLE |
| `sections` | jsonb | NULLABLE — explainer sections |
| `viewCount` | integer | DEFAULT 0, NOT NULL |
| `likeCount` | integer | DEFAULT 0, NOT NULL |
| `commentCount` | integer | DEFAULT 0, NOT NULL |
| `forkCount` | integer | DEFAULT 0, NOT NULL |
| `publishedAt` | timestamp(tz) | NULLABLE |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `contentForks`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `sourceId` | UUID | FK → contentItems.id CASCADE |
| `forkId` | UUID | FK → contentItems.id CASCADE |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `tags`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | varchar(64) | NOT NULL, UNIQUE |
| `slug` | varchar(64) | NOT NULL, UNIQUE |
| `category` | varchar(32) | NULLABLE |
| `usageCount` | integer | DEFAULT 0, NOT NULL |

#### `contentTags`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `contentId` | UUID | FK → contentItems.id CASCADE |
| `tagId` | UUID | FK → tags.id CASCADE |

### Social (6 tables)

#### `likes`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id CASCADE |
| `targetType` | like_target_type | NOT NULL |
| `targetId` | UUID | NOT NULL |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

**Unique constraint**: `(userId, targetType, targetId)`

#### `follows`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `followerId` | UUID | FK → users.id CASCADE |
| `followingId` | UUID | FK → users.id CASCADE |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

**Unique constraint**: `(followerId, followingId)`

#### `comments`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `authorId` | UUID | FK → users.id CASCADE |
| `targetType` | comment_target_type | NOT NULL |
| `targetId` | UUID | NOT NULL |
| `parentId` | UUID | NULLABLE (self-referencing for threads) |
| `content` | text | NOT NULL |
| `likeCount` | integer | DEFAULT 0, NOT NULL |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `bookmarks`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id CASCADE |
| `targetType` | bookmark_target_type | NOT NULL |
| `targetId` | UUID | NOT NULL |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

**Unique constraint**: `(userId, targetType, targetId)`

#### `notifications`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id CASCADE |
| `type` | notification_type | NOT NULL |
| `title` | varchar(255) | NOT NULL |
| `message` | text | NOT NULL |
| `link` | varchar(512) | NULLABLE |
| `actorId` | UUID | NULLABLE, FK → users.id SET NULL |
| `read` | boolean | DEFAULT false, NOT NULL |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `reports`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `reporterId` | UUID | FK → users.id CASCADE |
| `targetType` | report_target_type | NOT NULL |
| `targetId` | UUID | NOT NULL |
| `reason` | report_reason | NOT NULL |
| `description` | text | NULLABLE |
| `status` | report_status | DEFAULT 'pending', NOT NULL |
| `reviewedById` | UUID | NULLABLE, FK → users.id SET NULL |
| `reviewedAt` | timestamp(tz) | NULLABLE |
| `resolution` | text | NULLABLE |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

### Communities (7 tables)

#### `communities`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | varchar(128) | NOT NULL |
| `slug` | varchar(128) | NOT NULL, UNIQUE |
| `description` | text | NULLABLE |
| `rules` | text | NULLABLE |
| `iconUrl` / `bannerUrl` | text | NULLABLE |
| `joinPolicy` | community_join_policy | DEFAULT 'open', NOT NULL |
| `createdById` | UUID | FK → users.id CASCADE |
| `isOfficial` | boolean | DEFAULT false, NOT NULL |
| `memberCount` / `postCount` | integer | DEFAULT 0, NOT NULL |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityMembers`

**Primary key**: `(communityId, userId)` composite

| Column | Type | Constraints |
|--------|------|-------------|
| `communityId` | UUID | FK → communities.id CASCADE |
| `userId` | UUID | FK → users.id CASCADE |
| `role` | community_role | DEFAULT 'member', NOT NULL |
| `joinedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityPosts`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `communityId` | UUID | FK → communities.id CASCADE |
| `authorId` | UUID | FK → users.id CASCADE |
| `type` | post_type | DEFAULT 'text', NOT NULL |
| `content` | text | NOT NULL |
| `isPinned` / `isLocked` | boolean | DEFAULT false, NOT NULL |
| `likeCount` / `replyCount` | integer | DEFAULT 0, NOT NULL |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityPostReplies`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `postId` | UUID | FK → communityPosts.id CASCADE |
| `authorId` | UUID | FK → users.id CASCADE |
| `parentId` | UUID | NULLABLE (self-ref for threads) |
| `content` | text | NOT NULL |
| `likeCount` | integer | DEFAULT 0, NOT NULL |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityBans`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `communityId` | UUID | FK → communities.id CASCADE |
| `userId` | UUID | FK → users.id CASCADE |
| `bannedById` | UUID | FK → users.id CASCADE |
| `reason` | text | NULLABLE |
| `expiresAt` | timestamp(tz) | NULLABLE |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityInvites`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `communityId` | UUID | FK → communities.id CASCADE |
| `createdById` | UUID | FK → users.id CASCADE |
| `token` | varchar(64) | NOT NULL, UNIQUE |
| `maxUses` | integer | NULLABLE |
| `useCount` | integer | DEFAULT 0, NOT NULL |
| `expiresAt` | timestamp(tz) | NULLABLE |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityShares`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `communityId` | UUID | FK → communities.id CASCADE |
| `contentId` | UUID | FK → contentItems.id CASCADE |
| `sharedById` | UUID | FK → users.id CASCADE |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

### Documentation (4 tables)

#### `docsSites`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | varchar(128) | NOT NULL |
| `slug` | varchar(128) | NOT NULL, UNIQUE |
| `description` | text | NULLABLE |
| `ownerId` | UUID | FK → users.id CASCADE |
| `themeTokens` | jsonb | NULLABLE |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `docsVersions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `siteId` | UUID | FK → docsSites.id CASCADE |
| `version` | varchar(32) | NOT NULL |
| `isDefault` | integer | DEFAULT 0, NOT NULL |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `docsPages`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `versionId` | UUID | FK → docsVersions.id CASCADE |
| `title` | varchar(255) | NOT NULL |
| `slug` | varchar(255) | NOT NULL |
| `content` | text | NOT NULL — raw markdown (standing rule #4) |
| `sortOrder` | integer | DEFAULT 0, NOT NULL |
| `parentId` | UUID | NULLABLE (self-ref for page hierarchy) |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `docsNav`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `versionId` | UUID | FK → docsVersions.id CASCADE |
| `structure` | jsonb | NULLABLE — hierarchical nav tree |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

### Learning (6 tables)

#### `learningPaths`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `title` | varchar(255) | NOT NULL |
| `slug` | varchar(255) | NOT NULL, UNIQUE |
| `description` | text | NULLABLE |
| `coverImageUrl` | text | NULLABLE |
| `difficulty` | difficulty | NULLABLE |
| `estimatedHours` | numeric(5,1) | NULLABLE |
| `authorId` | UUID | FK → users.id CASCADE |
| `status` | content_status | DEFAULT 'draft', NOT NULL |
| `enrollmentCount` / `completionCount` | integer | DEFAULT 0, NOT NULL |
| `averageRating` | numeric(3,2) | NULLABLE |
| `reviewCount` | integer | DEFAULT 0, NOT NULL |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `learningModules`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `pathId` | UUID | FK → learningPaths.id CASCADE |
| `title` | varchar(255) | NOT NULL |
| `description` | text | NULLABLE |
| `sortOrder` | integer | DEFAULT 0, NOT NULL |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `learningLessons`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `moduleId` | UUID | FK → learningModules.id CASCADE |
| `title` | varchar(255) | NOT NULL |
| `slug` | varchar(255) | NOT NULL |
| `type` | lesson_type | NOT NULL |
| `content` | jsonb | NULLABLE |
| `duration` | integer | NULLABLE (minutes) |
| `sortOrder` | integer | DEFAULT 0, NOT NULL |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `enrollments`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id CASCADE |
| `pathId` | UUID | FK → learningPaths.id CASCADE |
| `progress` | numeric(5,2) | DEFAULT 0, NOT NULL |
| `startedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |
| `completedAt` | timestamp(tz) | NULLABLE |

#### `lessonProgress`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id CASCADE |
| `lessonId` | UUID | FK → learningLessons.id CASCADE |
| `completed` | boolean | DEFAULT false, NOT NULL |
| `completedAt` | timestamp(tz) | NULLABLE |
| `quizScore` | numeric(5,2) | NULLABLE |
| `quizPassed` | boolean | NULLABLE |

#### `certificates`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id CASCADE |
| `pathId` | UUID | FK → learningPaths.id CASCADE |
| `verificationCode` | varchar(64) | NOT NULL, UNIQUE |
| `certificateUrl` | text | NULLABLE |
| `issuedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

### Federation (4 tables)

#### `remoteActors`

Cached representations of remote ActivityPub actors.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `actorUri` | text | NOT NULL, UNIQUE |
| `inbox` | text | NOT NULL |
| `outbox` | text | NULLABLE |
| `publicKeyPem` | text | NULLABLE |
| `preferredUsername` | varchar(64) | NULLABLE |
| `displayName` | varchar(128) | NULLABLE |
| `avatarUrl` | text | NULLABLE |
| `instanceDomain` | varchar(255) | NOT NULL |
| `lastFetchedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `activities`

Log of all inbound and outbound AP activities.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `type` | varchar(64) | NOT NULL |
| `actorUri` | text | NOT NULL |
| `objectUri` | text | NULLABLE |
| `payload` | jsonb | NOT NULL |
| `direction` | activity_direction | NOT NULL |
| `status` | activity_status | DEFAULT 'pending', NOT NULL |
| `attempts` | integer | DEFAULT 0, NOT NULL |
| `error` | text | NULLABLE |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `followRelationships`

Federation-level follow state between actors.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `followerActorUri` | text | NOT NULL |
| `followingActorUri` | text | NOT NULL |
| `status` | follow_relationship_status | DEFAULT 'pending', NOT NULL |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `actorKeypairs`

RSA keypairs for HTTP Signature signing.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | NOT NULL, FK → users.id CASCADE, UNIQUE |
| `publicKeyPem` | text | NOT NULL |
| `privateKeyPem` | text | NOT NULL |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

### Other Tables (6)

#### `files`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `uploaderId` | UUID | FK → users.id CASCADE |
| `filename` | varchar(255) | NOT NULL |
| `mimeType` | varchar(128) | NOT NULL |
| `sizeBytes` | integer | NOT NULL |
| `storageKey` | text | NOT NULL |
| `publicUrl` | text | NULLABLE |
| `purpose` | file_purpose | DEFAULT 'attachment', NOT NULL |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `videos`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `authorId` | UUID | FK → users.id CASCADE |
| `title` | varchar(255) | NOT NULL |
| `description` | text | NULLABLE |
| `url` | text | NOT NULL |
| `embedUrl` | text | NULLABLE |
| `platform` | video_platform | NOT NULL |
| `thumbnailUrl` | text | NULLABLE |
| `duration` | varchar(16) | NULLABLE |
| `viewCount` / `likeCount` / `commentCount` | integer | DEFAULT 0, NOT NULL |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `videoCategories`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | varchar(64) | NOT NULL, UNIQUE |
| `slug` | varchar(64) | NOT NULL, UNIQUE |
| `description` | text | NULLABLE |
| `sortOrder` | integer | DEFAULT 0, NOT NULL |

#### `contests`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `title` | varchar(255) | NOT NULL |
| `slug` | varchar(255) | NOT NULL, UNIQUE |
| `description` / `rules` | text | NULLABLE |
| `bannerUrl` | text | NULLABLE |
| `status` | contest_status | DEFAULT 'upcoming', NOT NULL |
| `startDate` / `endDate` | timestamp(tz) | NOT NULL |
| `judgingEndDate` | timestamp(tz) | NULLABLE |
| `prizes` / `judges` | jsonb | NULLABLE |
| `createdById` | UUID | FK → users.id CASCADE |
| `entryCount` | integer | DEFAULT 0, NOT NULL |
| `createdAt` / `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `contestEntries`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `contestId` | UUID | FK → contests.id CASCADE |
| `contentId` | UUID | FK → contentItems.id CASCADE |
| `userId` | UUID | FK → users.id CASCADE |
| `score` / `rank` | integer | NULLABLE |
| `judgeScores` | jsonb | NULLABLE |
| `submittedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `instanceSettings`

Key-value store for admin-configurable instance settings.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `key` | varchar(128) | NOT NULL, UNIQUE |
| `value` | jsonb | NOT NULL |
| `updatedBy` | UUID | NULLABLE, FK → users.id SET NULL |
| `updatedAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `auditLogs`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id |
| `action` | varchar(64) | NOT NULL |
| `targetType` | varchar(64) | NOT NULL |
| `targetId` | varchar(255) | NULLABLE |
| `metadata` | jsonb | NULLABLE |
| `ipAddress` | varchar(45) | NULLABLE |
| `createdAt` | timestamp(tz) | DEFAULT now(), NOT NULL |

---

## Validators (35+)

All validators are Zod schemas exported from `packages/schema/src/validators.ts`.

### Auth Validators

| Export | Shape |
|--------|-------|
| `usernameSchema` | `z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/)` |
| `emailSchema` | `z.string().email().max(255)` |
| `displayNameSchema` | `z.string().min(1).max(128)` |
| `bioSchema` | `z.string().max(2000).optional()` |
| `socialLinksSchema` | `z.object({github?, twitter?, linkedin?, youtube?, instagram?, mastodon?, discord?}).optional()` |
| `createUserSchema` | `{email, username, displayName?}` |
| `updateProfileSchema` | `{displayName?, bio?, headline?, location?, website?, socialLinks?, skills?}` |

### Content Validators

| Export | Shape |
|--------|-------|
| `slugSchema` | `z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)` |
| `contentTypeSchema` | `z.enum(['project','article','guide','blog','explainer'])` |
| `contentStatusSchema` | `z.enum(['draft','published','archived'])` |
| `difficultySchema` | `z.enum(['beginner','intermediate','advanced'])` |
| `createContentSchema` | `{type, title, slug, subtitle?, description?, content?, coverImageUrl?, category?, difficulty?, tags?}` |
| `updateContentSchema` | `createContentSchema.partial().omit({type: true})` |

### Social Validators

| Export | Shape |
|--------|-------|
| `likeTargetTypeSchema` | `z.enum(['project','article','blog','comment','post','explainer','guide'])` |
| `commentTargetTypeSchema` | `z.enum(['project','article','blog','explainer','post','lesson'])` |
| `createCommentSchema` | `{targetType, targetId: uuid, parentId?: uuid, content: string(1..10000)}` |

### Community Validators

| Export | Shape |
|--------|-------|
| `createCommunitySchema` | `{name, slug, description?, rules?, joinPolicy?}` |
| `createPostSchema` | `{communityId: uuid, type?, content}` |

### Learning Validators

| Export | Shape |
|--------|-------|
| `createLearningPathSchema` | `{title, slug, description?, difficulty?, estimatedHours?}` |
| `lessonTypeSchema` | `z.enum(['article','video','quiz','project','explainer'])` |
| `createLessonSchema` | `{moduleId: uuid, title, slug, type, content?, durationMinutes?}` |

### Federation Validators

| Export | Shape |
|--------|-------|
| `actorUriSchema` | `z.string().url().max(2048)` |
| `activityDirectionSchema` | `z.enum(['inbound','outbound'])` |
| `activityStatusSchema` | `z.enum(['pending','delivered','failed','processed'])` |
| `followRelationshipStatusSchema` | `z.enum(['pending','accepted','rejected'])` |
| `createRemoteActorSchema` | `{actorUri, inbox, outbox?, publicKeyPem?, preferredUsername?, displayName?, avatarUrl?, instanceDomain}` |
| `createActivitySchema` | `{type, actorUri, objectUri?, payload: Record, direction}` |
| `createFollowRelationshipSchema` | `{followerActorUri, followingActorUri}` |

### Docs Validators

| Export | Shape |
|--------|-------|
| `createDocsSiteSchema` | `{name, slug, description?}` |
| `createDocsPageSchema` | `{versionId: uuid, title, slug, content: string, sortOrder?, parentId?}` |

### Report Validators

| Export | Shape |
|--------|-------|
| `createReportSchema` | `{targetType, targetId: uuid, reason, description?}` |

### Admin Validators

| Export | Shape |
|--------|-------|
| `updateInstanceSettingSchema` | `{key, value: unknown}` |
| `updateUserRoleSchema` | `{userId: uuid, role}` |
| `updateUserStatusSchema` | `{userId: uuid, status}` |
| `resolveReportSchema` | `{reportId: uuid, status: 'resolved'|'dismissed', resolution: string}` |
