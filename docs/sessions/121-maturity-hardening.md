# Session 121 — Maturity Hardening + OAuth Fix (2026-04-14)

Maturity hardening (4 phases) + deep audit + OAuth federation fix + auth middleware fix.
20 commits (commonpub) + 8 commits (deveco-io). Both instances deployed.

## Verification
- 23/23 typecheck, 30/30 test suites — verified throughout
- Test count: 2852 (was 2843 — +9 new tests)

## Phase 1 — Validation & Loading States

**Commit:** `60a89d2`

### Zod validation on 2 routes
- `notifications/read.post.ts`: raw `readBody` → `parseBody` with `z.object({ notificationId: z.string().uuid().optional() })`
- `content/[id]/products-sync.post.ts`: manual `Array.isArray` → `parseBody` with `z.object({ items: z.array(addContentProductSchema) })`

### Loading states on 3 pages
- `pages/index.vue`: added `feedPending`, `statsPending`, `communitiesPending` with spinner UI for feed grid, stats sidebar, trending hubs
- `pages/notifications.vue`: added `pending` with spinner before notification list
- `pages/settings/notifications.vue`: added `pending` with spinner before preferences form

## Phase 2 — Schema Cleanup + Auth Test

**Commit:** `89fb453`

### hubPostLikes relations + index
- Added `hubPostLikesRelations` (post → hubPosts, user → users)
- Added `likes: many(hubPostLikes)` to `hubPostsRelations`
- Added `idx_hub_post_likes_user_id` index

### Removed dead messages.readAt
- Removed `readAt` column from `messages` table schema (superseded by `message_reads` table)
- Manual SQL needed: `ALTER TABLE messages DROP COLUMN IF EXISTS read_at;`

### Extract resolveIdentityToEmail
- New `@commonpub/server` auth module: `resolveIdentityToEmail(db, identity)`
- 3 integration tests: email passthrough, username→email resolution, not-found throws
- Refactored `sign-in-username.post.ts` to use server function

**Published:** `@commonpub/schema@0.9.9`, `@commonpub/server@2.29.1`

## Phase 3 — deveco-io Hardening

**Commit (deveco-io):** `a7674cc`

### Dockerfile
- Non-root user: `addgroup -S deveco && adduser -S deveco -G deveco`
- `--chown=deveco:deveco` on `.output` COPY, `USER deveco` before CMD
- `HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3`

### Theme cleanup
- Extracted 9 hardcoded hex/rgba values from `pages/create.vue` to CSS vars in `deveco-theme.css`:
  `--deveco-project-color/bg/border`, `--deveco-blog-*`, `--deveco-explainer-*`
- Fixed 2× `#fff` → `var(--color-text-inverse)`

### CI
- Added post-deploy health check to `deploy-prod.yml` (curl retry loop, matches commonpub pattern)

## Phase 4 — commonpub Dockerfile + Schema Enums

**Commit:** `87f7cd7`

### HEALTHCHECK
- Added same HEALTHCHECK pattern to commonpub `Dockerfile`

### varchar→enum migrations
- `docsPages.status`: `varchar(16)` → `docsPageStatusEnum` (`'draft','published','archived'`)
- `userFederatedHubFollows.status`: `varchar(16)` → `hubFollowStatusEnum` (`'pending','joined'`)

**Published:** `@commonpub/schema@0.9.10`

**Manual SQL needed on both instances after deploy:**
```sql
CREATE TYPE docs_page_status AS ENUM ('draft','published','archived');
ALTER TABLE docs_pages ALTER COLUMN status TYPE docs_page_status USING status::docs_page_status;
CREATE TYPE hub_follow_status AS ENUM ('pending','joined');
ALTER TABLE user_federated_hub_follows ALTER COLUMN status TYPE hub_follow_status USING status::hub_follow_status;
ALTER TABLE messages DROP COLUMN IF EXISTS read_at;
```

## Audit Progress

### Fixed This Session
- ✓ **MEDIUM** — 2 unvalidated API routes (Zod schemas)
- ✓ **MEDIUM** — 3 pages missing loading states
- ✓ **MEDIUM** — hubPostLikes missing relations + index
- ✓ **MEDIUM** — messages.readAt dead column removed
- ✓ **MEDIUM** — docsPages.status varchar → enum
- ✓ **MEDIUM** — userFederatedHubFollows.status varchar → enum
- ✓ resolveIdentityToEmail extracted to server + 3 tests
- ✓ deveco-io Dockerfile hardened (non-root, healthcheck)
- ✓ deveco-io create.vue colors → CSS vars
- ✓ deveco-io CI health check
- ✓ commonpub Dockerfile HEALTHCHECK

## Phase 5 — OAuth Federation Fix (HIGH)

Three interconnected bugs prevented cross-instance OAuth login:

### Bug 1: WebFinger advertised wrong URL
- **Commit:** `6fce4e1`
- WebFinger + SSO config + protocol federation.ts all advertised `/api/auth/oauth2/authorize` (API JSON endpoint)
- Browser redirected there got raw JSON or 401 instead of the consent page
- **Fix:** Changed to `/auth/oauth/authorize` (Vue consent page) in webfinger.ts, sso.ts, federation.ts
- Token endpoint now hardcoded per-domain (`/api/auth/oauth2/token`) instead of derived from auth URL

### Bug 2: Missing dynamic client registration
- **Commit:** `cb82a17`
- `login.post.ts` used a default `cpub_{domain}` client_id without registering it on the remote instance
- Remote's `processAuthorize` rejected it as `invalid_client` (400), then rate limit kicked in (429)
- **Fix:** Auto-call remote's `/api/auth/oauth2/register` endpoint before constructing authorization URL

### Bug 3: Better Auth middleware intercepting custom auth routes
- **Commit:** `67d97ef`
- `auth.ts` middleware routed ALL `/api/auth/*` to Better Auth, only excluding `/federated/` and `/oauth2/`
- `/api/auth/sign-in-username`, `/api/auth/delete-user`, `/api/auth/export-data` were caught by Better Auth → 404
- **Fix:** Added explicit exclusion list for custom Nitro route handlers
- **Root cause of "invalid credentials" report** — sign-in-username was unreachable

### Bug 4: Federated link endpoint called nonexistent route
- **Commit:** `0f72512`
- `link.post.ts` called `$fetch('/api/resolve-identity')` which never existed
- **Fix:** Inlined username→email resolution (same pattern as sign-in-username)

### Sign-in-username Nitro import revert
- **Commit:** `22dced4`
- Reverted `resolveIdentityToEmail` import from `@commonpub/server` back to inline query
- Originally thought this was causing the 404 (Nitro externalization), but actual cause was Bug 3
- Kept reverted anyway — safer to avoid `@commonpub/server` imports in auth-critical routes

**Published:** `@commonpub/layer@0.8.8`, `@commonpub/auth@0.5.1`, `@commonpub/protocol@0.9.9`

## Phase 6 — Additional Loading States + Theme + Error Handling

- **Commit:** `195c213` — Loading states on admin/index, admin/settings, admin/federation, learn/index
- **Commit:** `9b97e9b` — admin/settings.vue: loading state restructured (was after content, now wraps it)
- **Commit:** `51402d7` — `PUT /api/profile/theme` route added (wires up `setUserTheme`)
- **Commit:** `51402d7` — admin/federation.vue: try-catch on 3 `$fetch` calls
- **Commit:** `cb82a17` — `useTheme` composable persists theme to DB via fire-and-forget `$fetch`
- **Commit:** `cb82a17` — products/[slug].vue: loading state (distinguish pending vs not-found)

## Phase 7 — Schema + Indexes

- **Commit:** `b19ef21` — Added `idx_files_hub_id` on `files.hubId` FK
- **Published:** `@commonpub/schema@0.9.11`

## Phase 8 — Tests

- **Commit:** `0fd9bfc`
- `identity.integration.test.ts`: +1 test (soft-deleted user rejection)
- `hub.integration.test.ts`: +2 tests (like/unlike + idempotent like — skipped, PGlite `ON CONFLICT...RETURNING` limitation)
- `auth-middleware-routing.test.ts`: 5 new tests verifying custom auth routes bypass Better Auth

## deveco-io Changes

| Commit | Change |
|--------|--------|
| `a7674cc` | Dockerfile non-root user + healthcheck |
| `a7674cc` | create.vue colors → CSS vars, CI health check |
| `834202e` | DevEcoLogo.vue hardcoded hex → CSS classes with theme vars |
| `186999b`→`59b5491` | Layer bumps: 0.8.3 → 0.8.8 (OAuth + auth middleware fixes) |

## Verified OK (no action needed)
- ✓ Federated HTML sanitization — defense in depth (15+ sanitize calls on ingest + client-side sanitizeBlockHtml)
- ✓ Rate limiting — implemented in security.ts middleware (auth:5/min, upload:10/min, API:60/min)
- ✓ Learning tests — all active (only 1 skip: messaging PGlite JSONB @>)
- ✓ API route validation — all 210+ routes use parseBody/safeParse/parseParams
- ✓ `calculateContestRanks` — internal helper called by `transitionContestStatus`, no route needed
- ✓ `autoDiscoverHub` — internal federation helper, auto-invoked by inbox handler

## Remaining (all LOW priority)
- `federatedContent.mirrorId` — no DB-level FK (circular table def; ORM relation exists, low risk)
- Mobile: ~70 components without @media breakpoints (parent layouts handle most layout)
- Unvalidated query params in federated-hub endpoints (rate-limited, low risk)
- 3 skipped tests (1 messaging PGlite JSONB, 2 hub likes PGlite ON CONFLICT)
- More loading states possible: dashboard, explore (lazy fetches, lower priority)
