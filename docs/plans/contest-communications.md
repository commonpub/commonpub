# Plan — Contest Communications + Notification Preference Center

> Created 2026-07-12 (session 231). Companion to `docs/plans/federation-email-audit-fixes.md`
> (which carries the pure fixes) and `docs/plans/email-comms-overhaul.md` (session 227, the email
> pipeline this builds on). Informed by a web-research pass on contest/hackathon comms lifecycles,
> notification-preference UX, reminder-scheduling reliability, and deliverability/compliance.
>
> **The gap this closes:** contests emit 7 in-app notifications today, but `type='contest'` is not
> in the notification→email bridge (`emailPrefs.ts` maps only like/comment/follow/mention), so **no
> contest event ever produces a dedicated email**, and email is OFF in prod anyway. There are **no
> deadline reminders, no entry confirmations, no judge-invite emails, no winner announcements**, and
> a dedup-key bug silently overwrites distinct contest lifecycle notifications. Contests are the
> platform's flagship surface (sessions 211-226); their comms are the biggest UX gap.
>
> **Design principle:** make contest comms *ready and correct*, additive, and flag-gated. In-app
> notifications improve immediately regardless.
>
> **🔴 LIVE-STATE CORRECTION (round-4 audit, verified via `curl /api/features` + fork inspection
> 2026-07-12).** The "inert until an operator enables email" framing below is **imprecise for
> deveco.io** and must be stated exactly: `emailNotifications` is **`true` (live) on deveco.io** (OFF
> on commonpub.io + heatsynclabs.io), so **both email workers (the notification bridge/digest AND the
> outbox drainer) are actively running on deveco right now** — the outbox pipeline is being
> live-exercised (so the Phase-3 outbox bugs — send-time recheck, lease ownership, suppression —
> matter on deveco today, not hypothetically). HOWEVER, deveco's tracked deploy wires **no transport**
> (`emailAdapter` falls back to the Console adapter — no `NUXT_RESEND_*`/`NUXT_SMTP_*` secret), so mail
> is enqueued and drained to a **no-op console sink**: nothing is actually delivered. **The bright
> line:** adding a `NUXT_RESEND_*` secret to the deveco box flips real delivery on with **zero code
> change**, and deveco's **digest scheduler is type-agnostic** (batches every unread notification type,
> including `contest`), so the moment a transport is added, any contest notification a digest-opted
> deveco user has unread goes out. Treat **deveco as a live canary, not a dormant instance**: default
> every new contest email category to email-OFF-per-category (in-app on) until a user opts in; ship the
> preference center BEFORE wiring contest→email; roll to deveco last with a live check; and re-verify
> the flag + transport before each roll (both can change out-of-band).

## Why (verified current state)

- **In-app only, and lossy.** 7 events fire `createNotification(type:'contest')` (judge
  invite/accept, stakeholder grant, status→active/paused/judging/cancelled, winner, judge notices,
  per-entry stage advance/eliminate) — `contest/contest.ts:271-354`, `judging.ts:289`,
  `judges.ts:88`, `stakeholders.ts:110`. They collide on `UNIQUE(userId,type,actorId,link)` and
  **overwrite each other** (see fix below).
- **No contest email.** `emailPrefs.ts` `TYPE_TO_PREF` covers only 4 social types; contest
  notifications reach email only via opt-in digests. `emailNotifications` is OFF on commonpub.io +
  heatsynclabs.io but **ON (live) on deveco.io** (verified round 4) — so on deveco, social
  like/comment/follow/mention notifications ALREADY email today, and contest email is one registry
  entry away from going live there.
- **No time-based logic.** Transitions are **manual** (organizer clicks the Status menu). The
  schema *has* the dates — `contests.startDate/endDate/judgingEndDate` (`schema/contest.ts:196-198`)
  and per-stage `ContestStage.startsAt/endsAt` (jsonb, `:45-47`) — but **nothing reads them on a
  timer**. `scheduled-publishing.ts` is content-only; the digest scheduler is the only cron-ish job.
- **Half-reconciled countdown.** `ContestHero.vue` already renders a live countdown but from the 3
  top-level dates only; per-stage `endsAt` shows in `ContestSidebar` timeline but drives nothing.

## Goals

1. **Correct, non-lossy contest notifications** (fix the dedup collision) + a **data-driven
   notification→email bridge** so contest (and future) types can email.
2. A **notification preference center**: category × channel (in-app / email) matrix replacing the
   4-checkbox settings page, WCAG-AA, transactional-default-on / marketing-default-off.
3. **Contest transactional emails**: entry confirmation, judge invitation, stage transition,
   winner — wired to the preference center, built on the session-227 outbox + branding.
4. **Deadline reminder worker**: idempotent, timezone-correct reminders at T-7d/48h/24h/1h
   (submissions) and T-48h/24h (judging), reconciling per-stage `endsAt` with the hero countdown.
5. **Winner announcement + organizer contest-comms controls** (scoped broadcast to entrants).

## Non-goals

- Turning email ON in prod (operator's call; this makes it safe to).
- Push notifications (the matrix is designed to add a `push` column later, but not now).
- Per-user-timezone send scheduling (contest deadlines are a single UTC instant; render local TZ).
- Marketing/recap/next-event promotion (separate opt-in; kept out of transactional contest mail to
  preserve the GDPR/CAN-SPAM transactional exemption).

---

## Design decisions (from research — carry these verbatim)

**Reminder lead times.** Submission deadline: **T-7d, T-48h, T-24h, T-1h** (Devpost ships a 3-day
"final call" + a ~1h nudge; research recommends 3-5 escalating reminders; the T-1h nudge is
high-value for a to-the-wire maker audience). Judging deadline: **T-48h, T-24h**.

**⚠ Audience reality (verified against the schema — corrects the research's assumption).** CommonPub
contests have **no "registered / interested participant" concept and no contest-follow/watch table**,
and contests have **no `hubId` linkage** to borrow a hub-follower audience. The ONLY participant
record is a `contest_entries` row, and `contentId` is `NOT NULL` — so a row cannot exist until the
user has already created/attached an entry (the proposal flow creates a **draft placeholder**
content item with `placeholder=true`). **Therefore the high-value "you haven't entered yet, deadline
soon" reminder has no audience to send to.** What IS queryable:
- **Entry-holders** (anyone with a `contest_entries` row).
- **"Not fully submitted"** ≈ their entry is still a `placeholder=true` draft (draft content status)
  vs a developed/published real entry. This is the only submitted-vs-not signal that exists.
So reminders can only nudge people who already started an entry ("finish/polish your draft, edits
close in X" / "your entry is in, edits close in X"). To reach people who *intend to enter but
haven't started*, you must **add a lightweight "Notify me about this contest" / register-interest
table first** (a new migration + a follow button + API) — that is the real feature that makes T-7d
reminders valuable, and it is called out as a prerequisite decision below (Open decision 7), NOT
assumed by Phase 3. Without it, scope Phase 3 to entry-holders only.

**Idempotency (must-not-double-send).** A dedicated ledger table with
`UNIQUE(recipient_id, contest_id, milestone)`; the worker **claims the row first** via
`INSERT … ON CONFLICT DO NOTHING RETURNING`, and only enqueues the email if a row is returned.
`milestone` encodes the exact reminder (`deadline_T7d` … `judging_T24h`), so distinct milestones
each fire once. This co-locates dedup with the data (the repo's `digest_runs` idiom, generalized).

**Worker cadence + catch-up.** Scan every **10-15 min**. Select recipients whose milestone window
`[now, now+leadtime]` is open **and** who lack a ledger row for that milestone. Window-based (not
edge-triggered) selection means a downed worker self-heals — the next run still finds un-sent
recipients. **Staleness guard:** if `now > deadline` for a pre-deadline milestone (window fully
passed while down), **skip** rather than send a stale "24h left" late. Winner announcements send on
catch-up (a late one is still useful); urgency reminders do not.

**Timezones.** Compute all scheduling in **UTC**; run the worker in UTC (avoids DST double-run/skip).
The deadline is a single contest-defined UTC instant (one global deadline for all entrants).
**Render the deadline in the email in the recipient's local timezone** and show the contest TZ
explicitly (e.g. "closes 11:59 PM PT, 06:59 UTC") so "24 hours" is unambiguous.

**Transactional vs marketing.** Entry confirmations, deadline reminders, stage transitions, judge
invites/reminders, and the **personal** winner email are transactional (exempt from opt-in consent
under CAN-SPAM; justified under GDPR contractual-necessity/legitimate-interest because the user
entered the contest). Post-event recap/survey/next-event promo is marketing (separate opt-in).
**Keep transactional contest mail promo-free** — a single promo block reclassifies it as marketing.

**Deliverability/compliance.** Ship **both** `List-Unsubscribe` forms: RFC 8058 one-click POST
`List-Unsubscribe-Post: List-Unsubscribe=One-Click` **and** the RFC 2369 URL (GET) + `mailto:`
fallback (Apple Mail honors `mailto:`). The `/unsubscribe` endpoint must handle **POST**
(mailbox one-click, unsubscribe immediately) **and GET** (human clicked, show confirm/preference
page); no auth on either (HMAC token). Honor unsubscribes within 48h. Keep spam-complaint rate
<0.1% (never 0.3%): default marketing OFF, frictionless unsubscribe, never blast non-opted-in
users. Drain reminder/winner batches through the existing outbox throttle, not all at once. Gmail/
Yahoo 2024 bulk rules (SPF+DKIM+DMARC alignment, one-click unsub) apply per-instance during a
winner blast — build to comply.

**Copy/tone.** One primary button CTA (2-5 words, action verb: "Submit your entry"). Subject =
specific action + specific deadline ("24 hours left to submit to {Contest}", "Final hour:
submissions close 11:59 PM PT"). Escalate urgency across the sequence but **no spam triggers**
(no all-caps, no "Act now!!!", no multiple `!`). Winner: split a **personal** transactional "you
won" (claim instructions) from a **general** recap; warm, never "you lost". **House style: no em
dashes (—) in any user-facing copy** — use commas/periods/colons. (Applies to every subject,
preview, body, button, toast in this plan.)

---

## Phase 1 — Notification correctness + preference center (FOUNDATIONAL)

No email required to ship; improves in-app UX immediately and unblocks Phases 2-4.

### 1a. Fix the dedup-key collision (also in the fixes plan — do once)
Make each contest lifecycle notification distinct so it stops overwriting. Append a milestone
discriminator to `link` (e.g. `/contests/{slug}?e=judging-open`, `?e=stage-2-advanced`,
`?e=results`) — zero migration, click-through target unchanged (page ignores the query param).
Use the same milestone vocabulary as the reminder ledger (Phase 3). Files: `contest/contest.ts`,
`judging.ts`, `judges.ts`, `stakeholders.ts`. Test: active→judging→completed yields 3 rows.

### 1b. Data-driven notification→email bridge
Replace the hardcoded 4-entry `TYPE_TO_PREF` (`emailPrefs.ts:20`) with a **notification-category
registry** keyed by notification type, each entry declaring: a preference key, a default (on/off),
a channel policy (in-app always; email when opted), and whether it's transactional (locked-on) or
optional. Add contest categories (`contest.deadline`, `contest.entry`, `contest.stage`,
`contest.result`, `contest.judge`). `shouldEmailNotification` consults the registry instead of the
4-key map. This makes adding an emailable type a one-line registry entry rather than the current
8-file change. Keep the digest-owns-them behavior. **Do not** widen the `notificationTypeEnum` yet
unless a finer type than `contest` is needed for the UI (see 1d).

### 1c. Preference storage shape
Extend `users.emailNotifications` JSONB (`schema/auth.ts:41`, zod `validators/auth.ts:59`) from the
flat `{likes,comments,follows,mentions,digest,unsubscribedAll}` to a category map, e.g.
`{ channels: { 'contest.deadline': {inApp:true, email:true}, … }, digest, unsubscribedAll,
snoozeUntil? }`, **migrating the 4 legacy keys** on read (a small normalizer: old `likes:true`
→ `channels['social.like'].email=true`). JSONB, **no migration**. Transactional categories default
on; marketing default off; security/auth is a locked "always on" pseudo-row (not stored, rendered
disabled). Add `snoozeUntil` for a non-destructive global mute.

**Backward-compat (do not skip).** Lazy migrate-on-read means old-shape rows persist until a user
saves settings, so the normalizer is **permanent**, not transitional, and **every reader** must run
it: the instant bridge (`notification-email.ts`), the digest scheduler, AND any pref check in the
sweep worker. The unsubscribe route (which today writes `{digest:'none', unsubscribedAll:true}`) and
any other partial writer must **merge into** the existing shape, never overwrite it, or they'll wipe
the `channels` map. Add a single `normalizeEmailPrefs(raw)` helper in `@commonpub/server` and route
all reads/writes through it. Test: an old-shape row → normalized correctly; unsubscribe on a
new-shape row preserves `channels`.

**Suppression hierarchy (define explicitly).** Three tiers: (1) **auth/security** mail (verify,
reset) always sends, exempt from every opt-out; (2) **`unsubscribedAll`** kills all non-auth mail
(notifications, digest, broadcast, reminders) — the hard opt-out; (3) per-category `channels[cat]
.email=false` suppresses just that category. A message sends only if none of (2)/(3) suppress it and
the recipient is `emailVerified`. Contest deadline reminders are legally transactional but still
honor the per-category toggle AND `unsubscribedAll` (a user who unsubscribed from everything means
it). The worker's send-time re-check (see the fixes-plan Phase 3 item) must consult this hierarchy,
and the new `reminder` category must be in its suppressible set.

### 1d. Preference center UI (the UX centerpiece)
Replace `layers/base/pages/settings/notifications.vue`'s 4 checkboxes with a **category × channel
matrix**. Layout (from research):

```
Notifications
──────────────────────────────────────────────
[ Snooze all notifications until: [date ▾] ]        non-destructive global mute

▾ Contests & entries                (section master toggle)
                          In-app     Email
  Deadline reminders        [on]      [on]     "7 days, 48h, 24h, and 1h before close"
  Entry confirmations       [on]      [on]     default on (transactional)
  Stage / round updates     [on]      [on]
  Results & winners         [on]      [on]

▾ Judging   (shown only if the user is/was a judge)
  Judge invitations         [on]      [on]
  Judging reminders         [on]      [on]

▾ Community
  Replies & mentions        [on]      [off]
  New followers             [on]      [off]
  Cadence: (•) Instant  ( ) Daily digest  ( ) Weekly

▾ Account & security
  Sign-in & security        [on]      [on]     Always on (disabled, locked)

[ Unsubscribe from all email ]  → existing RFC-8058 flow
──────────────────────────────────────────────
```

Requirements:
- **Descriptive labels with frequency** ("Deadline reminders (7 days, 48h, 24h, 1h before)") so the
  setting is informed.
- **Immediate save** on toggle (inline/toast confirm, no Save button) — matches
  Linear/Slack/GitHub; write via `PUT /api/profile`.
- **Defaults:** transactional on, marketing off; locked "Always on" security row (visible, disabled).
- **Cadence** (instant/daily/weekly digest) applies to community, not time-critical deadlines.
- **Global snooze** (mute until date) distinct from per-category off; plus the hard unsubscribe-all.
- Judging section shown only to users with a judge role (via `/api/me` or a lightweight flag).

**Accessibility (WCAG 2.1 AA — the matrix is the hard part, this is a standing rule):**
- Render the matrix as a real `<table>`: `<th scope="col">` for In-app/Email, `<th scope="row">`
  for each category, so a screen reader announces "Deadline reminders, Email, switch, on."
- Each cell is a `role="switch"` (or native checkbox styled as switch) with `aria-checked` and an
  `aria-label` naming **both** category and channel ("Email for deadline reminders") — never rely on
  column position.
- Full keyboard operability (Tab to each switch, Space/Enter toggles; section headers are
  `<button aria-expanded>`); state never by color alone (WCAG 1.4.1 — text/icon too); save
  confirmation via `aria-live="polite"`. Component test with axe-core (repo convention).
- CSS: `var(--*)` only, `cpub-` prefix, sharp corners, existing switch component if one exists (else
  a new `CpubSwitch` in `@commonpub/ui`, headless + ARIA).

**Phase 1 release:** `@commonpub/schema` (zod shape only, no table) → `@commonpub/server` (registry
+ `shouldEmailNotification` + 1a) → `@commonpub/ui` (CpubSwitch if new) → `@commonpub/layer`
(settings page + `/api/profile` shape). No migration. In-app improvements land regardless of the
email flag.

---

## Phase 2 — Contest transactional emails

Depends on Phase 1's registry + preference center + Phase-227 outbox/branding. Additive, inert
until `emailNotifications` on.

### 2a. Contest email templates
Add to `packages/infra/src/email/templates.ts` (+ `EmailCategory` union in `comms/outbox.ts`):
- `contestEntryConfirmation(site, username, {contestName, entryTitle, editUrl, closesAtLocal,
  closesTz}, unsub, branding)`
- `contestJudgeInvitation(site, judgeName, {contestName, role, criteriaSummary, timeCommitment,
  acceptUrl, declineUrl}, unsub, branding)`
- `contestStageTransition(site, username, {contestName, advanced:boolean, stageName, nextStepUrl},
  unsub, branding)` (graceful non-advance copy; never "you lost")
- `contestWinner(site, username, {contestName, placement, prize, claimUrl}, unsub, branding)`
- `contestDeadlineReminder(site, username, {contestName, timeLeftLabel, closesAtLocal, closesTz,
  submitUrl, alreadySubmitted:boolean}, unsub, branding)` (used by Phase 3)

All go through `escapeHtml` + `button()`; honor per-instance branding; carry the per-recipient
`unsubscribeUrl` + `List-Unsubscribe` headers (transactional still benefits from the header). Copy
per the tone rules above. Extend the admin email-preview route (`/api/admin/email-preview`) to
preview these with sample data (today it hardcodes `notificationDigest`).

### 2b. Wire the existing events to email
The on-transition/on-invite hooks already call `createNotification`; with the Phase-1 registry the
matching categories now email when opted. Add the **missing** notification producers:
- **Entry-received confirmation** (to entrant) + optional **new-entry alert** (to organizer) —
  `contest/submissions.ts` / `entries.ts` currently create zero notifications. Add
  `createNotification(type:'contest', category link `?e=entry`)` + the transactional email.
- **Judge invitation email** — `judges.ts:88` makes the in-app notif; ensure the `contest.judge`
  category is transactional so an invited judge emails even without digests. Include accept/decline
  links.
- **Stage transition** — `judging.ts:289` already notifies; template + category do the email.
- **Winner** — `contest.ts:308` already notifies winners; split personal winner email (transactional)
  from a general recap (Phase 4, marketing/opt-in).

### 2c. Proposal accept/reject (if `contestProposals` on)
`submissions.ts` proposal path creates a draft placeholder but no adjudication notification. Add
accept/reject producers + email when an organizer decides. Gated by `contestProposals`.

**Phase 2 release:** `@commonpub/infra` (templates) → `@commonpub/server` (producers + preview) →
`@commonpub/layer` (preview UI). No schema/migration. Flag: rides `emailNotifications` (no new flag)
plus the per-category prefs from Phase 1.

---

## Phase 3 — Deadline reminder worker

The one genuinely new subsystem. Depends on Phase 2 templates.

### 3a. Ledger table (migration)
`contest_reminder_sends`: `id, recipientId uuid→users(cascade), contestId uuid→contests(cascade),
milestone text, sentAt timestamptz default now()`, `UNIQUE(recipientId, contestId, milestone)` +
`index(contestId)`. Milestones: `deadline_T7d|deadline_T48h|deadline_T24h|deadline_T1h|
judging_T48h|judging_T24h` (+ room for per-stage `stage_{id}_T24h` if per-stage reminders are
wanted). Migration `NNNN_*` via `db:generate` (next after 0039).

### 3b. Scheduled Nitro plugin
`layers/base/server/plugins/contest-reminders.ts`, copying `scheduled-publishing.ts` skeleton
(test-guard first line, startup stagger ~12s, `setInterval`, feature gate read inside the timer,
cleanup on `close`). Interval **10-15 min**. Gate on `emailNotifications` **and** a new flag
`contestReminders` (default OFF; 7-touchpoint flag add per the fixes-plan/§4.2 checklist:
config schema + types + useFeatures + ENV_FLAG_MAP + nuxt runtimeConfig + admin flagMeta).

### 3c. Server sweep fn (`@commonpub/server`)
`sweepContestReminders(db, config, now)`:
- For each contest with `status IN ('upcoming','active')` and a future/near `endDate`, for each
  submission milestone whose window `[now, now+lead]` is open and `now <= endDate` (staleness
  guard): resolve recipients = **users with a `contest_entries` row** (see Audience reality above —
  there is no non-entrant audience unless Open decision 7 adds a watch table), keyed by `userId`.
  Distinguish copy by whether their entry is a `placeholder=true` draft ("finish your entry") vs a
  developed entry ("edits close in X"). Then for each recipient **claim** `INSERT INTO
  contest_reminder_sends … ON CONFLICT DO NOTHING RETURNING`, and only on a returned row check the
  per-category preference + verified email and `enqueueEmail` (category `reminder`) with
  `contestDeadlineReminder`.
- Judging milestones (`status='judging'`, `judgingEndDate`): recipients = **accepted judges**
  (`contest_judges.acceptedAt IS NOT NULL`, `role != 'guest'`). **NOTE (verified):** "judges with
  incomplete scoring" is NOT a stored/queryable field — scores live only in the denormalized
  `contest_entries.judgeScores` jsonb, partitioned by `roundId`, with no per-judge progress column.
  Computing "incomplete" means an in-memory scan of every eligible entry's `judgeScores` for that
  judgeId in the current round (excluding the judge's own + eliminated entries) — expensive per
  tick. **Recommend v1: remind all accepted judges** (simple, one join); add a denormalized
  scored-count later if "only unfinished judges" is wanted. Same claim-then-enqueue.
- All time math in UTC; the template renders `closesAtLocal` from the recipient's TZ if known
  (fallback: show contest TZ + UTC). See Open decision 3 on whether TZ is collected at all.
- Multi-replica safe by construction (the `ON CONFLICT` claim is the lock; no `SKIP LOCKED` needed).

### 3d. Reconcile the per-stage `endsAt` / hero countdown seam
Per-stage `ContestStage.endsAt` exists in schema + editor + sidebar timeline but drives neither the
hero countdown nor reminders. Decide: (a) reminders key off the top-level `endDate` only (simplest,
matches the current hero), or (b) also remind off the current stage's `endsAt` and extend
`ContestHero.countdownTargetStr` to prefer the current stage's `endsAt` when the contest is active.
**Recommend (a) for v1** (one clear submission deadline), with (b) as a follow-up once per-stage
submissions are common. Note the reconciliation either way so the countdown and the reminder agree.

**Phase 3 release:** `@commonpub/schema` (ledger + migration) → `@commonpub/config` (flag) →
`@commonpub/server` (sweep fn) → `@commonpub/layer` (plugin + flag wiring + admin flagMeta). Roll to
3; flag OFF. CLI re-pin. Verify curl + a real contest per instance.

---

## Phase 4 — Winner announcement + organizer contest-comms controls

Depends on Phases 1-3 + session-227 broadcast plumbing.

### 4a. Winner announcement
On transition to `completed` (`calculateContestRanks` already runs): send the **personal**
transactional `contestWinner` email to placed entrants (claim instructions), and a **general**
recap to the rest **only if** they opted into `contest.result` email (or via an opt-in recap
category). Keep the recap promo-free (transactional) or route promo to a separate marketing opt-in.

### 4b. Organizer "message entrants" (scoped broadcast)
Reuse the session-227 `sendBroadcast` audience/throttle machinery but scoped to a **single
contest's** audience (all entrants / advancing / a stage cohort / judges), exposed to the contest
**organizer** (not just platform admin) in a new **Comms** panel/tab in `ContestEditor.vue` (beside
People/Schedule). Compose + audience picker + live recipient count + preview (reuse the broadcast
composer components) + send history. Permission: a contest-scoped `contest.message` (organizer/
editor role), distinct from the admin `broadcast.send`. Feature flag `contestBroadcast` (OFF).
Respects verified + unsubscribed + per-category prefs; drains through the outbox throttle.

### 4c. Public winners banner + countdown polish
Add a completed-state **winners banner** to `ContestHero.vue` (today winners live only on
`results.vue`); surface top placements with a "View results" CTA. If Phase 3d chose (b), extend the
hero countdown to per-stage `endsAt`.

**Phase 4 release:** `@commonpub/schema` (permission key + any broadcast-scope column) →
`@commonpub/config` (flag) → `@commonpub/server` (scoped broadcast) → `@commonpub/layer` (organizer
Comms panel + hero banner). Roll to 3; flag OFF.

---

## Master sequencing & release boundaries

1. **Release A = Phase 1** — notification correctness + preference center. Ships value with email
   OFF; unblocks everything. (Also satisfies the fixes-plan 1c dedup fix.)
2. **Release B = Phase 2** — contest transactional emails (templates + producers).
3. **Release C = Phase 3** — deadline reminder worker (the migration + new flag).
4. **Release D = Phase 4** — winner announcement + organizer comms + hero banner.

Each is a full publish + roll-to-3 per the STATUS runbook (schema→config→infra→ui→server→layer,
poll `npm view`, both lockfiles, CLI re-pin, curl-verify), TDD, all flags default OFF, all
migrations additive, no behavior change until an operator enables email. No AI attribution in
commits. Component tests use axe-core; the preference matrix is the a11y-critical piece.

## Open decisions (confirm before building)

1. **Notification type granularity.** Keep the single `contest` DB enum type and discriminate by
   `link`/category (zero migration, recommended), or split into `contest_deadline` /
   `contest_result` / `contest_judge` enum values (finer in-app filtering, needs a migration + the
   8-touchpoint type add)? Recommend keeping `contest` + a category registry.
2. **Reminder scope (Phase 3d).** Top-level `endDate` only (recommended v1) vs also per-stage
   `endsAt`.
3. **Per-user timezone.** Do we have/collect a user timezone? If not, render contest TZ + UTC in
   reminder copy (recommended) rather than build TZ collection now.
4. **Winner recap classification.** Personal winner = transactional (always). Is the general recap
   transactional (results of a contest you entered) or marketing (needs opt-in)? Recommend a
   `contest.result` opt-in category defaulting ON, kept promo-free.
5. **Organizer broadcast (Phase 4b).** Give organizers a scoped broadcast now, or defer until
   contest-run demand is proven? It's the highest-effort UI. Recommend deferring behind
   `contestBroadcast` until asked.
6. **Enable email in prod at all** — operator's call; this only makes it safe to. Contests get an
   in-app upgrade regardless.
7. **Contest watch / register-interest table (prerequisite for the high-value reminder).** VERIFIED:
   no "interested but not entered" audience exists (no follow/watch/registration, no hub linkage).
   To send the valuable "you haven't entered yet, N days left" reminder you must FIRST add a
   `contest_watchers` table (userId, contestId, createdAt) + a "Notify me about this contest" button
   on the public contest page + API. This is a small feature (one migration + one button + one
   route) but it is **out of Phase 3's stated zero-new-table scope** and should be its own Phase 0
   of the reminder work IF that reminder is wanted. **Decision:** add the watch table (recommended if
   deadline reminders are a goal at all, since entry-holders already know they entered), or scope
   reminders to entry-holders only (draft-finish nudges). This is the single biggest scope fork in
   the plan.

## Effort estimate

- Phase 1 (correctness + preference center): ~1.5-2 sessions (the matrix UI + a11y + storage
  migration-on-read + registry refactor + tests).
- Phase 2 (contest emails): ~1 session (5 templates + producers + preview extension).
- Phase 3 (reminder worker): ~1.5 sessions (ledger migration + idempotent sweep + timezone copy +
  the flag + concurrency/catch-up/staleness tests).
- Phase 4 (winner/organizer comms): ~1.5-2 sessions (scoped broadcast + organizer Comms panel +
  hero banner).

Total ~5.5-7 focused sessions across 4 releases. Phase 1 alone delivers the biggest UX win (a real
preference center + non-lossy contest notifications) with zero prod risk.

---

## Round-2 blast-radius corrections (session 231, workflow audit)

> A 12-surface upstream/downstream degradation audit + a completeness critic. These **supersede the
> inline text above where they conflict**. Each cites a finding id (R#) or completeness gap (G#),
> CONFIRMED against code unless marked PLAUSIBLE.

### The email-preference reshape (1b/1c) has three write-path landmines
- **R5 (P1).** `updateProfileSchema` is a **strict `z.object()`** — a matrix UI shipping before the
  schema widens has `channels` **silently stripped**, so every toggle save no-ops with no error.
  **Edit:** land schema+server FIRST — widen `updateProfileSchema.emailNotifications` (non-strict)
  to accept BOTH the flat keys AND `{channels,snoozeUntil}` — THEN the layer UI. Add an
  `auth.test.ts` case asserting both shapes parse. (Also completeness G3.)
- **R6 (P2).** `updateUserProfile` (`profile.ts:165`) does a **wholesale overwrite** of
  `emailNotifications` — a partial matrix/profile save wipes `channels`, `digest`, AND one-click
  `unsubscribedAll` (silent re-subscribe). **Edit:** read-modify-write MERGE into
  `normalizeEmailPrefs(currentRow.emailNotifications)` (the `unsubscribe.post.ts` spread pattern).
  Also migrate/strip `settings/profile.vue`'s own email toggles so only the notifications page owns
  the field.
- **R7 (P2).** `shouldEmailNotification` reads flat keys via `TYPE_TO_PREF`; if writers switch to
  `channels` without a read-normalizer, every opted-in like/comment/follow/mention email evaluates
  `undefined → false` (silent email-off regression). **Edit:** ship a permanent `normalizeEmailPrefs()`
  (maps BOTH legacy-flat and new-`channels` → resolved per-category booleans) in the SAME server
  publish as the writer change, and route EVERY reader through it: instant bridge, digest scheduler,
  sweep worker, unsubscribe route, AND the GDPR export (**R25** — `export.ts:74` serializes it raw,
  else exports leak legacy flat keys forever). Rewrite `notification-email.test.ts` for registry
  semantics + add old-flat-normalizes + unsubscribe-preserves-channels cases.

### Category routing is load-bearing on the link discriminator — G10 (unhandled in both plans)
All five contest categories share `type='contest'`, so `shouldEmailNotification` **cannot** pick
`contest.deadline` vs `contest.entry` from the notification TYPE alone — it must parse the `?e=`
link discriminator. That makes the 1c dedup vocabulary a **routing key**, not just collision
avoidance: a producer that sets the wrong `?e=` routes mail to the wrong preference toggle. **Edit:**
define the discriminator→category map once, share it between `createNotification` producers and
`shouldEmailNotification`, and pin it to the `contest_reminder_sends` milestone vocabulary (R26).

### Double-send: the instant bridge AND the explicit template fire on the same event — G9
Once 1b puts `type='contest'` in the registry, `notification-email.ts`'s instant path emails on
winner/stage/judge events — and Phase 2/4 ALSO send explicit `contestWinner`/`contestStageTransition`
templates for the same events → **two emails per event** (the reminder ledger only dedups reminders).
**Edit:** decide ONE channel per event — either the generic instant bridge OR a dedicated template,
not both. Recommend: exclude the contest categories from the instant bridge and send only the rich
templates; the bridge stays for social types.

### The reminder worker — flag wiring, batching, stagger, ordering
- **R15 (P2, consumer-fork).** deveco-io + heatsynclabs-io inherit the worker plugin but have their
  own staler `ENV_FLAG_MAP` → `FEATURE_CONTEST_REMINDERS` env-toggle silently dropped (only the DB
  toggle works). **Edit:** add `contestReminders:'FEATURE_CONTEST_REMINDERS'` to BOTH forks'
  `server/utils/config.ts` ENV_FLAG_MAP + declare it in each fork's `nuxt.config` public.features, in
  the layer-publishing change.
- **R16 (P2, ripple).** The flag half-wires unless BOTH layer `ENV_FLAG_MAP` and
  `nuxt.config.public.features` are hand-edited; nothing guards drift so it ships green. **Edit:** add
  a **flag-parity test** enumerating flag keys across config schema / ENV_FLAG_MAP / nuxt.config so
  drift hard-fails. (This also needs a `@commonpub/config` publish for the new flag — completeness
  G2, not covered by the plugin surface.)
- **R17 (P2, PLAUSIBLE) + G14.** `sweepContestReminders` as sketched is an O(contests×recipients)
  N+1 burst on the shared pool every tick, on every replica. **Edit:** (1) single-join recipient
  resolution (no per-recipient reads); (2) ONE multi-row `INSERT … SELECT … ON CONFLICT DO NOTHING
  RETURNING` claim per contest/milestone; (3) v1 reminds all accepted judges (no per-tick
  `judgeScores` jsonb scan); (4) per-tick contest/recipient LIMIT with window-based catch-up; (5) an
  index plan beyond `index(contestId)`.
- **R28 (P3).** The ~12s startup stagger collides exactly with `scheduled-publishing.ts:28`. **Edit:**
  use a distinct 15_000–20_000ms offset; document occupied offsets (5s ×3, 12s ×1) in the comment.
- **R18 (P2, ripple).** Per-category `reminder` suppression depends on the `channels` shape +
  `normalizeEmailPrefs` that don't exist until 1c lands. **Edit:** scope the reminder recheck to
  `unsubscribedAll`-ONLY until 1c ships; note the dependency.

### UI: reuse the existing switch, and gate the judging section on a datum that may not exist
- **G1 (refuted the plan's own suggestion).** Do NOT create a new `CpubSwitch` — `Toggle.vue`
  (`role=switch`, exported from `packages/ui/index.ts:63`) already exists. **Edit:** reuse
  `CpubToggle` for the matrix cell (verify `aria-checked` + dual-context label). Avoids a
  `@commonpub/ui` publish + re-pin.
- **G12.** 1d gates the Judging section on "am I a judge," but there's **no existing cross-contest
  is-judge query** — that's a new server/API surface the UI depends on. **Edit:** add a lightweight
  `GET /api/me` field or `hasAnyJudgeRole(userId)` before the UI can conditionally render it.
- **Consumer forks (G4, verified CLEAN for the matrix):** neither deveco nor heatsync overrides
  `settings/notifications.vue`, the profile API, or `app.vue` — only the schema/server TYPE widening
  ripples (covered by fixes-plan R20). No fork UI edits needed for the matrix itself.

### Migrations & cross-plan sequencing
- **G13 / migration numbering.** Both plans add migrations "after 0039" concurrently
  (`contest_reminder_sends`, optional `contest_watchers` from Open decision 7, the Phase-4
  permission/scope add). **Edit:** assign sequential 0040+ numbers across BOTH plans at build time;
  generate via committed SQL + `db-migrate.mjs` (the repo standard), NOT `db:push`.
- **R26 (P3, cross-plan).** fixes-1c and contest-1a edit the IDENTICAL `createNotification` sites
  (`contest.ts:308/317/324/343`, `judges.ts`, `stakeholders.ts`, `judging.ts`) → guaranteed merge
  conflict + wasted second publish. **Edit:** name **fixes-plan Phase 1c as the single canonical host**
  for that edit; contest-1a becomes a pointer (no code). Pin the `?e=<milestone>` strings to match the
  ledger vocabulary.
- **NotificationType union (G17).** `NotificationType` omits `event` (in the DB enum) — a vue-tsc
  strict hazard the moment the registry is typed over `NotificationType`. **Edit:** add `event` (and
  resolve `certificate`) to the union in the registry-refactor commit.

### Depends on fixes-plan Phase 3 (call out the coupling — G6/G7/G8)
Contest email is not shippable-compliant until three fixes-plan Phase-3 items land: the send-time
unsubscribe recheck (suppression hierarchy), the `List-Unsubscribe` **GET** handler (RFC 2369
compliance for contest mail), and the broadcast drain-gate + idempotency (Phase 4b organizer blast
inherits both defects). Sequence those BEFORE contest Phase 2/4 email.

---

## Round-4 verification corrections (session 231, "never assume" pass)

> Direct code + live-state verification of the round-2/3 corrections themselves and the wider surface.
> These are the final refinements; each is CONFIRMED against code/live unless noted.

- **[deveco live email]** See the LIVE-STATE CORRECTION banner at the top — the biggest assumption
  break. `emailNotifications=true` on deveco; workers run but drain to the Console adapter (no
  transport). Not greenfield-safe there.
- **[R7 reader list — add the SQL-path reader].** `comms/broadcast.ts:30` reads `unsubscribedAll` via
  **raw SQL JSONB** `(users.emailNotifications ->> 'unsubscribedAll') IS DISTINCT FROM 'true'`. A JS
  `normalizeEmailPrefs()` **cannot** cover a SQL-side reader. **Constraint:** the reshape MUST keep
  `unsubscribedAll` AND `digest` as **top-level** JSONB keys (plan 1c already does); if either is ever
  nested under `channels`, the broadcast audience query silently over-sends to unsubscribed users.
  Add broadcast.ts to the "every reader" enumeration, flagged as SQL-path (normalizer-exempt).
- **[G1 Toggle reuse — needs one additive prop].** `CpubToggle` (`packages/ui/src/components/Toggle.vue`,
  exported `src/index.ts:63`) IS a real `role=switch` + v-model + `aria-checked` and is reusable — BUT
  its accessible name is coupled to the visible `label` prop, and `inheritAttrs` puts a fallthrough
  `aria-label` on the wrapper `<div>`, not the switch. For a matrix cell (invisible per-cell name,
  visual context from row/col headers) add a small `ariaLabel`/`hideLabel` prop to Toggle. This is a
  minor `@commonpub/ui` change (partially erodes G1's "no ui publish" benefit — budget one ui bump).
- **[R17 batched claim — CONFIRMED implementable].** `contest_entries` has `contestId`+`userId`+
  `contentId` (unique `(contestId,userId,contentId)`), so `INSERT INTO contest_reminder_sends SELECT
  contestId,userId,'<milestone>' FROM contest_entries WHERE contestId=$1 ON CONFLICT DO NOTHING
  RETURNING` is clean; judge variant = `contest_judges WHERE accepted_at IS NOT NULL`. No obstacle.
- **[R28 stagger — pick 18000 or 20000].** Verified occupancy: startup offsets 2000, 3000, 5000(×3),
  10000(×2), 12000 (scheduled-publishing), 15000 (metrics-rollup). The plan's "~12s" collides with
  scheduled-publishing; R28's fallback "15s" collides with metrics-rollup. **Free: 8000, 18000, 20000,
  25000 — use 18000 or 20000** for `contest-reminders.ts`. Interval 10-15min collides with nothing.
- **[G17 NotificationType — confirmed + broader].** The union (`notification.ts:21`) omits `event`
  (in the DB enum) → vue-tsc-strict hazard when the registry is typed over it; add `event`. Also the
  union already includes `hub`/`fork`/`build`/`certificate`, all of which ALREADY flow into deveco's
  type-agnostic digest — so the registry must decide the email policy for those existing types too,
  not only `contest` (framing "4 social + contest" undercounts the live surface).
- **[fork ENV_FLAG_MAP drift — worse than R15 said].** deveco's `server/utils/config.ts` has 15 flags,
  heatsync 14, vs canonical 24 — both are ~9 flags behind (missing adminBroadcast, requireTerms­Acceptance,
  contentImport, actAsRegistry, announceToRegistry, referralLinks, featuredHub, hubGovernance, …).
  Env-toggle is ALREADY broken for many existing flags on the forks; `contestReminders`/`contestBroadcast`
  inherit this. **Edit:** the flag-parity test (R16) should run against the FORKS too, or at minimum the
  release checklist must add each new flag to both forks' ENV_FLAG_MAP + nuxt.config.
- **[deveco shadows the notification bell].** deveco forks `layouts/default.vue` (its own `de-notif-dot`
  bell markup). G4's narrow claim (settings page / profile API / app.vue unshadowed) holds, but any
  future change to the notification bell / a global notification component will NOT reach deveco
  (memory: "consumer layout drops layer globals"). Latent, not an active break for this plan.
- **[link discriminator ripple — CLEAN, contained].** Verified `?e=` does NOT ripple to search-index
  (notifications unindexed), metrics-rollup, SSE (count-only payload), or GDPR export (link not
  exported). The discriminator's only load-bearing downstream is email category routing (G10). Safe.
- **[CLI pins CURRENT].** create-commonpub pins schema^0.56/config^0.30/server^2.105/layer^0.97 = live
  stack; each publish phase still needs a re-pin (edit `template.rs` AND `tests/cli.rs`).
