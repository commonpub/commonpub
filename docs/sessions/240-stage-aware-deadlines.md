# Session 240 — Stage-aware contest deadlines + consent-checkbox answer

Two operator (Jinger Zeng, deveco.io) support questions, both resolved.

## Q1 — Staged-contest deadlines in emails + reminders (BUILT + ROLLED)

**Problem:** a staged contest's registration-confirmation email + deadline reminders used
`contest.endDate` (the FINAL deadline), but the first thing due is the proposal submission.
And the "The submission deadline is …" paragraph was system-appended (not a block), so the
organizer couldn't edit it.

**Root cause:** the deadline resolved from `contest.endDate` in 6 places
(`registrations.ts`, `reminders.ts` selection + milestone math + display, `email-preview.post.ts`,
`email-test.post.ts`). Stages already store per-stage `endsAt` (editable in `ContestStageCard.vue`)
but nothing read them. The deadline line was always appended in `templates.ts`.

**Fix (full scope, user-approved):**
- New pure `nextContestDeadline(contest, now)` (`contest/stages.ts`): the earliest upcoming
  `endsAt` among `submission`/`interim` stages, else the final `endDate`. Returns
  `{ at, stageId, stageName }`. `isContestOwnDeadline(stageId)` = `'final'` or `core-*`
  (synthesized/classic) → treated as the contest's own deadline.
- Confirmation email + preview + test-send routes use it → show the next stage deadline; the
  `{deadline}` token is now stage-aware.
- **Reminder sweep is stage-aware:** selects live contests (drops the `endDate <= horizon`
  upper bound), resolves each one's next stage deadline, fires 7d/48h/24h/1h before EACH stage
  deadline via a **stage-scoped ledger key** (`<stageId>:deadline_T7d`). Classic/own-deadline
  contests keep the historical un-scoped key, so widening never re-fires an already-sent
  reminder — **no migration** (the `milestone` column is free-form text).
- **Editability:** the system "submission deadline is …" paragraph (confirmation) and
  "Submissions close on …" line (reminder) are **suppressed when the organizer supplies a
  custom block body** — they own the copy and can place the stage-aware `{deadline}` token
  wherever they want. Default (no custom body) still shows it, now with the correct date.

**Verified live (local):** the confirmation preview for a staged contest shows the PROPOSAL
date (Jul 22), not the final (Sep 14); with a custom body the auto line is suppressed and the
body's `{deadline}` resolves to the proposal date. Tests: `nextContestDeadline` unit cases +
a sweep test proving a staged contest reminds about the proposal deadline (stage-scoped key)
not the far-off final. Full server suite 1722 green.

**Rolled:** infra **0.16** / server **2.112** / layer **0.105**, CLI **0.5.28**, NO migration,
still 37 flags.

## Q2 — Consent checkbox "we are a registered US entity" (ALREADY EXISTS + preset added)

The per-stage **Submission form builder** already supports a required `agreement` field
(custom terms + audit trail: snapshot + hash + IP) and a plain `checkbox` (custom label),
both organizer-configurable + server-enforced (`validation.ts` / `recordPrivateAndAgreements`).
`contestPii` is ON for deveco, so the Agreement type is available.

**Answer to relay:** contest editor → the submission stage's **Submission form** → + Add field →
**Agreement** → terms = "I confirm we are a registered legal entity in the United States" →
Required / Must accept. Blocks entry until ticked; audited. (It gates at ENTRY submission, the
correct binding moment — not at one-click registration.)

**Added:** a one-click **"US entity attestation"** preset (`contestSubmissionTemplates.ts`,
`US_ENTITY_TERMS`) so it's a single click in the Add-field menu.

## Method
Two parallel Explore recons (reminder-sweep internals; agreements/PII infra) mapped the systems
before any code. Decisions confirmed via AskUserQuestion (Q1 full scope; Q2 relay-only).

## Open / next
- The hero countdown (`ContestHero.vue`) still targets status-derived dates, not the current
  stage `endsAt` — would align with the same helper (out of scope here).
- Contest Signup as a droppable block; resend-verification UX (still pending from 237/239).
