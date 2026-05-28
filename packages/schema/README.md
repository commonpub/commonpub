# @commonpub/schema

Drizzle ORM table definitions and Zod validators for the CommonPub data model.

## Overview

This package is the single source of truth for CommonPub's database schema. Every table, enum, relation, and validator lives here. All other packages depend on `@commonpub/schema`.

## Installation

```bash
pnpm add @commonpub/schema
```

## Usage

```ts
import { users, contentItems, contentTypeEnum } from '@commonpub/schema';
import { createContentItemSchema, updateUserProfileSchema } from '@commonpub/schema';
```

## Schema Modules

| Module       | Tables                                                                                       | Purpose                                    |
| ------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `auth`       | `users`, `sessions`, `accounts`, `organizations`, `members`, `federatedAccounts`, `oauthClients`, `oauthCodes`, `verifications` | User identity, auth sessions, OAuth, SSO   |
| `content`    | `contentItems`, `contentVersions`, `contentForks`, `contentBuilds`, `tags`, `contentTags`    | Articles, projects, blog posts, explainers |
| `social`     | `likes`, `comments`, `follows`, `bookmarks`, `notifications`, `reports`, `conversations`, `messages` | Social interactions, messaging, reports    |
| `hub`        | `hubs`, `hubMembers`, `hubPosts`, `hubPostReplies`, `hubBans`, `hubInvites`, `hubShares`     | Hub spaces (community/product/company) with moderation |
| `product`    | `products`, `contentProducts`                                                                | Product catalog and BOM linking            |
| `learning`   | `learningPaths`, `learningModules`, `learningLessons`, `enrollments`, `lessonProgress`, `certificates` | Learning paths, progress, certificates     |
| `docs`       | `docsSites`, `docsVersions`, `docsPages`, `docsNav`                                          | Versioned documentation sites              |
| `federation` | `remoteActors`, `activities`, `followRelationships`, `actorKeypairs`                         | ActivityPub federation state               |
| `admin`      | `instanceSettings`, `auditLogs`                                                              | Admin panel and instance config            |
| `video`      | `videos`, `videoCategories`                                                                  | Video content and categories               |
| `contest`    | `contests`, `contestEntries`                                                                 | Contest/competition system                 |
| `files`      | `files`                                                                                      | File upload tracking                       |
| `enums`      | (none)                                                                                       | Shared PostgreSQL enums                    |
| `layout`     | `layouts`, `layout_rows`, `layout_sections`, `layout_versions`                              | Layout engine — DB-stored page layouts composed from a section registry. Phase 3a editor shipped session 160. Instance-local (never federates). |
| `validators` | (none)                                                                                       | Zod schemas for input validation (includes `layoutSchema`, `layoutCreateSchema`, `layoutSectionSchema`, `layoutRowSchema`, `layoutZoneSchema`, `pageMetaSchema`) |

## Enums

All enums are defined as PostgreSQL enum types via Drizzle's `pgEnum`:

- `userRoleEnum`: `member`, `moderator`, `admin`
- `userStatusEnum`: `active`, `suspended`, `banned`
- `profileVisibilityEnum`: `public`, `private`
- `contentTypeEnum`: `project`, `article`, `blog`, `explainer`
- `contentStatusEnum`: `draft`, `published`, `archived`
- `contentVisibilityEnum`: `public`, `unlisted`, `private`
- `difficultyEnum`: `beginner`, `intermediate`, `advanced`
- Additional enums for communities, learning, federation, etc.

## Conventions

- **UUID primary keys** on all tables (`uuid().defaultRandom().primaryKey()`)
- **Timestamps with timezone** (`timestamp('created_at', { withTimezone: true })`)
- **Cascade deletes** on foreign keys where appropriate
- **JSONB columns** for flexible structured data (social links, parts lists, sections)
- **Denormalized counters** for read performance (view/like/comment/fork counts)
- **Relations** defined via Drizzle's `relations()` for type-safe joins

## Validators

Zod schemas for validating user input at API boundaries:

```ts
import { createContentItemSchema, updateUserProfileSchema } from '@commonpub/schema';

const result = createContentItemSchema.safeParse(userInput);
if (!result.success) {
  // Handle validation errors
}
```

## Development

```bash
pnpm build        # Compile TypeScript
pnpm test         # Run tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `drizzle-orm`: ORM and query builder
- `zod`: Runtime validation
