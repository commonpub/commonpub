# Session 083 — L6: Hub Federation (FEP-1b12) + L7: Dynamic OAuth Registration

**Date**: 2026-03-26
**Scope**: @commonpub/schema + @commonpub/protocol + @commonpub/server + deveco-io

## L6: Hub Federation (Group Actors)

### Schema
- New `hubActorKeypairs` table — RSA keypairs per hub (separate from user keypairs since actorKeypairs requires userId FK)
- New `hubFollowers` table — remote actors following hub Group actors, with activityUri for Undo matching, unique constraint per (hubId, followerActorUri)
- `remoteActors` — added `actorType` column (default 'Person', also 'Group', 'Service')
- `APGroup` type added to protocol activityTypes

### Server Functions (`federation/hubFederation.ts`)
- `getOrCreateHubKeypair(db, hubId)` — generates/caches RSA keypair for hub Group actor
- `buildHubGroupActor(db, hubSlug, domain)` — AP Group JSON-LD with inbox/outbox/followers/publicKey
- `handleHubFollow(db, hubSlug, followerActorUri, activityId, domain)` — auto-accepts for public open hubs, queues Accept activity
- `handleHubUnfollow(db, hubSlug, followerActorUri, activityUri?)` — exact match on activityUri, fallback to actor
- `getHubFederatedFollowers(db, hubId)` — accepted followers list
- `federateHubPost(db, postId, hubId, domain)` — Announce from Group actor wrapping post Note
- `federateHubShare(db, contentObjectUri, hubId, domain)` — Announce wrapping shared content

### Delivery Worker Updates
- `getKeypairForActor` detects hub URIs (`/hubs/{slug}`) and fetches from `hubActorKeypairs`
- `resolveTargetInboxes` for hub actors queries `hubFollowers` instead of `followRelationships`

### deveco-io
- `GET /hubs/[slug]` route — content-negotiated: AP clients get Group JSON-LD, browsers redirect

### Tests: 12 new
- Hub actor: keypair generation/caching, Group object structure, null for missing hub, URI construction
- Follow lifecycle: accept, duplicate (idempotent), Undo with activityUri, Undo fallback
- Content federation: post Announce, share Announce, delivery resolves hub followers
- Anti-loop: inbound Announce does NOT re-announce

## L7: Dynamic OAuth Client Registration

### Protocol
- `OAuthDynamicRegistrationRequest` type (clientName, redirectUris, clientUri?, instanceDomain)
- `validateDynamicRegistration()` — validates name, URIs (HTTPS required except localhost), domain

### Server
- `processDynamicRegistration(db, request)` — validates, checks for existing domain (idempotent), registers new client

### deveco-io
- `POST /api/auth/oauth2/register` — public endpoint for dynamic registration (no auth, feature-flag gated)

### Tests: 6 new
- Register new client, idempotent for same domain, rejects missing name, rejects empty URIs, rejects HTTP (non-localhost), allows localhost HTTP

## Test Results
- **@commonpub/server**: 36 files, **453 tests** (452 passed, 1 skipped)
- All packages build clean

## Federation Plan Status Update
| Limitation | Status |
|-----------|--------|
| L6: Hub federation | **DONE** — FEP-1b12 Group actors, follow lifecycle, content Announce |
| L7: Dynamic OAuth | **DONE** — registration endpoint, validation, idempotent |
| L3: Meilisearch search | Deferred v2 |
