# Session 085 — Federation UX Polish + Mirroring Fix + Cross-Instance Messaging

**Date**: 2026-03-27
**Scope**: @commonpub/server + deveco-io + commonpub reference app

## What Was Done

### Mirroring Fix (Critical)
**Problem**: Creating a mirror only inserted a DB row — no Follow was sent to the remote instance, so content never arrived.

**Fix**: `createMirror()` now:
1. Inserts mirror config as `active` (was `pending`)
2. Sends a Follow activity from local instance actor (`/actor`) to remote instance actor
3. Stores follow relationship for delivery resolution
4. Delivery worker now also delivers to followers of the instance actor (for mirroring)
5. Delivery worker can sign requests as the instance actor (loads keypair from instanceSettings)

### Cross-Instance Direct Messaging
- `resolveRemoteHandle()` — WebFinger resolve for `@user@domain` handles
- `federateDirectMessage()` — creates private AP `Create(Note)` with `to:[recipientActorUri]` (no `#Public`)
- Delivery worker detects DMs (Create with specific `to`, no `#Public` in `to` or `cc`) → delivers to recipient inbox only
- Inbox handler detects inbound private Notes → stores as local messages
- Message input placeholder updated to accept federated handles

### DM Security Fix
- Private Note detection now checks BOTH `to` AND `cc` for `#Public` (was only checking `to`)
- Prevents treating public-via-cc messages as private DMs

### Remote User Profile Pages
- New page at `/federation/users/[handle]` (e.g., `/federation/users/@alice@commonpub.io`)
- Shows avatar, display name, fediverse handle, bio, follower/following counts
- Follow/Unfollow button with pending state
- Lists the user's federated content from timeline

### Federated Notifications
Inbox handlers now create notifications for remote interactions:
- **Follow**: "alice from the fediverse started following you"
- **Like**: "alice from the fediverse liked 'Your Project Title'"
- **Reply**: "alice from the fediverse replied to 'Your Project Title'"
- All non-critical (silently caught if notification creation fails)

### Fediverse Nav Link
- "Fediverse" link added to main nav (desktop + mobile) on both instances
- Gated by `federation` feature flag

### Federated Search Integration
- "Fediverse" pill added to main search type filters
- Searches federated timeline content by title/content/summary
- Links to `/federation/search` for discovering remote users

### Clickable Actors
- Actor names in `FederatedContentCard` link to remote profile pages
- Hover state shows accent color

### Database Migrations
- Ran CREATE TABLE SQL directly on both production databases (commonpub.io + deveco.io)
- Tables created: `federated_content`, `instance_mirrors`, `hub_actor_keypairs`, `hub_followers_fed`
- Columns added: `remote_actors.shared_inbox/summary/banner_url/follower_count/following_count/actor_type`, `follow_relationships.activity_uri`

### Published
- `@commonpub/server@0.7.3`

## How Mirroring Works Now

### Setup (Admin on each instance):

1. **On commonpub.io** — go to Admin → Federation → Mirrors tab
   - Enter `deveco.io` in the domain field
   - Click "Add Mirror"
   - This creates the mirror AND sends a Follow from `commonpub.io/actor` to `deveco.io/actor`

2. **On deveco.io** — the inbox receives the Follow, auto-accepts it
   - deveco.io now knows commonpub.io wants its content
   - The delivery worker will include commonpub.io's inbox when delivering activities

3. **Content published on deveco.io** → delivery worker sends to all followers INCLUDING commonpub.io's instance actor
   - commonpub.io's inbox receives the Create activity
   - `matchMirrorForContent()` matches the active mirror → stores with `mirrorId`
   - Content appears in commonpub.io's federated timeline

4. **To mirror in BOTH directions**: set up mirrors on BOTH instances
   - commonpub.io adds mirror for deveco.io (sends Follow to deveco)
   - deveco.io adds mirror for commonpub.io (sends Follow to commonpub)

### Important Notes:
- **Delete existing mirrors first** — mirrors created before this fix didn't send Follows
- **Wait ~30 seconds** after creating a mirror for the Follow to be delivered
- **Publish new content** after mirrors are established — existing content isn't retroactively mirrored
- Anti-loop protection prevents content from bouncing between instances

## Files Changed

### commonpub
- `packages/server/src/federation/mirroring.ts` — Follow on mirror create
- `packages/server/src/federation/delivery.ts` — instance actor follower delivery, DM detection with cc check, instance actor keypair loading
- `packages/server/src/federation/inboxHandlers.ts` — DM detection cc check, federated notifications (follow/like/reply)
- `packages/server/src/federation/messaging.ts` — NEW: cross-instance DM functions
- `packages/server/src/federation/index.ts` — exports
- `apps/reference/layouts/default.vue` — Fediverse nav link
- `apps/reference/pages/federation/users/[handle].vue` — NEW: remote profile page
- `apps/reference/pages/search.vue` — Fediverse search tab
- `apps/reference/components/FederatedContentCard.vue` — clickable actors

### deveco-io
- `layouts/default.vue` — Fediverse nav link
- `pages/federation/users/[handle].vue` — NEW: remote profile page
- `pages/search.vue` — Fediverse search tab
- `pages/messages/index.vue` — federated handle placeholder
- `components/FederatedContentCard.vue` — clickable actors
- `server/api/admin/federation/mirrors/index.post.ts` — pass localDomain
- `server/api/messages/index.post.ts` — import federated handle helpers

## Test Results
- **@commonpub/server**: 453 tests (452 pass, 1 skip)
