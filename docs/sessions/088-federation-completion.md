# Session 088 — Federation Completion Plan Execution

**Date**: 2026-03-28 (continued from session 087)
**Scope**: commonpub monorepo + deveco-io — production-grade federation

## Context

Session 087 established working federation between commonpub.io and deveco.io with seamless content feeds. A deep audit then identified 43 remaining issues across security, reliability, completeness, config, and testing. This session executes the 11-phase completion plan.

## Plan File
`/Users/obsidian/.claude/plans/eager-crunching-grove.md`

## Progress

### Phase 1: XSS-Critical Tests — DONE
- 48 new tests for `blockTuplesToHtml()` and `sanitizeBlockHtml()`
- Covers all 15 block types, XSS vectors, edge cases, cpub:type, image attachments
- Commit: `bbbd2d5`

### Phase 2: Delivery Hardening — DONE
- Schema: `lockedAt` + `deadLetteredAt` columns on `activities` table
- Claim-based worker locking (prevents duplicate delivery with multiple workers)
- Dead letter support (distinguishes permanently failed from retrying)
- Lock release in all mark/increment functions
- `cleanupDeliveredActivities()` for activity table maintenance
- `DeliveryOptions` interface: configurable batchSize + maxRetries
- `FederationConfig` type with admin knobs
- Commit: `9e13f98`

### Phase 3: Working Outboxes — DONE
- New `outboxQueries.ts`: `countOutboxItems`, `getOutboxPage`, `countInstanceOutboxItems`, `getInstanceOutboxPage`
- Instance actor outbox (`/actor/outbox`) now serves real paginated OrderedCollection with all users' Create activities
- User actor outbox (`/users/{username}/outbox`) now serves real paginated activities
- Protocol: `generateOutboxCollection`/`Page` support instance actor (null username)
- 8 new tests (counts, pagination, exclusions, empty pages)
- Both repos updated
- Commit: `5cacab6`

### Phase 4: Content Lifecycle Federation — DONE
- `onContentStatusChange()` detects published→draft/archived and sends Delete
- `onUpdate` handler falls through to `onCreate` when objectUri not found (handles Updates before Creates)
- `handlers` variable extracted for self-reference in onUpdate→onCreate delegation
- Commits: `b388b36`, `c010aeb`

### Phase 5: Mirror Correctness — DONE
- cancelMirror soft-hides content (isHidden=true) instead of orphaning
- pauseMirror records pausedAt for gap-fill on resume
- matchMirrorForContent checks sender domain as fallback for re-broadcasts
- Schema: pausedAt column on instanceMirrors
- Commit: `9dc01ed`

### Phase 6: Config & Feature Flags — DONE
- federateHubs feature flag (default false)
- InboxHandlerOptions accepts federationConfig (backfillOnMirrorAccept, mirrorMaxItems)
- onAccept auto-triggers backfill when mirror Follow is accepted (fire-and-forget)
- Commit: `bee5b95`

### Phase 7: Backfill Hardening — DONE
- Schema: backfillCursor column on instanceMirrors
- Saves cursor (page URL) after each page for resume
- Resumes from cursor on subsequent call with mirrorId
- Per-item error handling (one bad activity doesn't stop the page)
- Network errors save cursor and stop (next call resumes)
- Clears cursor when complete
- Now processes Update activities alongside Create
- Commit: `ddb8f4f`

### Phase 8: Circuit Breaker & Error Visibility — DONE
- New `instanceHealth` table: domain, consecutiveFailures, totalDelivered/Failed, circuitOpenUntil
- `isCircuitOpen/recordDeliverySuccess/Failure/getDeliveryHealth` functions
- Delivery worker checks circuit before each inbox, records results after
- Escalating cooldown: 5min → 15min → 1h → 6h → 24h after threshold
- `onContentPublished/Updated` return `{ federated, error }` instead of void
- Commit: `ec98c65`

### Phase 9: Admin UI — DONE
- Backfill button per mirror with loading state + result display
- Retry Failed button with count badge
- Activity filters: direction, status, type dropdowns
- Client-side filtering on activity list
- deveco-io only commit: `35636aa`

### Phase 10: Remaining Test Coverage — DONE
- 13 new tests for unified content listing + isBookmarked
- listContent with/without federation: merge, sort, source metadata, type filter, search, pagination
- isBookmarked: all target types, different users, true/false states
- Commit: `6650ae4`

### Phase 11: Two-Instance E2E — DEFERRED
Requires Docker infrastructure to spin up two Nuxt instances with separate databases.
Planned tests: Publish→receive, Like→propagate, Update→sync, Delete→tombstone, Follow cycle, Backfill, Blocklist.
This is best done as a dedicated infrastructure task with docker-compose.test.yml.

---

## Final Test Count
- Protocol: 367 tests (24 files)
- Server: 473 tests (38 files) + 1 skipped
- **Total: 841 tests, 0 failures**
- Added this session: **69 new tests** (48 XSS + 8 outbox + 13 unified)

## Final Package Versions
| Package | Version |
|---------|---------|
| @commonpub/schema | 0.8.0 |
| @commonpub/config | 0.7.0 |
| @commonpub/protocol | 0.9.0 |
| @commonpub/server | 2.0.0 |

## Test Status
- Protocol: 367 tests (24 files)
- Server: 460 tests (37 files) + 1 skipped
- Total: **828 tests, 0 failures**
- Typecheck: 25/25 tasks pass
- Build: 14/14 tasks pass

## Package Versions (Source — Not Yet Published)
All phases 1-7 are committed to commonpub main. Need to publish:
| Package | Current | New | Changes |
|---------|---------|-----|---------|
| @commonpub/config | 0.6.0 | 0.7.0 | FederationConfig, federateHubs flag |
| @commonpub/protocol | 0.8.1 | 0.9.0 | outbox instance actor support |
| @commonpub/server | 1.1.0 | 2.0.0 | delivery locking, outbox queries, lifecycle, mirror fixes, config, backfill |
| @commonpub/schema | 0.7.0 | 0.8.0 | lockedAt, deadLetteredAt, pausedAt, backfillCursor |

## Key Files Modified
- `packages/schema/src/federation.ts` — lockedAt, deadLetteredAt, pausedAt, backfillCursor
- `packages/config/src/types.ts` — FederationConfig, federateHubs
- `packages/config/src/schema.ts` — federationConfigSchema
- `packages/protocol/src/outbox.ts` — instance actor support
- `packages/protocol/src/contentMapper.ts` — sanitizeBlockHtml on all data.html
- `packages/server/src/federation/delivery.ts` — claim locking, dead letter, cleanup, DeliveryOptions
- `packages/server/src/federation/outboxQueries.ts` — NEW (4 query functions)
- `packages/server/src/federation/inboxHandlers.ts` — onUpdate→onCreate, auto-backfill, config
- `packages/server/src/federation/mirroring.ts` — cancel cleanup, pause/resume, sender domain
- `packages/server/src/federation/backfill.ts` — resume cursor, per-item errors, BackfillOptions
- `packages/server/src/content/content.ts` — onContentStatusChange
- `packages/protocol/src/__tests__/blockTuplesToHtml.test.ts` — NEW (48 tests)
- `packages/server/src/__tests__/outboxQueries.test.ts` — NEW (8 tests)
