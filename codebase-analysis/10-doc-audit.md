# 10 — Existing Docs Audit

Assessment of `docs/*.md`, `docs/adr/`, `docs/reference/`, and package READMEs
as of session 125. Source: full read-through of every file vs current code.

## Summary

- `docs/sessions/` — **authoritative** for recent changes; trusted
- `docs/reference/packages/*.md` — mostly fresh
- `docs/reference/guides/*.md` — mixed; several pre-date session 108
- `docs/*.md` (top level) — mostly fresh, a few stale (federation-* variants)
- `docs/adr/` — old ones lack status/date fields; several superseded silently
- `CHANGELOG.md` — **critically stale** (ends at v0.2.0, 2026-03-23)
- Package/layer READMEs — all fresh

## Quick status table

### Top-level (`docs/*.md`)

| File | Status | Notes |
|---|---|---|
| quickstart.md | ✔ fresh | Evergreen |
| architecture.md | ✔ fresh | Updated for URL restructure |
| deployment.md | ✔ fresh | — |
| contributing.md | ✔ fresh | Mirrors coding-standards.md |
| coding-standards.md | ✔ fresh | CI-enforced |
| federation.md | ✔ fresh | Comprehensive guide including activity delivery + hub federation (verified 2026-04-16) |
| federation-plan.md | ✔ fresh | Phase table accurate |
| plan-v2.md | ⚠ historical | March-15 snapshot; rename to historical or add banner |
| plan-v3-engineering.md | ❓ unclear | Empty / unused? Verify |
| building-with-commonpub.md | ✔ fresh | — |
| llm-contributor-guide.md | ⚠ stale | Pre-session-100; refresh with new features + gotchas |
| federation-interop-audit.md | ⚠ stale | No mention of recent sessions |
| federation-notes.md | ⚠ stale | Research notes; move to archive |
| federation-testing-plan.md | ⚠ stale | Pre-implementation; move to archive |
| migration-switch.md | ⚠ archive-candidate | v1→v2 migration, historical |
| a11y-audit.md | ⚠ partially stale | Session 122 audit revealed additional issues not in this file |
| audit-119.md | ⚠ outdated | Findings file from audit sweep; many fixed since |
| federation-map.md | ⚠ status unclear | Check if still current |

### ADRs (`docs/adr/*.md`)

24 ADRs total. Ones with explicit dates (2026-03-11+):
- 023 Polish & Launch ✔
- 024 CommonPub rename ✔ (historical marker)
- 025 Nuxt framework switch ✔
- 026 UI Design Direction ✔ **supersedes ADR 006**

Older ADRs (002–022): **no date, no status field.** Most describe decisions
still in effect. Flagging the following as superseded or outdated:

- **006 CSS Tokens** — superseded by 026, not marked
- **005 TipTap** — superseded by 012 TipTap Architecture, not marked
- **019 Federation Architecture** — sessions 074–125 implemented 7 additional
  phases; `federation-plan.md` is newer source of truth
- **018 Community Architecture** — hub types/moderation updated (hub types
  now: community/product/company; v1 hub federation added in session 083+)

### Reference — packages (`docs/reference/packages/*.md`)

All 11 fresh. Accurately describe current public APIs. Cited counts match code
(22 UI components, 20 block types, etc.).

### Reference — server (`docs/reference/server/*.md`)

| Module doc | Status |
|---|---|
| overview.md | ✔ fresh |
| content.md | ⚠ stale (no URL restructure, no blog merge) |
| social.md | ⚠ stale (no voting, no polls, no threaded comments) |
| community.md | ⚠ stale, should be `hubs.md` |
| federation-server.md | ✔ fresh |
| learning-server.md | ⚠ stale |
| docs-server.md | ⚠ stale |
| admin.md | ⚠ stale (no admin nav config from session 124) |
| security.md | ✔ fresh (session 119 hardening) |
| rate-limit.md | ✔ fresh |
| oauth-codes.md | ✔ fresh |
| audit.md | ✔ fresh |
| — contests.md | ❌ **missing** |
| — events.md | ❌ **missing** |
| — voting.md | ❌ **missing** |
| — video.md | ❌ **missing** |
| — messaging.md | ❌ **missing** |
| — navigation.md | ❌ **missing** (stored under homepage pattern) |

### Reference — guides (`docs/reference/guides/*.md`)

| Guide | Status |
|---|---|
| federation.md | ⚠ stale (v1 limitations out of date) |
| routing.md | ⚠ likely stale (url restructure session 108) |
| feature-flags.md | ⚠ stale (missing contests/events/voting flags) |
| admin-and-permissions.md | ⚠ stale (no admin nav or judge perms) |
| theming.md | ✔ fresh |
| url-structure.md | ✔ fresh |
| v1-limitations.md | ⚠ stale |
| hooks.md | ⚠ likely stale |

### Session logs (`docs/sessions/`)

All fresh. These are the **source of truth** for recent changes. When guides
contradict session logs, trust the session log.

## Top 10 highest-impact gaps

1. **Contests system doc** — 3 sessions of work (117, 122, 124), no reference
2. **Events system doc** — session 124–125 built this, no reference
3. **Voting + polls doc** — session 124, no reference
4. **Video system doc** — session 118, no reference
5. **Admin navigation guide** — session 124 phase 3, no reference
6. **Updated feature-flags.md** — missing 3+ flags added recently
7. **Contest judge permissions** — judgeRoleEnum + judgingVisibility workflow
8. **Comment threading** — session 113, no dedicated doc
9. **Article/blog merge** — session 116, no migration doc for consumers
10. **Federation v2 roadmap** — plan-v2 is "done", need v3 plan

## Contradictions to fix

| Doc | Claim | Reality |
|---|---|---|
| architecture.md (older sections) | Separate blog and article types | `contentTypeEnum` still has both, but blog is canonical (session 116 merge) |
| v1-limitations.md | Several "deferred" items | Now implemented (check item-by-item) |
| CHANGELOG.md | Ends at v0.2.0 (2026-03-23) | Current code is session 125 (2026-04-16); 25+ sessions of work unlogged |

Note: an earlier pass claimed federation.md said "No activity delivery" / "No federated hubs" — that was wrong. Verified 2026-04-16 that federation.md covers both.

## Recommended actions

### Immediate

1. **Update `CHANGELOG.md`** — aggregate sessions 108–125 into semver-style entries
2. **Fix `federation.md` contradictions** — the two false claims above
3. **Add stubs for 5 missing server module docs** (contests, events, voting, video, messaging)
4. **Update `feature-flags.md`** — add contests, events, seamlessFederation
5. **Mark superseded ADRs** — append a banner linking to the newer doc

### Short term

1. Refresh 5 stale server module docs (content, social, community, learning, docs-server, admin)
2. Refresh 4 stale guides (federation, routing, feature-flags, admin-and-permissions)
3. Write `docs/guides/users/` and `docs/guides/developers/` (NEW — this audit)
4. Archive `federation-notes.md`, `federation-testing-plan.md`, `migration-switch.md` into `docs/archive/`

### Long term

1. Add "status" + "date" fields to every ADR
2. Establish a "docs updated in same session as code" policy (it's in CLAUDE.md standing rules but not consistently applied)
3. Automate a doc-staleness check in CI (e.g. last-modified vs mentioned feature's touch date)
