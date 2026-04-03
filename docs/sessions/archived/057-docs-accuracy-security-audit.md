# Session 057: Documentation Accuracy Sweep + Security Audit

## Scope

Full documentation audit of every markdown file in the project, followed by a deep security audit of the server, API routes, infra, schema, editor, and frontend packages. Then fixed three remaining issues from the audit backlog.

## Documentation Fixes (19 files touched)

### New files created
- `packages/infra/README.md` -- full README for the previously undocumented `@commonpub/infra` package
- `docs/reference/packages/infra.md` -- API reference for storage, image, email, and security modules

### Structural inaccuracies fixed
- **CLAUDE.md** -- added missing `infra` package to Architecture table
- **README.md** -- added `infra` to architecture tree and package docs table; removed broken link to nonexistent `apps/reference/README.md`; fixed `docs/plan.md` link to `docs/plan-v2.md`; fixed "26 ADRs" to "25 ADRs"; fixed "13 packages" to "12 packages"
- **packages/schema/README.md** -- fixed `community` module to `hub`; replaced stale table names with current ones; removed `guide` from contentTypeEnum; added missing tables (contentVersions, contentBuilds, conversations, messages, products, contentProducts, videoCategories, docsNav)
- **packages/server/README.md** -- fixed `community` to `hub` in modules table
- **packages/config/README.md** -- fixed `communities: true` to `hubs: true`; fixed `contentTypes` to remove `guide` and add `explainer`; fixed `video` default from `false` to `true`; added missing `video` and `contests` flags to example

### Stale counts fixed
- **docs/architecture.md** -- tables 20 to 53, pages 47 to 61, components 79+ to 85+, composables 8 to 9, API routes 97 to 142, server files 41 to 36, UI components 24 to 22, editor blocks 19 to 20, feature flags 11 to 10. Added 15 missing pages to Page Map.
- **docs/reference/index.md** -- table count 52 to 53, page count 48 to 61, API count 144 to 142
- **docs/reference/guides/routing.md** -- page count 50 to 61, API count 120+ to 142, added 12 missing page routes
- **docs/reference/guides/v1-limitations.md** -- test count 118 to 880+, removed broken `docs/launch-checklist.md` link

### Other fixes
- **docs/a11y-audit.md** -- "Standing Rule 8" corrected to "Standing Rule 12"
- **docs/deployment.md** -- `deploy/Dockerfile` path corrected to `Dockerfile` (root)
- **docs/quickstart.md** -- "13 packages" corrected to "12 packages plus the reference app"
- **docs/reference/architecture.md** -- removed nonexistent `apps/landing`, added `@commonpub/server` and `@commonpub/infra` to Mermaid dependency graph, fixed "Community Membership" to "Hub Membership"
- **docs/reference/server/overview.md** -- "community modules" corrected to "hub modules"
- **CHANGELOG.md** -- annotated Phases 3, 4, 5 with notes about the Svelte-to-Vue 3 framework switch

## Security Audit Findings + Fixes

### Fixed (8 issues)

1. **sendMessage missing participant check (Critical)** -- `packages/server/src/messaging/messaging.ts`. Any authenticated user could send messages to any conversation. Fixed by adding participant verification before insert.

2. **joinHub invite token cross-hub exploit (Critical)** -- `packages/server/src/hub/hub.ts`. A valid invite token for Hub A could be used to join Hub B because `validateAndUseInvite()` returned the hubId but `joinHub()` never verified it matched. Fixed by adding `tokenResult.hubId !== hubId` check.

3. **listBans/listInvites missing authorization (High)** -- `apps/reference/server/api/hubs/[slug]/bans.get.ts` and `invites.get.ts`. Any authenticated user could view any hub's ban list and invite list. Fixed by adding `getMember` check requiring moderator/admin/owner role. Also fixed stale "Community not found" error messages.

4. **listContent no visibility filter (High)** -- Published content with `visibility: 'private'` or `visibility: 'members'` appeared in public listing results. Fixed by adding `visibility` to `ContentFilters` schema and filtering to `public` in the API route for non-authors.

5. **Email template HTML injection (Medium)** -- `packages/infra/src/email.ts`. Parameters like `siteName`, `contestTitle`, `username`, and URLs were interpolated directly into HTML templates without escaping. Fixed by adding `escapeHtml()` and applying it to all user-controlled template parameters.

6. **processImage() no MIME validation (Medium)** -- `packages/infra/src/image.ts`. Accepted any buffer without checking if it was actually an image. Fixed by adding optional `mimeType` param that rejects non-image types, plus a try/catch around `sharp().metadata()` to catch corrupt buffers. Upload route now passes `mimeType` through.

7. **Rate limiting IP-only (Medium)** -- `packages/infra/src/security.ts`. Authenticated users on shared IPs could be blocked by other users' traffic. Fixed by adding optional `userId` param to `checkRateLimit()`. When present, the rate limit key is `user:{id}:{route}` instead of `ip:{addr}:{route}`. Security middleware now passes `event.context.auth?.user?.id`.

8. **Auto-save race condition (Medium)** -- `apps/reference/pages/[type]/[slug]/edit.vue`. Manual save (Save Draft, Publish, Ctrl+S) could overlap with a pending auto-save setTimeout. Fixed by canceling any pending auto-save timer at the start of `handleSave()`, `handlePublish()`, and the Ctrl+S handler.

## Verification

- `pnpm --filter @commonpub/infra typecheck` -- 0 errors
- `pnpm --filter @commonpub/infra build` -- clean
- `pnpm --filter @commonpub/schema typecheck` -- 0 errors
- `pnpm --filter @commonpub/schema test` -- 74 passed
- `pnpm --filter @commonpub/server typecheck` -- 0 errors
- `pnpm --filter @commonpub/server test` -- 175 passed, 5 skipped
- `pnpm --filter @commonpub/editor test` -- 69 passed

## Remaining items (low priority)

- View tracking dedup uses in-memory Map with an interval that never clears on shutdown (only matters for serverless, not the standard Nitro deployment)
- Several API routes define Zod schemas locally instead of importing from `@commonpub/schema` (cosmetic consistency, not a bug)
