# Contest judging: organizer runbook and judge guide

Written 2026-10-08 (session 260) against the live deveco contest
`qualcommforamoreresilientamerica`, whose first review round ("Semi-Finalists
Selection (50)") is scheduled to start 2026-10-09 15:00 UTC. The mechanics are the
same for any staged contest.

**Nothing in judging happens automatically.** Stage dates are shown on the timeline
and drive reminders, but no status changes on its own. Every step below is a button
someone has to press.

---

## Part 1: organizer runbook

### Before the round opens

**1. Invite the judges. As of 2026-10-08 22:00 UTC this contest has zero.**

- Each judge needs a deveco account first. The judge picker only finds existing
  members.
- Contest → **Edit** → **People** section (or the "Judge Management" box on the
  contest page). Search by username, pick a role, click to invite. Only the contest
  owner or an instance admin can do this. A per-contest editor can't.
  - **Judge**: scores entries.
  - **Lead judge**: same powers as Judge. The label is only a label.
  - **Guest judge**: can see entries, **cannot score**. Don't use this for real
    panelists.
- Each judge must **accept** before they can score. The invitation is an in-app
  notification only. **No email is sent** (contest notifications never email), so
  send each judge the link yourself:
  `https://deveco.io/contests/qualcommforamoreresilientamerica/judge`.
  That page has an **Accept invitation** button.
- Invite and get acceptances **before** you press Start Judging. Judges who have
  accepted get a "Judging Period Started" notification at that moment, and pending
  ones don't.

**2. Decide on a rubric now, not mid-round.**

- This contest has **no criteria** on the review stage and none at contest level, so
  judges give one overall score from 0 to 100. That works.
- If you want criteria (Impact, Feasibility, Edge fit...), add them to the
  **Semi-Finalists** stage in the Stages tab (a stage's own criteria override the
  contest-wide rubric under the "Judging" section). A criterion's "pts" is its maximum,
  and the overall score is the weighted total scaled to 100.
- Don't add, remove or rename criteria after anyone has scored. Saved scores are
  matched to criteria by label and pre-filled by position, so a change mid-round
  makes judges' existing scores display against the wrong rows.

**3. Fix the Winner Showcase start date.** It is stored as year **0001**
(`0001-12-19`). Set it in the Stages tab.

### Opening the round

**4. Press "Start Judging"** (contest page or editor status controls).

- **The proposal deadline passed at 2026-10-08 15:00 UTC, but proposals are still
  open.** The form stays live until the status leaves Active. Until you press Start
  Judging, people can still submit proposals, and can also attach any published
  project as an entry. Press it as soon as you're ready to stop accepting entries.
- With no current stage set, Start Judging makes the **first review stage**
  (Semi-Finalists) the active round. You don't need to set the current stage
  yourself for round 1.
- Every entrant gets an in-app "Judging Started" notice, and accepted judges get
  "Judging Period Started".

### During the round

**5. Watch progress:** Edit → **Stages** tab → **Advancement** → open **Scores and
feedback** under the round. It lists every entry still in the running with its
average this round, how many of the panel scored it, and each judge's score and
written feedback. *(Ships with layer 0.138.2. Before that, per-judge scores and
feedback are stored but not shown anywhere.)*

### Closing the round: advancing

**6. Make the cut** in the same Advancement section, on the **Semi-Finalists** row
only.

- **Top N**: advances the N highest averages. The field is pre-filled with 50 from
  the stage. **With 21 entries, Top 50 advances everyone.** If you want a real cut,
  enter a smaller number or use **Pick manually**.
- **Entries with no score rank last.** A Top N cut made before judging finishes
  quietly eliminates whatever nobody scored. Check "N of M entries scored" first.
  *(0.138.2 also warns in the confirm dialog.)*
- Every entrant gets an in-app notification: "You advanced!" or "wasn't selected".
- Re-running recomputes the cut, but the notifications go out again.
- **Do not press Advance on "Selection for Finalists (10)" now.** That row is shown
  all the time. Pressing it would mark everyone outside the top 10 as eliminated
  before round 2 has started.

**7. After the cut, leave the status on "Judging" for the Build Sprint. Don't set
it back to Active.**

- Advancing moves the current stage to Build Sprint. Entrants build on their
  existing proposal project and publish it. That needs no contest status.
- If the status goes back to **Active**, any registered member can attach a new
  published project as a fresh entry. The server only checks status, not stage, and
  a new entry hasn't been eliminated, so it would land in the finalist round. Active
  also sends every entrant (eliminated ones included) a "now accepting
  submissions!" notice.
- The trade-off: the contest still reads "being judged" during the sprint. If that
  matters, say so in an Announcement.

### Round 2 (December): one manual step

**8. Before judges score the finalist round,** open the Stages tab, mark
**"Selection for Finalists (10)"** as the **current stage**, and save.

- Without this, the current stage stays Build Sprint, which isn't a review stage.
  Scores are then saved untagged and the live averages mix round-1 and round-2
  scores.
- A server fix that refuses scoring outside a review stage is on the list for
  before December.

---

## Part 2: judge guide (send this to the panel)

1. **Sign in** to deveco.io. You need a member account. Send the organizers your
   username if they haven't invited you yet.
2. Open **https://deveco.io/contests/qualcommforamoreresilientamerica/judge** and
   press **Accept invitation**.
3. When judging opens, the same page lists every proposal still in this round. Each
   card shows the proposal answers inline (title, summary, problem, approach,
   feasibility, links). **Open full entry** shows the full entry page.
   - Most entries are proposals, not finished projects, so there may be no project
     page yet. That's expected.
4. Give each entry a score **from 0 to 100** and optional written feedback, then
   press **Score**. Each card saves on its own, with a "Score saved." confirmation
   under it. Press **Update** to change a score any time before the round closes.
5. The bar at the top counts your progress ("Scored 12 / 21"). Please score
   **every** entry. An unscored entry ranks last when the organizers make the cut.
6. **Entrants never see your scores or feedback.** The organizers do, and they use
   them to decide who advances. Write feedback you'd be comfortable sharing with the
   organizing team.
7. If you have an entry of your own in the contest, its card says you can't score
   it. That's intended.
8. On a phone, the page works but the proposals are long. A laptop is easier.

**If something looks wrong:**

- "Scoring opens when the contest enters the judging phase": the organizers haven't
  started the round yet.
- "You are not a judge for this contest": you're signed in with a different account
  from the one that was invited.
- A score error appears under the card, not at the top of the page.
