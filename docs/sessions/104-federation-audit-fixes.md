# Session 104 — Federation Audit, Fixes, and Testing

**Date:** 2026-04-03

## What Was Done

### Comprehensive Audit
- Full sweep of both repos (commonpub + deveco-io): schemas, migrations, documentation, test coverage, themes
- Created `docs/federation-map.md` — comprehensive reference for all federation tables, routes, components, data flows
- Investigated E2E test failures, hub post rendering pipeline, content type handling

### Bugs Fixed (8)
1. **Hub members list empty on federated hubs** — Added `federated_hub_members` table with auto-population from post ingestion and followers collection. Backward-compat fallback for pre-migration hubs.
2. **Projects lumped with discussions** — `sharedContentPosts` filter now checks `type === 'project'`, discussion filter excludes posts with `sharedContent`.
3. **Share posts show raw JSON** — `hubPostToNote()` now parses JSON share content, generates readable text + `cpub:sharedContent` extension. Hub post Note serving route matches.
4. **Hub post HTML shown as literal text** — FeedItem/HubFeed/HubDiscussions strip HTML for previews. Federated post detail uses `v-html`. Local post detail uses MentionText.
5. **OAuth authorize page blocks remote users** — Removed `middleware: 'auth'`, inline login form with OAuth context, consent form after authentication.
6. **onUpdate authorization bypass** — Fallback-to-onCreate path checked content existence before allowing creation (prevented actor impersonation).
7. **Hub avatars missing on homepage sidebar** — Both layer and deveco-io homepage sidebars hardcoded generic icon, now render `hub.iconUrl` when present.
8. **Content AP route missing** — Created `server/routes/content/[slug].ts` to serve AP Article JSON-LD for federation dereference (was entirely missing).

### E2E Fixes
- `smoke.spec.ts`: Register form `#identity` → `#email`
- `navigation.spec.ts`: Footer `feed.xml` strict mode (`.first()`), tab test `networkidle` + longer timeouts
- `responsive.spec.ts`: Login form `#email` → `#identity`
- `search.vue`: Hardcoded "devEco.io" title → `useSiteName()`

### Tests Added (122 new)
- **Schema (8):** All federation table structure validation
- **Server (69):** Circuit breaker (14), delivery retry (8), inbox handlers (16), hub members (14), content types (11), hub post federation (6)
- **Layer (45):** FederatedContentCard component (25), useMirrorContent composable (20)
- **Total: 1,407 tests** (was 1,285)

### Published
- `@commonpub/schema@0.8.13` — federatedHubMembers table
- `@commonpub/server@2.16.0` — hub members, share post rendering, onUpdate auth fix
- `@commonpub/layer@0.3.29` — all UI fixes, content AP route, hub avatars, OAuth
- deveco-io updated to layer 0.3.29

### Production SQL
- Created `federated_hub_members` table on both instances
- Backfilled members from existing post authors (3 rows on commonpub.io)
- Repaired existing share posts (JSON content → readable text + sharedContentMeta)

## Decisions Made
- `federatedHubMembers` table uses `discoveredVia` enum ('post', 'followers', 'mention') to track how members were found
- Hub sync plugin fetches followers on FIRST sync only (avoid hammering remote instances)
- `listFederatedHubMembers` falls back to post-authors-only query for backward compatibility
- Theme count corrected: 3 built-in (base, dark, generics), not 4
- Layer component testing uses global Vue auto-import shim for Nuxt compatibility

## Open Questions / Next Steps
- HTTP Signature verification on inbox routes (P0 security, major feature)
- Theme editor/selector in admin UI (future)
- CLI Rust source still lists old theme names (needs Rust edit)
- Consider periodic followers refresh in hub sync (not just first sync)
- Custom schema extensibility plan (see below)

## Technical Debt Updated
- Per-participant read receipts for group chats (needs message_reads table)
- Redis authentication in production docker-compose
- `as any` casts in storage adapter (upload-from-url)
- `useSanitize.ts` is a no-op — should implement DOMPurify as defense-in-depth
- E2E flakiness on navigation tests (timing in CI)

## Custom Schema Extensibility — Research Plan

The current architecture has a closed schema: `@commonpub/schema` is published as a compiled npm package. Consumers can't add columns or tables that integrate with the base schema.

### Approach: Schema Plugin System

**Goal:** Let consumer apps define custom tables + server functions as easily as they override pages/components.

**Architecture:**

```
commonpub.config.ts
├── instance: { ... }
├── features: { ... }
├── schema: {
│     extensions: [
│       myCustomModule({
│         // module-specific config
│       })
│     ]
│   }
```

**How it would work:**

1. **Schema Extension Modules** — Consumer defines Drizzle tables in their own package or `server/schema/` directory:
   ```ts
   // server/schema/inventory.ts
   export const inventory = pgTable('inventory', {
     id: uuid('id').primaryKey(),
     contentId: uuid('content_id').references(() => contentItems.id),
     sku: varchar('sku'),
     quantity: integer('quantity'),
   });
   ```

2. **Schema Merge at Push Time** — `drizzle.config.ts` in the consumer app includes both CommonPub schema AND custom schema:
   ```ts
   export default defineConfig({
     schema: [
       './node_modules/@commonpub/schema/dist/*.js',
       './server/schema/*.ts',  // Custom tables
     ],
   });
   ```
   This already works with Drizzle — no changes needed to the push mechanism.

3. **Server Function Extensions** — Consumer adds custom API routes that use both CommonPub functions and custom tables:
   ```ts
   // server/api/inventory/[contentId].get.ts
   import { getContent } from '@commonpub/server';
   import { inventory } from '~/server/schema/inventory';
   
   export default defineEventHandler(async (event) => {
     const db = useDB();
     const content = await getContent(db, contentId);
     const stock = await db.select().from(inventory).where(eq(inventory.contentId, contentId));
     return { ...content, stock };
   });
   ```

4. **Hook System for Integration** — CommonPub exports lifecycle hooks that consumers can subscribe to:
   ```ts
   // server/plugins/inventory-hooks.ts
   export default defineNitroPlugin(() => {
     useCommonPubHooks({
       onContentPublished: async (db, contentId) => {
         await db.insert(inventory).values({ contentId, quantity: 0 });
       },
       onContentDeleted: async (db, contentId) => {
         await db.delete(inventory).where(eq(inventory.contentId, contentId));
       },
     });
   });
   ```

**What needs to change in CommonPub:**
1. Export a `useDB()` helper that returns the typed DB instance (already done via Nitro)
2. Export a `useCommonPubHooks()` registration function (NEW — needs event emitter)
3. Document the schema extension pattern (drizzle.config.ts with multiple schema dirs)
4. Ensure `drizzle-kit push` works with merged schemas (it does)
5. Add JSONB `extensionData` columns to key tables for lightweight extension without custom tables

**What does NOT need to change:**
- Schema package stays closed (no dynamic composition)
- Server package stays closed (hooks provide integration points)
- Layer system already supports custom pages/components/routes
- Config system already supports custom feature flags

**Complexity estimate:** Medium — the hook system is the main new code (~200 lines). Schema extension is already possible via Drizzle config. The documentation and conventions are the bulk of the work.
