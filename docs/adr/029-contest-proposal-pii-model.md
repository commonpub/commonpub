# 029 — Contest proposal + PII submission model

**Status**: Accepted (Contest Elevation, branch `contests`, Phases 4-6). Addendum to the contest engine (sessions 171-194). Ships flag-gated, default OFF; no behavior change until an operator enables it.

## Context

The contest engine (stages, cohorts, per-round judging, advancement) was mature. The submission *surface* had one path: attach a **pre-existing published** content item to a contest. Real maker contests need more:

1. A **form-first proposal** path — an entrant fills a structured form (title, abstract, track, agreements) and the system creates a placeholder project they develop over later rounds. This is the "proposal → prototype" flow the Resilient-America walkthrough documents.
2. **Agreements / terms acceptance** — versioned, auditable consent captured atomically with a submission (legal/eligibility).
3. **PII** — addresses, contact details, shipping info — stored safely, never exposed through the normal entries surface, accessible only to privileged roles + the entrant themselves.
4. An **export** for organizers/judges who tally offline.

The risk: PII leaking through an endpoint that "just returns the entry," and consent that can't be proven after the fact.

## Decision

**1. PII is a partition, not a column you hope nobody selects.**

`validateSubmissionFields` splits every submission into `{ artifact, pii, agreements }`. Only the non-PII `artifact` reaches the public `contest_entries.stageSubmissions` jsonb. PII goes to a separate table `contest_entry_private_fields` (unique per entry); consent to `contest_agreement_acceptances` (append-only: `termsHash` + `termsSnapshot` + `ip` + `acceptedAt`). The `/entries` list, `/entries/:entryId` detail, the judge page, and the CSV export's non-PII columns read ONLY `stageSubmissions`. PII surfaces ONLY via:
- the gated `GET /contests/:slug/entries/:entryId/private` (`contest.pii` permission OR the entrant's own entry), and
- the CSV export's PII columns, gated on `contest.pii`.

The only code that reads the two private tables is `submissions.ts` (the upsert + `getEntryPrivateData`). Adding an entries reader that joins them is the one thing not to do. Contests don't federate, so there is no ActivityPub serialization leak path either.

**2. PII access = admin/staff only (+ entrant-own).** Operator decision (session 215). The contest owner/editor does NOT get PII by default — only `admin` (via `*`) and `staff` (seeded in migration 0030 + `STAFF_PERMISSION_SET`), plus the entrant reading their own. Widen later via RBAC if an operator wants it. The permission is `contest.pii` (single-dot) to satisfy the catalog's `^[a-z]+\.[a-z]+$` shape.

**3. Proposal mode is per-stage, flag-gated.** A `submission` stage carries `submissionMode: 'attach' | 'proposal'`. In proposal mode, `submitContestProposal` runs in one transaction: validate the stage form (required + agreements accepted + PII present) → create a DRAFT placeholder content item (reuse `createContent`) → link a `contest_entry` (relaxing the published-only gate for proposal mode) → write the non-PII artifact → record PII + agreements → bump `entryCount`; compensating-delete on tx failure. It returns the ACTUAL created `contentType` (not a client guess) so the UI routes to the right editor (`createContent` normalizes `article → blog`, and skips non-creatable eligible types). Gated by `features.contestProposals`.

**4. Two flags, both default OFF.** `features.contestProposals` gates the proposal path; `features.contestPii` gates whether PII field types are *offered* in the builder (access is always RBAC-gated regardless of this flag). Existing contests are unaffected.

**5. Export is CSV-only and formula-injection-safe.** `contest/export.ts` `toCsv` prefixes any cell starting with `= + - @` TAB or CR with `'` before RFC-4180 quoting, so entrant-controlled text can't execute as a spreadsheet formula. CSV over xlsx (zero-dep, opens in Excel/Sheets); one empty column per rubric criterion for manual tallying; PII columns only with `contest.pii`.

## Consequences

- New tables `contest_entry_private_fields` + `contest_agreement_acceptances` (migration 0030); permission `contest.pii`; field types `email`/`number`/`select`/`checkbox`/`date`/`agreement`/`address` (+ `pii`/`terms`/`mustAccept`) on `submissionTemplateFieldSchema`.
- The submission surface stays backward-compatible: a stage with no `submissionMode` (or `attach`) behaves exactly as before.
- The export is the offline-judging complement to the built-in `advanceContestStage` (export → tally → manual advance).
- Phase 6 cleanup dropped the long-dead `contests.judges` + `contests.content_format` columns (migration 0031); judges live in `contest_judges`, body format in the per-field `*Format` columns.
- A future operator who wants contest owners to read their own contest's PII flips it from a code change (widen the `contest.pii` grant or add an owner check in the gated route) — the storage + endpoint shape already supports it.

## Related

- ADR 018 (community architecture), the contest reference `docs/reference/guides/contests.md` (hyper-detailed, current through Phase 5), the gotchas in `codebase-analysis/09-gotchas-and-invariants.md` (PII partition, denormalization, slug-scoping), and `[[feedback_test_populates_both_sources]]` (judges split-brain — why judges have ONE source of truth).
