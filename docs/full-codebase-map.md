# CommonPub Full Codebase Map

Generated: 2026-03-10

---

## Table of Contents

1. [Database Schema (41 tables, 24 enums)](#1-database-schema)
2. [API Endpoints (68 routes)](#2-api-endpoints)
3. [ActivityPub & Federation](#3-activitypub--federation)
4. [Types, Validators & Data Flow](#4-types-validators--data-flow)

---

## 1. Database Schema

### Enums (24)

| Enum Name | Values |
|-----------|--------|
| `user_role` | member, pro, verified, staff, admin |
| `user_status` | active, suspended, deleted |
| `profile_visibility` | public, members, private |
| `content_status` | draft, published, archived |
| `content_type` | project, article, guide, blog, explainer |
| `difficulty` | beginner, intermediate, advanced |
| `content_visibility` | public, members, private |
| `like_target_type` | project, article, blog, explainer, comment, post |
| `comment_target_type` | project, article, blog, explainer, post, lesson |
| `bookmark_target_type` | project, article, blog, explainer, learning_path |
| `report_target_type` | project, article, blog, post, comment, user |
| `report_reason` | spam, harassment, inappropriate, copyright, other |
| `report_status` | pending, reviewed, resolved, dismissed |
| `notification_type` | like, comment, follow, mention, contest, certificate, community, system |
| `community_role` | owner, admin, moderator, member |
| `community_join_policy` | open, approval, invite |
| `post_type` | text, link, share, poll |
| `lesson_type` | article, video, quiz, project, explainer |
| `contest_status` | upcoming, active, judging, completed |
| `video_platform` | youtube, vimeo, other |
| `file_purpose` | cover, content, avatar, banner, attachment |
| `activity_direction` | inbound, outbound |
| `activity_status` | pending, delivered, failed, processed |
| `follow_relationship_status` | pending, accepted, rejected |
| `tag_category` | platform, language, framework, topic, general |

### Auth & User Management (8 tables)

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT random() |
| email | varchar(255) | NOT NULL, UNIQUE |
| emailVerified | boolean | DEFAULT false, NOT NULL |
| username | varchar(64) | NOT NULL, UNIQUE |
| displayUsername | varchar(64) | NULLABLE |
| displayName | varchar(128) | NULLABLE |
| bio | text | NULLABLE |
| headline | varchar(255) | NULLABLE |
| location | varchar(128) | NULLABLE |
| website | varchar(512) | NULLABLE |
| avatarUrl | text | NULLABLE |
| bannerUrl | text | NULLABLE |
| socialLinks | jsonb | NULLABLE `{github?, twitter?, linkedin?, youtube?, instagram?, mastodon?, discord?}` |
| role | user_role | DEFAULT 'member', NOT NULL |
| status | user_status | DEFAULT 'active', NOT NULL |
| profileVisibility | profile_visibility | DEFAULT 'public', NOT NULL |
| skills | jsonb | NULLABLE (string[]) |
| theme | varchar(64) | NULLABLE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |
| updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

**Relations**: → many sessions, accounts, members, federatedAccounts

#### `sessions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT random() |
| userId | UUID | NOT NULL, FK → users.id CASCADE |
| token | varchar(512) | NOT NULL, UNIQUE |
| expiresAt | timestamp(tz) | NOT NULL |
| ipAddress | varchar(45) | NULLABLE |
| userAgent | text | NULLABLE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |
| updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `accounts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT random() |
| userId | UUID | NOT NULL, FK → users.id CASCADE |
| providerId | varchar(32) | NOT NULL |
| accountId | varchar(255) | NOT NULL |
| accessToken | text | NULLABLE |
| refreshToken | text | NULLABLE |
| password | text | NULLABLE |
| expiresAt | timestamp(tz) | NULLABLE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |
| updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `organizations`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT random() |
| name | varchar(128) | NOT NULL |
| slug | varchar(128) | NOT NULL, UNIQUE |
| logoUrl | text | NULLABLE |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `members`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| organizationId | UUID | FK → organizations.id CASCADE |
| userId | UUID | FK → users.id CASCADE |
| role | varchar(32) | DEFAULT 'member', NOT NULL |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `federatedAccounts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → users.id CASCADE |
| actorUri | text | NOT NULL, UNIQUE |
| instanceDomain | varchar(255) | NOT NULL |
| preferredUsername | varchar(64) | NULLABLE |
| displayName | varchar(128) | NULLABLE |
| avatarUrl | text | NULLABLE |
| lastSyncedAt | timestamp(tz) | NULLABLE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `oauthClients`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| clientId | varchar(255) | NOT NULL, UNIQUE |
| clientSecret | varchar(512) | NOT NULL |
| redirectUris | jsonb | NOT NULL (string[]) |
| instanceDomain | varchar(255) | NOT NULL |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `verifications`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| identifier | varchar(255) | NOT NULL |
| value | text | NOT NULL |
| expiresAt | timestamp(tz) | NOT NULL |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

### Content Management (4 tables)

#### `contentItems`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| authorId | UUID | FK → users.id CASCADE |
| type | content_type | NOT NULL |
| title | varchar(255) | NOT NULL |
| slug | varchar(255) | NOT NULL, UNIQUE |
| subtitle | varchar(255) | NULLABLE |
| description | text | NULLABLE |
| content | jsonb | NULLABLE |
| coverImageUrl | text | NULLABLE |
| category | varchar(64) | NULLABLE |
| difficulty | difficulty | NULLABLE |
| buildTime | varchar(64) | NULLABLE |
| estimatedCost | varchar(64) | NULLABLE |
| status | content_status | DEFAULT 'draft', NOT NULL |
| visibility | content_visibility | DEFAULT 'public', NOT NULL |
| isFeatured | boolean | DEFAULT false, NOT NULL |
| seoDescription | varchar(320) | NULLABLE |
| previewToken | varchar(64) | NULLABLE |
| parts | jsonb | NULLABLE |
| sections | jsonb | NULLABLE (explainer sections) |
| viewCount | integer | DEFAULT 0, NOT NULL |
| likeCount | integer | DEFAULT 0, NOT NULL |
| commentCount | integer | DEFAULT 0, NOT NULL |
| forkCount | integer | DEFAULT 0, NOT NULL |
| publishedAt | timestamp(tz) | NULLABLE |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

**Relations**: → author (users), → many contentTags, contentForks

#### `contentForks`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| sourceId | UUID | FK → contentItems.id CASCADE |
| forkId | UUID | FK → contentItems.id CASCADE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `tags`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | varchar(64) | NOT NULL, UNIQUE |
| slug | varchar(64) | NOT NULL, UNIQUE |
| category | varchar(32) | NULLABLE |
| usageCount | integer | DEFAULT 0, NOT NULL |

#### `contentTags`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| contentId | UUID | FK → contentItems.id CASCADE |
| tagId | UUID | FK → tags.id CASCADE |

### Social (6 tables)

#### `likes`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → users.id CASCADE |
| targetType | like_target_type | NOT NULL |
| targetId | UUID | NOT NULL |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

**Unique**: (userId, targetType, targetId)

#### `follows`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| followerId | UUID | FK → users.id CASCADE |
| followingId | UUID | FK → users.id CASCADE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

**Unique**: (followerId, followingId)

#### `comments`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| authorId | UUID | FK → users.id CASCADE |
| targetType | comment_target_type | NOT NULL |
| targetId | UUID | NOT NULL |
| parentId | UUID | NULLABLE (self-ref) |
| content | text | NOT NULL |
| likeCount | integer | DEFAULT 0, NOT NULL |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `bookmarks`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → users.id CASCADE |
| targetType | bookmark_target_type | NOT NULL |
| targetId | UUID | NOT NULL |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

**Unique**: (userId, targetType, targetId)

#### `notifications`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → users.id CASCADE |
| type | notification_type | NOT NULL |
| title | varchar(255) | NOT NULL |
| message | text | NOT NULL |
| link | varchar(512) | NULLABLE |
| actorId | UUID | NULLABLE, FK → users.id SET NULL |
| read | boolean | DEFAULT false, NOT NULL |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `reports`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| reporterId | UUID | FK → users.id CASCADE |
| targetType | report_target_type | NOT NULL |
| targetId | UUID | NOT NULL |
| reason | report_reason | NOT NULL |
| description | text | NULLABLE |
| status | report_status | DEFAULT 'pending', NOT NULL |
| reviewedById | UUID | NULLABLE, FK → users.id SET NULL |
| reviewedAt | timestamp(tz) | NULLABLE |
| resolution | text | NULLABLE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

### Communities (7 tables)

#### `communities`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | varchar(128) | NOT NULL |
| slug | varchar(128) | NOT NULL, UNIQUE |
| description | text | NULLABLE |
| rules | text | NULLABLE |
| iconUrl / bannerUrl | text | NULLABLE |
| joinPolicy | community_join_policy | DEFAULT 'open', NOT NULL |
| createdById | UUID | FK → users.id CASCADE |
| isOfficial | boolean | DEFAULT false, NOT NULL |
| memberCount / postCount | integer | DEFAULT 0, NOT NULL |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityMembers` — PK: (communityId, userId)
| Column | Type | Constraints |
|--------|------|-------------|
| communityId | UUID | FK → communities.id CASCADE |
| userId | UUID | FK → users.id CASCADE |
| role | community_role | DEFAULT 'member', NOT NULL |
| joinedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityPosts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| communityId | UUID | FK → communities.id CASCADE |
| authorId | UUID | FK → users.id CASCADE |
| type | post_type | DEFAULT 'text', NOT NULL |
| content | text | NOT NULL |
| isPinned / isLocked | boolean | DEFAULT false, NOT NULL |
| likeCount / replyCount | integer | DEFAULT 0, NOT NULL |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityPostReplies`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| postId | UUID | FK → communityPosts.id CASCADE |
| authorId | UUID | FK → users.id CASCADE |
| parentId | UUID | NULLABLE (self-ref) |
| content | text | NOT NULL |
| likeCount | integer | DEFAULT 0, NOT NULL |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityBans`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| communityId | UUID | FK → communities.id CASCADE |
| userId | UUID | FK → users.id CASCADE |
| bannedById | UUID | FK → users.id CASCADE |
| reason | text | NULLABLE |
| expiresAt | timestamp(tz) | NULLABLE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityInvites`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| communityId | UUID | FK → communities.id CASCADE |
| createdById | UUID | FK → users.id CASCADE |
| token | varchar(64) | NOT NULL, UNIQUE |
| maxUses | integer | NULLABLE |
| useCount | integer | DEFAULT 0, NOT NULL |
| expiresAt | timestamp(tz) | NULLABLE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `communityShares`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| communityId | UUID | FK → communities.id CASCADE |
| contentId | UUID | FK → contentItems.id CASCADE |
| sharedById | UUID | FK → users.id CASCADE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

### Documentation (4 tables)

#### `docsSites`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | varchar(128) | NOT NULL |
| slug | varchar(128) | NOT NULL, UNIQUE |
| description | text | NULLABLE |
| ownerId | UUID | FK → users.id CASCADE |
| themeTokens | jsonb | NULLABLE |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `docsVersions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| siteId | UUID | FK → docsSites.id CASCADE |
| version | varchar(32) | NOT NULL |
| isDefault | integer | DEFAULT 0, NOT NULL |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `docsPages`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| versionId | UUID | FK → docsVersions.id CASCADE |
| title | varchar(255) | NOT NULL |
| slug | varchar(255) | NOT NULL |
| content | text | NOT NULL (raw markdown) |
| sortOrder | integer | DEFAULT 0, NOT NULL |
| parentId | UUID | NULLABLE (self-ref) |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `docsNav`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| versionId | UUID | FK → docsVersions.id CASCADE |
| structure | jsonb | NULLABLE (hierarchical nav) |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

### Learning (6 tables)

#### `learningPaths`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| title | varchar(255) | NOT NULL |
| slug | varchar(255) | NOT NULL, UNIQUE |
| description | text | NULLABLE |
| coverImageUrl | text | NULLABLE |
| difficulty | difficulty | NULLABLE |
| estimatedHours | numeric(5,1) | NULLABLE |
| authorId | UUID | FK → users.id CASCADE |
| status | content_status | DEFAULT 'draft', NOT NULL |
| enrollmentCount / completionCount | integer | DEFAULT 0, NOT NULL |
| averageRating | numeric(3,2) | NULLABLE |
| reviewCount | integer | DEFAULT 0, NOT NULL |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `learningModules`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| pathId | UUID | FK → learningPaths.id CASCADE |
| title | varchar(255) | NOT NULL |
| description | text | NULLABLE |
| sortOrder | integer | DEFAULT 0, NOT NULL |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `learningLessons`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| moduleId | UUID | FK → learningModules.id CASCADE |
| title | varchar(255) | NOT NULL |
| slug | varchar(255) | NOT NULL |
| type | lesson_type | NOT NULL |
| content | jsonb | NULLABLE |
| duration | integer | NULLABLE (minutes) |
| sortOrder | integer | DEFAULT 0, NOT NULL |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `enrollments`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → users.id CASCADE |
| pathId | UUID | FK → learningPaths.id CASCADE |
| progress | numeric(5,2) | DEFAULT 0, NOT NULL |
| startedAt | timestamp(tz) | DEFAULT now(), NOT NULL |
| completedAt | timestamp(tz) | NULLABLE |

#### `lessonProgress`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → users.id CASCADE |
| lessonId | UUID | FK → learningLessons.id CASCADE |
| completed | boolean | DEFAULT false, NOT NULL |
| completedAt | timestamp(tz) | NULLABLE |
| quizScore | numeric(5,2) | NULLABLE |
| quizPassed | boolean | NULLABLE |

#### `certificates`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → users.id CASCADE |
| pathId | UUID | FK → learningPaths.id CASCADE |
| verificationCode | varchar(64) | NOT NULL, UNIQUE |
| certificateUrl | text | NULLABLE |
| issuedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

### Federation (4 tables)

#### `remoteActors`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| actorUri | text | NOT NULL, UNIQUE |
| inbox | text | NOT NULL |
| outbox | text | NULLABLE |
| publicKeyPem | text | NULLABLE |
| preferredUsername | varchar(64) | NULLABLE |
| displayName | varchar(128) | NULLABLE |
| avatarUrl | text | NULLABLE |
| instanceDomain | varchar(255) | NOT NULL |
| lastFetchedAt | timestamp(tz) | DEFAULT now(), NOT NULL |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `activities`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| type | varchar(64) | NOT NULL |
| actorUri | text | NOT NULL |
| objectUri | text | NULLABLE |
| payload | jsonb | NOT NULL |
| direction | activity_direction | NOT NULL |
| status | activity_status | DEFAULT 'pending', NOT NULL |
| attempts | integer | DEFAULT 0, NOT NULL |
| error | text | NULLABLE |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `followRelationships`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| followerActorUri | text | NOT NULL |
| followingActorUri | text | NOT NULL |
| status | follow_relationship_status | DEFAULT 'pending', NOT NULL |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `actorKeypairs`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | NOT NULL, FK → users.id CASCADE, UNIQUE |
| publicKeyPem | text | NOT NULL |
| privateKeyPem | text | NOT NULL |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

### Other Tables (6)

#### `files`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| uploaderId | UUID | FK → users.id CASCADE |
| filename | varchar(255) | NOT NULL |
| mimeType | varchar(128) | NOT NULL |
| sizeBytes | integer | NOT NULL |
| storageKey | text | NOT NULL |
| publicUrl | text | NULLABLE |
| purpose | file_purpose | DEFAULT 'attachment', NOT NULL |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `videos`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| authorId | UUID | FK → users.id CASCADE |
| title | varchar(255) | NOT NULL |
| description | text | NULLABLE |
| url | text | NOT NULL |
| embedUrl | text | NULLABLE |
| platform | video_platform | NOT NULL |
| thumbnailUrl | text | NULLABLE |
| duration | varchar(16) | NULLABLE |
| viewCount / likeCount / commentCount | integer | DEFAULT 0, NOT NULL |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `videoCategories`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | varchar(64) | NOT NULL, UNIQUE |
| slug | varchar(64) | NOT NULL, UNIQUE |
| description | text | NULLABLE |
| sortOrder | integer | DEFAULT 0, NOT NULL |

#### `contests`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| title | varchar(255) | NOT NULL |
| slug | varchar(255) | NOT NULL, UNIQUE |
| description / rules | text | NULLABLE |
| bannerUrl | text | NULLABLE |
| status | contest_status | DEFAULT 'upcoming', NOT NULL |
| startDate / endDate | timestamp(tz) | NOT NULL |
| judgingEndDate | timestamp(tz) | NULLABLE |
| prizes | jsonb | NULLABLE |
| judges | jsonb | NULLABLE |
| createdById | UUID | FK → users.id CASCADE |
| entryCount | integer | DEFAULT 0, NOT NULL |
| createdAt / updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `contestEntries`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| contestId | UUID | FK → contests.id CASCADE |
| contentId | UUID | FK → contentItems.id CASCADE |
| userId | UUID | FK → users.id CASCADE |
| score / rank | integer | NULLABLE |
| judgeScores | jsonb | NULLABLE |
| submittedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `instanceSettings`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| key | varchar(128) | NOT NULL, UNIQUE |
| value | jsonb | NOT NULL |
| updatedBy | UUID | NULLABLE, FK → users.id SET NULL |
| updatedAt | timestamp(tz) | DEFAULT now(), NOT NULL |

#### `auditLogs`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → users.id |
| action | varchar(64) | NOT NULL |
| targetType | varchar(64) | NOT NULL |
| targetId | varchar(255) | NULLABLE |
| metadata | jsonb | NULLABLE |
| ipAddress | varchar(45) | NULLABLE |
| createdAt | timestamp(tz) | DEFAULT now(), NOT NULL |

---

## 2. API Endpoints

### Auth & OAuth2

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/auth/oauth2/authorize` | GET | OAuth2 authorization (provider-side) | Yes |
| `/api/auth/oauth2/token` | POST | OAuth2 token exchange | No |
| `/api/auth/oauth2/callback` | GET | OAuth2 callback handler (consumer-side) | No |
| `/auth/sign-up` | page | Sign up form → POST `/api/auth/sign-up/email` | No |
| `/auth/sign-in` | page | Sign in form | No |
| `/auth/federated` | action | Initiate federated OAuth login | No |

### Social API

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/social/like` | POST | Toggle like `{targetType, targetId}` → `{liked, likeCount}` | Yes |
| `/api/social/bookmark` | POST | Toggle bookmark `{targetType, targetId}` → `{bookmarked}` | Yes |
| `/api/social/comments` | GET | List comments `?targetType&targetId` → `{comments[]}` | No |
| `/api/social/comments` | POST | Create comment `{targetType, targetId, content, parentId?}` | Yes |
| `/api/social/comments` | DELETE | Delete comment `?id` | Yes |

### Communities API

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/communities/[slug]/posts/[postId]/replies` | GET | List post replies | No |
| `/api/communities/[slug]/posts/[postId]/replies` | POST | Create reply `{content, parentId?}` | Yes |

### Federation API

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/federation/follow` | POST | Send follow `{remoteActorUri}` | Yes |
| `/api/federation/follow/[id]` | DELETE | Unfollow remote actor | Yes |
| `/api/federation/follow/[id]/accept` | POST | Accept follow request | Yes |
| `/api/federation/follow/[id]/reject` | POST | Reject follow request | Yes |

### Docs API

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/docs/pages` | POST | Create doc page | Yes |
| `/api/docs/pages` | PUT | Update doc page | Yes |
| `/api/docs/pages` | DELETE | Delete doc page | Yes |
| `/api/docs/nav` | PUT | Update nav structure | Yes |
| `/api/docs/versions` | POST | Create version | Yes |
| `/api/docs/versions` | PUT | Update version | Yes |
| `/api/docs/versions` | DELETE | Delete version | Yes |
| `/api/docs/search` | GET | Search docs `?q&siteSlug` | No |

### Explainers API

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/explainers/[slug]/export` | GET | Export as HTML file | Yes (author) |

### Form Actions (SvelteKit)

#### Content
| Route | Action | Purpose |
|-------|--------|---------|
| `/create` | default | Create content (project/article/guide/blog) |
| `/[type]/[slug]/edit` | default | Update content, optionally publish |

#### Explainers
| Route | Action | Purpose |
|-------|--------|---------|
| `/explainers/create` | default | Create explainer |
| `/explainers/[slug]/edit` | default | Update explainer |

#### Learning Paths
| Route | Action | Purpose |
|-------|--------|---------|
| `/learn/create` | default | Create path |
| `/learn/[slug]/edit` | updatePath | Update metadata |
| | publish | Publish path |
| | addModule / updateModule / deleteModule | Module CRUD |
| | reorderModules | Reorder modules |
| | addLesson / updateLesson / deleteLesson | Lesson CRUD |
| | reorderLessons | Reorder lessons |

#### Docs
| Route | Action | Purpose |
|-------|--------|---------|
| `/docs/create` | default | Create site + v1.0.0 |
| `/docs/[siteSlug]/edit` | update / delete / createPage | Site management |
| `/docs/[siteSlug]/edit/[pageId]` | save / delete | Page editing |
| `/docs/[siteSlug]/edit/nav` | default | Update nav tree |
| `/docs/[siteSlug]/edit/versions` | create / setDefault / delete | Version management |

#### Communities
| Route | Action | Purpose |
|-------|--------|---------|
| `/communities/create` | default | Create community |
| `/communities/[slug]/settings` | update / delete | Settings |
| | changeRole / kick / ban / unban | Member management |
| | createInvite / revokeInvite | Invite management |

#### Admin
| Route | Action | Purpose |
|-------|--------|---------|
| `/admin/settings/theme` | setTheme / setTokenOverrides | Instance theming |
| `/dashboard/settings` | setTheme | User theme preference |
| `/dashboard` | delete | Delete user's content |

### Page Loads (Read-Only)

| Route | Returns |
|-------|---------|
| `/` | Paginated published content |
| `/projects`, `/articles`, `/blog`, `/explainers` | Filtered content lists |
| `/[type]/[slug]` | Content detail (increments viewCount) |
| `/learn` | Paginated learning paths |
| `/learn/[slug]` | Path with modules/lessons/enrollment |
| `/learn/[slug]/[lessonSlug]` | Lesson content + nav |
| `/certificates/[code]` | Certificate verification (public) |
| `/communities` | Community list |
| `/communities/[slug]` | Community detail |
| `/communities/[slug]/members` | Member list |
| `/docs/[siteSlug]/[...pagePath]` | Rendered docs page + nav + TOC |
| `/dashboard` | User's content (filterable) |
| `/dashboard/communities` | User's communities |
| `/dashboard/learning` | User's enrollments |
| `/dashboard/docs` | User's doc sites |
| `/dashboard/federation` | Federation activity |
| `/admin` | Platform stats |
| `/admin/users` | User management |
| `/admin/audit` | Audit logs |
| `/admin/reports` | Moderation reports |
| `/sitemap.xml` | XML sitemap |

---

## 3. ActivityPub & Federation

### Supported Activity Types (9)

| Activity | Builder | Purpose |
|----------|---------|---------|
| **Create** | `buildCreateActivity(domain, actorUri, object)` | Publish new content |
| **Update** | `buildUpdateActivity(domain, actorUri, object)` | Modify content |
| **Delete** | `buildDeleteActivity(domain, actorUri, objectId, formerType)` | Remove content |
| **Follow** | `buildFollowActivity(domain, actorUri, targetActorUri)` | Follow actor |
| **Accept** | `buildAcceptActivity(domain, actorUri, followActivity)` | Accept follow |
| **Reject** | `buildRejectActivity(domain, actorUri, followActivity)` | Reject follow |
| **Undo** | `buildUndoActivity(domain, actorUri, originalActivity)` | Retract action |
| **Like** | `buildLikeActivity(domain, actorUri, objectUri)` | Like content |
| **Announce** | `buildAnnounceActivity(domain, actorUri, objectUri, followersUri)` | Boost/share |

### Object Types

| Type | Maps To | Builder |
|------|---------|---------|
| **Article** | project, article, guide, blog | `contentToArticle(item, author, domain)` |
| **Note** | comments, short posts | `contentToNote(comment, author, domain, parentUri)` |
| **Tombstone** | deleted content | Via Delete activity |

### Actor Type: Person

```
{
  type: "Person"
  id: https://domain/users/{username}
  preferredUsername, name, summary, url
  inbox: /users/{username}/inbox
  outbox: /users/{username}/outbox
  followers: /users/{username}/followers
  following: /users/{username}/following
  publicKey: { id: {actorUri}#main-key, publicKeyPem }
  endpoints: { sharedInbox: /inbox, oauthAuthorizationEndpoint, oauthTokenEndpoint }
}
```

### Federation Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/webfinger?resource=acct:{user}@{domain}` | GET | WebFinger discovery |
| `/.well-known/nodeinfo` | GET | NodeInfo discovery |
| `/nodeinfo/2.1` | GET | NodeInfo 2.1 document |
| `/users/[username]` | GET | Actor profile (content negotiation) |
| `/users/[username]/followers` | GET | Followers collection |
| `/users/[username]/following` | GET | Following collection |
| `/users/[username]/outbox` | GET | Outbox (paginated, 20/page) |
| `/users/[username]/inbox` | POST | Per-user inbox (processes 9 activity types) |
| `/inbox` | POST | Shared inbox |

### Inbox Processing Callbacks

| Activity | Callback | Local Action |
|----------|----------|-------------|
| Follow | `onFollow` | Insert followRelationship (pending), auto-accept in v1 |
| Accept | `onAccept` | Update followRelationship → accepted |
| Reject | `onReject` | Update followRelationship → rejected |
| Undo | `onUndo` | Delete followRelationship (if Follow) |
| Create | `onCreate` | Log only (Phase 9: cache remote content) |
| Update | `onUpdate` | Log only (Phase 9: update cache) |
| Delete | `onDelete` | Log only (Phase 9: tombstone) |
| Like | `onLike` | Log only (Phase 9: record engagement) |
| Announce | `onAnnounce` | Log only (Phase 9: record boost) |

### OAuth2 SSO Flow (Model B)

```
Instance B user → WebFinger lookup on Instance A
  → GET /.well-known/webfinger → discovers oauth_endpoint
  → Redirect to Instance A /api/auth/oauth2/authorize
  → User authenticates on Instance A
  → Redirect back with ?code=...
  → Instance B POST /api/auth/oauth2/token (exchanges code)
  → Creates/links local account via federatedAccounts table
```

### v1 Status
- **Implemented**: Actor profiles, WebFinger, NodeInfo, Follow lifecycle, OAuth2, activity logging, keypair generation
- **Placeholder**: Create/Update/Delete/Like/Announce processing (logged only)
- **Deferred**: HTTP Signature signing, remote content ingestion, activity delivery to followers

---

## 4. Types, Validators & Data Flow

### Zod Validators (from `@commonpub/schema`)

| Validator | Shape |
|-----------|-------|
| `emailSchema` | `z.string().email().max(255)` |
| `usernameSchema` | `z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/)` |
| `slugSchema` | `z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)` |
| `contentTypeSchema` | `z.enum(['project','article','guide','blog','explainer'])` |
| `createContentSchema` | `{type, title, slug, subtitle?, description?, content?, coverImageUrl?, category?, difficulty?, tags?}` |
| `updateProfileSchema` | `{displayName?, bio?, website?, socialLinks?, skills?}` |
| `createCommentSchema` | `{targetType, targetId, parentId?, content}` |
| `createCommunitySchema` | `{name, slug, description?, rules?, joinPolicy?}` |
| `createPostSchema` | `{communityId, type?, content}` |
| `createLearningPathSchema` | `{title, slug, description?, difficulty?, estimatedHours?}` |
| `createLessonSchema` | `{moduleId, title, slug, type, content?, durationMinutes?}` |

### Key Package Types

#### `@commonpub/config`
```
CommonPubConfig { instance: InstanceConfig, features: FeatureFlags, auth: AuthConfig }
FeatureFlags { content, social, communities, docs, video, contests, learning, explainers, federation, admin }
AuthConfig { emailPassword, magicLink, passkeys, github?, google?, sharedAuthDb?, trustedInstances? }
InstanceConfig { domain, name, description, contactEmail?, maxUploadSize?, contentTypes? }
```

#### `@commonpub/auth`
```
AuthUser { id, email, emailVerified, username, displayName, avatarUrl, role, status, createdAt, updatedAt }
AuthSession { id, userId, token, expiresAt, ipAddress, userAgent, createdAt }
SessionResult { user: AuthUser, session: AuthSession }
UserRole = 'member' | 'pro' | 'verified' | 'staff' | 'admin'
```

#### `@commonpub/editor`
```
BlockTuple = [type: string, content: unknown]
Block types: text, heading, code, image, quote, callout
```

#### `@commonpub/explainer`
```
ExplainerSection = TextSection | InteractiveSection | QuizSection | CheckpointSection
```

#### `@commonpub/learning`
```
LearningPath, LearningModule, Lesson, Enrollment, Certificate
```

#### `@commonpub/docs`
```
DocsPage, DocsSite, NavItem, RenderResult { html, toc, frontmatter }, SearchDocument
```

### Server Helpers (UI → DB)

All in `apps/reference/src/lib/server/`:

| Module | Key Functions |
|--------|--------------|
| **content.ts** | `listContent`, `getContentBySlug`, `createContent`, `updateContent`, `deleteContent`, `publishContent`, `incrementViewCount` |
| **social.ts** | `toggleLike`, `isLiked`, `listComments`, `createComment`, `deleteComment`, `toggleBookmark` |
| **learning.ts** | `listPaths`, `getPathBySlug`, `createPath`, `updatePath`, `publishPath`, `createModule`, `createLesson`, `enroll`, `unenroll`, `markLessonComplete`, `getCertificateByCode` |
| **community.ts** | `listCommunities`, `getCommunityBySlug`, `createCommunity`, `updateCommunity`, `joinCommunity`, `leaveCommunity`, `listMembers`, `changeRole`, `kickMember`, `banUser`, `unbanUser`, `createPost`, `listPosts`, `createReply`, `listReplies` |
| **docs.ts** | `listDocsSites`, `getDocsSiteBySlug`, `createDocsSite`, `updateDocsSite`, `createDocsVersion`, `setDefaultVersion`, `listDocsPages`, `getDocsPage`, `createDocsPage`, `updateDocsPage`, `reorderDocsPages`, `getDocsNav`, `updateDocsNav`, `searchDocsPages` |
| **federation.ts** | `getOrCreateActorKeypair`, `resolveRemoteActor`, `sendFollow`, `acceptFollow`, `rejectFollow`, `unfollowRemote`, `federateContent`, `federateUpdate`, `federateDelete`, `federateLike`, `getFollowers`, `getFollowing`, `listFederationActivity` |
| **admin.ts** | Audit logging, settings, platform stats |
| **theme.ts** | Theme token management |
| **rateLimit.ts** | Sliding window rate limiter |
| **security.ts** | CSP headers, security middleware |

### Data Access Patterns

| Pattern | Implementation |
|---------|---------------|
| ORM | Drizzle query builder (no raw SQL) |
| Session | Better Auth → `locals.user`, `locals.session`, `locals.db` |
| Feature flags | `locals.config.features.*` gates all features |
| Pagination | LIMIT/OFFSET, `(page - 1) * limit` |
| Denormalized counts | `sql\`... + 1\`` / `sql\`... - 1\`` for viewCount, likeCount, etc. |
| Relations | Drizzle relations + manual joins |
| Hierarchies | parentId column, tree rebuilt in memory (JS) |
| Search | Postgres FTS (docs), Meilisearch (future) |
| Federation hooks | Called after mutations if `config.features.federation` enabled |

### Schema File Index

```
packages/schema/src/
├── index.ts          (re-exports all)
├── enums.ts          (all 24 pgEnum definitions)
├── auth.ts           (users, sessions, accounts, organizations, members, federatedAccounts, oauthClients, verifications)
├── content.ts        (contentItems, contentForks, tags, contentTags)
├── social.ts         (likes, follows, comments, bookmarks, notifications, reports)
├── community.ts      (communities, communityMembers, communityPosts, communityPostReplies, communityBans, communityInvites, communityShares)
├── learning.ts       (learningPaths, learningModules, learningLessons, enrollments, lessonProgress, certificates)
├── docs.ts           (docsSites, docsVersions, docsPages, docsNav)
├── federation.ts     (remoteActors, activities, followRelationships, actorKeypairs)
├── admin.ts          (instanceSettings, auditLogs)
├── video.ts          (videos, videoCategories)
├── contest.ts        (contests, contestEntries)
├── files.ts          (files)
└── validators.ts     (all Zod schemas)
```
