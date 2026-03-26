# Session 075 — Federation Phase 2: Remote Follow + Actor Viewing

**Date**: 2026-03-26
**Scope**: @commonpub/schema + @commonpub/server + deveco-io

## What Was Done

### Phase 2 of 7 in the full federation implementation plan.

**Goal**: Users can search for `@user@other.instance` and follow them. Remote actor profiles are viewable.

### Schema Changes (@commonpub/schema)
- `remoteActors` table: added `sharedInbox`, `summary`, `bannerUrl`, `followerCount`, `followingCount` columns
- New `federatedContent` table for Phase 3 (schema added now to avoid migration churn):
  - `objectUri` (unique) — canonical AP URI, prevents duplicate storage
  - `originDomain` — for filtering and **loop prevention** (critical for mirroring)
  - `apType`, `cpubType`, `cpubMetadata` — content-type-aware federation
  - `localLikeCount`, `localCommentCount` — local engagement
  - `deletedAt` — soft delete for inbound Delete activities
  - Indexes on actorUri, originDomain, receivedAt, apType

### Server Functions (@commonpub/server)
- `searchRemoteActor(db, query, localDomain, localUserId?)` — parses `@user@domain`, WebFinger resolution, caches in DB, returns profile with follow status
  - Self-federation guard: rejects lookups for the local domain
  - DNS/network error handling: catches fetch failures gracefully
  - Input validation: rejects malformed handles
- `getRemoteActorProfile(db, actorUri, localDomain?, localUserId?)` — reads cached profile with follow status
- `RemoteActorProfile` type — standardized return type
- `resolveRemoteActor` updated to cache new fields (summary, sharedInbox)

### deveco-io API Routes (4 new)
- `POST /api/federation/search` — search for remote users by handle
- `POST /api/federation/follow` — follow a remote actor
- `POST /api/federation/unfollow` — unfollow a remote actor
- `GET /api/federation/remote-actor?uri=` — get cached remote actor profile

### deveco-io Frontend (4 new files)
- `composables/useFederation.ts` — reactive search/follow/unfollow composable
- `components/RemoteActorCard.vue` — actor profile card with follow button
- `components/RemoteUserSearch.vue` — search form + result display
- `pages/federation/search.vue` — full search page (auth required)

### Tests Added: 10 new
- **remote-actor.integration.test.ts** (10 tests):
  - getRemoteActorProfile: returns full profile, null for missing, follow status (not following, pending, accepted, no leak without userId)
  - searchRemoteActor input validation: rejects no @, empty username, empty domain, local domain, strips leading @

### Security Fixes (from audit)
- **XSS prevention**: `RemoteActorCard.vue` uses `stripHtml()` instead of `v-html` for remote actor summaries (untrusted remote data)
- **Feature flag enforcement**: All 4 federation API routes now call `requireFeature('federation')` before processing
- **onLike UUID crash fix**: `inboxHandlers.ts` `onLike` handler now tries slug match first, validates UUID format before querying by ID (prevents crash on slug-based URIs)

### Loop Prevention Tests
- Explicit test: inbound Create does NOT generate outbound Create
- Explicit test: inbound Like does NOT generate outbound Like

## Decisions Made

1. **`federatedContent` table added in Phase 2** — schema goes in now so Phase 3 doesn't need a migration-only step
2. **`originDomain` column** — critical for loop prevention in mirroring (Phase 6). Content from `originDomain === localDomain` is always rejected by inbound handlers.
3. **Self-federation guard** — `searchRemoteActor` rejects lookups for the local domain (prevents users from accidentally following themselves via federation)
4. **DNS error handling** — `searchRemoteActor` catches fetch/DNS errors and returns null (not an unhandled rejection)
5. **Slug-first matching** — `onLike` handler now tries slug match before UUID match, since canonical URIs use slugs

## Files Changed

### commonpub (9 files, +669/-23)
- `packages/schema/src/federation.ts` — remoteActors columns, federatedContent table
- `packages/server/src/federation/federation.ts` — searchRemoteActor, getRemoteActorProfile, resolveRemoteActor update
- `packages/server/src/federation/delivery.ts` — Undo(Like) fix (from Phase 1 audit)
- `packages/server/src/federation/index.ts` — exports
- `packages/server/src/index.ts` — barrel exports
- `packages/server/src/__tests__/remote-actor.integration.test.ts` — 10 new tests
- `packages/server/src/__tests__/federation-hooks.integration.test.ts` — 2 new tests (draft guards)
- `packages/server/src/__tests__/delivery.integration.test.ts` — new file (9 tests)
- `docs/sessions/074-federation-phase1-outbound.md` — updated with bug fixes

### deveco-io (8 new files, 3 modified)
- `server/api/federation/search.post.ts` — search endpoint
- `server/api/federation/follow.post.ts` — follow endpoint
- `server/api/federation/unfollow.post.ts` — unfollow endpoint
- `server/api/federation/remote-actor.get.ts` — profile endpoint
- `composables/useFederation.ts` — reactive composable
- `components/RemoteActorCard.vue` — actor card
- `components/RemoteUserSearch.vue` — search form
- `pages/federation/search.vue` — search page
- Modified: content PUT, DELETE, like routes (Phase 1 wiring)

## Test Results
- **@commonpub/server**: 31 files, 350 tests (349 passed, 1 skipped)
- **@commonpub/schema**: 8 files, 319 tests passed
- **Build**: Clean TypeScript compilation across both packages

## Loop Prevention Architecture (for Phase 6 mirroring)
The `federatedContent.originDomain` column is the key anti-loop mechanism:
- Every piece of federated content records where it came from
- Inbound handlers MUST check: `if (originDomain === localDomain) reject` — prevents re-ingestion of own content
- Mirror filters check `originDomain` before storing
- `objectUri` UNIQUE constraint prevents duplicate storage even if an activity arrives via multiple paths

## Next Steps (Phase 3)
- Upgrade inbox handlers from logging to content storage in `federatedContent`
- Federated timeline query (`listFederatedTimeline`)
- Like/boost remote content (local interaction + outbound Like)
- Frontend: `FederatedContentCard.vue`, `/federation` timeline page
