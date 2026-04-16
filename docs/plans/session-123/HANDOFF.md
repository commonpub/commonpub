# Session 124 Handoff — Curated Destination Transformation (continued)

## What This Is

CommonPub is transforming from a "platform shell" into a "curated destination" to compete with Hackster.io. This is a 7-phase plan. **Phases 0, 1, 2, and 4 are COMPLETE.** This handoff covers what was done in session 123 and what remains.

---

## Session 123 Summary (2026-04-15)

**7 commits (commonpub) + 4 commits (deveco-io). 23/23 typecheck, 30/30 test suites (865 tests).**

### Completed Phases

| Phase | Name | Commits | Key Deliverables |
|-------|------|---------|-----------------|
| 0 | Quick Fixes | 1 | Explore grid overflow fix, AGPL license fix |
| 1 | Staff Content + Editorial Curation | 2 | contentCategories table, isEditorial/categoryId, admin pages, badges, homepage Staff Picks |
| 4 | Runtime Feature Flags | 1 | DB overrides with 60s TTL, admin toggle page |
| 2 | Configurable Homepage | 1 | 7 section components, HomepageSectionRenderer, admin homepage editor |

### Audit Findings Fixed
- `forkContent()` now preserves `categoryId`
- `deleteContentCategory()` enforces `isSystem` server-side (403)
- 22 behavioral integration tests added
- **Critical Nitro bug**: All workspace packages unified to `@commonpub/schema@^0.10.0` — Nitro was resolving 0.9.13 from packages still on ^0.9.8, silently stripping `editorial`/`categoryId` from Zod parse results at runtime

### Lesson Learned (IMPORTANT for future sessions)
When publishing a new minor version of `@commonpub/schema` (e.g., 0.9.x → 0.10.0), ALL packages that depend on it must be updated to `^0.10.0`. Otherwise Nitro's `.nitro/` internalized copies will resolve the old version, and Zod `.safeParse()` will silently strip fields that exist in the new version but not the old one. **No error is thrown — the fields just disappear.**

---

## Current State (as of Session 123, 2026-04-15)

### Published Package Versions
| Package | Version | Changed in 123? |
|---------|---------|----------------|
| `@commonpub/schema` | **0.10.0** | Yes — contentCategories, isEditorial, categoryId |
| `@commonpub/server` | **2.33.0** | Yes — categories CRUD, editorial filters, homepage sections |
| `@commonpub/config` | **0.9.2** | Yes — editorial feature flag |
| `@commonpub/layer` | **0.11.0** | Yes — editorial badges, admin pages, section renderer |
| `@commonpub/protocol` | 0.9.9 | No |
| `@commonpub/auth` | 0.5.1 | No |
| `@commonpub/ui` | 0.8.5 | No |
| `@commonpub/editor` | 0.7.9 | No |
| `@commonpub/explainer` | 0.7.11 | No |
| `@commonpub/docs` | 0.6.2 | No |
| `@commonpub/learning` | 0.5.0 | No |
| `@commonpub/infra` | 0.5.1 | No |

### Key Architecture Changes (since session 122)

**Config system is now RUNTIME-ADJUSTABLE:**
- `useConfig()` in both apps merges: `commonpub.config.ts` defaults < env vars < DB overrides
- DB overrides stored in `instanceSettings['features.overrides']` (JSONB)
- 60-second TTL cache — no per-request DB hits
- `invalidateConfigCache()` for immediate effect after admin changes
- `GET /api/features` public endpoint, `GET/PUT /api/admin/features` admin endpoints
- Admin features page at `/admin/features`

**Content model now has editorial curation:**
- `content_categories` table with 6 system categories (News, Deep Dive, Opinion, Announcement, Tutorial, Review)
- `contentItems` has `is_editorial` (boolean), `editorial_note` (varchar 255), `category_id` (FK)
- `contentFiltersSchema` supports `editorial`, `categoryId`, `sort: 'editorial'`
- Editorial/category filters correctly exclude federated content
- `EditorialBadge` + `CategoryBadge` on `ContentCard`
- Admin content page: bulk actions, editorial toggle, category assignment
- Admin categories page: CRUD with system category protection

**Homepage is now configurable:**
- `HomepageSection` type stored in `instanceSettings['homepage.sections']`
- Default sections match the hardcoded layout (backwards compatible)
- `HomepageSectionRenderer` renders by zone: `full-width` (hero), `main` (editorial, content-grid), `sidebar` (stats, contests, hubs)
- 7 section components: HeroSection, EditorialSection, ContentGridSection, ContestsSection, HubsSection, StatsSection, CustomHtmlSection
- Admin homepage editor at `/admin/homepage`: reorder, enable/disable, inline config editing
- `GET /api/homepage/sections` public, `GET/PUT /api/admin/homepage/sections` admin

**Admin panel now has 12 pages:**
Dashboard, Settings, Theme, Users, Content, Categories, Reports, Audit, Homepage, Features, Federation, (+ existing)

### SQL Applied to Both Instances
```sql
-- content_categories table + 6 system categories
-- contentItems: is_editorial, editorial_note, category_id columns + indexes
-- (No new SQL needed for Phases 2 and 4 — they use instanceSettings JSONB)
```

### Production Database Access
- **commonpub.io**: `ssh root@commonpub.io` then `docker exec commonpub-postgres-1 psql -U commonpub -d commonpub`
- **deveco.io**: `ssh root@deveco.io` then get NUXT_DATABASE_URL from `docker exec deveco-app-1 env` and use `psql` with that connection string

---

## Remaining Phases

### Recommended Order: 3 → 5 → 6 → 7

### Phase 3: Admin-Configurable Nav (3-4 sessions)

**Data model (stored in instanceSettings `nav.items`):**
```typescript
interface NavItem {
  id: string;
  type: 'link' | 'dropdown' | 'external';
  label: string;
  icon?: string;
  route?: string;
  href?: string;
  featureGate?: string;
  children?: NavItem[];
  visibleTo?: 'all' | 'authenticated' | 'admin';
}
```

**New files:**
- `layers/base/components/nav/NavRenderer.vue`
- `layers/base/components/nav/NavLink.vue`
- `layers/base/components/nav/NavDropdown.vue`
- `layers/base/components/nav/MobileNavRenderer.vue`
- `packages/server/src/navigation/navigation.ts`
- `layers/base/server/api/navigation/items.get.ts`
- `layers/base/server/api/admin/navigation/items.put.ts`
- `layers/base/pages/admin/navigation.vue`

**Major rewrite:** `layers/base/layouts/default.vue` — replace hardcoded nav with `<NavRenderer>`

**Approach:** Same pattern as Phase 2 homepage — store in instanceSettings, provide defaults matching current hardcoded nav, render via component, admin page to edit. Keep hardcoded fallback for backwards compatibility.

### Phase 5: Events System (4-5 sessions)

**New schema:** `events` table, `eventAttendees` table, 3 new enums
**New config:** `events` feature flag (default false)
**New files:** Full CRUD server module, 8+ API routes, 4 pages, 4+ components
**Depends on:** Phase 4 (runtime feature flags) — DONE

### Phase 6: Voting + Polls (3-4 sessions)

**New schema:** `hubPostVotes`, `pollOptions`, `pollVotes`, `contestEntryVotes` tables
**Modified schema:** `hubPosts` adds `voteScore`, `contests` adds `communityVotingEnabled`
**Migration:** Backfill existing `hubPostLikes` → `hubPostVotes` as upvotes

### Phase 7: Contest Judge Permissions (2-3 sessions)

**New schema:** `contestJudges` junction table with role enum, `contests` adds `judgingVisibility` enum
**Replaces:** `contests.judges` string array (keep for backward compat, deprecate)

---

## Critical Rules (from memory)

1. **Never add Claude as co-author in git commits**
2. **Always use pnpm publish, never npm publish**
3. **pnpm update modifies BOTH package.json and lockfile — commit both**
4. **Verify exports in dist before publishing**
5. **Always be explicit about which repo/directory**
6. **No hardcoded colors — always var(--*)**
7. **No feature without a flag**
8. **When bumping @commonpub/schema minor version, update ALL workspace package.json deps to ^new.version** — Nitro resolves the oldest matching version otherwise
9. **drizzle-kit push is unreliable — apply schema changes via manual SQL on both instances**
10. **Federated UI must reuse local components**
11. **Publish in dependency order: schema → server → layer** (server depends on npm schema, layer depends on npm server+schema)

## Memory Files to Read
- `/Users/obsidian/.claude/projects/-Users-obsidian-Projects-ossuary-projects/memory/MEMORY.md` — master index
- `/Users/obsidian/.claude/projects/-Users-obsidian-Projects-ossuary-projects/memory/audit_session_122.md` — deep audit findings
- `/Users/obsidian/.claude/projects/-Users-obsidian-Projects-ossuary-projects/memory/architecture.md` — schema decisions
- `/Users/obsidian/.claude/projects/-Users-obsidian-Projects-ossuary-projects/memory/architecture_layer_consumption.md` — layer publishing
