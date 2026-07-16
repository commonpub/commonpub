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

## Adversarial audit + fixes (rolled: infra 0.17 / server 2.113 / layer 0.106, CLI 0.5.29, NO migration)

A 5-lens ultracode audit (refute-by-default verify) raised 9, confirmed **7** (all P2/P3 — no P0/P1;
2 refuted), deduping to **5 distinct issues**, all fixed:

1. **(P2) deploy-time duplicate reminder for staged contests.** The un-scoped→stage-scoped ledger-key
   transition would re-fire a milestone a registrant already got under the old key. → the scoped claim
   now carries a `NOT EXISTS` guard against the legacy un-scoped `milestone.key`, so the transition
   never re-fires.
2. **(P3) reserved stage-id misclassification.** `isContestOwnDeadline(stageId)` string-matched `final`/
   `core-*`; a user stage with such an id (reachable via raw API) mis-keyed. → `nextContestDeadline` now
   returns `isOwnDeadline` from stage **provenance** (explicit vs synthesized/fallback), not the id
   string; `isContestOwnDeadline` dropped.
3. **(P3) past deadline in the confirmation email** for a contest still `active` after its endDate. →
   confirmation + preview + test-send show the deadline only when it's in the future.
4. **(P3) sweep perf.** Dropping the `endDate<=horizon` bound made it load every live contest's heavy
   `stages`+`emailCopy` jsonb each tick. → **two-phase load**: a light select resolves the deadline +
   filters to the in-window contests, then a heavy select fetches `emailCopy`/title/slug only for those
   survivors. Dead `horizon` removed.
5. **(P3) HTML/text suppression divergence.** The deadline line was suppressed on `bodyHtml` but the
   text part gated on `bodyText`; a text-less authored body (image/divider-only) made the two MIME
   parts disagree. → both parts (and the leadText fallback) now key off `bodyHtml`.

Refuted (correct): "custom body drops the deadline" (intended — the organizer owns the copy) and
"endDate>last-stage sends a false cycle" (wrong premise — endDate IS submission close). Tests added:
legacy-key dedup, `final`-id provenance. Full server suite 1724 green; nuxt typecheck clean.

## Method
Two parallel Explore recons (reminder-sweep internals; agreements/PII infra) mapped the systems
before any code. Decisions confirmed via AskUserQuestion (Q1 full scope; Q2 relay-only).

## Open / next
- The hero countdown (`ContestHero.vue`) still targets status-derived dates, not the current
  stage `endsAt` — would align with the same helper (out of scope here).
- Contest Signup as a droppable block; resend-verification UX (still pending from 237/239).
