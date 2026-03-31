# Session 092 — Hub Refactor + Seamless Hub Mirroring

**Date**: 2026-03-30/31
**Packages**: @commonpub/schema 0.8.6, @commonpub/server 2.4.9
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
- **`federateHubActor()`**: Announces a hub's existence (self-referencing Announce) so hubs with 0 posts still get discovered
- **Inbox wiring**: onAccept → acceptHubFollow, onAnnounce → auto-discover + ingest, onDelete → soft-delete (with actorUri validation)
- **Delivery**: Hub Announces fan out to both hubFollowers AND instance mirror followers
- **Refederate**: Announces all hub actors + hub posts. Dedup only blocks pending (not delivered). Safe to run multiple times.
- **Backfill**: Processes Announce activities (not just Create/Update)

### Security
- `getFederatedHubByActorUri` only returns accepted hubs
- `deleteFederatedHubPost` validates actorUri
- Loop prevention (skips own-domain Announces)
- AP-spec `attributedTo` handling (string, object, array)
- `resolveRemoteActor` stores actual `actorType` (Group detection works)
- Outbound activity dedup (pending-only)
- Activity cleanup covers delivered + failed + dead-lettered

### UI (both apps synced)
- Hubs listing: federated hubs show origin domain label
- Federated hub detail: origin banner, type badge, contextual stats, fediverse handles
- SEO: noindex + canonical for federated pages
- CommentSection: federation-aware replies, skip local fetch, notice banner
- Admin refederate: shows content/hubs/hub posts breakdown

### Config Fix
- deveco-io: `useConfig()` now reads from `commonpub.config.ts` as source of truth, env vars override
- Reference app: added `federateHubs` env var mapping

---

## Bugs Found and Fixed

| Bug | Server Version |
|-----|---------------|
| `actorType` never stored in remoteActors | 2.4.4 |
| Cached actor returned hardcoded `type: 'Person'` | 2.4.4 |
| Hub Announces only delivered to hubFollowers, not instance mirrors | 2.4.5 |
| Stale actorType cache for pre-fix actors | 2.4.6 |
| Duplicate outbound activities on refederate | 2.4.6 |
| Activity cleanup only removed delivered | 2.4.7 |
| Dedup blocked re-creation of delivered activities | 2.4.8 |
| Hub mirroring functions not exported from main index | 2.4.1 |
| Admin route used wrong ResolvedActor field names | 2.4.1 |
| Hubs with 0 posts invisible to mirrors | 2.4.9 |
| `federateHubs` flag ignored (server config didn't read commonpub.config.ts) | config fix |

---

## How Hub Mirroring Works (end to end)

1. Instance A mirrors Instance B (existing `instanceMirrors` active pull mirror)
2. On Instance B, admin clicks "Re-federate All" in admin portal
3. For each hub: `federateHubActor()` queues self-referencing Announce from Group actor
4. For each hub post: `federateHubPost()` queues Announce wrapping the Note
5. Delivery worker fans out to hubFollowers + instance actor followers (Instance A's Service actor)
6. Instance A's shared inbox receives the Announces
7. `onAnnounce`: resolves Group actor (stores `actorType: 'Group'`), checks `getFederatedHubByActorUri`
8. If hub unknown: `autoDiscoverHub` checks domain has active mirror → creates `federatedHubs` entry as accepted
9. Self-announce (objectUri === actorUri): hub discovered, skip post ingestion
10. Post announce: dereferences Note, extracts content, calls `ingestFederatedHubPost`
11. Hub + posts appear on Instance A's hubs page

---

## Next Session

1. **Verify end-to-end**: Click Re-federate on deveco.io after deploy, verify hubs appear on commonpub.io
2. **Federated hub post like/reply UI**: Wire interaction buttons on the federated hub detail page
3. **Reference app hub page extraction**: Still a 1387-line monolith

## Remaining Backlog

- Boost button on mirror pages
- Follow federated content author from content view
- Fork federated content
- Share card backfill migration
- Repo sync automation
