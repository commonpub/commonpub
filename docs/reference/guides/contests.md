# Contests

CommonPub contests let an instance run a skill-based competition: organisers
create a contest, makers submit published projects as entries, an invited judge
panel scores them, and ranked results are published. Contests are **instance-
local** — they never federate.

Gated by `features.contests`. Who may create contests is controlled by
`instance.contestCreation` (`open` | `staff` | `admin`, default `admin`).

## Lifecycle

`contestStatusEnum` has **7 states** (draft + paused added session 189) and transitions are
**bidirectional** — the server's `VALID_TRANSITIONS` map is the gating truth (you can move a contest
back, e.g. `judging → paused` to re-open submissions). The classic forward path:

```
draft ──▶ upcoming ──activate──▶ active ──begin judging──▶ judging ──complete──▶ completed
```

- **draft** — not yet public (gated out of public reads). A new contest can be created here.
- **upcoming** — created, not yet open. Edit freely.
- **active** — entrants submit / withdraw published content. Community voting (if enabled, **advisory**) is open.
- **paused** — temporarily halted (from `active` or `judging`); reversible.
- **judging** — submissions locked; accepted judges score each entry 1–100. `judgingEndDate` drives the countdown.
- **completed** — `calculateContestRanks()` assigns ranks (`RANK()` over scored, **non-eliminated** entries; ties share a rank, unscored stay unranked). Results + leaderboard published.
- **cancelled** — reachable from any non-terminal state. **Not strictly terminal** — `VALID_TRANSITIONS` allows `cancelled → draft` / `cancelled → upcoming` to revive.

Multi-stage contests (cohorts / Top-N cull / per-round judging) layer an explicit `stages` timeline
on top of `status`; `status` stays the gating truth. See `codebase-analysis/02` + `07` for the stage
model and `calculateContestRanks` cohort-exclusion invariant.

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

## Visibility & access

`visibility` is **orthogonal to `status`** (lifecycle) — it controls *who can see*
the contest, and you can change it at any time (e.g. keep a contest `private`
while drafting, then flip to `public` to publish):

| `visibility` | Listed? | Who can view |
| --- | --- | --- |
| `public` (default) | yes | everyone |
| `unlisted` | no | anyone with the direct link |
| `private` | no | owner, admins, **collaborators** (reviewers + editors), panel judges, and any role in `visibleToRoles` |

- **`visibleToRoles`** (e.g. `['staff']`) grants whole roles view access to a
  `private` contest.
- **Collaborators** (`contest_stakeholders` table, managed on the Edit page) are
  per-contest grants scoped to that one contest only, with **no** system-wide
  access. The `role` column distinguishes two kinds:
  - **`reviewer`** (default) — view-only. Can see a private/unpublished contest to
    review it, without being a judge or admin (never appears in the judge list,
    can't score or edit).
  - **`editor`** — full edit rights to *that* contest: edit fields, transition
    status, and advance stages, exactly like the owner. An editor **cannot**
    delete the contest, manage judges, or add/promote other collaborators (those
    stay owner / `contest.manage`), so an editor can't escalate. Recognized by
    `isContestEditor`.
- Access is enforced server-side by `canViewContest(db, contest, user)` on every
  read endpoint (detail/entries/votes/judges/submit); a blocked viewer gets a
  **404** (not 403) so a private contest's existence isn't leaked. The public v1
  API (`isPublicContest`) only ever exposes `public` contests.
- The public `/contests` listing shows only `public` contests; signed-in users
  also see their own drafts there, and admins see everything.
- **Who can edit/manage:** edit (`PUT`), status transition, and stage advance are
  authorized for the **owner**, a per-contest **editor**, or a holder of the
  `contest.manage` RBAC permission (`canManage = ownerOrPermission(event,
  contest.createdById, 'contest.manage') || isContestEditor(...)`). The three
  server functions (`updateContest`/`transitionContestStatus`/
  `advanceContestStage`) take a `canManage` boolean and also re-check the editor
  server-side. Delete + judge/collaborator management stay owner / `contest.manage`
  only. The contest detail payload exposes a per-request `viewerCanManage` flag so
  the client shows the Edit affordance to editors (UI hint only; the server
  enforces).
- **Delete vs hide:** `DELETE /api/contests/:slug` removes a contest entirely;
  setting `visibility` to `unlisted`/`private` hides it without deleting.

## Participants

The contest detail page has a **Participants** tab listing the unique entrants
(distinct from the **Entries** tab, which lists submissions) with their entry
counts, linking to each profile.

## Entry eligibility

Two optional per-contest controls (default = unrestricted, set in create/edit):

- **`eligibleContentTypes`** — restrict entries to specific content types (e.g.
  `['project']`). Empty/unset = any published content the entrant owns. The
  submit picker filters to eligible types; the server enforces it as a backstop.
- **`maxEntriesPerUser`** — cap the number of distinct entries one person may
  submit. Null = unlimited. Enforced in `submitContestEntry`.

(The unique constraint `(contestId, userId, contentId)` already prevents
submitting the *same* content twice, independent of the cap.)

## Per-stage submissions (multi-stage artifacts)

For multi-phase contests (proposal → prototype), each `submission`-kind stage can
carry a **submission template** — the fields entrants must fill for *that* stage's
artifact. Gated by `features.contestStageSubmissions` (default ON, inert until a
template is defined; no effect unless `contests` is on too).

- **Define it**: in the stages editor, a `submission` stage gets a "Submission
  form, this stage" panel — add fields with a label, a type (`text` / `textarea` /
  `url`), a required toggle, and an optional hint. Field keys derive from the
  label and stay stable once hand-edited (artifact values hang off them).
- **Fill it**: an entrant with a live entry sees the form on the contest page's
  Entries tab while the contest is `active` and that stage is **current**.
  Re-submitting while the stage is open replaces the artifact (snapshotted with
  `submittedAt`). The cohort gate applies: an entry culled at a review stage
  cannot submit later-stage artifacts.
- **Validation**: required fields must be non-blank; `url` fields accept
  `http(s)://` only (`javascript:` and friends are rejected); unknown keys are
  rejected; values cap at 4000 chars. Server-enforced in
  `validateStageArtifactFields` (pure, exhaustively tested).
- **Judge it**: the judge page shows each entry's artifact for the round being
  judged — the nearest `submission` stage preceding the current review stage —
  beside the per-round rubric, plus an "All submissions" link.
- **View it**: `/contests/:slug/entries/:entryId` is the entry-detail page — the
  content summary plus every stage's artifact in a timeline. Artifacts are
  visible to judges/owner/admin and the entrant; the public sees the content
  card only. Entry cards link here.
- **Storage**: templates live on `contests.stages[].submissionTemplate` (jsonb,
  no migration); artifacts on `contest_entries.stage_submissions`
  (migration 0021, additive `[]` default).

A typical Resilient-America-style flow: a *Proposals* stage with a summary/focus
template → a *Screening* review round (Top-N cull) → a *Prototype* stage whose
template asks for repo + demo URLs (only advanced entrants can fill it) → a
*Final Judging* round scoring the prototype artifact.

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
