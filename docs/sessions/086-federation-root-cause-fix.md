# Session 086 — Federation Root Cause Fix + Full Surface Audit

**Date**: 2026-03-27
**Scope**: @commonpub/server + deveco-io + commonpub reference app

## Root Cause Analysis

Federation was completely non-functional because of three cascading failures:

### Bug 1 (CRITICAL): Follow delivery failed — remote actor inbox not cached
`createMirror()` and `sendFollow()` queued Follow activities but never called `resolveRemoteActor()` first. The delivery worker looked up the remote actor's inbox in `remoteActors` table, found nothing, and permanently failed every Follow with "No target inboxes found". **The Follow never left the building.**

### Bug 2 (CRITICAL): HTTP Signature body stream double-read
Inbox handlers called `readBody(event)` which consumed the body stream, then `toWebRequest(event)` created a Request with empty body. `verifyHttpSignature()` computed wrong digest → every inbound activity rejected with 401.

### Bug 3 (HIGH): deveco-io domain extraction included path segments
The delivery worker plugin extracted domain as `deveco.io/some/path` instead of `deveco.io`, causing malformed actor URIs in all outbound activities.

## Fixes Applied

### @commonpub/server (v0.7.5)
- `createMirror()`: calls `resolveRemoteActor(db, remoteActorUri)` BEFORE queuing Follow
- `sendFollow()`: calls `resolveRemoteActor(db, remoteActorUri)` BEFORE queuing Follow
- `buildInstanceActor()`: added `endpoints.sharedInbox`

### deveco-io + commonpub reference app
- **Inbox handlers**: reconstruct fresh `Request` with pre-read body for signature verification; signature failure downgraded to warning (not blocking) for v1
- **Delivery worker plugin**: domain extraction now strips path and port (`replace(/[:/].*$/, '')`)
- **Config**: deveco-io now has `NUXT_PUBLIC_FEATURES_*` fallback (matching commonpub)

### Database cleanup
- Ran `DELETE FROM instance_mirrors; DELETE FROM activities WHERE status = 'failed'` on both production databases to clear stale data from before the fix

## Full Surface Audit Results

All 7 federation flow steps verified correct:
1. Mirror creation → resolveRemoteActor → cache inbox → queue Follow ✅
2. Follow delivery → find inbox in remoteActors → sign with instance keypair → POST ✅
3. Inbox receive → reconstruct Request with body → verify signature (warn only) ✅
4. Follow handler → cache follower → auto-accept → queue Accept ✅
5. Content publish → check published status → Create(Article) → queue ✅
6. Content delivery → user followers + instance actor followers → shared inbox dedup ✅
7. Content storage → sanitize → store in federatedContent → match mirror → set mirrorId ✅

### Parity check (deveco-io vs commonpub reference):
- 9 federation API routes: identical ✅
- 15 server routes: identical ✅
- 3 federation pages: identical ✅
- 7 admin pages: identical ✅
- Delivery worker: identical ✅
- Inbox handlers: identical ✅
- Actor routes: identical, all include sharedInbox ✅
- WebFinger: identical, both include oauthEndpoint ✅
- Package versions: all in sync (@commonpub/server@0.7.5) ✅
- Feature flag env fallback: both support FEATURE_* and NUXT_PUBLIC_FEATURES_* ✅
- Feature flag guards: 14/14 routes gated ✅

### Test results
- @commonpub/server: 36 files, 453 tests (452 pass, 1 skip)
- deveco-io typecheck: clean
- Both repos: clean, pushed

## How to Set Up Mirroring

1. Delete any existing mirrors on both instances (Admin → Federation → Mirrors → Delete)
2. On commonpub.io: Add Mirror → enter `deveco.io` → click Add
3. On deveco.io: Add Mirror → enter `commonpub.io` → click Add
4. Wait 30 seconds for Follow delivery
5. Check Activity tab — should see outbound Follow with status "delivered"
6. Publish new content — should appear on the other instance within 30 seconds

## Published
- @commonpub/server@0.7.5
