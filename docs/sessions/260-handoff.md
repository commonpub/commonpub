# Session 260 handoff: judging readiness for deveco round 1

Full detail: `docs/sessions/260-judging-readiness.md`. Operator runbook and judge guide:
`docs/guides/contest-judging.md`. Fake-account options: `docs/plans/fake-account-handling.md`.
Previous: `docs/sessions/259-handoff.md`.

## Read this first

**Nothing from this session is released.** Branch `fix/judging-readiness` is local and
unpushed: 13 code and doc commits on top of `main` 38e3970f, plus the commit carrying this handoff. deveco still runs layer 0.138.1 / server
2.136.0 and has every bug this session found.

**deveco's first review round opens 2026-10-09 15:00 UTC, and the contest is not ready**
(checked 08:47 UTC by request):

| | live value | needed |
| --- | --- | --- |
| status | `active` | `judging` (press Start Judging) |
| judges | **0 invited** | panel invited and every judge accepted |
| entries | **22**, one more than at 22:15 UTC last night, after the 15:00 UTC deadline. Proposals stay open until the status changes | Start Judging closes them |
| rubric | none on the round or the contest | judges give one score from 0 to 100. Fine, or add criteria first |
| Winner Showcase `startsAt` | year 0001 | real date |

Those are operator actions in the contest editor. The runbook walks through them.

## State at handoff (2026-10-09)

**Published / live:** unchanged since 259. schema 0.67.0 · config 0.41.0 · infra 0.23.0 ·
server 2.136.0 · layer 0.138.1. All three instances are on 48 flags, with migrations
through 0049.

**Branch release, if approved:** server 2.136.0 → **2.137.0** (new exports:
`getContestJudgeMembership`, `stageHasClosed`, `currentStage`) and layer 0.138.1 →
**0.138.2**. Only the layer depends on server, so nothing else republishes. **No schema
change and no migration.**

- deveco pins `^0.138.1` / `^2.136.0`. Both carets reach the new versions, but **raise
  the floors** to `^0.138.2` / `^2.137.0`, because a satisfied caret never upgrades
  itself.
- Refresh **both** of deveco's lockfiles: CI uses pnpm and the Dockerfile uses npm.
  Count `node_modules/vue` entries in package-lock before merging.
- deveco's deploy doesn't wait for CI and can't fail on a bad container, so check
  `/api/health` and one contest page after the swap.

**Suites on the branch:** server 2201 passed + 11 skipped (245 contest). The 8
real-Postgres concurrency tests skip because local Postgres is down with Docker; the
other 3 skips predate the branch. Layer 3034. Reference typecheck is clean; a planted
error proved it covers layer pages. Lint: 0 errors (3 pre-existing warnings in
`utils/contestStages.ts`).

## What the branch fixes (grouped)

**Live on deveco today, from the first score:**

- Judges saw only the newest 20 entries; deveco has 22.
- An anonymous `?order=rank` request read the live judging standings.
- A pending (unaccepted) invitation could read every score, all feedback and the
  export.
- Every judge received every other judge's scores and feedback.
- Hydration mismatch on every contest page with entries, for anyone off UTC.
- Hero status buttons changed the status on one click, including "Complete & Publish".
- Proposal answers could be overwritten after the deadline, with no history kept.
- A removed judge's scores kept counting.
- Test sends revealed any picked member's email address.

**Round-1 cut (Oct 12):**

- A mistaken cut couldn't be undone; a re-run could only shrink the field.
- Every review round's Advance button was live, the finals one included.
- The cut could run outside judging, or move the stage pointer backwards.

**Build Sprint / December:**

- Scoring between rounds blended rounds.
- A new entry could join, or an eliminated one rejoin, if the status went back to
  active.
- The finals cut ranked on stale round-1 averages.
- **Finals judges saw the original proposal, with no link to the built project.**
- **Unpublished winners were missing from the public results**, with no warning to the
  organizer.

**UX:**

- Judge page: inputs start blank, whole numbers only, unsaved-work marker and leave
  warning, loading and error states, a notice between rounds, an "edited after the
  deadline" badge, an unscored-only filter, and proposals shown in the preview.
- Advancement: a per-judge scores and feedback panel; only the open round can be
  cut.
- Entrants are told their own outcome after a cut.
- Submitting a proposal no longer drops the entrant into a blank editor.
- Admin users page: pagination.

## How it was verified

1. Unit and integration tests, test-first. **Every new server test fails against the
   old code**: checked by stashing the fix.
2. A dev-server browser pass on a deveco-shaped mirror.
3. **A full-contest persona walk-through on the production Docker image** (the repo
   Dockerfile, with migrations via `scripts/db-migrate.mjs` on a fresh database):
   - organizer, 3 judges + guest + a pending invitee, 6 entrants, a latecomer, and an
     anonymous visitor;
   - each persona on its own IP, so production rate limits stayed on;
   - a real-time deadline.

   That walk found the hydration mismatch and the finals and results defects, none of
   which tests or the dev server could show.

**The second walk, after its fixes and the audit fixes, did not run.** Docker Desktop failed: containerd
I/O errors with the host disk at 98% (about 12 GB free; Docker.raw is about 26 GB).
Docker, and with it the local Postgres, is still down. I didn't prune or reset any
Docker data; that's the operator's call. Commits 2a0f7fc6, 3765ab4e, 9b8a2ca8 and 17e7b355 are covered by
tests, typecheck, lint and code review, not by a second browser pass. **The judge-page
P0 above is exactly the kind of thing a browser pass catches.** The first walk showed
"Score saved." because the refresh is quick locally. Re-walk before trusting the UI.

## The branch was audited after the walk-through (2026-10-09)

Three independent reviewers covered server logic, routes and privacy, and UI and
server rendering. **No P0 in server or routes, and nothing more exposed than on
`main`.** Found and fixed in 9b8a2ca8 + 17e7b355:

- **P0 (UI): every score save blanked the judge page.** `refresh()` sets the status
  back to `pending`, and the new loading state unmounted every card, so the judge was
  thrown to the top after each save. Loading and error states now gate on "no data
  yet".
- **P1: the "later round started" guard skipped a pointer moved back by hand.** A cut
  could clear a scored finals round. Now checked for every cut. Mutation-tested.
- **P1: a judge removed while their score request waited could still land one
  score.** Membership is re-checked under the entry lock.
- **P1: after the deadline, Submit prompts stayed in the hero, the mobile bar, the
  entries tab and the signup card.** One shared `contestEntriesClosed` helper now
  hides all of them.
- **P1: after the final cut, finalists were told to keep building for a next round.**
- **P1: a manual re-run couldn't see the entries it had cut.**
- **P1: unscored finalists vanished from results.**
- **P1: two contradictory toasts on proposal submit.**
- **P2s:** a manual cut with no valid ids or Top-N below 1 eliminated everyone; the
  legacy re-run fallback; the personal-data route and the showcase import accepted a
  pending judge; the results note wording; admin search scrolled and leaked a timer.

**Reviewed and left open (P2, recorded):**

- A judge can derive another judge's score from the aggregate (`2*avg − mine` with
  two judges). The aggregate is visible to judges under judges-only by design.
- An accepted guest judge is a privileged reader (drafts, export) while the page tells
  them only that they can't score. Same as `main`.
- `votes.get` lists hidden entry ids and counts. Older behaviour.
- A test send can go to any member, not just this contest's people. The address no
  longer leaks.
- The panel doesn't mirror the server's "later round started" refusal; the server
  refuses with a message.
- `stageDeadlinePassed` isn't reactive, so an open tab keeps its form until reload.
  The server refuses.
- "Show only unscored" drops a card the moment it's saved, together with its
  confirmation.

## Decisions made

- **Stage deadlines are enforced for organizer-defined stages only** (`stageHasClosed`
  skips synthesized `core` stages). A classic contest's end date has never been
  enforced, and fixtures date-anchored in the past depend on that.
- **Start Judging moves an explicit submission-stage pointer to the next review
  round.** Scoring now refuses non-review stages, so otherwise the button could open
  judging with nothing scoreable.
- **A cut clears the live score when a later review round exists.** Each round starts
  clean, and ranks come from the last round. The snapshot in `stageState` keeps each
  round's result.
- **Judges see only their own per-judge scores.** The aggregate under `judges-only`
  stays visible to them, which is what that setting means. That anchors judges, but
  it's a product decision, so left alone.
- **Per-contest editors are privileged readers of entries**, because they can run the
  cut.
- **Judges may still enter the contest.** In the walk-through a judge's own entry won.
  That's policy, so it went into the runbook, not code.

## Next, in order

1. **Release and roll before 15:00 UTC, or not.** The operator decides. Without it,
   round 1 runs on 0.138.1 and the runbook's **[before the update]** notes apply.
   The biggest one: **only 20 of 22 entries reach judges.**
2. **Operator actions on deveco** (runbook Part 1): invite judges and get acceptances,
   press Start Judging, fix the 0001 date, set max entries per person to 1, review
   the duplicate wildfire entry (maxic93 and pldubouilh) and the 22nd, late entry.
3. **Free disk space, restore Docker, and re-run the persona walk** against the
   rebuilt image. The harness is described in the session log. It was a throwaway
   `walk.mjs`, deleted, so rebuild it or add a Playwright spec.
4. Open from the audits, not blocking:
   - Reminders and announcements can't target only the people still in the running.
   - A tie at completion produces two first places and no second.
   - A criterion weight of 0 counts as 100, and duplicate criterion or stage ids are
     accepted. Fixing either changes a schema validator, which cascades.
   - A rubric can be bypassed through the API.
   - `user-search` ignores profile visibility.
   - A stale editor form can reset the current stage.
   - The hero still offers "Log in to register" (registering, not submitting) after
     the deadline, before Start Judging.
   - The audit's open P2s above.
5. Still open from 258/259: PR #92, rotate the crates.io token, `sharp` ≥ 0.35, and
   make deveco's deploy able to fail.

## Things that will bite the next person

- **Nothing in a contest happens on a date.** Stage dates drive the timeline and
  reminders, never status. Proposals stayed open after the deadline and a 22nd entry
  arrived.
- **List routes return 20 rows by default.** Any "show everything" surface must page.
  Use `utils/fetchAllPages.ts`, and in SSR wrap it with `useRequestFetch`.
- **Production hydration bugs need a production build and a browser off UTC.** The
  dev server and the unit tests both missed the entry-date mismatch.
- **Contest notifications never email.** Judge invitations arrive in the bell only.
- **The `x-forwarded-for` trick for distinct-IP personas must be scoped to the app's
  host.** Sent to the font and icon CDNs, it fails their CORS preflight and strips
  every icon from the screenshots.
