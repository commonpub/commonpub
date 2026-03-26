# Session 082 — Federation Limitation Fixes

**Date**: 2026-03-26
**Scope**: @commonpub/schema + @commonpub/server + deveco-io

## Limitations Fixed

### L8: Instance actor route (GET /actor)
- Added `getOrCreateInstanceKeypair(db)` — generates and caches instance-level RSA keypair in `instanceSettings` table (since `actorKeypairs` requires userId FK)
- Added `buildInstanceActor(domain, publicKeyPem)` — returns AP Service object with inbox, outbox, followers, following, publicKey
- Created `deveco-io/server/routes/actor.ts` — content-negotiated: AP clients get JSON-LD, browsers redirect to /about
- Updated WebFinger to handle `acct:domain@domain` → resolves to `/actor`

### L1: Follow Undo ambiguity
- Added `activityUri` column to `followRelationships` table — stores the original Follow activity ID
- `onFollow` handler now stores `activityUri` on insert and update
- `onUndo` handler tries exact `activityUri` match first, falls back to most-recent if not found (backwards-compatible with AP implementations that don't include activity URI in Undo)
- **Tested**: actor follows two local users → Undo with specific activity URI deletes the correct one

### L4: Delivery worker concurrency
- Documented as production NOTE in delivery.ts — `FOR UPDATE SKIP LOCKED` recommended for multi-worker deployments
- Current single-worker `setInterval` in deveco-io plugin prevents concurrent invocations
- Not implemented with optimistic locking because PGlite tests don't support it cleanly

### L5: Unlike count decrement
- `onUndo` handler now handles `objectType === 'Like'`:
  - Extracts slug from objectUri
  - Decrements `likeCount` on local content (via `GREATEST(count - 1, 0)` — can't go negative)
  - Falls back to decrementing `localLikeCount` on federated content
- **Tested**: Like then Unlike → count decremented; Unlike without prior Like → stays at 0

### L2: OAuth callback (deferred)
- Deferred to v2 — requires session-based state storage for remote token endpoint + client credentials
- Placeholder callback route exists in deveco-io with clear TODO documentation

## Tests Added: 6 new
- Unlike decrement: local content, no-negative guard
- Undo safety (existing): confirmed Undo(Like) doesn't delete follows
- activityUri targeting: actor follows 2 local users, Undo deletes correct one
- Instance actor: keypair generation + caching, Service object structure

## Test Results
- **@commonpub/server**: 35 files, **431 tests** (430 passed, 1 skipped)
- **Build**: Clean TypeScript compilation

### L2: OAuth callback (FIXED in this session, post-initial handoff)
- Added `storeOAuthState(db, state)` — stores token endpoint, client credentials, redirect URI in `instanceSettings` with 10-minute TTL
- Added `consumeOAuthState(db, stateToken)` — single-use retrieval with expiry check
- Added `exchangeCodeForToken(state, code)` — POSTs to remote token endpoint, returns user info
- Updated `login.post.ts` — stores state before redirect
- Completed `callback.get.ts` — consumes state, exchanges code, links federated account, redirects
- **4 new tests**: store+retrieve, single-use, invalid token, expired state

## Test Results (Final)
- **@commonpub/server**: 35 files, **435 tests** (434 passed, 1 skipped)

## Remaining Known Limitations
| # | What | Status |
|---|------|--------|
| L3 | Meilisearch for federated search | Deferred to v2 |
| L6 | Hub federation (Group actors) | Deferred to v2 |
| L7 | Dynamic OAuth client registration | Deferred to v2 |
