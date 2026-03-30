# Session 092 — Hub Refactor + Seamless Hub Mirroring

**Date**: 2026-03-30
**Scope**: commonpub monorepo + deveco-io
**Packages published**: @commonpub/schema 0.8.6, @commonpub/server 2.4.0 → 2.4.7

## Context

Session 091 shipped hub federation but left significant debt: 1400-line hub.ts, 1400-line hub page, bolted-on useEngagement routing, and no seamless hub mirroring. This session refactored all debt, built the complete hub mirroring pipeline, and hardened it through multiple audit rounds.

---

## What Was Done

### Refactoring

**Hub server split** — `hub.ts` (1430 lines) → 4 modules: `hub.ts` (CRUD), `posts.ts` (posts/replies/likes/shares), `members.ts` (membership), `moderation.ts` (bans/invites). Clean acyclic dependency graph.

**Hub page extraction** — `pages/hubs/[slug]/index.vue` (1385 lines) → ~200 lines + 7 child components: HubHero, HubFeed, HubDiscussions, HubMembers, HubProjects, HubProducts, HubSidebar.

**useEngagement refactor** — Positional params → `EngagementOptions` object. Bookmark skips for federated content. `isFederated` computed exposed.

**useMirrorContent composable** — Extracted from mirror page. Content parsing, metadata extraction, view component resolution.

### Seamless Hub Mirroring

**Schema** (0.8.6): `federatedHubs` table (Group actor metadata, follow lifecycle, status) + `federatedHubPosts` table (posts from remote hubs with engagement counters). Indexes on (status, isHidden), name, remoteActorId, originDomain, federatedHubId, receivedAt.

**Server** (2.4.x): `hubMirroring.ts` module with followRemoteHub, sendHubFollow, acceptHubFollow, autoDiscoverHub, ingestFederatedHubPost, listFederatedHubs, deleteFederatedHubPost, like/unlike. All use atomic insert-or-update patterns (no double-counting).

**Auto-discovery**: When an Announce arrives from a Group actor on a domain with an active instance mirror, the hub is automatically created with `status='accepted'`. No per-hub Follow required. Admin can hide individual hubs.

**Inbox wiring**:
- `onAccept` → calls `acceptHubFollow()` for pending hub mirrors
- `onAnnounce` → detects Group actors, auto-discovers from mirrored instances, dereferences Note, ingests post
- `onDelete` → calls `deleteFederatedHubPost()` with actorUri validation

**Delivery fix**: Hub Group actor Announce activities now also fan out to instance actor followers (for mirroring), not just hubFollowers.

**`listHubs()`**: Supports `includeFederated` option. Dynamic import of hubMirroring (lazy-loaded, no perf impact when disabled). Merges local + federated, sorts by date, paginates.

### API Routes (both apps)

- `GET /api/hubs` — includes federated hubs when `seamlessFederation + federateHubs` enabled
- `GET /api/federated-hubs/[id]` — federated hub detail
- `GET /api/federated-hubs/[id]/posts` — federated hub posts
- `GET /api/admin/federation/hub-mirrors` — list federated hubs (admin)
- `POST /api/admin/federation/hub-mirrors` — follow remote hub (admin)

### Refederate + Backfill

- Refederate endpoint now re-queues hub posts as Announce activities (`hubsOnly` flag supported)
- Backfill now processes Announce activities (not just Create/Update), enabling hub post backfill
- Outbound activity deduplication: `federateContent()` and `federateHubPost()` check for existing activities before inserting — safe to run refederate multiple times

### UI (both apps synced)

- Hubs listing: federated hubs show subtle origin domain label (`globe icon + domain.com`)
- Federated hub detail page: origin banner ("Mirrored from domain.com"), hub header with type badge, stats that clarify context ("X members on domain.com", "Y mirrored posts"), post feed with fediverse handles
- SEO: `noindex, follow` + canonical link to origin hub
- CommentSection: federation-aware (routes to `/api/federation/reply`, skips local fetch, shows notice)

### Security

- `getFederatedHubByActorUri()` only returns accepted hubs
- `deleteFederatedHubPost()` validates actorUri matches post author
- Loop prevention: skips Announces of own domain content
- `attributedTo` handling: string, object, array per AP spec
- Note dereference: 10s timeout
- `autoDiscoverHub` respects admin hide decisions
- `resolveRemoteActor` stores actual `actorType` (not hardcoded 'Person')
- Cached actor returns use stored actorType

### Tests

32 integration tests in `hub-mirroring.integration.test.ts`:
- followRemoteHub: create, update on duplicate, preserves status
- acceptHubFollow: pending→accepted, idempotent, unknown actor
- getFederatedHubByActorUri: returns accepted, rejects pending
- listFederatedHubs: status+hidden filter, search
- ingestFederatedHubPost: create with count, no double-count, multiple
- listFederatedHubPosts: listing, author info, pagination
- deleteFederatedHubPost: soft-delete, rejects wrong actor, idempotent
- like/unlike: increment, decrement, floor at zero
- autoDiscoverHub: mirrored domain, non-mirrored, Person actors, admin hide, post ingestion
- listHubs with includeFederated: local-only, merged, search
- unfollowRemoteHub: hides from all listings

512 total tests pass across 40 test files.

### Activity Cleanup

`cleanupDeliveredActivities()` expanded to also clean failed and dead-lettered activities past retention period.

---

## Packages Published

| Package | Version | Changes |
|---------|---------|---------|
| @commonpub/schema | 0.8.6 | federatedHubs + federatedHubPosts tables |
| @commonpub/server | 2.4.7 | Hub split, hub mirroring, auto-discovery, delivery fix, actorType fix, dedup, cleanup |

---

## Bugs Found and Fixed During Audits

| Bug | Impact | Fix |
|-----|--------|-----|
| `actorType` never stored in remoteActors | autoDiscoverHub always returned null | Store `actor.type` on resolve (2.4.4) |
| Cached actor returned hardcoded `type: 'Person'` | Wrong type for Group actors | Use stored `actorType` from DB (2.4.4) |
| Hub Announces only delivered to hubFollowers | Instance mirrors never received hub posts | Also fan out to instance actor followers (2.4.5) |
| Stale `actorType='Person'` for pre-fix cached actors | autoDiscoverHub failed on already-cached Group actors | Force re-resolve for /hubs/ URIs with stale type (2.4.6) |
| `federateContent` created duplicate outbound activities | Refederate doubled all activities each run | Check for existing before insert (2.4.6) |
| `federateHubPost` same duplication issue | Same | Same fix (2.4.6) |
| Activity cleanup only removed delivered | Failed/dead-lettered accumulated forever | Include failed + dead-lettered in cleanup (2.4.7) |
| Hub mirroring functions not exported from main index | `import { ... } from '@commonpub/server'` failed | Added to index.ts re-exports (2.4.1) |
| Admin route used wrong ResolvedActor field names | `actorType`, `displayName`, `avatarUrl` don't exist on protocol type | Use `type`, `name`, `icon?.url` (2.4.1) |
| Reference app hubs route had stale return type | TypeScript error on CI | Updated to union type (2.4.1) |
| Race conditions in followRemoteHub/ingestFederatedHubPost | Double-counting on concurrent requests | onConflictDoNothing + separate update |
| listHubs merge didn't sort across sources | Inconsistent pagination | Fetch both sources, merge, sort, slice |
| CommentSection 404 on federated content | Fetched comments with remote ID | Skip fetch when federatedContentId set |
| Missing CSS in HubSidebar | `.cpub-sb-card`, `.cpub-sb-title` unstyled | Added styles |

---

## Known Remaining Work

### Next session priorities
1. **End-to-end test**: Trigger refederate on commonpub.io (`POST /api/admin/federation/refederate` with `{ "hubsOnly": true }`), verify hubs appear on deveco.io
2. **Federated hub post interactions**: Like/reply UI wiring for federated hub posts
3. **Reference app hub page component extraction**: Still a 1387-line monolith (deveco-io is done)

### Lower priority
- Boost button on mirror pages (endpoint exists, UI not wired)
- Follow federated content author from content view
- Fork federated content (new endpoint)
- Share card backfill migration (runtime N+1 → SQL)
- Repo sync automation (manual file copying between repos)

---

## Commits

### commonpub (10 commits)
1. `b477c42` refactor: hub.ts split into 4 modules
2. `7ed2b73` feat: seamless hub mirroring (schema + server + inbox + tests)
3. `7bb3d71` docs: session 092
4. `82835a1` fix: reference app union type handling
5. `d93277b` fix: export hub mirroring functions from main index
6. `3ea72e2` fix: lazy-load hub mirroring, Announce in backfill, hub-aware refederate
7. `1113a28` feat: auto-discover hubs from mirrored instances
8. `5427d66` feat: federated hubs UI for reference app, sync with deveco-io
9. `fc8d271` fix: store actorType, return correct type from cache
10. `bc29237` fix: deliver hub Announces to instance mirror followers
11. `5cb4990` fix: dedup outbound activities, stale actorType cache
12. `0ba510d` fix: activity cleanup includes failed/dead-lettered

### deveco-io (8 commits)
1. `3c24c2e` refactor: hub page components, useEngagement, mirror composable
2. `8e2972a` feat: hub mirroring UI, routes, admin tools
3. `d987d9f` chore: bump schema 0.8.6, server 2.4.0
4. `e1d1b69` fix: server 2.4.1, ResolvedActor fields, sitemap
5. `1e5f1e6` fix: hub-aware refederate, server 2.4.2
6. `0f4fd69` chore: server 2.4.3
7. `122ef15` fix: polish federated hub UX
8. `7369aef` chore: server 2.4.4
9. `e8a5e5a` chore: server 2.4.5
10. `98eb111` chore: server 2.4.6
11. `0dbdb4d` chore: server 2.4.7
