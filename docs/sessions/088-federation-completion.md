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

### Phase 5: Mirror Correctness — TODO
### Phase 6: Config & Feature Flags — TODO
### Phase 7: Backfill Hardening — TODO
### Phase 8: Circuit Breaker & Error Visibility — TODO
### Phase 9: Admin UI — TODO
### Phase 10: Remaining Test Coverage — TODO
### Phase 11: Two-Instance E2E — TODO

## Test Status
- Protocol: 367 tests (24 files)
- Server: 460 tests (37 files) + 1 skipped
- Total: **828 tests, 0 failures**
- Typecheck: 25/25 tasks pass
- Build: 14/14 tasks pass

## Package Versions (Source — Not Yet Published)
| Package | Current | Needs Bump |
|---------|---------|-----------|
| @commonpub/config | 0.6.0 | Yes (FederationConfig added) |
| @commonpub/protocol | 0.8.1 | Yes (outbox signature change) |
| @commonpub/server | 1.1.0 | Yes (delivery, outbox, lifecycle) |
| @commonpub/schema | 0.7.0 | Yes (lockedAt, deadLetteredAt) |

## Key Files Modified
- `packages/schema/src/federation.ts` — lockedAt, deadLetteredAt columns
- `packages/config/src/types.ts` — FederationConfig type
- `packages/config/src/schema.ts` — federationConfigSchema
- `packages/protocol/src/outbox.ts` — instance actor support
- `packages/protocol/src/contentMapper.ts` — sanitizeBlockHtml on all data.html
- `packages/server/src/federation/delivery.ts` — claim locking, dead letter, cleanup
- `packages/server/src/federation/outboxQueries.ts` — NEW
- `packages/server/src/federation/inboxHandlers.ts` — onUpdate→onCreate fallback
- `packages/server/src/content/content.ts` — onContentStatusChange
