# Session 225 — contest entry-flow fix + Task C tests + deep entry-flow audit

Picked up from `225-kickoff.md`. Did **Task C** (contest-field tests, no release), fixed a **user-reported
proposal-entry bug** (verified in-browser), and ran an **extreme adversarial audit of every contest
entry/submission flow** (2 parallel agents + direct tracing). Nothing committed or shipped yet.

## What was done

### 1. Task C — test coverage for the new contest fields (all green, rides next layer release)
- `composables/__tests__/useContestEditor.test.ts` — added `bannerMeta`/`coverMeta`/`coverPlacement`
  **hydrate** (maps + null-defaults) and **buildPayload clear-on-remove** (image removed ⇒ `null`; present
  but unframed ⇒ `undefined`; present + framed ⇒ sends meta). **Verified this matches REAL server behavior:**
  `updateContest` (contest.ts:143-146) writes the column only when `data.x !== undefined`, and `$fetch`/JSON
  drops `undefined` keys, so `null` clears and omitted leaves-as-is. Not a mock-only assertion.
- `components/blocks/__tests__/BlockVideoView.test.ts` + `BlockEmbedView.test.ts` (new) — size-preset cap
  (`cpub-{video,embed}-size-{s|m|l|full}` + fallback to `l` for missing/bogus size), embed-url gate
  (rejects `javascript:`/`data:`), platform label, iframe title. **Limitation:** the `aspect-ratio: 16/9`
  is scoped CSS that jsdom does NOT expose (and axe can't traverse iframes in jsdom) — tests lock the
  structural contract (`.cpub-*-wrap > iframe.cpub-*-iframe`) the ratio binds to + the iframe `title`,
  NOT the literal CSS value. The 16:9 value itself is a visual/CSS concern.
- `components/contest/__tests__/ContestProposalForm.test.ts` (new) — instructions-blocks render ABOVE the
  fields, POST payload + `submitted` emit, required-field gate, axe.
- `ContestStageSubmission.test.ts` — added instructions-blocks-render-above-the-form coverage.
- `ContestStageTemplateEditor` block-intro round-trip was ALREADY covered (kickoff item; no-op).
- Suite: **1405 passing** (was 1377). Reference `nuxt typecheck` clean.

### 2. User-reported bug — hero "Submit Entry" never showed the proposal form (FIXED + verified)
Two reports: (a) the hero **Submit Entry** button doesn't show the form for proposal-type stages; (b) even
with the form, the user should be able to pick an existing project OR create a draft from a proposal.

**Root cause:** the hero button always did `showSubmitDialog = true` (the attach-a-project picker)
regardless of stage; the proposal form (`ContestProposalForm`) lives on the **Entries tab**, so the most
prominent CTA never reached it. Separately, the attach option was hidden in proposal mode
(`!currentProposalStage`).

**Fix** (`pages/contests/[slug]/index.vue`):
- `onHeroSubmitEntry()` — when the current stage is form-based (proposal, or a per-stage submission the user
  already has an entry in) → switch to the Entries tab + `scrollIntoView` `.cpub-proposal, .cpub-stagesub`;
  else open the attach dialog as before.
- Attach CTA now shows for **every active contest** (was `!currentProposalStage`) — both paths always
  available. Removed the now-redundant proposal-only login block (the attach CTA's "Log in to enter" covers
  anon).
- **Self-introduced copy bug found in audit + fixed:** title was `'Or enter with an existing project'`,
  which dangles when no form renders above it (anon viewer, `contestStageSubmissions` off + existing entry,
  eliminated-only entrant). Changed to `(currentProposalStage || currentSubmissionStage) ? 'Enter with an
  existing project' : 'Enter this contest'` — reads correctly standalone AND as a secondary option.

**Verified in-browser** (Playwright, authed, contest `founders-makers-cup` = active, current stage
`s-proposal`, 7-field template): hero click moves tab OVERVIEW→ENTRIES, attach dialog stays closed,
**proposal form visible**, attach CTA present + its dialog still opens. Re-ran after the copy fix.

### 3. Extreme audit — every entry/submission flow traced (no P0/P1 regressions from my change)
Full state matrix (proposal/per-stage/classic × auth × entry-count × flags × status) traced and correct.
Server trust boundary solid: all three write paths (`entries.post`, `proposal.post`, `submission.put`)
enforce `requireAuth` + `requireFeature` + `canViewContest` + status/stage/ownership re-validation. Client
and server agree byte-for-byte on which stage is "current". Field validation is strict (unknown keys
rejected, required+blank rejected, agreements gated, PII partitioned + written in the artifact's tx).

### 4. P1 orphan-on-withdraw — FIXED (schema + server change + tests; end-to-end verified)
Withdrawing a **proposal** entry deleted the entry row but **orphaned the DRAFT placeholder project**
`submitContestProposal` created — unbounded draft litter, asymmetric with the proposal flow's own
compensating delete. (More reachable now that the hero-CTA fix lands users on the proposal form.)

**Fix:**
- **Schema** (`packages/schema/src/contest.ts`): new `contest_entries.placeholder boolean NOT NULL DEFAULT
  false` + **migration 0034** (`0034_friendly_annihilus.sql`, journaled). Marks entries whose content is an
  auto-created proposal stub.
- **`submitContestProposal`** sets `placeholder: true` on the entry insert.
- **`withdrawContestEntry`** now joins `contentItems`, and when `placeholder === true && content.status ===
  'draft'`, archives the stub (soft-delete: `status='archived'` + `deletedAt`) **inside the same
  transaction** as the entry delete + entryCount decrement. A placeholder the entrant DEVELOPED + published
  (status ≠ draft) is their real entry and is left untouched; an attached project (`placeholder === false`)
  is never touched. This is the safe disambiguation — gating on `status='draft'` ALONE would destroy a real
  project the user unpublished, so the marker column is required.
- **Tests** (`contest-proposals.integration.test.ts`, +3, real PGlite Postgres): pristine placeholder →
  archived; published placeholder → kept; attached project → untouched.
- **Verified end-to-end via the real HTTP route** (dev server + real Postgres): POST `/proposal` → draft
  placeholder + entry; DELETE `/entries/:id` → 200, entry gone, placeholder content `status=archived`.

## Pre-existing findings (NOT regressions — surfaced by the audit)

| Sev | Where | Issue |
|---|---|---|
| **P1 — FIXED** | `contest/entries.ts` `withdrawContestEntry` | Proposal-withdraw orphaned the draft placeholder. Fixed this session (see §4 above) via the `placeholder` marker column + archive-on-withdraw. |
| **P2** | `voting/voting.ts` `voteOnContestEntry` (239-248) | Double-vote race: non-tx check-then-insert → unique constraint throws an **unhandled 500** instead of a clean 400. Vote count stays correct. Fix: `onConflictDoNothing`. |
| **P2** | `contest/entries.ts` `listContestEntries` (54-78, no status filter) | Proposal **draft** entries are listed publicly; entry-detail "View the project" 404s for non-owners; title+author leak (artifact body stays gated). No draft indicator. |
| **P2** | `contest/validation.ts` `isPiiField` | PII routing is **operator-gated** — an `email`/`text` field without `pii:true` puts entrant emails in the public artifact. Not entrant-exploitable. Recommend defaulting `email` to PII (like `address`) or an editor warning. |
| **P3** | `submitContestEntry` / `submitContestProposal` | `maxEntriesPerUser` check is outside the tx (TOCTOU) — concurrent submits can exceed the cap. |
| **P3** | voting | Eliminated entries remain votable (appears by-design). |
| **P3** | page hydration | Returning proposal entrant briefly sees the empty proposal form before lazy entries load. |

## Decisions
- **P1 orphan: fixed with a `placeholder` marker column** (NOT a `status='draft'` heuristic, which would
  destroy a real unpublished project) + archive-on-withdraw gated on `placeholder && status==='draft'`. See
  §4.
- Aspect-ratio 16:9 left as a structural-class lock (jsdom can't read scoped CSS).
- Title copy avoids an "Or" prefix to stay correct across all anon/flag/eliminated edge cases.

## State at session end — SHIPPED + ROLLED to all 3 (2026-06-25)
- **Released:** `schema 0.49.0 · server 2.93.0 · layer 0.86.6` (npm, dependency order). Migration **0034**
  applied on all 3. PR #54 squash-merged to main. commonpub.io / deveco.io / heatsynclabs.io all health 200;
  heatsync `/api/contests/<slug>/entries` = 200 (definitive: the `placeholder` column is live).
- ⚠️ **create-commonpub pins are now STALE** (^0.48/^2.92 vs published 0.49.0/2.93.0) — bump on next CLI publish.
- Gates green: **server 1493** tests, **layer 1405** tests, full `pnpm typecheck` 28/28.
- Changed/new files:
  - `layers/base/pages/contests/[slug]/index.vue` (M — hero-CTA bug fix)
  - `packages/schema/src/contest.ts` (M — `placeholder` column) + `packages/schema/migrations/0034_friendly_annihilus.sql` (new) + journal
  - `packages/server/src/contest/submissions.ts` (M — set `placeholder:true`)
  - `packages/server/src/contest/entries.ts` (M — archive-on-withdraw)
  - `packages/server/src/__tests__/contest-proposals.integration.test.ts` (M — +3 withdraw tests)
  - `layers/base/composables/__tests__/useContestEditor.test.ts` (M) + `components/contest/__tests__/ContestStageSubmission.test.ts` (M)
  - `layers/base/components/blocks/__tests__/BlockVideoView.test.ts`, `BlockEmbedView.test.ts`, `components/contest/__tests__/ContestProposalForm.test.ts` (new)
  - `packages/schema/dist/**`, `packages/server/dist/**` rebuilt (gitignored).
- Local Docker DB only: manually applied the 0032/0033/0034 columns to run the dev server — **not a repo
  change** (migrations are committed; prod DBs apply them via db-migrate on deploy).

## Open questions / next steps
1. **Release** (this is now a schema+server+layer release): proposed `schema 0.49.0 · server 2.93.0 · layer
   0.86.6`. Order: bump + publish **schema** → **server** → **layer** (`pnpm run publish:layer` pins the new
   schema/server) → deveco/heatsync bump pins + BOTH lockfiles → push → each instance's deploy runs
   `db-migrate` (applies 0034) → curl-verify health on all 3.
2. **Commit split** (on a branch): `fix(contest): reach the proposal form from the hero Submit Entry CTA`;
   `fix(contest): archive abandoned proposal placeholders on withdraw` (schema 0034 + server); `test(contest):
   image-meta, video/embed sizing, proposal instructions, withdraw cleanup`.
3. **B polish** (still pending from 224-handoff) — fold into the same layer 0.86.6 release.
4. P2 vote-race 500 (trivial `onConflictDoNothing`) and the public-draft-entries filter when prioritized.
