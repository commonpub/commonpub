# Session 125 Handoff — Post-Destination Transformation

## What This Is

CommonPub completed the 7-phase "Curated Destination Transformation" in sessions 123-124. All phases deployed and working on both instances.

---

## Session 124 Summary (2026-04-15)

**12 commits (commonpub) + 2 commits (deveco-io). 22/23 typecheck (pre-existing shell errors), 30/30 tests (865). Both instances DEPLOYED.**

### Phases Completed: 3 (Nav), 5 (Events), 6 (Voting), 7 (Judges)

### Critical Post-Audit Fixes
- **Database schema applied manually** — drizzle-kit push fails in CI for new enums (TTY prompt conflict). SQL applied to both instances.
- **Client feature flags now dynamic** — `useFeatures()` hydrates from `/api/features` on mount. Admin toggles reflected on client within seconds.
- **Nav CSS fixed** — scoped styles now use `:deep()` to reach NavRenderer child components
- **Race conditions fixed** — voteOnPost, voteOnPoll, rsvpEvent, cancelRsvp all transaction-wrapped
- **Judge permissions fixed** — `judgeContestEntry` uses `contestJudges` table, not stale JSONB

---

## Current State (as of Session 124, 2026-04-15)

### Published Package Versions
| Package | Version |
|---------|---------|
| `@commonpub/schema` | **0.13.0** |
| `@commonpub/server` | **2.41.0** |
| `@commonpub/config` | **0.10.0** |
| `@commonpub/layer` | **0.14.0** |
| `@commonpub/protocol` | 0.9.9 |
| `@commonpub/auth` | 0.5.1 |
| `@commonpub/ui` | 0.8.5 |
| `@commonpub/editor` | 0.7.9 |
| `@commonpub/explainer` | 0.7.11 |
| `@commonpub/docs` | 0.6.2 |
| `@commonpub/learning` | 0.5.0 |
| `@commonpub/infra` | 0.5.1 |

### Feature Flags (with defaults)
Enabled: content, social, hubs, docs, video, learning, explainers, editorial
Disabled: contests, **events**, federation, seamlessFederation, federateHubs, admin, emailNotifications

### Admin Panel (13 pages)
Dashboard, Users, Content, Categories, Reports, Audit, Theme, Homepage, **Navigation**, Features, Federation, Settings

### New Database Objects (session 124)
**Tables:** events, event_attendees, hub_post_votes, poll_options, poll_votes, contest_entry_votes, contest_judges
**Columns:** hub_posts.vote_score, contests.community_voting_enabled, contests.judging_visibility
**Enums:** vote_direction, judge_role, judging_visibility, event_status, event_type, event_attendee_status; 'event' in notification_type

---

## Known Issues

1. **Pre-existing shell typecheck errors** — dashboard.vue, CommentSection.vue, docs/edit.vue, settings/profile.vue, admin/content.vue all have $fetch TS2589 or implicit-any (not from session 124)
2. **drizzle-kit push fails for new enums in CI** — must apply SQL manually. See `memory/feedback_drizzle_push_ci.md`
3. **No waitlist auto-promotion** — when registered attendee cancels, waitlisted users aren't promoted
4. **Poll votes are immutable** — by design, but undocumented
5. **Judge invitation flow incomplete** — no notification on invite, no "My Invitations" page

---

## Suggested Next Work

### Immediate (wiring + polish)
1. **Fix pre-existing shell typecheck errors** — dashboard.vue TS2589/implicit-any, CommentSection.vue TS2589
2. **Wire PostVoteButtons into single-post view** — component exists but only shown in DiscussionItem listing
3. **Wire PollDisplay into poll-type hub posts** — component exists but not shown on post detail
4. **Add events to homepage section types** — EventsSection component for configurable homepage

### Short-term
5. **Waitlist auto-promotion** — promote oldest waitlisted → registered on cancel
6. **Judge invitation notifications** — wire into existing notification system
7. **Event reminders** — notification before event starts
8. **Event calendar view** — monthly/weekly view component

### Architecture
9. **Fix drizzle-kit CI push** — either fix the db-push.mjs script or switch to generate + migrate
10. **Consolidate server/utils/config.ts** — deveco and reference have duplicate copies

---

## Critical Rules

1. **Never add Claude as co-author in git commits**
2. **Always use pnpm publish, never npm publish**
3. **pnpm update modifies BOTH package.json and lockfile — commit both**
4. **When bumping @commonpub/schema minor version, update ALL workspace package.json deps**
5. **drizzle-kit push fails for new enums — apply SQL manually on both instances**
6. **No hardcoded colors — always var(--*)**
7. **No feature without a flag**
8. **Publish in dependency order: schema → server → config → layer**
9. **Nav styles in default.vue must use `:deep()` to reach child components**

## Production Access
- **commonpub.io**: `ssh root@commonpub.io` → `docker exec commonpub-postgres-1 psql -U commonpub -d commonpub`
- **deveco.io**: `ssh root@deveco.io` → get NUXT_DATABASE_URL from `docker exec deveco-app-1 env`, strip `&uselibpqcompat=true`, use `psql`
