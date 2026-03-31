# Session 093 — Dockerfile Fix + Hub UI Unification

**Date**: 2026-03-30
**Packages**: no version changes (app-level only)

---

## What Was Done

### Dockerfile Fix (deployed)
- **Root cause**: `drizzle-kit` was a devDependency of `@commonpub/schema`, not available in the Docker runtime stage. Additionally, the runtime `drizzle.config.ts` pointed at TypeScript source (`./src/*.ts`) that doesn't exist in the container. Pnpm workspace symlinks for `@commonpub/schema` break when copied to the runtime stage since the target directory doesn't exist outside the monorepo.
- **Fix**: Added `drizzle-kit` as a dependency of the reference app so it's in `node_modules/.bin/` at runtime. Created `apps/reference/drizzle.config.ts` pointing at `./schema/dist/*.js` (compiled JS). Added explicit `COPY` of schema dist files in Dockerfile to avoid broken pnpm symlinks.
- **Deploy workflow** at `.github/workflows/deploy.yml` already had `npx drizzle-kit push --force` — it was just silently failing. Now works.
- **CLI unaffected**: `create-commonpub` generates its own `drizzle.config.ts` dynamically via Rust; scaffold overwrites any stale file.

### Hub UI Unification (deployed to both instances)

**Architecture**: Data-agnostic component layer + data-aware page layer.

```
Page Layer (data-aware)
  ├─ Fetches from API (local or federation)
  ├─ Maps domain types → view models
  └─ Fills slots with page-specific content

Component Layer (data-agnostic)
  ├─ Accepts view model props (HubViewModel, HubPostViewModel, etc.)
  ├─ Renders UI
  └─ Uses slots for extensibility (#actions, #badges, #compose, #sidebar)
```

**New/refactored components** (both repos):
- `types/hub.ts` — `HubViewModel`, `HubPostViewModel`, `HubMemberViewModel`, `HubTabDef`
- `HubLayout` — tab bar + 2-column grid skeleton with `#hero`, default, `#sidebar` slots
- `HubHero` — banner + icon + stats with `#actions`, `#badges`, `#banner-overlay` slots
- `HubFeed` — post list with `#compose` slot (page provides compose bar or nothing)
- `HubSidebar` — pure slot wrapper
- `HubSidebarCard` — titled card block
- `HubDiscussions` — discussion list with `#compose` slot
- `HubMembers` — member grid accepting `HubMemberViewModel[]`
- `FeedItem` — added `authorHandle` + `authorAvatar` props

**Page rewrites**:
- `pages/hubs/[slug]/index.vue` — fetches `HubDetail`, maps to view models, provides local slots (join button, compose bar, moderators sidebar)
- `pages/federated-hubs/[id]/index.vue` — fetches `FederatedHubListItem`, maps to SAME view models, provides federation slots (origin banner, "Visit on origin" button, origin sidebar card)
- Reference app monolithic hub page (1387 lines) decomposed into components

## Decisions

- **Components never import domain types** — they accept plain typed objects (`HubViewModel` etc.). Pages own the mapping.
- **Slots over props for page-specific UI** — compose bar, action buttons, badges, sidebar cards are all provided via slots. Components don't know about federation.
- **HubProjects/HubProducts not refactored** — still API-coupled, only used on local hubs. Left as-is.
- **drizzle-kit as regular dependency** (not devDep) — safer against future Dockerfile optimizations that might skip devDeps.

## Tech Debt Closed
- ~~Dockerfile: drizzle-kit not in runtime stage~~ → FIXED
- ~~Reference app hub page still monolithic (1387 lines)~~ → EXTRACTED into 9 components
- ~~Federated hub pages use separate UI~~ → UNIFIED with local hub components

## Tech Debt Remaining
- Manual file sync between repos (hub components copied, not shared)
- Share card backfill (runtime N+1)
- Federated hub posts read-only (no like/reply UI)
- No fork endpoint for federated content
- Boost UI not on mirror pages
- HubProjects still API-coupled (only used on local hubs)

## Next Session Priorities
- Like/reply on federated hub posts
- Boost UI on federated hub pages
- Consider moving shared hub components into `@commonpub/ui` to eliminate manual sync
