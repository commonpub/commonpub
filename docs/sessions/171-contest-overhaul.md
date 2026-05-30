# Session 171 — Contest feature audit + overhaul

Deep audit of the entire contest feature (schema → server → API → UI/UX → state
flow), fixing correctness bugs and adding flexibility, with selected
Hackster.io-style patterns. The `contests` flag is **off** on all sites, so this
is workspace-only with no live exposure (no publish performed this session).

## Correctness bugs found + fixed

1. **Split-brained judge system (P0).** `contests.judges` (jsonb, written by the
   create/edit forms + read by `isJudge` and the judges display) was a *separate*
   source of truth from the `contest_judges` table (written by
   `ContestJudgeManager`, read by scoring authorization). End-to-end judging was
   broken via the UI: jsonb judges saw the link but couldn't score; table judges
   could score but never saw the link. The integration test only passed because
   it populated **both**.
   - **Fix:** `contest_judges` table is now the single source of truth.
     `createContest` seeds the table from `input.judges`. `isJudge` / accept
     state / the public judges grid all derive from the table (via
     `/api/contests/:slug/judges`). The legacy jsonb column is retained but no
     longer drives auth or display.

2. **Judge-score privacy leak (P1).** `GET /entries?includeJudgeScores=true` was
   unauthenticated — anyone could read per-judge scores + written feedback. Now
   only the owner/admin/panel-judge get judge scores, and the aggregate `score`
   is nulled for non-privileged viewers until the contest is `completed`
   (`listContestEntries({ revealScores })`).

3. **Accept-invite was unreachable.** The `judges/accept` endpoint existed but no
   UI called it, and scoring requires `acceptedAt` — so judges could never
   score. Added accept banners on the detail page + judge page.

4. **Public v1 API always returned null** for `entryDeadline` / `judgingDeadline`
   / `prizeDescription` (mismatched `PublicContestRow` cast). Serializer now reads
   the real columns (`endDate`, `judgingEndDate`, `prizes[]`).

5. **Ranking** used `ROW_NUMBER` (arbitrary tie-break) and ranked unscored
   entries. Now `RANK()` over scored entries only; unscored → null rank.

6. **Countdown** showed "Judging ends in" but counted to `endDate`; now counts to
   `judgingEndDate` during the judging phase.

7. **Homepage "Active Contests"** listed all statuses → now filters `status=active`.

8. **No date validation** → `createContestSchema` refines (end > start,
   judgingEnd >= end); create/edit forms guard client-side.

## Flexibility added

- `communityVotingEnabled` is now settable (was unreachable — voting was dead).
- `judgingVisibility` (`public`/`judges-only`/`private`) settable.
- **Judging criteria rubric** — new `contests.judging_criteria` jsonb column
  (migration `0006`), settable in create/edit, displayed on the detail page +
  shown as scoring guidance on the judge page. (Display/guidance only; judges
  still submit one 0–100 score.)
- **Category prizes** — prize `place` is now optional and `category` added, so
  themed awards ("Best in Show") work alongside ranked prizes.
- Score range tightened to 1–100 (matches the judge UI contract).

## UI/UX (Hackster-inspired, within the existing design system)

- **Tabbed contest detail** — Overview / Rules / Prizes / Entries (count) /
  Judges (count), ARIA tablist/tab/tabpanel.
- **Phase timeline** in the sidebar (Opens → Submissions close → Judging →
  Results) with the current phase highlighted.
- Judge-invite accept banners; guest/pending/non-judge states on the judge page;
  scoring disabled outside the judging phase.
- Submit dialog disables already-entered content.

## Files

- Schema: `packages/schema/src/contest.ts` (judging_criteria col, prize
  place optional + category), `validators.ts` (new fields + date refine + score
  min 1), migration `0006_contest_voting_visibility_criteria.sql`.
- Server: `contest/contest.ts` (unify judges, persist fields, revealScores gate,
  RANK), `contest/index.ts` + `index.ts` (type exports),
  `publicApi/serializers.ts` (real-field mapping).
- API: `server/api/contests/[slug]/entries.get.ts` (privilege gate).
- UI: all `components/contest/*`, `components/homepage/ContestsSection.vue`,
  `pages/contests/{index,create,[slug]/index,[slug]/edit,[slug]/judge,[slug]/results}.vue`,
  new `components/contest/ContestJudgingCriteria.vue`.

## Verification

- `pnpm --filter @commonpub/schema build` ✓, `@commonpub/server build` ✓
- `nuxt typecheck` (reference) — 0 errors
- server tests **1135 pass** (+6 new contest/publicApi), layer **670**, schema **471**
- Migration `0006` = single `ALTER TABLE contests ADD COLUMN judging_criteria jsonb`.

## Hardening pass + release (same session, part 2)

Re-audit found three more items, all fixed:

1. **`judgingVisibility` was set but not enforced.** Added the pure helper
   `shouldRevealScores(visibility, status, privileged)` (exported from server),
   wired into `entries.get`. `public` → always; `judges-only` → after completed;
   `private` → never to the public (ranks may still show). Exhaustively
   unit-tested + a source-contract test locks the endpoint wiring
   (`layers/base/server/api/contests/__tests__/entries-score-gating.test.ts`).
2. **`v-model.number` empty → `''` bug.** Category-only prizes and weightless
   rubric criteria would have failed Zod (`z.number().positive()` rejects `''`).
   create/edit now coerce empty `place`/`weight` to `undefined`.
3. **Tab a11y.** Added the WAI-ARIA arrow-key / Home-End / roving-tabindex
   keyboard pattern to the contest detail tabs.

**Ground-truth correction (important):** `contests` is **live (`true`) on all
three instances** via `apps/reference/commonpub.config.ts` + per-instance config —
NOT dormant as the build-time `nuxt.config` default suggested. So this was a
**bugfix release to a live feature**, including closing the live unauthenticated
judge-score leak. (Lesson: `curl /api/features` before calling a flag dormant.)

**Tests:** server **1146** (+11: visibility matrix, guest/unaccepted/promote
judge auth, owner-only transition, accept idempotency, community voting),
schema **477** (+6: date refine, new fields, category prizes), layer **675**
(+5: entries score-gating contract). `nuxt typecheck` 0 errors.

**Docs:** `docs/llm/facts.md` + `gotchas.md` (contest invariants), README,
`docs/reference/guides/contests.md` (new), reference index.

## Release

Published schema/server/layer (minor bumps), updated `create-commonpub` pins +
deveco + heatsync, deployed all three, verified `/api/features`, `/contests`, and
that the judge-score leak is closed. (See `172-kickoff-next.md` for the live
state snapshot.)

## Open / next

- Possible follow-ups: per-criterion scoring (vs single 0–100), participants tab,
  surfacing community-vote counts in results, contest discussion board,
  transaction-safe `judgeScores` jsonb update (current read-modify-write can lose
  a concurrent judge's update — low risk with small panels).
