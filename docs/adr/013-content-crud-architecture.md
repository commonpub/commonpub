# ADR-013: Content CRUD Architecture

## Status

Accepted

## Context

Phase 4 builds the reference app's content system. We need to decide how mutations flow (form actions vs API), how slugs are generated, and how content body is stored and rendered.

## Decision

### Form Actions for Mutations

- Content create/update/delete/publish use SvelteKit form actions in `+page.server.ts`
- Progressive enhancement via `use:enhance`
- Built-in CSRF protection from SvelteKit
- Validation errors returned via `fail()` — no client-side schema duplication

### Server Loads for Reads

- All content listing and detail pages use `+page.server.ts` load functions
- SSR for SEO — content is in the HTML response

### JSON API for Social Only

- `+server.ts` routes only for like/bookmark/comment toggles
- These are interactive AJAX calls from components, not page navigations

### Slug Generation

- `generateSlug(title)`: lowercase, replace non-alphanumeric with hyphens, collapse, trim
- `ensureUniqueSlug(db, slug, excludeId?)`: check `contentItems` table, append `-{timestamp}` on collision
- Slug regenerated only when title changes on update

### Content Body Storage

- Stored as `BlockTuple[]` in `content` JSONB column (editor state)
- `BlockTuple` = `[type, attrs]` from `@commonpub/editor`
- Rendered to HTML at read time using editor serialization utilities
- No separate HTML column — single source of truth

### No tRPC

- Direct Drizzle queries in server functions
- Type safety via Drizzle's inferred types + app-level TypeScript interfaces

## Consequences

- Progressive enhancement works out of the box
- Single source of truth for content (BlockTuples)
- Slug uniqueness guaranteed at the database level (unique constraint + app-level check)
- Social interactions require JavaScript (acceptable tradeoff for optimistic UI)
