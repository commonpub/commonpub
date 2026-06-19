# Session 209 — kickoff / handoff (next)

Date: 2026-06-19. **Supersedes `207-kickoff-next.md`** (still accurate for the deep-audit findings;
this doc is the current branch state). Companion: the paste-ready prompt in
`209-kickoff-prompt.md`, the audit report `208-ui-ux-functionality-audit.md`, the operator runbook
`docs/STATUS.md`.

---

## TL;DR — where things stand

**commonpub.io is healthy and LIVE on the sessions 203-204 audit remediation** (main `d1ce1320`).
deveco.io / heatsynclabs.io are NOT rolled (nothing published since).

**Active branch: `monolith-splits` — 17 commits ahead of main, NOT pushed / NO PR / NOT deployed /
NOT published** (per standing instruction: all this session's work stays on this branch). Everything
below is committed, fully green (layer suite **1109 tests**, `nuxt typecheck` clean), and
adversarially self-audited.

`git diff --stat main..HEAD` → **57 files, +1634/-422.**

---

## What's on the branch (3 bodies of work)

**1. Monolith splits + refactors (TDD, tested):**
- `useEditorAutosave` composable extracted from `docs/[siteSlug]/edit.vue` (1434→1397).
- `projectBlocks.ts` util (5 pure block parsers) extracted from `ProjectView.vue` (1656→1522) + a
  pre-existing TOC-anchor bug fixed (slug raw text to match the renderer).

**2. Deep verification audit** (sessions 203/204 deploy verified live; new findings in `207`): the
NEW P1 `likeRemoteContent` non-transactional like race is documented but **still unfixed** (see Deferred).

**3. UI/UX + functionality audit (7 agents) + Phase A+B fixes** (`208` has the full report). All SHIPPED,
tested where the surface allows, mutation-proven:
- **Search** "Most Liked" sort (was a one-click 400) — wired through schema/route/Meili/PG/listContent.
- **Admin API keys** gated behind `publicApi` (routes + sidebar + page) so admins can't mint dead keys.
- **"I Built This"** state hydrates on load (new GET routes) — re-click no longer un-marks + decrements.
- **Error-as-empty** masking fixed on 6 listing pages (error+retry instead of "No X yet").
- **Follower/following**: fixed a real shape bug (lists rendered EMPTY — page read a `{items,total}`
  object as an array) + viewer-aware `isFollowing` so the Follow button reflects the viewer.
- **a11y**: ProjectView tabs → full tablist/roving-arrows; SearchSidebar clickable divs → real buttons;
  layout palette tiles → Enter/Space keyboard insert (records history); **all 7 flagged forms' labels
  associated** (WCAG 1.3.1/4.1.2, index-aware ids in loops).
- **Misc**: cert loading state, ExplainerView comments, assertive error toasts, share() toast, nav
  Home exact-active, video Featured dedup, 4 silent-catch→toast.
- **Self-audit fixes** (final commit `df40f6b7`): the adversarial review of this branch caught a P1 I
  introduced (onPaletteInsert didn't record to history → undo desync) + 2 P2 + 2 P3, all fixed.

**Audit verdict:** branch is sound and safe to merge. The server-package changes (schema sort enum,
listContent/contentSearch orderBy, listFollowers `viewerId`) were verified **purely additive +
backward-compatible** — safe to publish to deveco/heatsync (no broken callers, no N+1, empty-array
guarded, optional params/fields).

---

## DECISION NEEDED — how to land this branch

The branch mixes internal refactors, user-facing UX/a11y fixes, AND server-package changes. Options
(not mutually exclusive):

1. **Merge → deploy commonpub.io** (push `main`, deploy.yml runs on push). Ships all the UX/a11y fixes
   + refactors to the live reference app. No new migration this cycle (verify), so the deploy is
   low-risk. This is the natural next step.
2. **Publish + roll to deveco/heatsync.** The schema/server changes (search likes, follower
   isFollowing) are consumer-safe per the audit. If rolling: bump + publish in dependency order
   (`schema → protocol → server → infra → explainer → layer` per `207`'s corrected list — though THIS
   branch only changed schema/server/layer, so re-confirm the changed set), then bump consumer pins +
   CLI. Outward-facing; needs explicit go-ahead. The 203/204 SECURITY fixes ALSO still need this roll.
3. **Keep iterating on the branch** (Phase C below) before landing.

---

## Deferred backlog (NOT done — needs decisions / its own efforts)

**From the deep audit (`207`):**
- **P1 `likeRemoteContent` race** (`packages/server/src/federation/timeline.ts:225-281`) — non-transactional
  check-then-act → double counter + duplicate federated Likes, unrecoverable (not in reconcile). Confirmed
  still unfixed. Fix: tx + unique index + `onConflictDoNothing`; test via the real-Postgres harness.
  `boostRemoteContent:286` has no dedup either. **Highest-value correctness fix.**
- **P2 latent**: 10 hand-rolled `Math.min(limit ?? N, 100)` clamps repeat the NaN-500 footgun (not live —
  edges use `z.coerce`). Route them through `normalizePagination`.

**From the UI/UX audit (`208`, Phase C — feature builds / product decisions):**
- **Hub invite UI (P0)** — invite-only/approval hubs are unjoinable (no invite UI exists). Highest UX gap.
- Hub member-management page is orphaned (unlinked) + ban backend has no UI.
- Video sort options are dead (no `sort` in `videoFiltersSchema`) + no video-category admin UI.
- Products are read-only after create (edit/delete backend, no UI).
- Learning per-lesson completion never reads back (`getCompletedLessonIds` called by no endpoint).
- Homepage 3-path consolidation (2-phase deploy: seed layouts first); RBAC `useCan`-driven admin chrome;
  profile per-tab pagination + own-drafts; federated-follow-from-profile; megalodon TOCTOU residual.

---

## Repo conventions / landmines (MUST follow)

- **Tests-first, mutation bar**: a fix needs a test that goes RED when reverted. Pure logic → unit test;
  components → @testing-library/vue (stub Nuxt auto-imports on `globalThis`, see ProjectView.test.ts);
  DB logic → the real-Postgres harness (`packages/server/src/__tests__/helpers/` — PG is reachable in
  THIS environment, tests run locally; CI has a PG service; `describe.skipIf` otherwise).
- **Gates**: `cd layers/base && pnpm exec vitest run` (1109 baseline) AND `cd apps/reference && pnpm
  typecheck` (vue-tsc strict — looser vitest/esbuild passes locally but CI's vue-tsc is stricter). After
  changing a `packages/*` type, rebuild that package (`pnpm --filter @commonpub/<pkg> build`) so the
  layer typecheck sees it.
- **Edit tool needs a prior Read** of each file (a `grep`/`sed` via Bash does NOT count) — Read first.
- **Committed migrations only** — never `db:push`. **Never deploy deveco/heatsync without curl-verifying**
  (their deploy health is warn-only). **commonpub.io deploys on push to main** (deploy.yml; `pipefail`
  migration gate + hard-fail smoke).
- **CLAUDE.md standing rules**: no AI co-author / `Co-Authored-By` in commits (ANY repo); no feature
  without a flag; `var(--*)` only (no hardcoded colors/fonts); TS strict (no `any`); **no em dashes in
  user-facing copy** (labels/hints/toasts/titles — comments exempt); `cpub-` class prefix.
- **`dist/` is gitignored** — don't commit build artifacts.
- **Adversarially verify** agent findings + your own work against source before claiming done — this
  session that caught a silently-failed grep (a duplicate fn) and a self-introduced undo-desync P1.
