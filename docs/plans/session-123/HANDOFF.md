# Session 125 Handoff

## Current State (2026-04-16, end of session 124)

All 7 phases of the Curated Destination Transformation are complete. Voting, polls, and judge search are wired into the UI. Both instances deployed and verified healthy.

### Deployed Package Versions
| Package | Version |
|---------|---------|
| @commonpub/schema | 0.13.0 |
| @commonpub/server | 2.42.0 |
| @commonpub/config | 0.10.0 |
| @commonpub/layer | 0.15.1 |

### Session 124 Commits: 19 (commonpub) + 5 (deveco-io)

### Database State
SQL applied manually to both instances. Tables: events, event_attendees, hub_post_votes, poll_options, poll_votes, contest_entry_votes, contest_judges. Columns: hub_posts.vote_score, contests.community_voting_enabled, contests.judging_visibility. 6 new enum types + 'event' in notification_type.

### Feature Flags (from /api/features)
| Flag | commonpub.io | deveco.io |
|------|-------------|-----------|
| content | true | true |
| social | true | true |
| hubs | true | true |
| docs | true | false |
| video | true | false |
| contests | true | true |
| events | true | false |
| learning | true | false |
| explainers | true | false |
| editorial | true | true |
| federation | true | true |
| admin | true | true |

---

## What Works Now

### Phase 3: Admin-Configurable Navigation
- Nav items stored in `instanceSettings['nav.items']` JSONB
- NavRenderer/NavDropdown/NavLink/MobileNavRenderer components with `:deep()` scoped CSS
- Admin page at `/admin/navigation` — reorder, add/remove, inline editor, children
- Dropdowns auto-hide when all children are feature-gated out
- Mobile responsive (`:deep()` in `@media` block)

### Phase 5: Events System
- events + event_attendees tables; `events` feature flag
- New events default to `published` status (immediately visible)
- RSVP with auto-waitlisting (transaction-wrapped)
- 8 API routes + create/edit/detail/listing pages
- EventCard component with date, type, location, capacity

### Phase 6: Voting + Polls — NOW WIRED INTO UI
- **Hub post voting works**: FeedItem and DiscussionItem vote buttons call the API with optimistic updates
- **Polls render**: HubFeed detects `post.type === 'poll'` and renders PollDisplay below content
- PostVoteButtons, PollDisplay, and hub components all connected
- Vote buttons use `.prevent.stop` to avoid triggering parent NuxtLink navigation
- Contest entry voting API exists (POST/DELETE) but no UI yet

### Phase 7: Contest Judge Permissions — WITH USER SEARCH
- contestJudges table with invite/accept workflow
- **User search autocomplete** in ContestJudgeManager (searches /api/admin/users, shows dropdown)
- judgeContestEntry checks contestJudges table, requires accepted invite, blocks guests
- 4 API routes for judge CRUD + accept

### Runtime Feature Flags
- `useFeatures()` hydrates from `/api/features` on client mount (DB overrides reflected)
- DEFAULT_FLAGS fallback prevents null crash during SSR
- Feature gate middleware reads reactive useState

### Admin Panel (13 pages)
Dashboard, Users, Content, Categories, Reports, Audit, Theme, Homepage, Navigation, Features, Federation, Settings

---

## Known Issues

### Active
1. **Commonpub.io theme not applying** — user reported Agora theme selected but not rendering. Needs investigation (theme stored in instanceSettings, rendered via useTheme composable).
2. **Pre-existing shell typecheck errors** — dashboard.vue, CommentSection.vue, docs/edit.vue, settings/profile.vue, admin/content.vue (all have $fetch TS2589 or implicit-any)
3. **drizzle-kit push fails for new enums in CI** — must apply SQL manually
4. **No waitlist auto-promotion** on RSVP cancellation
5. **Poll votes are immutable** (by design)
6. **Judge invitation notifications** not wired
7. **Contest entry voting has no UI** (API only)
8. **CI Node 23 dropped** — rollup native binary issue

### Resolved in Session 124
- Admin/events 500 on refresh → useFeatures DEFAULT_FLAGS fallback
- Events not visible after creation → default to 'published' status
- Nav unstyled → `:deep()` CSS
- Nav visible on mobile → `:deep()` in @media block
- Feature flags frozen at build time → client hydration from /api/features
- Hub feed voting not connected → wired HubFeed/HubDiscussions
- Judge UUID input → user search autocomplete
- Database columns missing → manual SQL on both instances
- Race conditions → transactions

---

## Suggested Next Work

### High Priority
1. **Investigate commonpub.io theme issue** — Agora theme selected but not applying
2. **Fix pre-existing shell typecheck errors** — mostly `useFetch` TS2589 patterns
3. **Event pagination + filters** — API supports them, UI doesn't expose
4. **Cover image upload on events** — no image field in create/edit forms

### Medium Priority
5. **Contest entry voting UI** — wire API into entry cards
6. **Event calendar view** — monthly/weekly component
7. **Waitlist auto-promotion** — promote on cancel
8. **Fix drizzle-kit CI push** — switch to generate+migrate or fix TTY handling

### Low Priority
9. **Judge invitation notifications**
10. **Event reminders**
11. **Consolidate server/utils/config.ts** between reference and deveco

---

## Critical Rules

1. **Never add Claude as co-author in git commits**
2. **When bumping @commonpub/schema minor, update ALL workspace deps** (0.x caret = patch only)
3. **drizzle-kit push fails for new enums** — apply SQL manually to both instances
4. **Nav styles must use `:deep()` including in `@media` blocks**
5. **No hardcoded colors — always var(--*)**
6. **No feature without a flag**
7. **Publish order: schema → server → config → layer**
8. **Layer minor bumps require updating deveco's package.json** (0.x caret = patch only)
9. **useFeatures must have DEFAULT_FLAGS fallback** — config.public.features can be null during SSR

## Production Access
- **commonpub.io**: `ssh root@commonpub.io` → `docker exec commonpub-postgres-1 psql -U commonpub -d commonpub`
- **deveco.io**: `ssh root@deveco.io` → get `NUXT_DATABASE_URL` from `docker exec deveco-app-1 env`, strip `&uselibpqcompat=true`, use `psql`
