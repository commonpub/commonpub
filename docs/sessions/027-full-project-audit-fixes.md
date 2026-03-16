# Session 027 — Full Project Audit: Tier 1 & 2 Fixes

Date: 2026-03-15

## What Was Done

### Tier 1: Make Things Actually Work

1. **Fixed editor save** — `edit.vue` `handleSave()` now spreads ALL metadata fields instead of hardcoding a fixed subset. Fields like `slug`, `costMin`/`costMax`, `series`, `excerpt`, `ogImage`, `estimatedMinutes`, `learningObjectives`, `category` are no longer silently dropped on save.

2. **Fixed metadata loading** — `edit.vue` now loads all metadata fields from the server response when editing existing content (including `category`, `subtitle`, proper `coverImageUrl` mapping).

3. **Updated server types** — `CreateContentInput` and `UpdateContentInput` now include `buildTime`, `estimatedCost`, `visibility`, `seoDescription` fields. `createContent()` and `updateContent()` now persist these fields to the database.

4. **Added Zod validation to API routes**:
   - `POST /api/content` — validates with `createContentSchema`
   - `PUT /api/content/:id` — validates with `updateContentSchema`
   - `POST /api/social/comments` — validates with `createCommentSchema`
   - `POST /api/communities` — validates with `createCommunitySchema`
   - `POST /api/communities/:slug/posts` — validates with `createPostSchema`
   - `POST /api/social/like` — inline validation of targetType/targetId
   - `POST /api/social/bookmark` — inline validation of targetType/targetId

5. **Implemented real Drizzle queries for stubbed features**:
   - **Notifications**: `listNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`, `deleteNotification`, `createNotification` — all now use real DB queries on the `notifications` table in `packages/schema/src/social.ts`
   - **Messaging**: `listConversations`, `getConversationMessages`, `createConversation`, `sendMessage`, `markMessagesRead` — uses `conversations` + `messages` tables from `packages/schema/src/social.ts`, uses jsonb `@>` operator for participant filtering
   - **Contests**: `listContests`, `getContestBySlug`, `createContest`, `updateContest`, `listContestEntries`, `submitContestEntry`, `judgeContestEntry` — uses `contests` + `contest_entries` tables from `packages/schema/src/contest.ts`, includes judge scoring with jsonb `judgeScores` array
   - **Videos**: `listVideos`, `getVideoById`, `createVideo`, `listVideoCategories`, `incrementVideoViewCount` — uses `videos` + `video_categories` tables from `packages/schema/src/video.ts`

6. **Fixed ProjectEditor `codeBlock` mismatch** — changed `insertContent({ type: 'codeBlock' })` to `setCodeBlock()` which matches the TipTap extension registration name.

### Tier 2: Wire Up Existing Components

7. **Community page** (`communities/[slug].vue`):
   - Feed filter chips now use `<FilterChip>` component instead of inline spans
   - Feed posts now use `<FeedItem>` component instead of inline cards
   - Discussion items now use `<DiscussionItem>` component instead of inline rendering
   - Member cards now use `<MemberCard>` component instead of inline cards
   - Fixed compose bar (removed non-existent `$refs.composeInput`, replaced with actual `<input>` bound to `newPostContent`)

8. **User profile** (`u/[username].vue`):
   - Experience timeline now uses `<TimelineItem>` component instead of inline rendering
   - Skill bars now use `<SkillBar>` component instead of inline bars
   - Added `<HeatmapGrid>` to the About tab sidebar (component existed, was never imported)
   - Fixed `filteredContent` returning empty on About tab (added `'about': ['project']` mapping so sidebar "Featured Projects" works)

9. **Settings layout** — already existed at `settings/index.vue` with sidebar nav and `<NuxtPage />`. Confirmed working with Profile, Account, Notifications, Appearance sub-pages.

## Decisions Made

- Editor save now spreads all metadata rather than maintaining a whitelist. This is more future-proof — adding new fields to specialized editors won't require updating `handleSave()`.
- Used inline validation (not Zod) for like/bookmark routes to avoid direct `zod` import issues with pnpm's strict node_modules. The `@commonpub/schema` package has zod as a dependency, but it's not hoisted. Routes that import schemas from `@commonpub/schema` work fine because Nitro bundles them.
- Server functions return proper dates/types from DB rather than placeholder `new Date()`.

---

## HANDOFF: Remaining Work & How To Approach It

### CRITICAL: Before doing ANYTHING

1. **Rebuild the server package** — we changed `packages/server/src/content.ts`, `contest.ts`, `video.ts`, `messaging.ts`, `notification.ts`, `types.ts`. Run:
   ```bash
   cd packages/server && pnpm build
   ```
2. **Test the dev server** — `cd apps/reference && pnpm dev` — check that the app loads and styles render.

### CRITICAL: How to work on this project

- **NEVER use agents for writing code.** Read the actual files yourself. Agents produced garbage previously because they invented designs from text descriptions.
- **ALWAYS read the mockup HTML file** at `/Users/obsidian/Projects/ossuary-projects/all-mockups/unified-v2/` before touching any page. The mockup is the source of truth. Not the plan text, not a description — the actual HTML file.
- **The project is CommonPub**, not Snaplify. The repo folder says "snaplify" but all branding is CommonPub.

---

### Tier 3: Match Mockups For Real

Each task below requires reading the corresponding mockup HTML file FIRST, then comparing with the current Vue page.

#### 3A. View pages (highest visual impact)

These pages exist but have NOT been rebuilt to match mockups. Each one needs:
1. Read the mockup: `all-mockups/unified-v2/XX-view-*.html`
2. Read the current page: `apps/reference/pages/[type]/[slug]/index.vue`
3. Rebuild the template to match the mockup's structure, sections, and sidebar

| Page | Mockup file | Current page |
|------|------------|--------------|
| Article view | `08-view-article.html` | `pages/[type]/[slug]/index.vue` (generic for all types) |
| Blog view | `09-view-blog.html` | Same file — needs type-specific rendering |
| Explainer view | `10-view-explainer.html` | Same file — needs interactive sections |
| Project view | `11-view-project.html` | Same file — needs parts list, build steps |

**Key decision**: The current `[type]/[slug]/index.vue` is a single generic page. The mockups show very different layouts per type. Options:
- A) Keep one file with `v-if` branches per type (simpler routing, larger file)
- B) Create separate view components per type like the editors (more files, cleaner separation)

Recommendation: Option B — create `components/views/ArticleView.vue`, `BlogView.vue`, `ExplainerView.vue`, `ProjectView.vue` and use dynamic component in the page (same pattern as `edit.vue` uses with editors).

#### 3B. Contest page

- Mockup: `14-contest-page.html`
- Current page: `pages/contests/[slug].vue`
- The server functions are now real (we just implemented them), so the page should be able to fetch actual data
- Read the mockup to see: countdown timer, entry gallery, judges panel, rules section, prizes

#### 3C. Learning system

- Mockup: `15-learning-system.html`
- Current page: `pages/learn/index.vue` and `pages/learn/[slug].vue`
- Server functions for learning are ALREADY real (they existed before this session — `packages/server/src/learning.ts` has ~600 LOC of real Drizzle queries)
- Read the mockup to see: path cards, module accordion, lesson list, progress tracking

#### 3D. Video hub

- Mockup: `16-video-hub.html`
- Current page: `pages/videos/index.vue`
- Server functions are now real (we just implemented them)
- Read the mockup for: category filters, video grid, featured section

#### 3E. Community page refinements

Current community page is ~80% there. Remaining:
- Tab counts next to tab labels (e.g., "Feed (12)", "Members (45)")
- Projects tab — should show content shared to the community, not "Coming soon"
- Learn tab — should show learning paths associated with community
- Events tab — can stay as "Coming soon" for now (no events system yet)

#### 3F. Profile edit refinements

- Mockup: `07-editor-profile.html`
- Current: `pages/settings/profile.vue`
- The mockup shows a much more complex layout with sections: Basic Info, Social Links, Gallery, Experience, Awards, Publications, Videos, Interactives, Visibility, Theme
- The current page has basic form fields but not the full mockup structure
- The settings sidebar layout already exists at `pages/settings/index.vue`

---

### Tier 4: Production Readiness

#### 4A. Seed script

Create `packages/schema/seed.ts` or `apps/reference/server/seed.ts` that inserts realistic demo data:
- 5-10 users with profiles, skills, experience
- 20+ content items across all types (projects, articles, blogs, explainers)
- 2-3 communities with posts and members
- 1-2 contests with entries
- 5-10 videos
- Learning paths with modules and lessons
- Notifications, comments, likes

This is essential for testing and demo purposes. Without it, every page shows "No X yet".

#### 4B. Validation on remaining write routes

Routes that still have NO validation (lower priority since they have auth):
- `POST /api/contests` — no body validation
- `PUT /api/contests/:slug` — no body validation
- `POST /api/contests/:slug/entries` — no contentId validation
- `POST /api/contests/:slug/judge` — no score validation
- `POST /api/videos` — no body validation
- `POST /api/messages` — no participants validation
- `POST /api/messages/:id` — no body validation
- `POST /api/learn` — no body validation
- Various community management routes (bans, invites, role changes)

#### 4C. E2E test — one complete user flow

Using Playwright:
1. Register new user
2. Create an article
3. Save → all metadata persists
4. Publish → article appears in feed
5. View article → comment on it
6. View profile → article appears in content tab

#### 4D. Federation (lowest priority)

`packages/server/src/federation.ts` has the right types and structure but:
- `federateContent()`, `federateUpdate()`, `federateDelete()` are stubs
- No HTTP signature verification on inbox
- No actual outbound HTTP posts
- Feature-flagged off (correct)

This should only be touched after two instances exist with real content (per CLAUDE.md rule #10).

---

### Components that exist and are now wired up

| Component | Used in |
|-----------|---------|
| `FeedItem.vue` | `communities/[slug].vue` |
| `MemberCard.vue` | `communities/[slug].vue` |
| `DiscussionItem.vue` | `communities/[slug].vue` |
| `FilterChip.vue` | `communities/[slug].vue` |
| `SkillBar.vue` | `u/[username].vue` |
| `HeatmapGrid.vue` | `u/[username].vue` |
| `TimelineItem.vue` | `u/[username].vue` |

### Components that exist but are STILL not wired up

| Component | Should be used in |
|-----------|------------------|
| `SortSelect.vue` | Search page, content listing pages |
| `StatBar.vue` | Profile page, community page |
| `ProgressTracker.vue` | Learning pages |
| `TOCNav.vue` | View pages (article/explainer sidebar) |
| `AnnouncementBand.vue` | Homepage or layout |
| `VideoCard.vue` | Video hub page |
| `CountdownTimer.vue` | Contest page |
| `MessageThread.vue` | Messages page |
| `NotificationItem.vue` | Notifications page |
| `CommentSection.vue` | View pages |
| `SectionHeader.vue` | Various pages |

### Architecture: Key file locations

| What | Where |
|------|-------|
| DB schema (all tables) | `packages/schema/src/*.ts` — auth, content, social, community, learning, docs, video, contest, federation, files, admin |
| Zod validators | `packages/schema/src/validators.ts` |
| Server business logic | `packages/server/src/*.ts` — content, community, social, learning, docs, admin, contest, video, messaging, notification, federation, profile, security, theme |
| Server types | `packages/server/src/types.ts` |
| API routes | `apps/reference/server/api/**/*.ts` |
| Nitro server utils | `apps/reference/server/utils/db.ts`, `auth.ts`, `config.ts` |
| Pages | `apps/reference/pages/**/*.vue` |
| Components | `apps/reference/components/**/*.vue` |
| Editors | `apps/reference/components/editors/*.vue` — ArticleEditor, BlogEditor, ExplainerEditor, ProjectEditor, EditorShell, FloatingToolbar |
| CSS theme | `packages/ui/theme/*.css` — base, dark, prose, layouts, forms, editor-panels |
| Mockups (source of truth) | `/Users/obsidian/Projects/ossuary-projects/all-mockups/unified-v2/*.html` |
| Nuxt config | `apps/reference/nuxt.config.ts` |
| Editor page | `apps/reference/pages/[type]/[slug]/edit.vue` |
| View page | `apps/reference/pages/[type]/[slug]/index.vue` |

### Editor architecture (important for future consolidation)

The 4 specialized editors are in `components/editors/`:
- `ArticleEditor.vue` (~244 lines) — 3-panel: block library | canvas | properties (metadata, SEO, visibility, cover)
- `BlogEditor.vue` (~171 lines) — 2-panel: canvas | properties (meta, excerpt, SEO, publishing, social)
- `ExplainerEditor.vue` (~261 lines) — 3-panel: modules/structure | canvas | properties (content, difficulty, visibility, cover)
- `ProjectEditor.vue` (~419 lines) — 3-panel: block library | canvas | settings (meta, tags, community, visibility, cover, files, checklist)

They ALL duplicate: tag management, section collapse, block insertion. The generic components `EditorBlockLibrary.vue`, `EditorPropertiesPanel.vue`, `EditorToolbar.vue` exist but are only used in the fallback path. Future work should consolidate these into a config-driven system.

The parent `edit.vue` loads the specialized editor via dynamic component (`editorMap` dict) and passes blocks/metadata as props. The editor emits `update:metadata` back. The save function in `edit.vue` sends everything to the API.

### CSS system

- `base.css` — all CSS custom properties (colors, spacing, typography, shadows)
- `dark.css` — dark mode overrides
- `prose.css` — typography for rendered content
- `layouts.css` — shared layout utilities
- `forms.css` — form element styles
- `editor-panels.css` — shared editor panel styles (sections, chips, block library, visibility radio groups)

All loaded in `nuxt.config.ts` via the `uiTheme()` helper that resolves to `packages/ui/theme/`.

### Design system rules (from CLAUDE.md)

- Sharp corners (`--radius: 0px`), 2px borders, offset shadows (no blur)
- JetBrains Mono for UI labels (uppercase, letter-spaced)
- Blue accent (`#5b9cf6`), cool neutral palette
- No hardcoded colors — always `var(--*)` in component styles
- CSS class prefix: `cpub-`
