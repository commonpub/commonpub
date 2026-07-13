# Session 233 — pre-roll comprehensive re-audit of the `contest-registration-reminders` stack

Date: 2026-07-12/13. Branch **`contest-registration-reminders`** (still NOT pushed / published / rolled).
Goal: an independent, comprehensive re-audit of the whole branch (P1 security batch + registration/
reminders + email editor) before the roll — verify it is solid, foolproof, and deployable, driving a real
browser. The audit found **four real defects** (two of them LIVE) and they are now fixed on-branch.

## Method

Four parallel adversarial auditors (security batch / registration+reminders / email editor+infra / roll-
readiness+conventions), each told to re-verify from source and NOT trust prior audit claims. Plus a real-
browser behavioral pass (the batch's own "change medium" gate): the app was run locally against a
throwaway PG DB (mig 0040 applied), and the features were exercised through the real Nitro route layer.

## Findings + fixes (all committed on-branch)

### 1. P1 (LIVE) — private hub post body served over ActivityPub, unauthenticated
`layers/base/server/middleware/hub-post-ap.ts`. The per-post AP Note middleware resolved the hub with
`getHubBySlug(db, slug)` and guarded only `if (!hub) return;` — it never checked `privacy === 'private'`.
The session-231 batch gated the 4 AP *routes* (outbox/followers/products/resources) + webfinger + Group
actor, but this *middleware* was missed. With `federateHubs` ON (commonpub.io + deveco.io), a
`curl -H 'Accept: application/activity+json' /hubs/<private-slug>/posts/<uuid>` returned the private post's
full `content` (and `cpub:sharedContent` for shares) to anyone with the post UUID. **Fix:** `if (!hub ||
hub.privacy === 'private') return;` (mirrors the sibling AP routes; the no-requester stub carries
`privacy`). **Behaviorally verified:** private post AP deref → HTML passthrough, no Note (SECRET absent);
public post AP deref → Note served (not over-blocked).

### 2. P2 (LIVE where publicApi on) — private hub metadata via the public REST API
`layers/base/server/api/public/v1/hubs/[slug].get.ts`. No-requester `getHubBySlug` returns the real-id
stub for a private hub, so a `read:hubs` token could read a private hub's name + member/post counts.
**Fix:** 404 when `hub.privacy === 'private'` (matches `listHubs`, which excludes private).

A completeness sweep of ALL `getHubBySlug` callers in `layers/base/server` confirmed these two are the
only remaining same-class holes: every `?user?.id` read route threads `requireHubReadAccess`; the write /
privileged-GET paths self-authorize; `hub-ap.ts` (Group actor) is safe via `buildHubGroupActor` null-for-
private.

### 3. P1 (feature-correctness) — reminder milestone burst + stale "time remaining"
`packages/server/src/contest/reminders.ts`. The sweep fired EVERY entered milestone in one pass and set
`timeRemaining` to the milestone's FIXED label. A participant who registered late (e.g. 20h before the
deadline) — or any contest whose active window is shorter than 7 days — received a burst of simultaneous
emails literally stating "7 days left" / "48 hours left" when only hours remained. **Fix:** fire only the
single tightest entered milestone per contest per sweep (ledger still guarantees exactly-once; the next-
tighter milestone fires on a later sweep), AND derive the displayed time from the actual `msLeft` via a new
`humanizeTimeRemaining(ms)` — so a milestone that fires late never claims a wrong number. On-schedule
milestones still read "48 hours"/"24 hours"/"1 hour"; a mid-window fire reads e.g. "2 days".

### 4. P1 (found by driving the browser) — garbled deadline in every contest email
`packages/server/src/contest/reminders.ts` `formatDeadlineUtc`. The live email preview showed "August 12
**at** 2026 **at** 05:44 UTC". Root cause: modern ICU (Node 18+/V8) renders the date as "August 12, 2026
**at** 05:44" (native " at ", one comma); the old comma-rewriting regex then converted the day-comma into
" at", doubling it. The unit tests missed it because they compared `html` against the SAME function's
output (consistency, not correctness). **Fix:** assemble the string from `formatToParts` so it is stable
across ICU versions → "August 12, 2026 at 05:44 UTC". **Verified live** through the real preview route.

### Non-issues confirmed (no change)
- Email editor injection / DTO-leak / flag kill-switch / route gating / migration safety — all hold
  (re-verified from source + live: `<script>` in an intro renders as escaped literal text, no execution;
  tokens interpolate; `email_copy` never in the public DTO; save→persist→reload round-trip works).
- Registration idempotency, race-safe reminder ledger claim, unsubscribedAll honored, both flags default
  OFF and registered at every site — all confirmed.
- The "confirmation suppressed for `unsubscribedAll`" note is a deliberate session-231 decision (honor the
  global opt-out at the source); left as-is.

## Roll-plan correction (docs/sessions/233-kickoff.md updated)
The original 6-package publish set was **incomplete**: it omitted **`@commonpub/editor`** (the Callout/
Quote reversed-text caret fix — only reaches forks via an editor publish + layer caret bump) and
**`@commonpub/test-utils`** (`mockConfig` gains the two now-REQUIRED flags; forks' test typechecks break
without it). Publish set is now **8 packages**. Added the two new privacy-leak URLs to the post-deploy
curl checklist and the RBAC breaking-signature fork note.

## Verification
- Full `pnpm test` + `pnpm typecheck` green across the monorepo (see commit).
- New/updated tests: `humanizeTimeRemaining` + `formatDeadlineUtc` unit tests (boundaries + the double-
  "at" regression); reminder "late registrant gets ONE reminder with true time left, not a stale burst";
  updated the sequencing + override tests to the accurate-time behavior.
- Live browser: email editor round-trip, injection escaping, deadline fix, hub-post-ap private/public AP
  deref, registration register/cancel.

## Follow-on UX — registration/entry unification (operator asked: "why register AND submit?")

The two concepts are deliberate — `contest_registrations` is the reminder AUDIENCE (people to nudge
toward submitting), `contest_entries` is an actual submission. But making a participant do both explicitly
is cumbersome. Resolved by making entry IMPLY registration instead of merging them:

- **Auto-register on entry + proposal.** `submitContestEntry` and `submitContestProposal` now insert an
  idempotent `contest_registrations` row inside the same transaction as the entry (silent — no
  confirmation email, since the user's action was "submit", not "register"; deadline reminders still reach
  them). So entering never requires a separate register click.
- **Standalone register reframed as the optional path.** `ContestSidebar.vue` CTA is now "Get deadline
  reminders" (was "Register for this contest"), the registered state reads "You'll get deadline reminders"
  with a "Turn off reminders" toggle, and the hint says "Submitting an entry registers you automatically.
  Opt in here to get deadline reminders even before you enter." So the card is clearly the low-commitment
  "remind me before I enter" path, not a required step.

Rejected the "entry-only, drop standalone register" option: it breaks the deadline-reminder feature (you
could not nudge people who signed up but have not entered yet — the whole point of the reminders).

Tests: auto-register asserted in `contest.integration` (entry path) + `contest-proposals.integration`
(proposal path). Full server (1688) + layer (1483) suites + typecheck green. Browser-verified the reframed
card + the register toggle.

## State / next
Still an operator-supervised roll (nothing pushed/published/deployed). Versions unchanged at pre-roll
numbers. The roll sequence + expanded 8-package publish set + curl checklist live in `233-kickoff.md`.
