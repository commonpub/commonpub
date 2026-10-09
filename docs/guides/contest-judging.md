# Contest judging: organizer runbook and judge guide

Written 2026-10-08 (session 260) against the live deveco contest
`qualcommforamoreresilientamerica`. Its first review round, "Semi-Finalists
Selection (50)", is scheduled to start 2026-10-09 15:00 UTC. The mechanics are the
same for any staged contest.

**Nothing in judging happens on a date.** Stage dates show on the timeline and drive
reminders, but no status changes by itself. Every step below is a button someone
presses.

**Two versions of the software are described here.** Deveco runs layer **0.138.1**
until the session-260 release (server **2.136.1** / layer **0.138.2**) is rolled.
Where they differ, items are marked **[before the update]** or **[after the
update]**.

---

## Part 1: organizer runbook

### Tonight, before the round opens

**1. Invite the judges. As of 2026-10-08 22:00 UTC the panel is empty.**

- Each judge needs a deveco account first. The judge picker only finds existing
  members.
- Go to Contest → **Edit** → **People**, or use the "Judge Management" box on the
  contest page. Search by username, pick a role, and invite. Only the contest owner
  or an instance admin can do this; a per-contest editor can't.
  - **Judge**: scores entries. **Lead judge**: the same, the label is all that
    differs.
  - **Guest**: can't score. Don't use it for panelists.
- **Each judge must accept.** The invitation is an in-app notification only, and
  **no email is sent** (contest notifications never email). Send each judge the link
  yourself: `https://deveco.io/contests/qualcommforamoreresilientamerica/judge`.
  That page has an **Accept invitation** button.
- Get every judge accepted **before** pressing Start Judging. Only accepted judges get
  the "Judging Period Started" notice. [after the update] That notice links straight
  to the judge page.

**2. Decide on a rubric now, not mid-round.**

- There are **no criteria** on the review stage and none for the contest, so judges
  give one score from 0 to 100. That works.
- To use criteria (Impact, Feasibility, Edge fit...), add them to the
  **Semi-Finalists** stage in the Stages tab. A criterion's "pts" is its maximum,
  and the overall is the weighted total scaled to 100. Stage criteria override the
  contest-wide rubric in the "Judging" section.
- Don't add, remove or rename criteria after anyone has scored. Saved scores are
  matched to criteria by label and pre-filled by position.
- Avoid a weight of **0**, which counts as 100 points, not as "off". Avoid two
  criteria with the same label.

**3. Fix the contest data.** Found in the live contest:

| Fix | Where | Why |
| --- | --- | --- |
| Winner Showcase starts in **year 0001** | Stages tab | Shows as "Dec 19, 1" on the timeline. Every save re-sends it |
| `full_official_name` and `team_members` aren't treated as personal data | No fix in the editor: there's no per-field "personal data" toggle, only field types (address, file, email, signature) count. Don't add per-contest editors who shouldn't see entrants' legal names | Per-contest editors without the personal-data permission see legal names in the registrants panel and CSV. Judges can't see either |
| `maxEntriesPerUser` is unset | Contest settings: set it to 1 | Proposals cap at one per person, but the "attach a project" path doesn't. Someone could enter several projects |
| The old `rules` HTML is still stored: 50,000 characters, cut off mid-sentence, with 31 `[CONFIRM: …]` placeholders | Not urgent. The page shows the clean block version; the old text only ships in the API and the page data | Anyone reading the raw page data sees the draft text |
| Five proposal labels start with a space (`' Who benefits'`) | Stages tab → Proposals template | Cosmetic |
| The prize copy says December 14 in one place and December 18 in another | Prizes | Pick one |

**4. Look at the likely duplicate before anyone scores it.** Two accounts,
**maxic93** (submitted 2026-09-04) and **pldubouilh** (account created 09-04,
submitted 09-06), entered proposals with the **identical title**: "Early wildfire
detection: a detector on any camera, one integrator to weigh them all". They may be
teammates or a copy. Compare the two entries, then decide. See
`docs/plans/fake-account-handling.md`.

**5. Judges who are also entrants.** Nothing stops a judge from entering. A judge
can't score their own entry, but in the walk-through a judge's own entry won first
place. Decide your policy. The usual one is that judges don't enter, or that a judge
with an entry recuses from that round.

**6. Eligibility.** "I confirm my country of residence is the United States" is
optional on the form, and there is an "I'd like to participate even though I don't
qualify" box. Screen these entries before the 50 advance. Check identity and
eligibility at payout, not at entry.

### Opening the round

**7. Press "Start Judging".** Do it as soon as you're ready.

- **[before the update] The proposal deadline passed at 2026-10-08 15:00 UTC, but
  proposals are still open.** Until the status leaves Active, people can submit new
  proposals, **overwrite their existing proposal answers** (no earlier version is
  kept), attach any published project as an extra entry, and register. Anyone who
  registers tonight gets a confirmation email naming the Build Sprint deadline (Dec
  3) as their deadline.
- [after the update] The server refuses proposals and edits after the stage deadline,
  and hides the forms. Pressing Start Judging is still the step that opens scoring.
- Start Judging makes **Semi-Finalists** the active round. If you had marked
  Proposals as the current stage, it moves the current stage to the next review
  round for you.
- Every entrant gets an in-app "Judging Started" notice; accepted judges get "Judging
  Period Started".
- [after the update] The button asks you to confirm and says who is notified.
  [before the update] **The hero buttons don't confirm**, except Cancel. "Complete &
  Publish" sits next to "Pause" and with one click calculates final ranks and
  congratulates winners. Use the editor's Status menu instead, which does confirm
  completion.

### During the round

**7. Watch progress:** Edit → **Stages** tab → **Advancement** → open **Scores and
feedback** under the round. You'll see each entry's average for this round, how many
judges scored it, and every judge's score and comment. [before the update] Per-judge
scores and feedback are stored but not shown anywhere, and the judge page shows only
20 of the 21 entries. **Roll the update before judges start, or the 21st entry is
never judged.**

**8. If you remove a judge** (a conflict of interest, a wrong invite): [after the
update] their scores in the open round are removed and the averages recalculated.
[before the update] Their scores keep counting in the cut.

### Closing the round: advancing

**9. Make the cut** under Advancement, on the **Semi-Finalists** row.

- **Top N** advances the N highest averages **for this round**. The field is
  pre-filled with 50 from the stage. **With 21 entries, Top 50 advances everyone.**
  For a real cut, enter a smaller number or use **Pick manually**.
- **Entries with no score rank last.** Check "N of M entries scored" first.
  [after the update] The panel refreshes the scores and warns you before cutting.
- Every entrant gets an in-app notification: "You advanced!" or "wasn't selected".
- **Correcting a cut:** [after the update] run it again with a different number. That
  reinstates or removes entries and notifies everyone again. It works until the next
  review round has scores. **[before the update] A re-run can only remove more
  entries, never bring any back.** A mistaken cut can't be undone from the panel, so
  check the number before you press Advance.
- **Never press Advance on "Selection for Finalists (10)" during round 1.** [after the
  update] That button is disabled until the round is reached. [before the update] It
  is live, and pressing it eliminates everyone outside the top 10 on round-1 scores.

**10. After the cut, leave the status on "Judging" through the Build Sprint. Don't set
it back to Active.**

- Advancing moves the current stage to Build Sprint. Advanced entrants build on their
  project and publish it, which needs no contest status.
- Setting the status back to **Active**:
  - reopens registration and lets anyone registered attach a new entry [before the
    update]. That entry hasn't been cut, so it would land in the finalist round;
  - lets an eliminated entrant withdraw and re-enter fresh [before the update];
  - sends **every** entrant, eliminated ones included, a "now accepting
    submissions!" notice, which also overwrites their earlier advance or eliminate
    notice [before the update];
  - restarts deadline reminders to every registrant, eliminated ones included,
    telling them "submissions close Dec 3" when the sprint accepts no submissions.
- While Judging, the contest shows the Build Sprint as the current stage. [after the
  update] The hero reads "Build Sprint ends in…", and the judge page says no round is
  open. Reminders don't fire during Judging, so tell advanced builders the Dec 3
  deadline yourself with an Announcement. **Announcements go to every registrant,**
  including eliminated ones, so word it for both groups.

### Round 2 (December): one manual step

**11. Before judges score the finalist round,** open the Stages tab, mark
**"Selection for Finalists (10)"** as **Current**, and save.

- [after the update] Until you do, the judge page says no round is open and the
  server refuses scores.
- [before the update] Scores given while Build Sprint is current are saved untagged,
  and the averages mix round 1 and round 2.
- [after the update] Finalists are cut on round-2 scores only. An entry no judge
  scores in round 2 ranks last.
- An editor tab left open with unsaved changes since before an advance can put the
  current stage back when saved. Reload the editor after every advance.

### Completing

**12. Before completing, make sure every finalist has PUBLISHED their project.**
A proposal creates a private draft project. Public lists hide drafts, so **an
unpublished winner doesn't appear on the public results page at all.** In the
session-260 walk-through, both winners were unpublished and the public results page
showed neither of them. [after the update] The final cut and the results page name
the unpublished entries for you. [before the update] Nothing warns you: check each
finalist's project yourself.

**13. Complete & Publish** calculates final ranks from the last round's scores.

- Ties share a place: two entries tied for first both get "You won… 1st" and the
  first-place prize text, and nobody is placed 2nd.
- Break ties before completing, by having a judge adjust a score.

---

## Part 2: judge guide (send this to the panel)

1. **Sign in** to deveco.io. You need a member account; send the organizers your
   username if you haven't been invited yet.
2. Open **https://deveco.io/contests/qualcommforamoreresilientamerica/judge** and
   press **Accept invitation**.
3. When judging opens, the same page lists every proposal still in this round. Each
   card shows the proposal answers. **Open full entry** opens the full entry page.
   Most entries are proposals, not finished projects, so there may be no project page
   yet; that's expected.
4. Give each entry a **whole number from 0 to 100** and optional written feedback,
   then press **Score** on that card. Each card saves on its own, and the card says
   "Score saved." **A card you typed into but didn't save says "Unsaved changes"**,
   and the page warns you if you try to leave. Press **Update** to change a score any
   time before the round closes.
5. The bar at the top counts your progress. Tick **"Show only entries I haven't
   scored"** to work through what's left. Please score **every** entry: an unscored
   entry ranks last when the organizers make the cut.
6. **Entrants never see your scores or feedback, and neither do the other judges.**
   The organizers see them and decide who advances. Write feedback you'd be
   comfortable sharing with the organizing team.
7. An **"Edited after the deadline"** tag means the entrant changed those answers
   after proposals closed. Judge what's there, and mention it to the organizers if it
   matters.
8. If you have an entry of your own in the contest, its card says you can't score it.
9. On a phone the page works, but proposals are long; a laptop is easier.

**If something looks wrong:**

- "Scoring opens when the organizers start judging": the round hasn't started. You
  can already read the entries.
- "No judging round is open right now": the round has closed (or the next hasn't
  opened). Scoring is off until it does.
- "You are not a judge for this contest": you're signed in with a different account
  from the one that was invited.
- A save error appears under that card, not at the top of the page.
