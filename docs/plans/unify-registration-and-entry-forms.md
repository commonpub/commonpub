# Audit + Plan — Unify the registration form and the stage/entry forms

**Status:** AUDIT COMPLETE + PLAN PROPOSED. Author context: session 246. Grounded in a
two-agent trace of the entry system + the registration system (file:line inline).

## 0. TL;DR

The registration form and the stage/entry forms are **two parallel intakes over one shared
form engine.** They already share the entire field-definition → render → validate →
partition → private/consent-write layer. They diverge only in (a) which template column +
which public/PII table they target, (b) submit routes/fns, and (c) surfacing. The single
biggest redundancy: **combined mode creates an empty entry stub and does NOT flow the
registration answers into it** — so "register = enter" is only half-wired, while
`submitContestProposal` already does the *complete* form→entry path. Unifying = routing
combined registration through the proposal mechanism (entry as the source of truth) so one
form serves both, plus closing the surfacing asymmetries.

## 1. What we have (the shared engine)

Both intakes use, verbatim:

| Shared primitive | File |
|---|---|
| `FormField` type (= `ContestSubmissionTemplateField`) | `schema/contest.ts:155` |
| `ContestSubmissionField.vue` (field renderer) | used by `ContestRegistrationForm:90`, `ContestProposalForm:66`, `ContestStageSubmission:107` |
| `FormTemplateEditor.vue` (form builder) | registration (`ContestEditor.vue:609`) + stages (`ContestStageCard.vue:162`) |
| `buildSubmissionPayload` / `blockingFieldKeys` (`utils/contestSubmission.ts`) | both forms |
| `validateSubmissionFields` (validate + partition) | `validation.ts:41` — registration (`registrations.ts:159`) + entry (`submissions.ts:331,439`) |
| `recordPrivateAndAgreements` (PII + consent writer) | `submissions.ts:181` — switches scope on `entryId` XOR `registrationId` |
| `validateFileFields`, `isFormFieldPii` | shared |
| `contest_agreement_acceptances` (consent) | **already dual-scoped** (`entry_id` XOR `registration_id`, check constraint, `contest.ts:557`) |

So ~80% is already one system. The registration work (sessions 242–246) deliberately lifted
the entry field-subsystem onto registration.

## 2. Where they diverge

| Axis | REGISTRATION | STAGE-ENTRY |
|---|---|---|
| Field defs | `contests.registrationTemplate` | `contests.stages[].submissionTemplate` |
| Public answers | `contest_registrations.fields` | `contest_entries.stageSubmissions[].fields` (keyed by stageId) |
| PII | `contest_registration_private_fields` | `contest_entry_private_fields` |
| Consent | `contest_agreement_acceptances` (registration_id, **idempotent dedup**) | same table (entry_id + stage_id, **append-only**) |
| Submit route | `POST /register` → `registerForContest` | `POST /proposal` → `submitContestProposal`; `PUT /entries/:id/submission` → `submitStageArtifact` |
| Entrant render | `ContestSignup` + `ContestRegistrationForm` + `/register` page | `ContestProposalForm` (new) + `ContestStageSubmission` (per-stage) |
| Surfacing | `ContestRegistrantsPanel` + registrants CSV | `judge.vue` artifact box, `entries/[entryId].vue` timeline + `ContestEntryPrivateData`, entries CSV |
| Judges see it? | **No** (organizer-only) | **Yes** (judges get public artifact) |
| Consent surfaced to organizer? | **No** (filtered out of panel + CSV) | **Yes** (`ContestEntryPrivateData`, with IP) |
| Legacy fallback | Yes (`{building,experience,team}` when template empty) | No |

## 3. The redundancy, precisely

- **`submitContestProposal` (`submissions.ts:400`) is the complete "form → entry":** validate →
  `createContent` draft placeholder → insert `contest_entries` with the answers as
  `stageSubmissions:[{stageId, fields, submittedAt}]` (`:489`) → `recordPrivateAndAgreements`
  (entry PII + consent) → **auto-register full** (`:509`). One form, one submit, entry carries
  the data, judges/admins see it.
- **Combined registration (`maybeCreateCombinedEntry`, `submissions.ts:549`) is half of that:**
  validate → register → create a placeholder entry with **`stageSubmissions: []`** (`:609`).
  The answers stay on `contest_registrations`; **the entry is an empty stub.** So a combined
  contest produces data-less entries; judges/admins see nothing on them.
- **The upward link already works:** submitting an entry (proposal OR attach) auto-registers
  the user full (`entries.ts:308`, `submissions.ts:509`). Only the downward link
  (register → populated entry) is a stub.
- **Two render wrappers, two submit fns, two public/PII tables** for what is conceptually one
  "typed form → partitioned answers" operation.

## 4. The unification design

**Principle: in combined mode, the entry is the single source of truth, and "Register" IS a
proposal submission.** This reuses the path that already exists + works, instead of building a
parallel one.

### 4a. Data model — a definition link (small, additive)

Add to the stage schema: `submissionSource?: 'own' | 'registration'` (default `'own'`). When a
proposal stage sets `submissionSource: 'registration'`, its entry form **is** the contest's
`registrationTemplate` (no duplicate template). This is the "link a registration form to a
stage" the operator asked for. Additive jsonb field on the existing stage object — no new
table, no migration beyond the schema type.

### 4b. Flow — combined registration routes through the proposal mechanism

When `registrationMode: 'combined'` AND the current stage is a proposal stage:
- The "Register" submit validates against the effective form (the registration template, which
  is also the linked stage form) and writes the answers as the **entry's** proposal
  `stageSubmissions` + `contest_entry_private_fields` + entry-scoped consent — i.e. it calls the
  proposal path, not the empty-stub path.
- The `contest_registrations` row remains the thin "I'm participating" marker (tier), **without
  duplicating the field data** (single source of truth = the entry). `getViewerRegistration`
  reads answers from the entry in combined mode.
- Light mode is unchanged: registration and entry stay separate, two forms, two steps.

### 4c. Editor — define the form once

- In combined mode, the registration tab's `FormTemplateEditor` IS the proposal stage's form
  (they're linked). The markdown import (session 246) lets an operator author it once.
- The stage editor shows "This stage uses the registration form" when linked, with a toggle to
  unlink (own template).

### 4d. Surfacing — make it symmetric

Independent of combined mode, close the asymmetries (safe, high-value on their own):
- **Registration consent → organizers.** `ContestRegistrantsPanel` + registrants CSV currently
  drop agreements entirely; surface a "Consents: N/N" indicator + the acceptance audit (mirror
  `ContestEntryPrivateData`), so registration consent is visible like entry consent is.
- **Combined entries carry data.** Once 4b lands, judges/entry-detail see the intake answers on
  the entry (they already render `stageSubmissions`); label-map falls back to the registration
  template for a linked stage.

## 5. Flexibility preserved

- **Light mode** — registration (a "who's participating" form) + a separate per-stage entry
  form. Two distinct forms, as today. For contests where signing up ≠ submitting a project.
- **Combined mode** — one form is the registration *and* the first-round entry. For monolithic
  intakes (the jinger case). The operator builds it once; registering enters.
- **Per-stage still independent** — later stages keep their own `submissionTemplate` (refine
  the entry), regardless of how round one was collected.

## 6. Phasing (each: schema → server → UI → tests → adversarial audit → verify)

- **P1 (surfacing, SAFE, no schema) — symmetric consent surfacing. ✅ DONE (session 246, local).**
  `listContestRegistrants` + `buildRegistrantsExport` now return a per-registrant `consentCount`
  (distinct accepted agreement fields; NOT PII, so every organizer sees it — mirroring the entry
  side); `ContestRegistrantsPanel` shows a "Consents X/N" column with a completion check, and the
  registrants CSV gains a "Consents" column. Verified: 22 server integration tests + 415 layer
  tests green; browser-confirmed 2/2 in panel + CSV. (Also noted: file/signature answers already
  render as gated download links in the panel.)
- **P2 (schema + server) — combined registration → real entry.** `submissionSource` on the
  stage; combined register routes through the proposal storage (entry as source of truth);
  `getViewerRegistration` reads the entry in combined mode; kill the empty-stub. Migration:
  additive stage field only. Behind the existing `contestProposals` + `registrationMode` gates.
- **P3 (editor) — the link UI.** "Use the registration form for this stage" toggle in the stage
  editor; combined-mode registration tab reflects the link.
- **P4 (surfacing) — unified participant view.** One organizer view per participant that shows
  their registration marker + entry submissions + consent together (today they're split across
  the registrants panel and the entry detail).

## 7. Risks / landmines

- **Source-of-truth for combined mode is the load-bearing decision.** Duplicating answers into
  both `contest_registrations.fields` and the entry creates an edit-staleness bug (edit one,
  the other goes stale). Pick ONE (recommend the entry) and have the reader/edit paths honor it.
- Widening/rerouting the register write path is **data-integrity + consent-sensitive** — the P2
  change must keep the transactional guarantees (`recordPrivateAndAgreements`, advisory locks)
  and the idempotent re-register dedup; needs the adversarial-audit pass + negative tests
  (re-register doesn't double-create; a light→combined switch mid-contest is defined).
- Label-mapping a combined entry must fall back to the registration template or judges see raw
  keys (entry detail already renders-by-key; judge.vue filters by the stage template — fix that
  for linked stages).
- Don't regress light mode — it's the default and most contests use it.
- `submissionSource` must be a pure additive jsonb field (no destructive migration); the stage
  already round-trips unknown-safe.

## 8. What NOT to do

- Don't merge the two public tables (`contest_registrations` vs `contest_entries`) — they model
  genuinely different things (participation vs a judged artifact). Unify the *form + flow +
  surfacing*, not the storage identities.
- Don't drop light mode — the split is the right default for many contests.
- Don't federate any of this — all contest tables are instance-local by design.
