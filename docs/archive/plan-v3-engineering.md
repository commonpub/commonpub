# CommonPub v3 — Engineering Quality Plan

> Written 2026-03-17 after a senior engineer review of the entire codebase.
> Addresses structural debt: untyped DB, zero integration tests, CSS duplication,
> inconsistent errors, no migrations, flat server module.

---

## Research Summary

### Typed Drizzle DB
- Drizzle's power comes from `NodePgDatabase<typeof schema>` where queries return
  typed rows, not `unknown`. Current code uses `Record<string, unknown>` and casts
  manually — a column rename won't produce a compile error.
- Fix: pass `* as schema` to `drizzle()` and update the `DB` type alias.
- Source: [Drizzle Schema Docs](https://orm.drizzle.team/docs/sql-schema-declaration),
  [Type-Safe Patterns](https://dev.to/myougatheaxo/drizzle-orm-practical-patterns-type-safe-database-access-design-120c)

### Integration Testing with PGlite
- PGlite runs WASM Postgres in-memory. No Docker, millisecond startup, real SQL.
- Use `drizzle-kit/api` `pushSchema` to apply schema in `beforeAll`.
- Reference implementation: [rphlmr/drizzle-vitest-pg](https://github.com/rphlmr/drizzle-vitest-pg)
- Guide: [PGlite + Drizzle Testing](https://dev.to/benjamindaniel/how-to-test-your-nodejs-postgres-app-using-drizzle-pglite-4fb3)

### Database Migrations
- `drizzle-kit push` is for dev prototyping only. Production requires migration files.
- `drizzle-kit generate` creates SQL migration files. `drizzle-kit migrate` applies them.
- Migration files must be committed to version control and reviewed.
- Source: [Drizzle Migrations](https://orm.drizzle.team/docs/migrations),
  [Best Practices Gist](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)

### Composable Extraction (Nuxt 3)
- Large pages should extract logic into composables. Use `_composables/` directories
  alongside pages (underscore prefix is ignored by Nuxt router).
- Each composable does one thing. `useHub` not `useHubEverything`.
- Source: [Nuxt Discussion #34224](https://github.com/nuxt/nuxt/discussions/34224),
  [Composable Patterns](https://dev.to/jacobandrewsky/good-practices-and-design-patterns-for-vue-composables-24lk)

### Shared CSS / Component Library
- Current: `.cpub-btn`, `.cpub-tag`, `.cpub-empty-state` duplicated in 15+ scoped
  style blocks with slight variations.
- Fix: extract shared primitives into `packages/ui/theme/components.css` (global)
  or build actual Vue components.
- Source: [Nuxt UI approach](https://ui.nuxt.com/), [Vue class strategy](https://backlight.dev/mastery/best-vue-component-libraries-for-design-systems)

### Error Handling
- Nitro's `createError` returns consistent JSON for API routes.
- A custom `defineNitroErrorHandler` can normalize all error shapes.
- Source: [Nuxt Error Handling](https://masteringnuxt.com/blog/handling-errors-in-nuxt3),
  [createError docs](https://nuxt.com/docs/4.x/api/utils/create-error)

### OpenAPI from Zod
- `@asteasolutions/zod-to-openapi` generates OpenAPI 3.x from Zod schemas.
- Drizzle has built-in Zod schema generation via `drizzle-orm/zod`.
- Source: [zod-to-openapi](https://github.com/asteasolutions/zod-to-openapi),
  [Drizzle Zod integration](https://orm.drizzle.team/docs/zod)

---

## Phases

### Phase A: Typed DB (highest ROI, foundation for everything else)

**Goal**: Every Drizzle query returns typed rows. A column rename causes a compile error.

**Changes**:

1. `packages/server/src/types.ts` — change DB type:
   ```ts
   import * as schema from '@commonpub/schema';
   export type DB = NodePgDatabase<typeof schema>;
   ```

2. `apps/reference/server/utils/db.ts` — pass schema to drizzle:
   ```ts
   import * as schema from '@commonpub/schema';
   db = drizzle(pool, { schema });
   ```

3. `packages/server/src/*.ts` — remove all `as string`, `as number`, `as Date`
   casts from query results. Let Drizzle infer the types. Fix any compile errors
   (these are real bugs the casts were hiding).

4. `packages/server/src/content.ts` — remove `mapToListItem` manual casting,
   use Drizzle's inferred select types.

**Note**: A pre-existing type error in `admin.ts` (lines 103+) must be fixed first — the
`auditLogs` table has a Drizzle version incompatibility with the `db.insert()` overloads.
This error exists on main and is masked by Turborepo caching.

**Verification**: `pnpm typecheck` passes with zero `as unknown` casts in server/.

---

### Phase B: Integration Tests with PGlite

**Goal**: Every server function tested against real Postgres. Zero Docker required.

**Setup**:

1. `pnpm add -D @electric-sql/pglite drizzle-orm` in `packages/server`

2. Create `packages/server/src/__tests__/setup.ts`:
   ```ts
   import { PGlite } from '@electric-sql/pglite';
   import { drizzle } from 'drizzle-orm/pglite';
   import * as schema from '@commonpub/schema';

   export async function createTestDB() {
     const client = new PGlite();
     const db = drizzle(client, { schema });
     // Push schema using drizzle-kit API
     const { pushSchema } = await import('drizzle-kit/api');
     const { apply } = await pushSchema(schema, db);
     await apply();
     return db;
   }
   ```

3. Write integration tests for critical paths:
   - `content.integration.test.ts` — create, update, publish, delete, version
   - `hub.integration.test.ts` — create, join, post, ban, invite, gallery
   - `product.integration.test.ts` — create, BOM sync, gallery queries
   - `social.integration.test.ts` — like toggle, comment threading, follow
   - `learning.integration.test.ts` — enroll, complete lesson, certificate
   - `contest.integration.test.ts` — state machine transitions, judge auth

4. Each test file: `beforeEach` creates fresh DB, runs tests, no cleanup needed
   (PGlite instance is garbage collected).

**Verification**: `pnpm test` runs 50+ new integration tests in <5 seconds.

---

### Phase C: Database Migrations

**Goal**: Production-safe schema changes via committed SQL files.

1. Add `drizzle.config.ts` to `packages/schema/`:
   ```ts
   import { defineConfig } from 'drizzle-kit';
   export default defineConfig({
     schema: './src/*.ts',
     out: './migrations',
     dialect: 'postgresql',
   });
   ```

2. Generate initial migration:
   ```bash
   cd packages/schema && npx drizzle-kit generate
   ```

3. Add scripts to root `package.json`:
   ```json
   "db:generate": "pnpm --filter @commonpub/schema drizzle-kit generate",
   "db:migrate": "pnpm --filter @commonpub/schema drizzle-kit migrate"
   ```

4. Update `docs/quickstart.md`: replace `pnpm db:push` with `pnpm db:migrate`
   for production. Keep `db:push` for dev convenience.

5. Commit `migrations/` directory. Every future schema change gets a migration.

**Verification**: `pnpm db:migrate` applies cleanly to a fresh Postgres.

---

### Phase D: Shared CSS Primitives

**Goal**: Zero duplicate `.cpub-btn`, `.cpub-tag`, `.cpub-empty-state` definitions.

1. Create `packages/ui/theme/components.css`:
   - `.cpub-btn` / `.cpub-btn-primary` / `.cpub-btn-sm` / `.cpub-btn-ghost`
   - `.cpub-tag` / `.cpub-tag-accent` / `.cpub-tag-green` / `.cpub-tag-red`
   - `.cpub-empty-state` / `.cpub-empty-state-icon` / `.cpub-empty-state-title`
   - `.cpub-sb-card` / `.cpub-sb-title`
   - `.cpub-section-head`
   - `.cpub-pagination` / `.cpub-page-btn`

2. Add to `nuxt.config.ts` CSS array:
   ```ts
   css: [
     uiTheme('base.css'),
     uiTheme('dark.css'),
     uiTheme('components.css'),  // NEW
     uiTheme('prose.css'),
     // ...
   ]
   ```

3. Remove duplicate definitions from every page's `<style scoped>` block.
   This is mechanical — search for `.cpub-btn {` in all `.vue` files, delete
   each scoped copy, verify the global version applies.

**Verification**: `grep -r "\.cpub-btn {" apps/reference/pages/` returns 0 matches.

---

### Phase E: Consistent Error Handling

**Goal**: Every API error returns `{ statusCode, statusMessage, data? }`.
Every page handles errors the same way.

1. Create `apps/reference/server/utils/errors.ts`:
   ```ts
   export function validationError(errors: Record<string, string[]>) {
     throw createError({
       statusCode: 400,
       statusMessage: 'Validation failed',
       data: { errors },
     });
   }

   export function notFound(entity: string) {
     throw createError({
       statusCode: 404,
       statusMessage: `${entity} not found`,
     });
   }

   export function forbidden(message = 'Permission denied') {
     throw createError({ statusCode: 403, statusMessage: message });
   }
   ```

2. Create `apps/reference/composables/useApiError.ts`:
   ```ts
   export function useApiError() {
     function extract(err: unknown): string {
       const e = err as any;
       if (e?.data?.errors) {
         return Object.entries(e.data.errors)
           .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
           .join('; ');
       }
       return e?.data?.statusMessage || e?.data?.message || e?.message || 'Something went wrong';
     }
     return { extract };
   }
   ```

3. Update all API routes to use the error helpers.
4. Update all pages to use `useApiError().extract()` instead of inline parsing.

**Verification**: Every 4xx/5xx response from `/api/*` has `statusCode` + `statusMessage`.

---

### Phase F: Page Decomposition (largest pages)

**Goal**: No page file over 300 lines. Extract composables and sub-components.

Priority targets (by line count):
1. `pages/hubs/[slug].vue` (1,130 lines) → extract:
   - `composables/useHubData.ts` — fetch hub, members, gallery, products
   - `components/hubs/HubFeed.vue` — feed tab content
   - `components/hubs/HubGallery.vue` — gallery tab
   - `components/hubs/HubProducts.vue` — products tab
   - `components/hubs/HubMembers.vue` — members tab

2. `pages/u/[username].vue` (850+ lines) → extract:
   - `composables/useProfile.ts` — fetch profile, content, follow state
   - `components/profile/ProfileAbout.vue` — about tab

3. `pages/search.vue` (1,100+ lines) → extract:
   - `composables/useSearch.ts` — search query, pagination, filters
   - `components/search/SearchFilters.vue` — advanced filters panel
   - `components/search/SearchResults.vue` — results grid + pagination

4. `pages/videos/index.vue` (360+ lines) → extract featured section

**Verification**: No page file exceeds 300 lines. `pnpm build` passes.

---

### Phase G: OpenAPI Spec Generation

**Goal**: Auto-generated OpenAPI 3.x spec from existing Zod validators.

1. `pnpm add -D @asteasolutions/zod-to-openapi` in `packages/schema`

2. Create `packages/schema/src/openapi.ts` that registers all validators
   with OpenAPI metadata and generates the spec.

3. Add a build script that writes `docs/openapi.json`.

4. Optionally serve at `/api/docs` via Scalar or Swagger UI.

**Verification**: `docs/openapi.json` is valid OpenAPI 3.x with all 125 endpoints.

---

## Execution Order

```
Phase A (typed DB)          — 1 session, foundation for B
  ↓
Phase B (integration tests) — 1-2 sessions, depends on typed DB
  ↓
Phase C (migrations)        — 0.5 session, independent
Phase D (shared CSS)        — 1 session, independent
Phase E (error handling)    — 0.5 session, independent
Phase F (page decomposition)— 1-2 sessions, independent
Phase G (OpenAPI)           — 0.5 session, depends on nothing
```

**Critical path**: A → B (typed DB enables typed tests).
Everything else can be parallelized.

---

## What This Does NOT Cover (Intentionally Deferred)

- **Server package splitting** — splitting `@commonpub/server` into domain packages
  is a large refactor with low immediate ROI. The flat module works for now. Revisit
  when the team grows beyond 2-3 contributors.
- **Event-driven architecture** — domain events (ContentPublished, UserFollowed) are
  the right long-term architecture but require a message bus. Defer to federation phase.
- **Caching layer** — Redis caching, HTTP cache headers, stale-while-revalidate. Defer
  until there's actual traffic to optimize for.
- **Background jobs** — BullMQ worker for email, federation, search indexing. Defer
  until federation ships.
- **Federation interop tests** — recorded payloads from Mastodon/Lemmy/Misskey. Defer
  until federation is turned on.
