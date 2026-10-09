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

## Found, NOT fixed in the first pass (most fixed in the deep audit below)

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

## Deep audit (same session, second request: "deep audit everything")

Seven read-only auditors covered judging server logic, the stage lifecycle,
entrant flows and personal data, judge and organizer UX, contest access control,
email/notifications/results, and the deveco fork plus the live site. I verified
every finding I acted on myself. The highest-impact confirmed defects:

| # | Defect | Live on deveco? | Fixed |
| --- | --- | --- | --- |
| 1 | A re-run cut could only shrink the field (eligibility excluded the stage's OWN eliminations), and the panel said "You can re-run this" | Latent until the first cut | server |
| 2 | Any review stage could be cut at any time and status (the Finalists row was a live button in round 1); cuts could move the stage pointer backwards | Yes | server + panel |
| 3 | `?order=rank` sorted by the hidden live score: an anonymous live leaderboard under judges-only | From the first score | server + route |
| 4 | Cuts ranked on the live score, stale for any entry not re-scored that round | Round 2 | server |
| 5 | Scoring outside a review round saved untagged scores that blended rounds | Round 2 | server |
| 6 | Proposals accepted and proposal answers **overwritten** after the deadline, with no history, until the status flipped | **Yes, tonight** | server + forms hidden |
| 7 | A new entry could be attached outside a submission stage (build sprint loophole); an eliminated entry could withdraw and re-enter | If set to active | server |
| 8 | A removed judge's scores kept deciding the cut | Yes | server |
| 9 | A pending (unaccepted) invitation counted as a judge: every score, all feedback, drafts and the export | Yes | routes |
| 10 | Every judge received every other judge's scores and feedback (anchoring); the new judge-page copy said otherwise | Yes | routes |
| 11 | Per-contest editors could cut but couldn't see drafts or scores | Yes | routes |
| 12 | Test sends returned any picked member's email to any organizer | Yes (`contestEmailEditor` ON) | routes |
| 13 | Hero status buttons applied on one click, including "Complete & Publish" | Yes | shared confirm |
| 14 | Judge page: criteria seeded 0, decimals and blanks rejected with a generic error, unsaved work lost silently, "No entries" while loading, scoring offered between rounds | Yes | judge page |
| 15 | Hero said "Judging ends in 101d" on a 4-day round; the signup card promised email that never sends | From tomorrow | hero + card |
| 16 | Advance notifications de-duped on the bare contest link, so a later status notice overwrote "You advanced!" in place | Round 1 | per-round link |
| 17 | Judges list exposed pending invitations publicly | Yes | route |
| 18 | Two delete routes 500 on a non-uuid id | Yes | routes |

Verified in a local browser on a mirror of the deveco setup: late edit and late
proposal refused, form hidden, card says closed, hero confirm, round-named countdown,
blank inputs, decimal refused with a reason, unsaved marker and leave warning, each
judge sees only their own scores, pending judge sees nothing privileged, the Finals
Advance disabled, a Top 1 cut corrected to Top 3 (3 eliminated → 1), finals cut
refused during the sprint, scoring refused and disabled during the sprint, no
overflow at 390px.

Every new server test fails against the old code (10 of 10 checked by stashing the
fix). Suites: server 2210, layer 3031, typecheck clean (planted error caught), lint
clean.

### Live data found (operator, not code)

- Zero judges, no rubric, Winner Showcase `startsAt` year 0001.
- **Likely duplicate:** maxic93 and pldubouilh entered the identical proposal title,
  two days apart; pldubouilh's account was created the day of the first submission.
- `maxEntriesPerUser` unset; legal-name registration fields aren't typed as personal
  data (there's no per-field toggle in the editor); eligibility questions optional;
  the legacy `rules` HTML (truncated, 31 `[CONFIRM]` placeholders) still ships in
  the API.

### Still open after the deep audit

- Reminders: during a build sprint the sweep is silent while status is judging, and
  mails every registrant (eliminated included) about a "submission" deadline if
  active. Announcements can't target "still in the running".
- Ties at completion: two 1st places, no 2nd; ties at a cut are broken by entry id.
- Criterion weight 0 counts as 100; duplicate criterion and stage ids aren't rejected
  (schema validator change, which cascades to every package).
- Judges can still bypass a rubric with a single score through the API.
- The aggregate score is visible to judges under judges-only visibility (the setting's
  meaning), which anchors.
- user-search ignores profile visibility and account status.
- A stale editor form saved after an advance can reset the current stage.
- deveco's deploy doesn't wait for CI and can't fail on a bad container (known since
  257).

## Persona walk-through on the production image (third request)

Built the repo's Dockerfile, ran its migrations through `scripts/db-migrate.mjs` on
a fresh database, and drove a deveco-shaped contest end to end with Playwright:

- **Personas:** organizer; judges Jae, Kim (also an entrant), Lee (lead), Gus
  (guest) and Pat (never accepts); six entrants; a latecomer; an anonymous visitor.
- **Real time:** the proposal deadline passed in real time; nothing was moved by
  SQL.
- **Distinct IPs:** each persona had its own forwarded IP, so production rate limits
  stayed on.

**Worked as intended:**
- Hero activate and Start Judging, both with confirms.
- Judge invites through the People search, accepting from the banner (which lands
  on the judge page) and from the judge page.
- The public panel hides the pending invitee.
- The late proposal was refused.
- Scoring by all three judges, including the own-entry card, a guest's 403, and a
  rubric in round 2 with a message naming the missing criterion.
- A mistaken Top 2 corrected to Top 4.
- Advance notices update in place rather than piling up.
- The stage pointer moves forward only.
- The finals cut was made on round-2 scores.
- Ranks went to finalists only, and prize notifications went out.

**Found and fixed (commits 2a0f7fc6, 3765ab4e):**
- **Hydration mismatch on every contest page that has entries.** Entry dates were
  formatted during SSR (UTC) but in the browser's time zone on the client. Live on
  deveco for anyone off UTC.
- The judge preview before judging showed titles only.
- **Finals judges saw the original proposal as the entry**, with no link to the
  built project.
- Advanced and eliminated entrants saw an identical sprint card.
- Proposal submit dropped the entrant into a blank project editor, and the page then
  offered them a second entry.
- "Tomorrow" was shown for a deadline 6 minutes away.
- **Results hid unpublished winners from the public without telling the organizer**,
  and listed eliminated entries with stale scores.
- The judge manager's labels were truncated.
- An em dash in the win notice.

**Not fixed (noted):**
- After the deadline, before Start Judging, the hero still offers "Log in to
  register".
- The semi-final Advance button stays enabled in round 2; the server refuses it with
  a message.
- Judges may enter the contest (a policy decision, now in the runbook).

**Second replay not run:** Docker Desktop failed with containerd I/O errors on a
host disk that was 98% full (11 GB free, Docker.raw about 26 GB). The second
round of fixes is covered by the unit, integration and typecheck gates, but not
yet re-walked.

## Branch audit (fourth request, 2026-10-09)

Three reviewers covered server logic, routes and privacy, and UI and server
rendering. I verified each finding I acted on. Fixed in 9b8a2ca8 (server) and
17e7b355 (layer):

- **P0:** a judge-page save blanked the list (`refresh()` → `pending` → loading
  state). This is a defect I introduced in the walk-through fixes. It's the class
  the "audit your own fixes" rule is for.
- **P1s:**
  - the later-round guard bypassed by moving the pointer back by hand (mutation-tested);
  - a removed judge's in-flight score;
  - post-deadline Submit prompts (one shared `contestEntriesClosed`);
  - finalist copy after the final cut;
  - a manual re-run blind to its own cuts;
  - unscored finalists missing from results;
  - a double toast.
- **P2s:** a whole-field elimination from bad cut input, the legacy re-run fallback,
  pending judges on the personal-data route and the showcase import, the results note
  wording, and the admin search scroll and timer.

Open P2s are listed in `260-handoff.md`.

Live deveco at 08:47 UTC: still `active`, 0 judges, **22 entries** (one more than
last night, so a submission after the deadline arrived as predicted), no rubric, the
0001 date unchanged.

STATUS.md header re-verified against the registry and live `/api/features`: 47 boolean
flags per instance, and CI on `main` per job.

## Open

- **Release:** server 2.136.0 → **2.137.0** (new exports), layer 0.138.1 →
  **0.138.2**. Only the layer depends on server, so nothing else republishes. Both
  carets reach those versions, but raise the fork floors to `^0.138.2` / `^2.137.0`
  (a satisfied caret never upgrades itself), refresh BOTH deveco lockfiles, and count
  vue copies in package-lock before merging. The operator's call, before 15:00 UTC.
- PR #92 still open (session 259).
