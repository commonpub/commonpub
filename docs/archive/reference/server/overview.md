# Server Modules Overview

> Architectural guide to the server-side module layer that encapsulates all database logic in the reference app.

**Source**: `packages/server/src/*.ts`

---

## How Server Modules Work

Server modules are plain TypeScript files in `packages/server/src/` that export async functions encapsulating all database access. Each module covers a domain: content, social, federation, hubs, products, learning, docs, admin, etc.

Nitro route handlers (`server/api/*.ts`) never touch the database directly. Instead they import from the `@commonpub/server` package and delegate all reads and writes through these modules. This keeps routes thin and testable.

---

## DB Access Pattern

Every server function takes `db: NodePgDatabase` as its first parameter and uses the Drizzle query builder for all operations:

```ts
export async function getContentBySlug(
  db: NodePgDatabase,
  slug: string,
  requesterId?: string
): Promise<ContentDetail | null> {
  // Drizzle queries only — no raw SQL except for increment/decrement patterns
}
```

The `db` instance is created in the auth middleware and passed to server functions. In the reference app, Nitro server routes use a shared Drizzle instance.

---

## Feature Flag Gating

Nitro API routes check feature flags before calling server modules. A feature that is disabled at the config level never reaches the server module:

```ts
// In a Nitro API handler
export default defineEventHandler(async (event) => {
  const config = useCommonPubConfig();
  if (!config.features.social) {
    throw createError({ statusCode: 404, statusMessage: 'Feature disabled' });
  }
  const comments = await listComments(db, 'content', contentId);
});
```

Feature flags are defined via `defineCommonPubConfig()` in `@commonpub/config`.

---

## Federation Hook Pattern

Server modules call federation functions when `config.features.federation` is enabled. These calls are always fire-and-forget with `.catch(() => {})` so that a federation failure never breaks the primary operation:

```ts
if (config.features.federation) {
  federateContent(db, contentId, config.domain).catch(() => {});
}
```

This pattern appears in content (publish, update, delete), social (like), and hub modules. The federation module itself logs all activity attempts to the `activities` table regardless of delivery outcome.

---

## Pagination

All list functions use a LIMIT/OFFSET pattern with a hard cap of 100 items per page:

```ts
const limit = Math.min(filters.limit ?? 20, 100);
const offset = filters.offset ?? 0;
```

The default page size is 20. Callers can request up to 100. Any value above 100 is silently capped. List functions return both `items` and `total` to support client-side pagination controls.

---

## Denormalized Counts

View counts, like counts, comment counts, and reply counts are stored as denormalized integers on their parent rows. Server modules update them with atomic SQL expressions:

```ts
// Increment
await db.update(contentItems)
  .set({ viewCount: sql`${contentItems.viewCount} + 1` })
  .where(eq(contentItems.id, contentId));

// Decrement (floor at zero)
await db.update(contentItems)
  .set({ likeCount: sql`GREATEST(${contentItems.likeCount} - 1, 0)` })
  .where(eq(contentItems.id, contentId));
```

The `GREATEST(..., 0)` guard prevents counts from going negative due to race conditions or data inconsistencies.

---

## Auth

Authentication state is populated by the auth middleware in `server/middleware/auth.ts`. After the middleware runs, every route has access to:

- `event.context.user` — The authenticated user object, or `null` if unauthenticated.
- `event.context.session` — The current session object, or `null`.

Server modules themselves do not check authentication. That responsibility belongs to the route handler, which verifies `event.context.user` before calling any write operation and passes `authorId` / `userId` explicitly.

---

## Security Hooks

### `createSecurityHook`

Applies security headers on every response:

- **Nonce-based CSP** (production): Generates a per-request nonce. The Content-Security-Policy header references this nonce for inline scripts.
- **HSTS** (production): Adds `Strict-Transport-Security` with a one-year max-age and `includeSubDomains`.

### `createRateLimitHook`

Sliding-window rate limiting with five tiers:

| Tier | Scope | Window | Max Requests |
|------|-------|--------|--------------|
| auth | Login, register, password reset | 15 min | 10 |
| social | Likes, comments, bookmarks | 1 min | 30 |
| federation | Inbox, outbox, follow | 1 min | 60 |
| api | General API endpoints | 1 min | 100 |
| general | All other routes | 1 min | 200 |

Rate limit state is stored in Redis. When exceeded, the hook returns a 429 response with `Retry-After` header.

---

## Hook Chain Order

Middleware executes in a strict sequence in Nitro:

```
security -> rate limit -> auth -> route handler
```

1. **Security hook** -- Sets CSP nonce, HSTS, and other security headers.
2. **Rate limit hook** -- Checks sliding-window counters; short-circuits with 429 if exceeded.
3. **Auth middleware** -- Resolves session, populates `event.context.user` and `event.context.session`.
4. **Route handler** -- The Nitro `defineEventHandler` runs with full context.

This ordering ensures that security headers are always set (even on rate-limited or unauthenticated responses), rate limiting runs before any database work, and auth context is available to every route handler.
