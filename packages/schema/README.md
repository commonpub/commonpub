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
| `auth`       | `users`, `sessions`, `accounts`, `organizations`, `members`, `federatedAccounts`, `oauthClients`, `verifications` | User identity, auth sessions, OAuth, SSO   |
| `content`    | `contentItems`, `contentForks`, `tags`, `contentTags`                                        | Articles, projects, guides, blog posts     |
| `social`     | `likes`, `comments`, `follows`, `bookmarks`, `notifications`                                 | Social interactions and engagement         |
| `community`  | `communities`, `communityMembers`, `communityPosts`, `communityReplies`, `communityBans`     | Community spaces with moderation           |
| `learning`   | `learningPaths`, `learningModules`, `lessons`, `enrollments`, `lessonProgress`, `certificates`| Learning paths, progress, certificates     |
| `docs`       | `docsSites`, `docsVersions`, `docsPages`                                                     | Versioned documentation sites              |
| `federation` | `remoteActors`, `activities`, `followRelationships`, `actorKeypairs`                         | ActivityPub federation state               |
| `admin`      | `auditLogs`, `reports`, `instanceSettings`                                                   | Admin panel, moderation, instance config   |
| `video`      | `videos`                                                                                     | Video content type                         |
| `contest`    | `contests`, `contestEntries`, `contestVotes`                                                 | Contest/competition system                 |
| `files`      | `uploads`                                                                                    | File upload tracking                       |
| `enums`      | (none)                                                                                       | Shared PostgreSQL enums                    |
| `validators` | (none)                                                                                       | Zod schemas for input validation           |

## Enums

All enums are defined as PostgreSQL enum types via Drizzle's `pgEnum`:

- `userRoleEnum`: `member`, `moderator`, `admin`
- `userStatusEnum`: `active`, `suspended`, `banned`
- `profileVisibilityEnum`: `public`, `private`
- `contentTypeEnum`: `project`, `article`, `guide`, `blog`, `explainer`
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
