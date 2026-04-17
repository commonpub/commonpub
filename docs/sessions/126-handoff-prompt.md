# Session 126 → 127 Handoff

Context-reset prompt for a fresh Claude Code instance continuing work on
CommonPub.

## Repo orientation — read these first

1. `CLAUDE.md` — project rules (auto-loaded). **Standing rules are hard constraints.**
2. `docs/llm/facts.md` — condensed architecture (always load)
3. `docs/llm/conventions.md` — code style, naming
4. `docs/llm/gotchas.md` — non-obvious pitfalls
5. `docs/llm/task-recipes.md` — step-by-step flows for common work

For deep reference when needed: `codebase-analysis/` (12 files — the raw
inventory of tables, routes, components, feature flags, state diagrams).

For session history: `docs/sessions/126-doc-overhaul-audit-scaling.md`
(what was done last session) and earlier numbered logs.

## Current state as of session 126 (2026-04-16)

**Deployed and stable on both instances:**
- commonpub.io — Droplet + self-hosted Postgres
- deveco.io — DO App Platform + managed Postgres

**Published versions:**
- @commonpub/schema 0.13.0, server 2.43.0, config 0.10.0, layer 0.15.3
- ui 0.8.5, protocol 0.9.9, editor 0.7.9, explainer 0.7.11
- learning 0.5.0, docs 0.6.2, auth 0.5.1, infra 0.5.1, test-utils 0.5.3

**CI status:** commonpub typecheck GREEN, rust GREEN, e2e RED (pre-existing,
unrelated to typecheck work). deveco-io all GREEN.

**Docs:** comprehensively reorganized in session 126; see
`codebase-analysis/` + `docs/guides/` + `docs/llm/` for current.

## Open threads, in rough priority

### 1. Commonpub E2E failures (pre-existing, real bug, unassigned)

The e2e job has been red for 9+ consecutive commits. Specific failures:

- `editor.spec.ts:69` — pages being navigated to render "500 — CommonPub"
  as title (actual 500 error surfacing to the browser)
- `editor.spec.ts:85` — `/docs` page emitting fatal console errors
  (404/500 fetches)
- `navigation.spec.ts` — hero banner dismiss button not hiding the banner

These are worth investigating. The 500s in editor.spec suggest a real
runtime error on docs or editor pages — probably a query or guard
that's blowing up.

### 2. Scaling — Redis integration (optional)

`codebase-analysis/12-scaling-and-infrastructure.md` documents the plan.
If anyone asks to "make instances scalable" or plans a multi-instance
deploy, start with:

- Rate limit store → Redis (P1 — in-memory currently resets on deploy)
- SSE fanout → Redis pub/sub (P1 — cross-instance writes invisible today)
- Delivery queue → Postgres LISTEN/NOTIFY or BullMQ (P3)

Do NOT migrate to Fedify. `@commonpub/protocol` is hardened pure-TS;
migration would lose battle-tested work for no protocol-level benefit.

### 3. HeatmapGrid endpoint

Session 126 wired HeatmapGrid data by aggregating the existing content
fetch client-side. A dedicated `/api/users/[username]/activity` endpoint
returning per-day counts would be more accurate (especially for users
with > page-1 of content). Low priority.

### 4. Outstanding v1.x gaps (from memory)

- ~70 components without `@media` breakpoints (mobile polish)
- 3 skipped integration tests (PGlite advisory-lock limits)
- `eventAttendees` missing `unique(eventId, userId)` constraint
- `federatedContent.mirrorId` missing FK
- "For You" personalization (was in memory as deferred)
- Notification aggregation (ditto)

## Critical standing rules — DO NOT forget

From `CLAUDE.md`:

1. **The schema is the work** — features start with schema.
2. **No feature without a flag** in commonpub.config.ts.
3. **No hardcoded color/font** — always `var(--*)`.
4. **Standing Rule 15: Never add Claude as co-author** in any commit, in any repo.
5. **pnpm, never npm** for publish (and npm install).
6. **drizzle-kit push fails in CI for new enums** — apply enum SQL to
   deployed DBs manually BEFORE pushing the code change.
7. **`server/utils/config.ts` is required** in every CommonPub instance
   (Nitro-side config resolver — merges env + DB overrides over
   commonpub.config.ts defaults).

## What NOT to do

- Don't touch `CLAUDE.md` (it's our rules; kept out of doc overhauls).
- Don't archive more docs without user confirmation — the large archival
  pass happened in session 126.
- Don't try to unify `design-system-v2/` — it's Figma HTML exports,
  effectively read-only.
- Don't migrate to Fedify or BullMQ without explicit user direction.

## Quick doc links

- Scaling plan: `codebase-analysis/12-scaling-and-infrastructure.md`
- Doc audit (executed): `codebase-analysis/10-doc-audit.md`
- Gotchas: `codebase-analysis/09-gotchas-and-invariants.md` + `docs/llm/gotchas.md`
- CHANGELOG Unreleased: sessions 108–125 bundled

## Session 126 commits (reference)

```
dca7fab docs(audit): one more broken link + audit-state banner
c55702e fix(docs): broken links to archived docs/contributing.md
a8ba9d1 docs: add scaling + infrastructure doc; record Redis-not-integrated gotcha
666f235 docs(audit): Fedify, Redis, test count — substantive corrections
060faf0 docs(audit): deveco file count, /admin/search/reindex, date checks
a53a8d2 docs(audit): shell config reality + SSRF range precision
2419ca4 docs(audit): CHANGELOG session attribution — sanitizer/SSRF precede 119
fc6878c fix(profile): wire HeatmapGrid to actual activity data
27445db docs(audit): missing HeatmapGrid + explainer/editor file counts
44b11e9 docs(audit): missing pages + cpub extension naming precision
0daa489 docs(audit): composables count 21 → 20
c088fcb docs(audit): fix federated-hubs route prefix
51393e5 docs: fourth audit pass — fabricated backfillMirror + table count
da3eaeb docs: third audit pass — theme count, image variants, email templates, rate tiers
0feb544 docs: second audit pass — cert prefix, hook events, hub-join accuracy
2d73198 docs: audit + correct inaccuracies against current code
05bc937 fix(layer): typecheck errors across consumer apps
a983229 docs: reorganize into guides/llm/codebase-analysis + archive stale
```
