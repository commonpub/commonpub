# Session 125 Handoff

## Current State (2026-04-15, end of session 124)

All 7 phases of the Curated Destination Transformation are complete. Both instances deployed and verified working.

### Deployed Package Versions
| Package | Version | Instance |
|---------|---------|----------|
| @commonpub/schema | 0.13.0 | both |
| @commonpub/server | 2.41.0 | both |
| @commonpub/config | 0.10.0 | both |
| @commonpub/layer | 0.14.1 | both |

### Database State
SQL applied manually to both instances (drizzle-kit push fails for new enums in CI):
- **6 enum types:** vote_direction, judge_role, judging_visibility, event_status, event_type, event_attendee_status
- **notification_type:** 'event' added
- **3 columns:** hub_posts.vote_score, contests.community_voting_enabled, contests.judging_visibility
- **7 tables:** events, event_attendees, hub_post_votes, poll_options, poll_votes, contest_entry_votes, contest_judges

### Feature Flags
| Flag | commonpub.io | deveco.io |
|------|-------------|-----------|
| content | true | true |
| social | true | true |
| hubs | true | true |
| docs | true | false |
| video | true | false |
| contests | false | true |
| **events** | **false** | **false** |
| learning | true | false |
| explainers | true | false |
| editorial | true | true |
| federation | true | true |
| admin | true | true |

Client-side `useFeatures()` now hydrates from `/api/features` on mount — admin DB overrides are reflected on client within seconds.

### Admin Panel (13 pages)
Dashboard, Users, Content, Categories, Reports, Audit, Theme, Homepage, Navigation, Features, Federation, Settings

### deveco-io State
- Custom `admin.vue` deleted — inherits all 13 admin pages from layer
- All CSS theme variables verified compatible with layer's admin.vue
- `FEATURE_EVENTS` env var mapping added to server config

---

## Session 124 Architecture Summary

### Phase 3: Admin-Configurable Navigation
- `instanceSettings['nav.items']` stores NavItem[] JSONB
- NavRenderer, NavDropdown, NavLink, MobileNavRenderer components
- Styles in default.vue use `:deep()` to pierce into child components (including mobile `@media` block)
- `useAsyncData` fetches nav items (avoids Nuxt TS2589 typed route inference)
- Admin page: `/admin/navigation` — reorder, add/remove, inline editor, child management

### Phase 5: Events System
- `events` + `event_attendees` tables; `events` feature flag (default false)
- RSVP with auto-waitlisting (transaction-wrapped)
- 8 API routes + event edit page
- Feature gates on client middleware + server middleware

### Phase 6: Voting + Polls
- `hub_post_votes` (up/down), `poll_options`, `poll_votes`, `contest_entry_votes`
- `voteScore` on hub_posts; `communityVotingEnabled` on contests
- All vote/poll operations transaction-wrapped
- PostVoteButtons + PollDisplay components exist, wired into DiscussionItem listing
- Contest entry vote API: POST/DELETE endpoints

### Phase 7: Contest Judge Permissions
- `contest_judges` table (role: lead/judge/guest, invite/accept workflow)
- `judgeContestEntry` checks contestJudges table (not JSONB), requires accepted invite, blocks guest judges
- 4 API routes; ContestJudgeManager component on contest detail page

### Key Fixes Applied
- **Race conditions:** voteOnPost, voteOnPoll, rsvpEvent, cancelRsvp in transactions
- **Nav CSS:** All `:deep()` including mobile responsive `@media` block
- **TS2589:** useAuth authPost helper, useAsyncData for nav, typed callbacks
- **Feature flags:** Client hydrates from `/api/features` (was build-time frozen)

---

## What's NOT Wired Yet

These components/APIs exist but aren't integrated into the main UI flow:

1. **PostVoteButtons** — exists, shown in DiscussionItem listing. NOT wired into single-post view or FeedItem.
2. **PollDisplay** — exists, NOT rendered on poll-type hub posts (no detection of post.type === 'poll')
3. **FeedItem still shows likeCount** — voteScore is 0 for all existing posts (no votes cast yet). Will switch when PostVoteButtons are wired into FeedItem.
4. **Contest entry voting UI** — API exists, no component in contest entry cards
5. **Events homepage section** — no EventsSection component for configurable homepage

---

## Known Issues

### Blocking
None — all critical fixes applied.

### Non-blocking
1. **Shell typecheck errors (pre-existing):** dashboard.vue, CommentSection.vue, docs/edit.vue, settings/profile.vue, admin/content.vue — all have $fetch TS2589 or implicit-any from before session 124
2. **drizzle-kit push fails for new enums in CI** — wrapper script swallows TTY errors. Must apply SQL manually. See `memory/feedback_drizzle_push_ci.md`
3. **No waitlist auto-promotion** — cancelling a registration doesn't promote from waitlist
4. **Poll votes immutable** — by design, undocumented
5. **Judge invitation flow incomplete** — no notification on invite, no "My Invitations" page
6. **3 skipped tests** (PGlite limitations)

---

## Suggested Next Work (prioritized)

### High value, low effort
1. **Fix pre-existing shell typecheck errors** — mostly adding type annotations to `.reduce()` callbacks and fixing `useFetch` TS2589 with `useAsyncData` pattern
2. **Enable events on commonpub.io** — toggle in admin features page (now works on client too)
3. **Wire PostVoteButtons into FeedItem** — swap `@vote` emit for actual API call, show voteScore

### Medium effort
4. **Wire PollDisplay into post detail** — detect poll-type posts, show PollDisplay below content
5. **Fix drizzle-kit CI push** — either switch to `drizzle-kit generate` + `drizzle-kit migrate`, or pipe "yes" answers
6. **Waitlist auto-promotion** — on cancelRsvp, query oldest waitlisted → update to registered

### Larger features
7. **Event calendar view** — monthly/weekly calendar component
8. **Event reminders** — notification before event starts
9. **Community voting UI on contest entries** — wire API into entry cards
10. **Consolidate server/utils/config.ts** — deveco and reference have duplicate copies

---

## Critical Rules

1. **Never add Claude as co-author in git commits**
2. **Always use pnpm publish, never npm publish**
3. **When bumping @commonpub/schema minor, update ALL workspace deps to ^new.version** (0.x caret = patch only)
4. **drizzle-kit push fails for new enums** — apply SQL manually to both instances
5. **Nav styles must use `:deep()` including in `@media` blocks** — scoped CSS can't reach child components
6. **No hardcoded colors — always var(--*)**
7. **No feature without a flag**
8. **Publish order: schema → server → config → layer**

## Production Access
- **commonpub.io**: `ssh root@commonpub.io` → `docker exec commonpub-postgres-1 psql -U commonpub -d commonpub`
- **deveco.io**: `ssh root@deveco.io` → get `NUXT_DATABASE_URL` from `docker exec deveco-app-1 env`, strip `&uselibpqcompat=true`, use `psql`
