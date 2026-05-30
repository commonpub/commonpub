# Contests

CommonPub contests let an instance run a skill-based competition: organisers
create a contest, makers submit published projects as entries, an invited judge
panel scores them, and ranked results are published. Contests are **instance-
local** — they never federate.

Gated by `features.contests`. Who may create contests is controlled by
`instance.contestCreation` (`open` | `staff` | `admin`, default `admin`).

## Lifecycle

```
upcoming ──activate──▶ active ──begin judging──▶ judging ──complete──▶ completed
   │                     │                          │
   └──── cancel ─────────┴──────── cancel ──────────┘  (→ cancelled, terminal)
```

- **upcoming** — created, not yet open. Edit freely.
- **active** — entrants submit / withdraw published content. Community voting (if enabled) is open.
- **judging** — submissions locked; accepted judges score each entry 1–100. `judgingEndDate` drives the countdown.
- **completed** — `calculateContestRanks()` assigns ranks (`RANK()` over scored entries; ties share a rank, unscored stay unranked). Results + leaderboard published.
- **cancelled** — terminal; reachable from any non-terminal state.

Only the contest owner (or an admin) can transition status, edit, or manage judges.

## Judges (single source of truth: `contest_judges`)

Judges are managed through the `contest_judges` table — **not** the legacy
`contests.judges` jsonb column. Flow:

1. Owner invites a user via the judge manager (`POST /api/contests/:slug/judges`, role `lead`/`judge`/`guest`). The invitee gets a notification.
2. The invitee accepts (`POST /api/contests/:slug/judges/accept`) — surfaced as an "Accept invitation" banner on the contest + judge pages.
3. Once **accepted** and not a `guest`, they can score during the judging phase. Guest judges are view-only.

Per-entry score is the mean of accepted judges' scores (`Math.round`).

## Score visibility

`judgingVisibility` controls who sees aggregate scores before results:

| Setting | Public sees aggregate score… | Per-judge scores + feedback |
| --- | --- | --- |
| `public` | during judging and after | privileged only |
| `judges-only` (default) | only after `completed` | privileged only |
| `private` | never (ranks may still show) | privileged only |

"Privileged" = contest owner, instance admin, or a panel judge. The decision is
the pure helper `shouldRevealScores(visibility, status, privileged)`; per-judge
detail (`includeJudgeScores`) is always privileged-only regardless of visibility.

## Prizes & judging criteria

- **Prizes** carry an optional `place` (ranked: 1st/2nd/3rd…) **and/or** an
  optional `category` (themed: "Best in Show", "Robotics"). Place-based prizes
  map onto the results podium; category prizes display as themed awards.
- **Judging criteria** is an optional rubric (`label`, optional `weight` points,
  optional `description`) shown to entrants on the contest page. When a contest
  defines criteria, judges score **each criterion** (0..weight, or 0..100 if no
  weight) on the judge page and the overall 0–100 is the normalized weighted sum
  (`sum(score)/sum(max)*100`); the per-criterion breakdown is stored in
  `judgeScores`. With no criteria, judges submit a single holistic 1–100 score.
  Score writes are atomic (row-locked transaction), so concurrent judges scoring
  the same entry never clobber each other.

## Entry eligibility

Two optional per-contest controls (default = unrestricted, set in create/edit):

- **`eligibleContentTypes`** — restrict entries to specific content types (e.g.
  `['project']`). Empty/unset = any published content the entrant owns. The
  submit picker filters to eligible types; the server enforces it as a backstop.
- **`maxEntriesPerUser`** — cap the number of distinct entries one person may
  submit. Null = unlimited. Enforced in `submitContestEntry`.

(The unique constraint `(contestId, userId, contentId)` already prevents
submitting the *same* content twice, independent of the cap.)

## Community voting

When `communityVotingEnabled`, signed-in members can upvote entries (one vote
per user per entry) while the contest is `active` or `judging`. **A user cannot
vote for their own entry.** Votes are advisory — they do not feed the ranking —
but on the results page the most-voted entry is highlighted as the **Community
Choice** and a per-entry vote tally is shown in the leaderboard.

## Notifications

Status transitions notify participants (in-app, + email when
`emailNotifications` is on):

- **active / judging / cancelled** — all entrants get a status note; judges get a
  judging/cancelled note.
- **completed** — entrants whose rank earns a place-prize (or place in the top 3
  when no place-prizes are defined) get a **"🏆 You won!"** alert naming their
  placement and prize; every other entrant gets the standard "Results Posted"
  note. Judges are notified separately. Fired after `calculateContestRanks`.
- Judge **invite** → the invitee; judge **accept** → the contest owner.

## Key files

- Schema: `packages/schema/src/contest.ts`, validators in `validators.ts`.
- Server: `packages/server/src/contest/` (`contest.ts`, `judges.ts`) + voting in `voting/voting.ts`.
- API: `layers/base/server/api/contests/**`.
- UI: `layers/base/pages/contests/**` + `layers/base/components/contest/**`.
- Homepage section + layout-engine section: `components/homepage/ContestsSection.vue`, `sections/builtin/contests.ts`.
