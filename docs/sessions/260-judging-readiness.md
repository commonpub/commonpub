# Session 260 — judging readiness audit, admin users pagination, fake-account options

Date: 2026-10-08. Branch `fix/judging-readiness`. Previous: `259-handoff.md`.

## Why

deveco's Qualcomm contest moves from proposals to its first review round
("Semi-Finalists Selection (50)", 2026-10-09 15:00 UTC). The operator asked for an
audit of judging, so that the instructions are solid and the system is intuitive and
works. They also asked for admin users pagination and options for likely-fake
accounts.

## Live state found (deveco, 2026-10-08 ~22:15 UTC, by request)

- status `active`, `currentStageId` null, `entryCount` 21 (12 publicly visible, the
  rest draft proposal placeholders).
- **Zero judges invited** (`GET /judges` → `[]`).
- Proposal stage `endsAt` 2026-10-08 15:00 UTC has passed, but the proposal form is
  still open, because nothing closes it except a status change.
- No rubric on the review stage or at contest level, so judges give a single 0–100
  score.
- The Winner Showcase stage `startsAt` is `0001-12-19` (data entry error).

## Defects found and fixed (layer only)

1. **Judges saw only 20 entries.** Every entries fetch used the route's default
   limit of 20. With 21 entries, the oldest proposal never reached any judge, and
   the progress bar read "20 / 20". Same bug in the advancement manual picker and on
   the contest page, where it was also session 256's open item #3: an entrant's own
   older entry fell off, so the form invited a duplicate. New
   `utils/fetchAllPages.ts` reads every page. The contest page uses
   `useRequestFetch` so the SSR pass keeps the viewer's cookie.
2. **"View entry" was a dead link for proposals.** It pointed at the content page,
   which 404s for a draft unless you're the author. It now opens the entry page,
   which shows every stage's submission.
3. **Judge feedback was stored and shown nowhere**, organizer included. The
   advancement panel now has "Scores and feedback" per round: average, "k of N
   judges", and each judge's score and comment. A Top-N confirm warns when entries
   in the round are unscored, since they rank last.
4. A judge's own entry now says it can't be scored, and drops out of their progress
   count (the server already refused the score).
5. The judge page says who sees scores and feedback.
6. **Admin users page** requested no limit, so only the 20 newest accounts were
   reachable. Now 50 per page with first/prev/next/last, and filters reset to page 1.

Verified in a browser locally on a mirror of the deveco setup (proposal-mode stage,
null current stage, 25 entrants, one judge): the judge sees 25, scores the oldest,
the draft entry page opens with the proposal text, no horizontal overflow at 390px,
the advancement panel shows the score and feedback, the manual picker lists 25, and
the oldest entrant sees their own entry. The admin pager covered 710 users over 15
pages, and search resets to page 1. A planted type error confirmed the reference
typecheck covers layer pages.

## Found, NOT fixed (server changes, not needed for round 1)

- **Attaching a published project as an entry only checks `status === 'active'`,
  never the stage** (`submitContestEntry`). While the contest is active past the
  proposal deadline, or if it's set back to active for the Build Sprint, anyone
  registered can add a fresh entry. That entry hasn't been eliminated, so it would
  sit in the finalist round. The runbook says to keep the status on judging through
  the sprint.
- **Scoring when the current stage isn't a review stage** saves untagged scores, and
  the live average mixes them with earlier rounds. After the round-1 cut the current
  stage becomes Build Sprint, so round 2 needs the operator to set the current
  stage by hand. Fix: refuse to score outside a review stage. Do this before
  December.
- Any judge row, including pending and guest judges, counts as privileged on the
  entries routes, so they can read other judges' scores and feedback through the
  API. The UI doesn't show them.
- Contest notifications never email (`TYPE_TO_PREF` has no `contest`), so judge
  invitations reach no one who isn't checking the bell. The contest-communications
  plan specifies judge invite and reminder emails. Still unbuilt.
- Re-running an advancement re-sends every entrant's advanced/eliminated
  notification.

## Docs

- `docs/guides/contest-judging.md`: organizer runbook (step by step for deveco
  round 1, the Build Sprint status rule, and the round-2 manual step) plus a judge
  guide to send to the panel.
- `docs/plans/fake-account-handling.md`: current capabilities, common practice,
  no-code steps now, and a ranked build list.

## Open

- Publish layer 0.138.2 and roll it to deveco before or early in round 1. The
  operator's call.
- The server fixes above, before the December finalist round.
- PR #92 still open (session 259).
