# ADR 019: Federation Architecture

## Status

Accepted

## Context

Phase 8 delivers the core goal: "Two instances federate content via ActivityPub." We need to integrate Fedify, process AP activities, resolve remote actors, handle delivery, and support OAuth2 SSO between instances.

The protocol package already has hand-rolled WebFinger, NodeInfo, and OAuth handlers (42 tests). The schema has `federatedAccounts` and `oauthClients` tables. Redis is configured in Docker.

## Decisions

### 1. Fedify Integration Strategy

Replace hand-rolled `createFederation()` with real Fedify `createFederation()`. The hand-rolled WebFinger/NodeInfo builders become helpers called by Fedify dispatchers. Feature-flag guard preserved.

### 2. New Schema Tables

- `remoteActors` — Cache resolved remote AP actors
- `activities` — Log inbound/outbound AP activities
- `followRelationships` — Federation-aware follows (separate from local follows)
- `actorKeypairs` — RSA signing keys per user

### 3. Activity Scope (v1)

Implement: Follow, Accept, Reject, Undo (follow), Create (Article/Note), Update, Delete, Like, Announce.
Defer: Move, Add, Remove, Block.

### 4. Content Mapping

| CommonPub                   | AP Type  | Notes                |
| -------------------------- | -------- | -------------------- |
| article/blog/guide/project | Article  | Body as HTML         |
| comment                    | Note     | With inReplyTo       |
| like                       | Like     | Target is object URI |
| share                      | Announce | Boost semantics      |

### 5. Queue Architecture

Use Fedify's built-in message queue rather than separate BullMQ worker:

- Dev: `InProcessMessageQueue` (zero config)
- Production: `@fedify/redis` RedisMessageQueue
- Fedify handles HTTP Signature signing, retry, and delivery internally
- `tools/worker` provides monitoring/admin wrapper, not a separate consumer

### 6. Keypair Strategy

RSA 2048 per user, generated on first federation action. Stored in `actorKeypairs` table. Fedify's `setKeyPairsDispatcher` handles key lookup.

### 7. OAuth2 SSO

Model B (ADR 010): WebFinger discovery → OAuth2 authorize → token exchange → account linking. Uses existing `oauthClients` and `federatedAccounts` tables.

## Consequences

- Fedify manages activity delivery, retry, and signature verification
- Hand-rolled protocol code preserved as pure helpers (no breaking changes)
- Federation is fully feature-flag gated
- Communities remain local-only (no AP Group)
- Remote content cached in `remoteActors` table for display without re-fetching
