# Session 087 — Federation Deep Audit + Infrastructure Fixes

**Date**: 2026-03-28
**Scope**: commonpub monorepo + deveco-io + production infrastructure

## Context

Federation code was "complete" per session 086 but had never been verified working in production. User reported mirroring didn't work across three previous attempts. This session performed a complete ground-up audit of both repos, both deployed instances, and all federation code paths.

## Methodology

1. Identified correct repos (stale copies exist at `/Users/obsidian/Projects/commonpub/` and `/Users/obsidian/Projects/deveco/deveco-io/` — IGNORE these)
2. Verified npm packages published and installed at correct versions
3. Verified code is real implementations (not stubs) by reading every federation function
4. Used doctl + SSH to inspect both production droplets
5. Curled all federation endpoints on both live instances
6. Queried both production databases directly
7. Deep code audit of delivery, inbox, signing, sanitization, and content mapping

## Infrastructure Findings

### doctl Auth Contexts
- `default` — personal account, commonpub-prod droplet at 161.35.6.228
- `deveco-prod` — team account, deveco-app droplet at 104.236.69.120
- SSH works with default key (`~/.ssh/id_ed25519`)

### Production State (Pre-Fix)
- **Both instances**: Feature flags enabled (`FEATURE_FEDERATION=true`)
- **Both instances**: All federation tables present
- **commonpub.io**: 5 pending activities, ALL with 0 delivery attempts
- **deveco.io**: 32 pending activities, ALL with 0 delivery attempts
- **deveco.io**: `federated_content.remote_actor_id` column MISSING (drizzle-kit push blocked by interactive TTY prompt)
- **deveco.io**: `hub_actor_keypairs` and `hub_followers_fed` tables MISSING
- **Both**: Delivery worker NEVER started — zero `[federation]` log lines

## Root Causes

### Root Cause 1: Delivery Worker Never Starts (CRITICAL)
`nitro.hooks.hook('ready', ...)` is a **build-time hook** in Nitro — it does NOT fire at runtime. Both instances had delivery worker plugins that registered a hook that never executed. Result: 37 total activities queued across both instances with 0 delivery attempts.

**Fix**: Replaced with `setTimeout(5000)` in plugin body. Nitro plugins run at server bootstrap, so the interval starts after a 5-second delay for DB pool initialization. Also runs one delivery cycle immediately on startup to flush pending activities.

### Root Cause 2: deveco.io Schema Drift (HIGH)
drizzle-kit push was silently failing on deveco.io because it wanted to add a `content_builds_user_content` unique constraint that required an interactive TTY prompt. The `--force` flag doesn't bypass this specific prompt in drizzle-kit 0.31.10. The `|| echo "db:push completed"` in the deploy script hid the failure.

**Fix**: Applied missing schema changes directly via SQL (node + pg):
- Added `remote_actor_id` column to `federated_content`
- Created `hub_actor_keypairs` and `hub_followers_fed` tables
- Added missing columns to `remote_actors` (shared_inbox, summary, banner_url, follower_count, following_count, actor_type)
- Added `activity_uri` to `follow_relationships`

### Root Cause 3: Missing Instance Actor Collection Routes (MEDIUM)
Instance actor at `/actor` advertised `outbox`, `followers`, `following` URLs but no route handlers existed. Requests fell through to Nuxt page handler → HTML response.

**Fix**: Created `server/routes/actor/outbox.ts`, `server/routes/actor/followers.ts`, `server/routes/actor/following.ts` on both repos. Return OrderedCollection JSON-LD.

## All Fixes Applied

| Fix | Files Changed | Both Repos |
|-----|---------------|-----------|
| Delivery worker startup (setTimeout vs broken hook) | `server/plugins/federation-delivery.ts` | Yes |
| Instance actor collection routes | `server/routes/actor/{outbox,followers,following}.ts` | Yes |
| WebFinger CORS header | `server/routes/.well-known/webfinger.ts` | Yes |
| WebFinger OAuth endpoint on instance actor | `server/routes/.well-known/webfinger.ts` | Yes |
| deveco.io DB schema (via SSH/SQL) | Production database | deveco only |
| Reset stuck activities (via SSH/SQL) | Production database | Both |

## Post-Deploy Verification

### Delivery Worker — WORKING
- commonpub.io: `[federation] Activity delivery worker started (domain: commonpub.io)` — 5 delivered, 0 failed
- deveco.io: `[federation] Activity delivery worker started (domain: deveco.io)` — 35 delivered, 0 failed

### Follow Relationships — ALL ACCEPTED
| Follower | Following | Status |
|----------|-----------|--------|
| commonpub.io/actor | deveco.io/actor | **accepted** |
| deveco.io/actor | commonpub.io/actor | **accepted** |
| deveco.io/users/moheeb_deveco | commonpub.io/users/moheeb | **accepted** |

### Endpoint Tests
- `GET /actor` → valid Service JSON-LD (both)
- `GET /actor/followers` → OrderedCollection (deveco shows commonpub as follower)
- `GET /actor/following` → OrderedCollection
- `GET /actor/outbox` → OrderedCollection
- `GET /.well-known/webfinger` → CORS header + OAuth link present
- `GET /nodeinfo/2.1` → valid stats
- `GET /users/moheeb` → valid Person (commonpub), 404 (deveco — user is `moheeb_deveco`)
- Federation timeline → 401 (auth required, no longer crashing)

## Deep Code Audit Findings

Full audit documented at `/Users/obsidian/Projects/ossuary-projects/federation-audit/09-DEEP-AUDIT.md`.

### Critical Security Issues (5)
1. **Signature verification not enforced** on shared/user inboxes (hub inbox correctly blocks)
2. **No actor domain validation** against keyId (spoofing possible)
3. **Partial delivery marked complete** (failed inboxes silently lost)
4. **Activities permanently dead after 6 failures** (no recovery)
5. **onDelete has no authorization** (any actor can delete any content)

### High Severity Issues (8)
- No body size limit, no rate limiting, no Date header freshness check
- Like counts not idempotent, sendFollow swallows errors
- No redirect limit in actor resolution, content always public, no hashtag export

### Medium Severity Issues (9+)
- No activity deduplication, no table cleanup, onUndo(Follow) fallback wrong
- Race condition in onFollow, only 1/7 users has keypair, no fetch timeout

## Commits

- commonpub: `1868693` fix(federation): delivery worker startup, instance actor collections, WebFinger CORS
- deveco-io: `76bb7f7` fix(federation): delivery worker startup, instance actor collections, WebFinger CORS

## Tracking Folder

`/Users/obsidian/Projects/ossuary-projects/federation-audit/` — 9 files:
- `00-STATUS.md` — repo map and npm versions
- `01-ARCHITECTURE.md` — code location map
- `02-WHAT-WORKS-VS-BROKEN.md` — verified code vs infrastructure gaps
- `03-ACTIVITYPUB-REQUIREMENTS.md` — AP compliance check
- `04-FIX-PLAN.md` — phased approach
- `05-FLOW-DIAGRAMS.md` — federation flow diagrams with failure points
- `06-LIVE-TEST-RESULTS.md` — curl test results
- `07-PRIORITIZED-TODO.md` — ordered fix list
- `08-FIXES-APPLIED.md` — what was fixed and verified
- `09-DEEP-AUDIT.md` — full security + reliability audit

## Phase A: Security Hardening (Same Session)

### Applied
1. **Enforce signature verification** on all inboxes — was warn-only on shared/user, now 401 (matching hub inbox)
2. **Actor domain validation** — keyId domain must match resolved actor.id domain
3. **Date header freshness** — reject signatures with Date header >5 min from server time
4. **Body size limits** — 1 MB in Caddy config + route-level check
5. **Authorize Delete** — only original author (actorUri matches) can soft-delete content
6. **Shared verifyInboxRequest()** utility — DRYs all 3 inbox routes

### Published
- `@commonpub/server@0.7.7` — contains onDelete authorization fix
- deveco-io updated to consume 0.7.7
- Note: 0.7.6 was unpublished (had unresolved `workspace:*` deps — must use `pnpm publish`, not `npm publish`)

### Commits
- commonpub: `7045b1f` fix(federation): enforce signature verification, domain validation, body limits
- commonpub: `6b32a1d` chore: publish @commonpub/server@0.7.7
- deveco-io: `6459dc6` fix(federation): enforce signature verification, domain validation, body limits
- deveco-io: `e7bbc48` chore: update @commonpub/server to 0.7.7

### Verified Post-Deploy
- Both delivery workers restarted and running
- Actor endpoints responding correctly
- Followers still visible (data intact)

## Next Steps (Phase B: Reliability)

1. Per-inbox delivery tracking (don't mark partial delivery as complete)
2. Admin retry for failed activities
3. Handle actor resolution failures in sendFollow
4. Activity deduplication (check activity.id before processing)
5. Fix onFollow race condition (onConflictDoUpdate)
6. Fix onUndo(Follow) fallback
7. Idempotent like tracking (per-actor-per-content)
8. Eager keypair generation for all users
9. Add User-Agent header + fetch timeout on outbound requests
10. Redirect limit on actor resolution
