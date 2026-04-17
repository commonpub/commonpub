# Building a Site with CommonPub

> Guide for building a new federated maker community using the published `@commonpub` npm packages.

---

## Overview

CommonPub is a suite of 12 npm packages that give you everything needed to run a federated maker community — content management, learning paths, documentation sites, user auth, ActivityPub federation, and a headless UI system.

You can use as few or as many packages as you need. The minimum viable setup is `@commonpub/schema` + `@commonpub/server` + `@commonpub/config`.

---

## Package Guide — What to Install

### Core (always needed)

```bash
pnpm add @commonpub/schema @commonpub/server @commonpub/config
```

| Package | What it gives you |
|---------|-------------------|
| `@commonpub/schema` | Database tables (Drizzle ORM) + Zod validators |
| `@commonpub/server` | Business logic — content CRUD, social features, admin, federation |
| `@commonpub/config` | Feature flags + `defineCommonPubConfig()` factory |

### Auth

```bash
pnpm add @commonpub/auth
```

Better Auth wrapper with session management, role guards (`authGuard`, `adminGuard`, `roleGuard`), and ActivityPub actor SSO.

### Federation

```bash
pnpm add @commonpub/protocol
```

ActivityPub protocol layer — HTTP signatures, WebFinger, NodeInfo, actor resolution, inbox/outbox, content mapping.

### Frontend

```bash
pnpm add @commonpub/ui
```

22 headless Vue 3 components (Button, Input, Tabs, Dialog, Menu, etc.) styled entirely with CSS custom properties. Import theme CSS:

```ts
import '@commonpub/ui/theme/base.css';
import '@commonpub/ui/theme/dark.css'; // optional
```

### Content Editing

```bash
pnpm add @commonpub/editor
```

TipTap-based block editor with 18+ maker-focused extensions (build steps, parts lists, tool lists, galleries, quizzes, math notation, etc.).

**Peer dependency:** Requires `@tiptap/core` and extensions — install them alongside.

### Documentation Sites

```bash
pnpm add @commonpub/docs
```

Markdown rendering pipeline (remark + rehype + shiki syntax highlighting), navigation tree builder, versioning, and dual search (Meilisearch primary, Postgres FTS fallback).

### Learning System

```bash
pnpm add @commonpub/learning @commonpub/explainer
```

Learning path engine (curriculum, progress tracking, certificates) and interactive scroll-driven module runtime with quizzes.

### Infrastructure

```bash
pnpm add @commonpub/infra
```

Storage adapters (local filesystem + S3/DO Spaces/MinIO/R2), image processing (sharp), email (SMTP + console), security headers, rate limiting.

**Optional peer deps:** `@aws-sdk/client-s3` (for S3 storage), `sharp` (for image processing).

### Testing

```bash
pnpm add -D @commonpub/test-utils
```

Test factories (`createTestUser`, `createTestSession`, `createTestConfig`) and mock config for development.

---

## Quick Start — Nuxt 3 App

### 1. Create the project

```bash
npx nuxi@latest init my-community
cd my-community
```

### 2. Install CommonPub packages

```bash
pnpm add @commonpub/schema @commonpub/server @commonpub/config @commonpub/auth @commonpub/protocol @commonpub/ui @commonpub/infra
pnpm add drizzle-orm pg
pnpm add -D @types/pg drizzle-kit
```

### 3. Configure CommonPub

Create `commonpub.config.ts`:

```ts
import { defineCommonPubConfig } from '@commonpub/config';

export default defineCommonPubConfig({
  instance: {
    domain: process.env.INSTANCE_DOMAIN ?? 'localhost:3000',
    name: 'My Community',
    description: 'A maker community powered by CommonPub',
  },
  features: {
    content: true,
    social: true,
    hubs: true,
    docs: false,       // enable when you need doc sites
    video: false,
    contests: false,
    learning: false,
    explainers: false,
    federation: false,  // enable when ready to federate
    admin: true,
  },
});
```

### 4. Set up the database

Create `server/utils/db.ts`:

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@commonpub/schema';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

Apply migrations:

```bash
# One-time: apply the committed baseline from @commonpub/schema to your DB.
npx drizzle-kit migrate --config=path/to/drizzle.config.ts

# For iterating on your own schema extensions during development:
npx drizzle-kit generate  # generates new migration SQL
npx drizzle-kit migrate   # applies them
```

`drizzle-kit push` is fine for quick dev iteration but don't rely on it in CI — it blocks on interactive prompts for populated-table changes and silently drops DDL. CommonPub's own deploys use `scripts/db-migrate.mjs` which calls the drizzle-orm migrator directly (see [session 128](sessions/128-docs-and-learn-audit.md)).

### 5. Create your first API route

Create `server/api/content/index.get.ts`:

```ts
import { listContent } from '@commonpub/server/content';
import { db } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  return listContent(db, {
    type: query.type as string | undefined,
    limit: Number(query.limit) || 20,
    offset: Number(query.offset) || 0,
  });
});
```

### 6. Import the UI theme

In `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  css: [
    '@commonpub/ui/theme/base.css',
    '@commonpub/ui/theme/dark.css',
  ],
});
```

---

## Environment Variables

Create `.env`:

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# Auth
AUTH_SECRET=your-secret-min-32-characters

# Public
NUXT_PUBLIC_SITE_URL=http://localhost:3000
INSTANCE_DOMAIN=localhost:3000
INSTANCE_NAME=My Community

# Optional — S3 storage (falls back to local filesystem)
# S3_BUCKET=
# S3_REGION=
# S3_ACCESS_KEY=
# S3_SECRET_KEY=

# Optional — Redis (falls back to in-memory)
# REDIS_URL=redis://localhost:6379

# Optional — Meilisearch (falls back to Postgres FTS)
# MEILI_URL=http://localhost:7700
# MEILI_MASTER_KEY=
```

---

## Handling Updates

### Checking for updates

```bash
pnpm outdated @commonpub/*
```

### Updating packages

```bash
pnpm update @commonpub/*
```

### Migration strategy

CommonPub uses [Drizzle ORM](https://orm.drizzle.team/) for schema management. When updating `@commonpub/schema`:

1. Update the package: `pnpm update @commonpub/schema`. This pulls the new migrations that ship in `node_modules/@commonpub/schema/migrations/`.
2. Apply them to your database: `npx drizzle-kit migrate` (production-safe, non-interactive). `drizzle-kit push` also works for dev but is not recommended in CI.
3. If you've added your own schema on top of CommonPub's, run `npx drizzle-kit generate` to produce a diff migration for those additions, review, commit, then `npx drizzle-kit migrate`.

### Breaking changes

- **0.x releases**: API may change between minor versions. Check the [CHANGELOG](https://github.com/commonpub/commonpub/blob/main/CHANGELOG.md) before updating.
- **1.x releases** (future): Follows semver — breaking changes only in major versions.
- The CommonPub packages are versioned together. Always update all `@commonpub/*` packages to the same version.

### Pinning versions

For production stability, pin exact versions:

```bash
pnpm add @commonpub/schema@0.1.0 @commonpub/server@0.1.0
```

---

## Common Patterns

### Feature flag gating

```ts
import config from '~/commonpub.config';

// In a server route
if (!config.features.learning) {
  throw createError({ statusCode: 404 });
}
```

### Auth guards

```ts
import { authGuard, adminGuard } from '@commonpub/auth';

// Require authentication
const user = authGuard(event);

// Require admin role
adminGuard(event);
```

### Storage

```ts
import { createStorageFromEnv, validateUpload } from '@commonpub/infra';

const storage = createStorageFromEnv();
const validation = validateUpload(mimeType, sizeBytes, 'avatar');
if (!validation.valid) throw new Error(validation.error);
const url = await storage.upload(key, buffer, mimeType);
```

### Federation (when enabled)

```ts
import { parseWebFingerResource, buildWebFingerResponse } from '@commonpub/protocol';

// Handle WebFinger requests
const resource = parseWebFingerResource(query.resource);
return buildWebFingerResponse(resource, domain);
```

---

## Package Dependency Graph

```
@commonpub/config  (standalone — feature flags)
@commonpub/schema  (standalone — DB tables + validators, peer: drizzle-orm)
@commonpub/infra   (standalone — storage, email, security)
@commonpub/ui      (standalone — Vue 3 components, peer: vue)

@commonpub/protocol  → config, schema
@commonpub/auth      → config, schema, protocol
@commonpub/editor    → config, schema (peer: @tiptap/*)
@commonpub/docs      → config, schema

@commonpub/explainer → editor, config, schema
@commonpub/learning  → explainer, editor, config, schema

@commonpub/server    → ALL packages above
```

Install only what you need. `@commonpub/server` pulls in everything.

---

## Getting Help

- [GitHub Issues](https://github.com/commonpub/commonpub/issues)
- [Developers guide](https://github.com/commonpub/commonpub/blob/main/docs/guides/developers.md)
- [Codebase analysis](https://github.com/commonpub/commonpub/tree/main/codebase-analysis) — exhaustive inventory of schema, server modules, API routes
- [Feature flags inventory](https://github.com/commonpub/commonpub/blob/main/codebase-analysis/08-feature-flags-inventory.md)
