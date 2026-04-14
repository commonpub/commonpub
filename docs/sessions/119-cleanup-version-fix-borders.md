# Session 119 — Cleanup, Docs Version Fix, Explainer Borders (2026-04-13)

Post-v1.0 cleanup session. 5 commits, all deployed via CI auto-deploy.

## Verification
- 26/26 typecheck, 30/30 test suites — verified after every commit
- 5 commits pushed, all auto-deployed via CI
- Deep audit performed: all $fetch calls in docs editor verified, upstream/downstream effects checked, no regressions

## Commit 1 — BlogView Cleanup + E2E Fix

**Commit:** `0fbfb4e`

- Deleted dead `BlogView.vue` from `layers/base/components/views/` (736 lines). Superseded by `ArticleView.vue` in session 116's article→blog merge. No remaining references in the codebase.
- Also deleted `test-site/components/views/BlogView.vue` and updated test-site routing to use ArticleView for blog type (test-site is gitignored).
- Fixed flaky E2E test `navigation.spec.ts:17` — root cause: test assumed the first `.cpub-tab` always starts active, but `activeTab` defaults to `'latest'` (2nd tab) when not authenticated. Changed to dynamically find whichever tab starts active via `page.locator('.cpub-tab.active')`, then click a different one.
- Verified article→blog SQL migration already applied on both instances (0 article rows on commonpub.io and deveco.io).

## Commit 2 — Docs Editor Version Fix

**Commit:** `6b669a5`

**Problem:** The docs editor version selector UI existed (dropdown to pick version), and page listing correctly filtered by version, but:
1. Creating a page always wrote to the default version (editor didn't pass `versionId`)
2. Reorder always operated on the default version's pages (API hardcoded it)

**Changes (2 files):**
- `layers/base/pages/docs/[siteSlug]/edit.vue` — Added `selectedVersionId` computed (resolves version string → UUID from site data). Passes `versionId` in create page body. Passes `version` in reorder body.
- `layers/base/server/api/docs/[siteSlug]/pages/reorder.post.ts` — Added optional `version` field to reorder schema. Resolves to requested version before falling back to default.

**Audit verified:** All 13 `$fetch` calls in edit.vue are correctly version-aware or version-agnostic:
- Create page: passes `versionId` (new)
- Reorder: passes `version` string (new)
- Duplicate: server copies `versionId` from source page (correct as-is)
- All PUT/DELETE operations: operate on page ID which is already version-scoped (correct as-is)

## Commit 3 — Explainer Border Width Vars

**Commit:** `89b2b41`

Replaced 16 hardcoded `1px solid` borders with `var(--border-width-default)` across 4 explainer components:
- `ExplainerViewer.vue` — 9 instances (topbar, sidebar, author, navigation). Uses `var(--border-width-default, 2px)` fallback for viewer context.
- `editor/BlockCanvas.vue` — 5 instances (controls, inputs, buttons)
- `editor/EditorSection.vue` — 1 instance
- `editor/EditorTagInput.vue` — 1 instance

Remaining: `editor-v2/ThemeEditor.vue` has 6 instances — intentionally left as-is (self-contained dark theme editor with `#333` fallbacks). Export templates (11 instances) also intentional — CSS vars unavailable in standalone HTML.

**Audit verified:** `InteractiveContainer.vue` sets `--border-width-default: 1px` for its dark context — all child component references to the var correctly cascade to 1px within containers. No visual regression.

## Commit 4 — Session Log

**Commit:** `cb55d01`

## Commit 5 — versionId Validator Tests

**Commit:** `fb09192`

Added 3 new tests to `createDocsPageSchema`:
- Accepts page with valid UUID `versionId`
- Rejects invalid `versionId` (not UUID)
- Allows omitting `versionId` (API resolves default)

## Deep Audit Findings

### Vanity Tests (~50 of 2,817 total = ~1.8%)

**Pattern 1 — `expect(true).toBe(true)` (6 tests):**
setup.test.ts in auth, editor, explainer, protocol, test-utils, ui

**Pattern 2 — typeof-only export checks (36+ tests):**
server/{docs,social,profile,admin,federation,learning,hub,theme}.test.ts — every test is `expect(typeof mod.X).toBe('function')` without ever calling the function. These are import smoke tests, not behavior tests.

**Pattern 3 — toBeDefined on relations (4+ tests):**
schema/{auth,federation,admin}.test.ts — relation definition existence checks only.

**Pattern 4 — tautological mocking (borderline):**
auth/createAuth.test.ts — fully mocks betterAuth, verifies mock args. Tests config transformation wiring but not actual auth behavior. Debatable — the function IS a config transformer.

**Not vanity:** The `createAuth` tests do verify real config mapping (baseURL, social providers, plugins). Counted as borderline, not vanity.

### Security Findings

**HIGH — v-html on federated content — FIXED (commit `108a9a3`):**
- Rewrote `sanitizeBlockHtml` from a no-op passthrough to a real allowlist-based sanitizer (mirrors protocol/sanitize.ts)
- Applied to `federated-hubs/[id]/posts/[postId].vue` and `mirror/[id].vue`
- 24 new tests verify XSS protection (script strips, event handlers, dangerous URLs, data URI filtering)

**HIGH — Raw SQL template literals — FIXED (commit `374e5cc`):**
- content-ap.ts: `sql IN` → `inArray()`
- trending.get.ts: `sql = 'published'` → `eq()`, `sql DESC` → `desc()`
- search/index.get.ts: `sql ANY(ARRAY[...])` → `inArray()`
- users/index.get.ts: 2× `sql ANY(ARRAY[...])` → `inArray()`
- messages/info.get.ts left as-is — JSONB `@>` has no Drizzle equivalent, value from requireAuth

**MEDIUM — Hardcoded colors — FIXED (commit `e15c5ce`):**
- Added `--gold`, `--silver`, `--bronze`, `--color-text-inverse` tokens to base.css
- Replaced `#a0724a` in ContestEntries, ContestPrizes, contests/create, contests/results
- Replaced `#fff` in ContentCard, ImageUpload
- BlockCodeView syntax highlighting theme (20+ hex) — intentionally left as-is (standalone highlight.js theme, needs `--hljs-*` token layer if ever themeable)

## Commit 8 — Vanity Test Cleanup

**Commit:** `2baa2f0`

Deleted 50 vanity tests across 18 files:
- 8× setup.test.ts (`expect(true).toBe(true)`) from auth, editor, explainer, protocol, test-utils, ui, infra, docs
- 8× server module files (admin, docs, social, profile, federation, learning, hub, theme) — pure typeof-only export checks
- 2× typeof-only tests from security.test.ts (14 real tests retained)
- Replaced server/setup.test.ts with a consolidated barrel-export smoke test (1 test covering all 15 module groups)

Test count: 2791 real tests (was 2841 with vanity padding).

## Commit 9 — BlockCodeView Token Layer

**Commit:** `0f2b900`

Added 14 CSS custom properties to base.css for syntax highlighting:
- `--code-bg`, `--code-text`, `--code-header-bg`, `--code-border`, `--code-muted`, `--code-green`
- `--hljs-comment`, `--hljs-keyword`, `--hljs-literal`, `--hljs-string`, `--hljs-deletion`, `--hljs-meta`, `--hljs-name`, `--hljs-variable`

BlockCodeView now has zero hardcoded hex values. Themes can override the entire code block color scheme.

## Commit 10 — Last Hardcoded Hex Values

**Commit:** `65a2e7e`

Fixed last 3 non-fallback hex values in layer:
- HubHero gradient: `#006b6b` → `var(--teal)`
- BlogEditor toggle: `#fff` → `var(--color-text-inverse)`
- Admin theme toast: `#fff` → `var(--color-text-inverse)`

All remaining hex in layer components/pages are now either `var()` fallbacks (correct) or theme preview data (intentional).

## Remaining Work

## Commit 11 — Group Chat Read Receipts

**Commit:** `ad9aa4b`

**Bug:** Group chats (3+ participants) had broken unread counts. `readAt` was a single column on the `messages` row — when Alice read, Bob's unread count dropped to zero because `readAt` was already set.

**Fix:**
- Added `message_reads` table: `(message_id, user_id, read_at)` with unique constraint
- `markMessagesRead` → INSERT INTO message_reads ON CONFLICT DO NOTHING
- `getUnreadMessageCount` / `getConversationUnreadCounts` → NOT EXISTS subquery against message_reads
- `getConversationMessages` → LEFT JOIN message_reads for per-user readAt
- 3 new tests: per-participant independence, per-conversation independence, idempotency

Old `readAt` column on `messages` table left in place (drizzle-kit push won't drop columns). New code ignores it completely.

## Commit 12 — Signed Backfill Fetches

**Commit:** `bb8358f`

Instance-level `backfillFromOutbox` was using unsigned fetches, which silently fails against instances requiring HTTP Signatures. Added `signedGet` helper (mirrors hubMirroring.ts pattern) using instance actor keypair, with graceful fallback to unsigned fetch.

## Commit 13 — Security: Email Disclosure + Admin Input Validation

**Commit:** `92f7aff`

- **Deleted `/api/resolve-identity`** — unauthenticated endpoint that returned user emails given a username. Any anonymous caller could enumerate usernames and harvest emails.
- **Created `/api/auth/sign-in-username`** — accepts username + password, resolves username→email server-side, proxies to Better Auth's sign-in, returns session. Email never sent to client.
- Updated login page to call new endpoint + `refreshSession()`.
- Added Zod validation to 4 admin routes: `retry.post.ts` (activityId UUID), `refederate.post.ts` (contentId UUID + hubsOnly boolean), `content/[id].patch.ts` (parseParams UUID), `mirrors/[id]/backfill.post.ts` (parseParams UUID).

## Commit 14 — Missing Indexes

**Commit:** `cb8a826`

Added `idx_bookmarks_user_id` and `idx_lesson_progress_user_id` — both columns used in WHERE clauses for user-specific queries but had no index.

## Full Codebase Audit

Comprehensive audit performed across all surfaces. See `docs/audit-119.md` for the full report with all findings categorized by severity and status (fixed vs documented for future work).

## Remaining Work

All remaining items are documented in `docs/audit-119.md`. Key priorities:
- **HIGH**: Feature flag bypass on page routes (direct URL access ignores config flags)
- **HIGH**: Architecture violations — 6 routes with inline business logic
- **MEDIUM**: Accessibility gaps (aria-expanded, label association), error states, schema cleanup
- **LOW**: Mobile responsiveness, query param validation, dependency gaps
