# 11 — Codebase Stats

As of session 125 (2026-04-16). Numbers are approximate — exact counts vary
with test exclusions.

## Headline

| | |
|---|---|
| Published packages | 12 |
| Shared Nuxt layer | 1 |
| Apps | 2 |
| Tools | 2 |
| Tables | 77 |
| Enums | 41 |
| Zod validators | 50+ |
| Server modules | 20+ |
| API routes | 257 |
| Layer pages | 85 |
| Layer components | 106 |
| Composables | 21 |
| Feature flags | 15 |
| Themes | 4 |
| ADRs | 24+ |
| Session log files | 48 (session numbers run 071–125; sessions are sometimes bundled) |
| Tests | 1,939+ (v0.2.0 baseline 2026-03-23); 30/30 & 865 in focused/wider recent runs |

## Per-package sizes (rough)

From package versions and file counts:

| Package | Version | Src files (est.) |
|---|---|---|
| schema | 0.13.0 | 17 TS files (one per domain + validators + index) |
| server | 2.43.0 | 80+ TS files across 20+ modules |
| config | 0.10.0 | 4 TS (types, schema, config, index) |
| layer | 0.15.2 | 200+ files (pages, components, server, composables, middleware, plugins, theme) |
| ui | 0.8.5 | 25 Vue components + theme CSS |
| protocol | 0.9.9 | 15 TS files |
| editor | 0.7.9 | 40+ TS files (blocks + extensions + serialization + vue wrapper) |
| explainer | 0.7.11 | 25+ TS files |
| learning | 0.5.0 | 6 TS files |
| docs | 0.6.2 | 15+ TS files |
| auth | 0.5.1 | 6 TS files |
| infra | 0.5.1 | 5 TS files |
| test-utils | 0.5.3 | 3 TS files |

## Database

- **77 tables** across 15 domains
- **41 enums**
- Counters denormalized on ~15 tables
- 5 soft-delete tables (users, contentItems, hubs, federatedContent, federatedHubPosts)
- Dozens of indexes; all unique constraints documented in `02-schema-inventory.md`

## Recent session churn

| Sessions | Topics |
|---|---|
| 108–110 | URL restructure, federation seamless, UX fixes |
| 111–115 | Editor decoupling, federation, comment threading |
| 116 | Article ↔ Blog merge |
| 117 | Contest system complete |
| 118 | Password reset, docs polish, admin reports, video social, nav badges |
| 119 | Security hardening, sanitizer, group chat read receipts, signed backfill |
| 120 | Test audit (−71/+49), architecture fixes, a11y, loading states |
| 121 | OAuth federation fix (3 bugs), sign-in fix, validation, deveco Dockerfile |
| 122 | Deep audit + v1.0 completion (16 tasks), hub resources/products, a11y, contest notifications |
| 123 | Destination phase 0+1+4+2 |
| 124 | Destination phase 3/5/6/7 — nav, events, voting, judges |
| 125 | Events UI, contest voting, theme fix |

## Schema growth (session 124 adds)

- 8 new tables: events, eventAttendees, hubPostVotes, pollOptions, pollVotes, contestEntryVotes, contestJudges, (and one more for federation)
- 6 new enums: judgeRoleEnum, judgingVisibilityEnum, voteDirectionEnum, eventStatusEnum, eventTypeEnum, eventAttendeeStatusEnum
- 3 new columns: voteScore (hubPosts), communityVotingEnabled (contests), judgingVisibility (contests)
- notificationTypeEnum gained `event`

## Docs coverage

- 45 reference files (packages + server + guides)
- 24+ ADRs
- 48 session log files (numbered up to 125 — some sessions bundled)
- 25% estimated stale (see `10-doc-audit.md`)
- ~10 critical missing docs for recently-added features

## Test coverage

- 1,939+ tests across 12 packages (as of v0.2.0 2026-03-23; likely higher now)
- 30/30 tests passing in recent session verification
- 865 tests in focused subsets
- 3 PGlite-skipped integration tests
- Stryker mutation: 72% score for sanitizer, per-package targets available
