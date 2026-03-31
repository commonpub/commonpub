# Session 092 — Hub Refactor + Seamless Hub Mirroring

**Date**: 2026-03-30/31
**Packages**: @commonpub/schema 0.8.6, @commonpub/server 2.5.0
**Tests**: 512 pass (32 hub mirroring)

---

## What Was Built

### Hub Server Refactoring
- `hub.ts` (1430 lines) split into `hub.ts` (CRUD), `posts.ts`, `members.ts`, `moderation.ts`
- Hub page (1385 lines) split into 7 components: HubHero, HubFeed, HubDiscussions, HubMembers, HubProjects, HubProducts, HubSidebar
- `useEngagement` → options object API, bookmark skips for federated content
- `useMirrorContent` composable extracted from mirror page

### Seamless Hub Mirroring
- **Schema**: `federatedHubs` + `federatedHubPosts` tables with indexes and cascade deletes
- **Auto-discovery**: Hubs from mirrored instances appear automatically when Announce arrives from Group actor on a mirrored domain
- **`federateHubActor()`**: Self-referencing Announce so hubs with 0 posts still get discovered
- **Inbox wiring**: onAccept → acceptHubFollow, onAnnounce → auto-discover + ingest, onDelete → soft-delete
- **Delivery**: Hub Announces fan out to hubFollowers AND instance mirror followers
- **Refederate**: Announces all hub actors + hub posts. Dedup only blocks pending. Safe to repeat.
- **Backfill**: Processes Announce activities (not just Create/Update)
- **Graceful fallback**: listHubs wraps federation query in try/catch — returns local hubs if table missing

### Config Fix
- deveco-io: `useConfig()` reads from `commonpub.config.ts` as source of truth, env vars override
- Reference app: added `federateHubs` env var mapping
- Hubs listing: `includeFederated` requires only `seamlessFederation` (not `federateHubs` — that controls outbound)

### Security
- `getFederatedHubByActorUri` only returns accepted hubs
- `deleteFederatedHubPost` validates actorUri
- Loop prevention, AP-spec attributedTo handling, 10s fetch timeout
- `resolveRemoteActor` stores actual `actorType`
- Outbound activity dedup (pending-only)
- Activity cleanup covers delivered + failed + dead-lettered

---

## Bugs Found and Fixed

| Bug | Fix |
|-----|-----|
| `actorType` never stored in remoteActors | Store `actor.type` on resolve |
| Cached actor returned hardcoded `type: 'Person'` | Use stored `actorType` |
| Hub Announces only delivered to hubFollowers | Also fan out to instance mirror followers |
| Stale actorType cache for pre-fix actors | Force re-resolve for `/hubs/` URIs |
| Duplicate outbound activities on refederate | Only block pending, not delivered |
| Activity cleanup only removed delivered | Include failed + dead-lettered |
| Hub mirroring functions not exported from main index | Added to re-exports |
| Admin route used wrong ResolvedActor field names | Use `type`, `name`, `icon?.url` |
| Hubs with 0 posts invisible to mirrors | `federateHubActor` self-announce |
| `federateHubs` config ignored on server | Config reads from commonpub.config.ts |
| `includeFederated` required `federateHubs` | Only requires `seamlessFederation` |
| listHubs 500 when federated_hubs table missing | try/catch fallback to local-only |
| drizzle-kit push silently failing on both instances | Manually created tables via SQL |
| Inbound Announce dedup blocked reprocessing | Cleared stale activity records |

---

## Production Database Status

Tables manually created via SQL on both instances (drizzle-kit push broken in Docker):
- **commonpub.io**: `federated_hubs`, `federated_hub_posts` — confirmed via psql
- **deveco.io**: `federated_hubs`, `federated_hub_posts` — confirmed via node pg client
- Instance mirror: commonpub.io has active pull mirror for deveco.io
- Remote actors: all 3 deveco.io hub Group actors cached with `actorType: 'Group'`
- Stale inbound/outbound Announce activities cleared on both instances

### drizzle-kit push issue (pre-existing)
The commonpub Dockerfile's runtime stage doesn't include drizzle-kit. The deploy script runs `npx drizzle-kit push --force` but it fails with "Cannot find module 'drizzle-kit'" and the deploy continues (error swallowed by `|| echo warning`). This affects ALL schema changes, not just hub mirroring. Needs Dockerfile fix.

---

## How Hub Mirroring Works

1. Instance B (deveco.io) admin clicks "Re-federate All"
2. `federateHubActor()` queues self-referencing Announce per hub
3. `federateHubPost()` queues Announce per hub post
4. Delivery worker fans out to hubFollowers + instance mirror followers
5. Instance A (commonpub.io) receives Announces at shared inbox
6. `onAnnounce`: resolves Group actor (stores `actorType: 'Group'`), checks `getFederatedHubByActorUri`
7. If unknown: `autoDiscoverHub` checks domain has active mirror → creates `federatedHubs` as accepted
8. Self-announce: hub discovered, skip post ingestion
9. Post announce: dereferences Note, extracts content, ingests
10. Hub + posts appear on Instance A's hubs listing

---

## Next Session

1. **Verify end-to-end**: User clicked Re-federate on deveco.io after table creation + activity cleanup. Check if hubs appear on commonpub.io
2. **Fix drizzle-kit push in Dockerfile**: Include drizzle-kit in runtime stage so schema migrations work on deploy
3. **Federated hub post like/reply UI**
4. **Reference app hub page extraction** (still 1387-line monolith)

## Backlog
- Boost button on mirror pages
- Follow federated content author
- Fork federated content
- Share card backfill migration
- Repo sync automation
