# Session 099 Handoff Prompt

Copy everything below the line into your next session prompt.

---

This is CommonPub session 099.

IMPORTANT: Never add Claude as co-author in git commits. No Co-Authored-By lines.

## Context

Read these files FIRST:
- CLAUDE.md at the monorepo root
- Memory file MEMORY.md — has full state from session 098
- `docs/federation-interop-audit.md` — the comprehensive gap analysis (this is the work)

## Repos
- **commonpub monorepo**: `/Users/obsidian/Projects/ossuary-projects/commonpub/`
- **deveco-io**: `/Users/obsidian/Projects/ossuary-projects/deveco-io/`

## What session 098 completed
- Verified SSR fix deployed on both deveco.io and commonpub.io (200, full renders)
- Removed isomorphic-dompurify from @commonpub/docs, published docs@0.5.2
- Converted drizzle.config.ts to .js for production containers (Alpine runtime can't compile TS)
- Updated CLI template versions (@commonpub/layer ^0.2.0 → ^0.3.0)
- Removed macOS from CI matrix (build was skipped, Postgres unavailable)
- Added x-admin-secret header to refederate endpoint for CLI automation
- Triggered refederation on deveco.io: 3 projects + 3 hubs + 2 hub posts, cpub:blocks confirmed on commonpub.io
- Published layer@0.3.7, docs@0.5.2 (deprecated 0.5.1, 0.3.5, 0.3.6 — broken workspace refs)
- Comprehensive federation interoperability audit stored in `docs/federation-interop-audit.md`

## What needs doing

The full gap analysis is in `docs/federation-interop-audit.md`. Work through the phases in order:

### Phase A — Fix broken buttons (HIGHEST PRIORITY)
These are things that visibly crash or mislead users right now:

1. **Fork button crashes on federated content** — ProjectView.vue:258. Calls `/api/content/${id}/fork` with federated UUID. Either disable for federated or build fork-from-blocks.
2. **"I Built This" crashes on federated content** — ProjectView.vue:274. Same pattern. Disable for federated.
3. **Bookmark silently no-ops** — useEngagement.ts:133. Button renders but `return` on federated. Either support or hide.
4. **Author link 404s** — ProjectView.vue:329. Links to `/u/${username}` which is local. Route to `/federation/users/${handle}` for federated.
5. **onUpdate missing cpubMetadata/cpubBlocks/tags** — inboxHandlers.ts:585-629. The Update handler updates title/content/summary but NOT cpubMetadata, cpubBlocks, or tags. Add them.
6. **ExplainerView missing like** — ExplainerView.vue:83. Only has bookmark/share, no toggleLike.
7. **Tags not clickable** on mirror page — spans instead of NuxtLinks.

### Phase B — Wire local notifications
- `createNotification()` is never called from local social actions (toggleLike, createComment, followUser in packages/server/src/social/)
- Notification infrastructure is complete (schema, API, SSE, composable) — only trigger calls missing
- This affects ALL users, not just federation

### Phase C — Comment visibility on federated content
- CommentSection.vue skips comment fetch for federated content (line 38)
- User can reply (sends AP Note) but never sees replies
- Phase 1: Show "Reply sent to origin" confirmation
- Phase 2: Fetch replies from remote or show from local activity log

### Phase D — Federation depth
- "Follow remote author" button on mirror pages
- Index federated content in Meilisearch on ingest
- Fork federated content (create local draft from cpubBlocks)
- Hub post type preservation (cpub:postType extension)

## Key facts
- CSS theming: `--border-width-default` (2px base, 1px deveco), `--radius` (0px base, 6px deveco)
- Semver: `^0.x` treats minor as breaking — `^0.3.0` does NOT match `0.4.0`
- Nitro dedup: `server/utils/config.ts` MUST live in the app, not the layer
- Federation: content is sanitized on ingest, useSanitize is now pass-through
- Always use `pnpm publish --no-git-checks`, never `npm publish` (workspace:* resolution)
- Manual SQL for schema changes on prod: `docker compose exec -T postgres psql` on commonpub.io
- CLI refederation: `curl -X POST https://<domain>/api/admin/federation/refederate -H 'x-admin-secret: <SECRET>' -d '{}'`
- deveco.io docker compose is at `/opt/deveco/docker-compose.yml` (not docker-compose.prod.yml)
- commonpub.io docker compose is at `/opt/commonpub/docker-compose.prod.yml`

## After completing work
- Update `docs/federation-interop-audit.md` — check off completed items
- Bump layer version and publish with `pnpm publish --no-git-checks` if layer files changed
- Update deveco-io package.json + lockfile if layer version bumped
- Push both repos to trigger auto-deploy
- Verify on deployed instances
- Write session log at `docs/sessions/099-*.md`
