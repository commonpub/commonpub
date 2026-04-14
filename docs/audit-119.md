# Full Codebase Audit — Session 119 (2026-04-14)

Comprehensive audit of all surfaces: API routes, schema, frontend, packages, deployment.

## Issues Fixed in This Session

### CRITICAL — Fixed

| Issue | Fix | Commit |
|-------|-----|--------|
| `/api/resolve-identity` exposed user emails unauthenticated | Replaced with `/api/auth/sign-in-username` — server-side resolution, email never sent to client | `92f7aff` |
| Client-side `sanitizeBlockHtml` was a no-op passthrough | Real allowlist-based sanitizer, 24 XSS tests | `108a9a3` |
| Raw SQL template literals in 5 API routes | Replaced with Drizzle `inArray`/`eq`/`desc` | `374e5cc` |

### HIGH — Fixed

| Issue | Fix | Commit |
|-------|-----|--------|
| Group chat read receipts broken for 3+ participants | `message_reads` table with per-participant tracking | `ad9aa4b` |
| Admin routes with unvalidated input (retry, refederate, content patch, backfill) | Added Zod schemas and `parseParams` UUID validation | `92f7aff` |
| Unsigned outbox backfill fetches | `signedGet` with instance keypair, graceful fallback | `bb8358f` |
| Missing `idx_bookmarks_user_id` — full table scan on "my bookmarks" | Added index | `cb8a826` |
| Missing `idx_lesson_progress_user_id` — full table scan on "my progress" | Added index | `cb8a826` |

### MEDIUM — Fixed

| Issue | Fix | Commit |
|-------|-----|--------|
| 50 vanity tests inflating test count | Deleted boilerplate, consolidated barrel-export test | `2baa2f0` |
| 20+ hardcoded hex in BlockCodeView syntax highlighting | 14 `--hljs-*`/`--code-*` CSS tokens | `0f2b900` |
| Hardcoded `#a0724a` bronze color in 4 contest files | `--gold`/`--silver`/`--bronze` tokens | `e15c5ce` |
| `#fff` in ContentCard, ImageUpload, BlogEditor, admin/theme | `var(--color-text-inverse)` | `e15c5ce`, `65a2e7e` |
| Docs editor version switching broken | `selectedVersionId` computed, version in create/reorder | `6b669a5` |

---

## Issues Documented (Not Fixed — Future Work)

### HIGH — Feature Flag Bypass

Pages accessible by direct URL without checking `features.*` config:
- `pages/videos/` — no `features.video` guard (nav correctly gates, but URL access bypasses)
- `pages/learn/` — no `features.learning` guard
- `pages/docs/` — no `features.docs` guard
- `pages/contests/` — no `features.contests` guard (except `contests/index.vue`)

**Fix**: Add `definePageMeta({ middleware: 'feature-video' })` (or equivalent) to each page group. Create a dynamic feature-gate middleware.

### HIGH — Architecture Violations (Business Logic in Routes)

Routes with inline DB queries that should delegate to `@commonpub/server`:
- `/api/federation/hub-post-like.post.ts` — 80+ lines of like/unlike logic + AP activity construction
- `/api/federation/hub-follow.post.ts` — direct `db.insert` on `userFederatedHubFollows`
- `/api/federation/hub-follow-status.get.ts` — direct `db.select`
- `/api/federation/hub-post-likes.get.ts` — direct `db.select` with `inArray`
- `/api/docs/migrate-content.post.ts` — entire migration loop inline, manual role check
- `/api/admin/federation/repair-types.post.ts` — fetch loop + `db.update` inline

### MEDIUM — Accessibility

- Nav dropdown buttons (`layouts/default.vue:88,100,111,121`) missing `aria-expanded` and `aria-haspopup="true"`
- `ShareToHubModal.vue:41` close button missing `aria-label`
- `ExplainerEditor.vue:322–353` property panel inputs lack `for`/`id` label association

### MEDIUM — Error States

Pages with `useFetch` calls but no `pending`/`error` handling:
- `pages/[type]/index.vue` — blank page on network failure
- `pages/settings/notifications.vue`, `pages/hubs/index.vue`, `pages/notifications.vue`
- `pages/tags/index.vue`, `pages/tags/[slug].vue`
- `pages/admin/audit.vue`, `pages/admin/theme.vue`
- `pages/u/[username]/[type]/[slug]/edit.vue`

### MEDIUM — Schema Issues

- `federatedContent.mirrorId` has no FK constraint (should reference `instanceMirrors.id`)
- `docsPages.status` is raw varchar, should use `contentStatusEnum` or a new pgEnum
- `messages.readAt` column now unused (superseded by `message_reads` table) — leave for now, drop in future migration
- `messageReads` has no primary key (uses unique constraint instead)
- `messageReads` has no relations definition
- `hubPostLikes` has no relations definition
- `changeRoleSchema` omits `'owner'` from allowed roles
- `userFederatedHubFollows.status` is raw varchar, not pgEnum

### MEDIUM — Missing API Routes

Server functions exported but no corresponding route:
- `calculateContestRanks` — no admin route to trigger
- `setUserTheme` — no profile/theme PUT route
- `autoDiscoverHub` — no admin route
- `refreshFederatedHubMetadata` — no admin route
- `cleanupDeliveredActivities` — no admin/cron route
- `getDeliveryHealth`/`isCircuitOpen` — no admin dashboard route

### MEDIUM — Mobile Responsiveness

70 of 169 components have no `@media` breakpoints. Key gaps:
- `CommentSection.vue`, `ContentPicker.vue`, `MessageThread.vue`
- `HubFeed.vue`, `HubMembers.vue`, `HubProducts.vue`

### LOW — Unvalidated Query Params

- `/api/federated-hubs/[id]/posts.get.ts` — raw `Number(query.limit)`, no bounds
- `/api/federated-hubs/[id]/posts/[postId]/replies.get.ts` — same
- `/api/federation/hub-post-likes.get.ts` — no count limit on `postIds` array
- `/api/content/[id]/index.get.ts` — `query.author` not validated through Zod

### LOW — Inconsistent Input Validation Patterns

- `hubs/[slug]/posts/index.post.ts` uses `readBody` + manual `safeParse` instead of `parseBody`
- `hubs/[slug]/posts/[postId]/replies.post.ts` — same pattern
- `content/[id]/report.post.ts` — same pattern
- `content/[id]/products-sync.post.ts` — manual array validation

### LOW — Dependency Gaps

- `meilisearch` peer dep of `@commonpub/docs` unsatisfied in layer/reference app
- `@tiptap/extension-horizontal-rule` missing from layer dependencies
- `drizzle-kit` version pinned separately in Dockerfile (`0.31.10`) — needs sync on upgrades

### LOW — Dead Code

- `buildContentUri` deprecated function — only tests use it (3 lines)
- Zero commented-out code blocks found in codebase audit
