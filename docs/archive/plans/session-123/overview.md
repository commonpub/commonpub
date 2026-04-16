# Session 123+ — Curated Destination Transformation

## Phases & Estimated Sessions

| Phase | Name | Sessions | Dependencies |
|-------|------|----------|-------------|
| 0 | Quick Fixes (explore grid, license) | 1 | None |
| 1 | Staff Content + Editorial Curation | 3-4 | None |
| 4 | Runtime Feature Flags | 2-3 | None (moved up) |
| 2 | Configurable Homepage | 4-5 | Phase 1 |
| 3 | Admin-Configurable Nav | 3-4 | None |
| 5 | Events System | 4-5 | Phase 4 |
| 6 | Voting + Polls | 3-4 | None |
| 7 | Contest Judge Permissions | 2-3 | None |

**Total estimated: 22-32 sessions**

## Key Architectural Decisions

1. **Homepage sections stored in instanceSettings JSONB** (key: `homepage.sections`)
2. **Nav items stored in instanceSettings JSONB** (key: `nav.items`)
3. **Feature flag overrides stored in instanceSettings** (key: `features.overrides`)
4. **60-second TTL cache** on merged config to avoid DB hits per request
5. **Events as separate table** (not content type extension)
6. **Staff content = isEditorial flag** + structured categories table (not separate type)
7. **Voting = directional** (+1/-1) replacing simple likes, keeping old data via migration
8. **Judge permissions via junction table** replacing string array, with role enum

## Files Most Affected (across all phases)

- `packages/schema/src/content.ts` — editorial flag, categoryId FK
- `packages/schema/src/hub.ts` — hubPostVotes, pollOptions, pollVotes
- `packages/schema/src/contest.ts` — contestJudges, contestEntryVotes
- `packages/schema/src/events.ts` — NEW
- `packages/schema/src/enums.ts` — 4+ new enums
- `packages/schema/src/validators.ts` — many new validators
- `packages/server/src/admin/admin.ts` — editorial/bulk actions
- `packages/server/src/content/categories.ts` — NEW
- `packages/server/src/homepage/homepage.ts` — NEW
- `packages/server/src/navigation/navigation.ts` — NEW
- `packages/server/src/events/events.ts` — NEW
- `packages/server/src/hub/votes.ts` — NEW
- `packages/server/src/hub/polls.ts` — NEW
- `packages/server/src/contest/judges.ts` — NEW
- `packages/server/src/contest/voting.ts` — NEW
- `packages/config/src/schema.ts` — events feature flag
- `layers/base/pages/index.vue` — homepage rewrite
- `layers/base/layouts/default.vue` — nav renderer
- `layers/base/composables/useFeatures.ts` — runtime flags
- `apps/*/server/utils/config.ts` — config merge with DB
