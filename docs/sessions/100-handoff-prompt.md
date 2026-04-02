# Session 100 Handoff Prompt

Copy everything below the line into your next session prompt.

---

This is CommonPub session 100.

IMPORTANT: Never add Claude as co-author in git commits. No Co-Authored-By lines.

## Context

Read these files FIRST:
- CLAUDE.md at the monorepo root
- Memory file MEMORY.md — has full state from sessions 098-099
- `docs/federation-interop-audit.md` — comprehensive gap analysis (Phases A-D done, Phase E partial)
- `docs/sessions/099-federation-interop-fixes.md` — what session 099 did

## Repos
- **commonpub monorepo**: `/Users/obsidian/Projects/ossuary-projects/commonpub/`
- **deveco-io**: `/Users/obsidian/Projects/ossuary-projects/deveco-io/`

## What session 099 completed

### Federation Interop (Phases A-D + partial Phase E)
- Fork/build/bookmark work for federated content (functional, not disabled)
- Author links route to remote actor profiles, clickable tags across all views
- Local notification triggers for toggleLike/createComment/followUser
- Federated comment replies + "reply sent" confirmation
- Follow button on mirror pages + RemoteFollowDialog for cross-instance joining
- Federated search upgraded from ILIKE to Postgres FTS
- Hub post type preservation (cpub:postType outbound + inbound)
- Federated hub members list with @user@domain handles
- Unread message badge on envelope icon (SSE + composable)
- Remote author profile enrichment (bio, follower count)
- View tracking for federated content
- Federated bookmark listing (dual LEFT JOIN, dashboard links)
- RSS for federated hubs
- Federation pages made public (no auth wall)
- "Following" badge → "Mirrored" indicator on federated hubs
- XSS fix: remote actor bio rendered as text not v-html
- Typecheck fixes (RemoteFollowDialog refs, message POST routes)

### Infrastructure
- Dockerfile fixed to include drizzle-kit in production container
- Deploy workflows improved to surface drizzle-kit push errors
- CRITICAL: drizzle-kit push is unreliable in CI. ALWAYS apply new schema changes via manual SQL on BOTH instances when adding columns/tables.
- Published: schema@0.8.10, server@2.10.0, layer@0.3.12

## What needs doing — Priority Order

### P0 — BUGS: Fix before anything else

#### 1. Hub federation broken — new hubs not showing on commonpub.io
New hubs created on deveco.io are NOT appearing on commonpub.io even after backfill. Investigate:
- Check `onAnnounce` handler in `inboxHandlers.ts` — does it handle hub Group actor discovery for new hubs?
- Check `autoDiscoverHub` in `hubMirroring.ts` — is it creating entries for new hubs?
- Check `backfillFromOutbox` — does it fetch hub Group actors or only content?
- Look at the actual backfill errors: "0 items, 56 errors, 4 pages" on commonpub.io admin federation page
- SSH into commonpub.io and check docker logs for specific error messages
- The deveco.io→commonpub.io mirror is "ACTIVE" with 523 items but new hubs aren't coming through
- Verify the hub follow/accept flow is working correctly between instances

#### 2. Cover images not showing on blog posts (and potentially other content types)
Blog posts on deveco.io show cover images locally but they may not render on federated mirrors. Investigate:
- How cover images are extracted from the AP Article object in `inboxHandlers.ts` onCreate
- Check if `coverImageUrl` is populated for all content types (blog, article, explainer) not just project
- Verify `useMirrorContent.ts` passes `coverImageUrl` correctly
- Check if the image URL is accessible from the remote instance (CORS, CDN paths)

#### 3. Audit ALL aspects of hub federation
Systematically verify that every hub feature federates correctly:
- Hub creation → Group actor published?
- Hub metadata (name, description, icon, banner, rules, categories) → synced?
- Hub posts (text, discussion, question, showcase, share, announcement) → all types federate?
- Hub post edits → Update activity sent/received?
- Hub post deletes → Delete activity sent/received?
- Hub post likes → Like activity sent/received?
- Hub post replies → Note with inReplyTo sent/received?
- Hub membership changes → not federated (by design), but follower count should update
- New hubs added after initial mirror → auto-discovered?

### P1 — Remaining Phase E items

- [ ] 2.6 Share federated content to local hub — share endpoint only accepts local contentId
- [ ] 2.8 Render attachments on federated content — stored in JSONB, never rendered
- [ ] 2.12 DM initiation to remote users — messaging infra exists, no UI entry point

### P2 — OAuth cross-instance SSO UI

Backend is fully built (`packages/server/src/federation/oauth.ts`):
- processAuthorize, processTokenExchange, processDynamicRegistration all implemented
- API endpoints exist: GET/POST authorize, POST token, POST register
- Schema ready: oauthClients, oauthCodes, federatedAccounts
- WebFinger includes oauthEndpoint in response

What's missing (UI only):
- Consent page: `pages/auth/oauth/authorize.vue` — "Instance X wants to access your account. Allow?"
- Login flow: "Sign in with another instance" on login page → WebFinger → dynamic register → redirect → callback
- Callback handler: `/api/auth/oauth2/callback` — consume state, exchange code, link/create account, establish session
- Admin page: show registered OAuth clients

### P3 — Polish

- Merge notification + message SSE into single stream (currently two SSE connections per user)
- Blog author card formatting on deveco.io (pre-existing — "POSTED BY" card has visible borders around each field)
- CLI: bump to v0.5.1 and republish binary after template version update

## Key facts
- CSS theming: `--border-width-default` (2px base, 1px deveco), `--radius` (0px base, 6px deveco)
- Semver: `^0.x` treats minor as breaking — `^0.3.0` does NOT match `0.4.0`
- Nitro dedup: `server/utils/config.ts` MUST live in the app, not the layer
- Federation: content sanitized on ingest, useSanitize is pass-through. Actor summaries NOT sanitized — render as text only.
- Always use `pnpm publish --no-git-checks`, never `npm publish`
- ALWAYS apply schema changes via manual SQL on BOTH instances:
  - commonpub.io: `ssh root@commonpub.io "cd /opt/commonpub && docker compose -f docker-compose.prod.yml exec -T postgres psql -U commonpub -d commonpub -c '<SQL>'"`
  - deveco.io: `ssh root@deveco.io` then use NUXT_DATABASE_URL from `/opt/deveco/.env` with psql (managed Postgres, no local container)
- CLI refederation: `curl -X POST https://<domain>/api/admin/federation/refederate -H 'x-admin-secret: <AUTH_SECRET>' -d '{}'`
- deveco.io docker compose at `/opt/deveco/docker-compose.yml`
- commonpub.io docker compose at `/opt/commonpub/docker-compose.prod.yml`
- RemoteFollowDialog uses `authorize_interaction` (works for Mastodon/Pleroma, not Lemmy/Misskey/other CP instances)
- Notification triggers: toggleLike/createComment/followUser each do 2 extra DB queries (non-critical, try/catch)
- federatedContentBuilds is separate table from contentBuilds (avoids FK migration)
- bookmarks table is polymorphic (no FK on targetId) — federated UUIDs work directly
- listUserBookmarks dual LEFT JOINs contentItems + federatedContent with COALESCE

## After completing work
- Update `docs/federation-interop-audit.md` — check off completed items
- Bump versions and publish with `pnpm publish --no-git-checks`
- Apply any new schema SQL manually on BOTH production instances
- Update deveco-io package.json + lockfile if layer version bumped
- Push both repos to trigger auto-deploy
- Run typecheck on deveco-io: `cd deveco-io && npx nuxi typecheck`
- Verify on deployed instances
- Write session log at `docs/sessions/100-*.md`
