# Contests

CommonPub contests let an instance run a skill-based competition: organisers
create a contest, makers enter (by attaching a published project **or** submitting
a proposal form), an invited judge panel scores entries across one or more rounds,
cohorts are culled between rounds, and ranked results are published. Contests are
**instance-local** — they never federate (no ActivityPub surface; see
[Federation scope](#federation-scope)).

Gated by `features.contests`. Who may create contests is controlled by
`instance.contestCreation` (`open` | `staff` | `admin`, default `admin`).

---

## Contents

1. [Architecture at a glance](#architecture-at-a-glance)
2. [Server module map](#server-module-map)
3. [Data model](#data-model)
4. [Status lifecycle (state machine)](#status-lifecycle-state-machine)
5. [Stage engine](#stage-engine)
6. [Entry submission paths](#entry-submission-paths)
7. [Submission forms & field types](#submission-forms--field-types)
8. [PII & agreements](#pii--agreements)
9. [Judging & advancement](#judging--advancement)
10. [Score & visibility](#score--visibility)
11. [Visibility & access control](#visibility--access-control)
12. [The editor](#the-editor)
13. [The public contest page](#the-public-contest-page)
14. [API surface](#api-surface)
15. [Feature flags](#feature-flags)
16. [RBAC permissions](#rbac-permissions)
17. [Notifications](#notifications)
18. [Federation scope](#federation-scope)
19. [Testing strategy](#testing-strategy)
20. [Key files](#key-files)

---

## Architecture at a glance

Contests are contained to four packages plus the reference layer. New capability
is **additive** (new columns/tables/field-types/routes) so legacy contests render
byte-identically.

```
┌─────────────────────────────────────────────────────────────────────┐
│ @commonpub/schema    tables + Zod validators + the RBAC catalog       │
│   contest.ts (tables, jsonb shapes), validators/contest.ts (Zod),     │
│   permissions.ts (contest.create / contest.manage / contest.pii)      │
├─────────────────────────────────────────────────────────────────────┤
│ @commonpub/server    framework-agnostic business logic (no HTTP)      │
│   contest/  → see "Server module map"                                 │
│   rbac/seed.ts (STAFF_PERMISSION_SET), content/content.ts (createContent)│
├─────────────────────────────────────────────────────────────────────┤
│ @commonpub/config    feature flags (contests, contestStageSubmissions,│
│                       contestProposals, contestPii)                    │
├─────────────────────────────────────────────────────────────────────┤
│ layers/base          Nitro routes + Vue components                    │
│   server/api/contests/**   thin routes: validate → authz → call server │
│   components/contest/**     editor + view components                  │
│   pages/contests/**         create / [slug] / [slug]/edit / judge      │
│   utils/{contestStages,contestSubmission,contestTransitions,datetime}  │
└─────────────────────────────────────────────────────────────────────┘
```

**Principle: build on the engine, refactor the surface.** The schema/server engine
is mature; the editor, layout, submission breadth, and judging UX are the evolving
surface. `status` is always the behavioural source of truth for gating; the stage
timeline drives display.

---

## Server module map

`packages/server/src/contest/` is decomposed into a clean, acyclic module DAG
(session 215; was a single 1666-line `contest.ts`). Each module is cohesive and
under ~350 lines. `index.ts` is the public barrel re-exporting the unchanged API.

```
        types.ts ........... all interfaces/types (dependency leaf)
           ▲
     ┌─────┴───────┐
 stages.ts     validation.ts     (pure, no DB)
     ▲              ▲
     │   ┌──────────┼──────────────┐
   read.ts      entries.ts     submissions.ts
     ▲              ▲                ▲
     └──────┬───────┘                │
        contest.ts (CRUD)        judging.ts
```

| Module | Responsibility |
| --- | --- |
| `types.ts` | All interfaces/types: `ContestDetail`, `ContestEntryItem`, `CreateContestInput`, `StageSource`, `PartitionedSubmission`, `AgreementAcceptanceInput`, `ContestTx`, … |
| `stages.ts` | Pure stage-timeline helpers: `synthesizeStages`, `normalizeStages`, `currentStage`, `isEliminated`. |
| `validation.ts` | Pure submission validation + partition: `validateSubmissionFields`, `validateStageArtifactFields`, `hashTerms`. |
| `read.ts` | Reads + visibility: `listContests`, `getContestBySlug`, `canViewContest`, `shouldRevealScores`, `toContestDetail`. |
| `entries.ts` | Entry lifecycle: `listContestEntries`, `getContestEntry`, `submitContestEntry`, `withdrawContestEntry`, `calculateContestRanks`. |
| `submissions.ts` | DB writers for artifacts/PII/agreements/proposals: `recordPrivateAndAgreements`, `submitStageArtifact`, `submitContestProposal`, `getEntryPrivateData`. |
| `judging.ts` | `judgeContestEntry`, `advanceContestStage`. |
| `contest.ts` | CRUD core: `createContest`, `updateContest`, `deleteContest`, `transitionContestStatus`, `canCreateContest`. |
| `judges.ts` / `stakeholders.ts` | Judge panel + per-contest collaborator management. |

---

## Data model

`packages/schema/src/contest.ts`. Tables (instance-local; no AP serialization):

| Table | Purpose | Notable columns |
| --- | --- | --- |
| `contests` | The contest itself | `status`, `visibility`, `stages` (jsonb), `currentStageId`, `descriptionBlocks`/`rulesBlocks`/`prizesBlocks` (jsonb BlockTuple[]), legacy `description`/`rules`/`prizesDescription` text + `*Format` enums, `prizes`/`judgingCriteria` (jsonb), `eligibleContentTypes`, `maxEntriesPerUser`, `entryCount` (denormalized), `visibleToRoles` |
| `contest_entries` | One entry per (contest, user, content) | `contentId`, `score`, `rank`, `judgeScores` (jsonb), `stageState` (jsonb cohort outcome), `stageSubmissions` (jsonb artifacts) — **never** holds PII |
| `contest_judges` | The judge panel (single source of truth) | `role` (`lead`/`judge`/`guest`), `acceptedAt` |
| `contest_stakeholders` | Per-contest collaborators | `role` (`reviewer` view-only / `editor` full edit, contest-scoped) |
| `contest_agreement_acceptances` | **Phase 4** immutable acceptance audit log | `stageId`, `fieldKey`, `termsHash` (sha-256), `termsSnapshot`, `ip`, `acceptedAt` |
| `contest_entry_private_fields` | **Phase 4** entrant PII, kept OUT of the public artifact | `fields` (jsonb, one row per entry, upserted); `address` values JSON-encoded |

### jsonb shapes

- `contests.stages` → `ContestStage[]`. A stage:
  `{ id, name, kind, startsAt?, endsAt?, core?, description?, location?, url?, criteria?, advanceCount?, submissionTemplate?, submissionMode? }`.
- `submissionTemplate[]` → `ContestSubmissionTemplateField`:
  `{ key, label, type, required, help?, options?, pii?, terms?, termsFormat?, mustAccept? }`.
- `contest_entries.stageSubmissions` → `{ stageId, fields: Record<string,string>, submittedAt }[]` (non-PII artifact only).
- `contest_entries.stageState` → `{ stageId, status: 'advanced'|'eliminated', score?, rank? }[]`.

### Migrations

Additive. `0021` (stageSubmissions), `0028`/`0029` (block columns), **`0030`**
(Phase 4: `contest_agreement_acceptances` + `contest_entry_private_fields` +
idempotent staff `contest.pii` seed). Applied via the deploy `db-migrate` path,
never `db:push` in prod.

---

## Status lifecycle (state machine)

`contestStatusEnum` has **7 states**. Transitions are **bidirectional** — the
server's `VALID_TRANSITIONS` map (`contest.ts`, mirrored client-side in
`utils/contestTransitions.ts`) is the gating truth (you can move a contest *back*,
e.g. `judging → paused` to re-open submissions). `status` is the behavioural source
of truth for every gate.

```
                ┌─────────────────────────── cancelled ◀──────────────────┐
                │                                 │ (revive)               │ (cancel from
                ▼                                 ▼                        │  any non-terminal)
   ┌──────▶ draft ──▶ upcoming ──▶ active ──▶ judging ──▶ completed         │
   │                     ▲    ╲      │  ▲        │                          │
   └─────────────────────┘     ╲     ▼  │        │                          │
                                ╲  paused ───────┘                          │
                                 ╲_______________________________(to/from)__┘
```

| State | Meaning | Gates |
| --- | --- | --- |
| `draft` | Not public (filtered from public reads). | Owner-only view; freely editable. |
| `upcoming` | Created, not yet open. | Editable; no entries. |
| `active` | Entries open (attach or proposal); community voting (advisory) open. | `submitContestEntry`/`submitStageArtifact`/`submitContestProposal` require `active`. |
| `paused` | Temporarily halted (from `active`/`judging`); reversible. | Entries/judging closed. |
| `judging` | Submissions locked; accepted judges score 1–100. `judgingEndDate` drives the countdown. | `judgeContestEntry` allowed. |
| `completed` | `calculateContestRanks()` assigns ranks. Results + leaderboard published. | Terminal-ish (revivable). |
| `cancelled` | Reachable from any non-terminal state; revivable to `draft`/`upcoming`. | — |

Only the contest **owner**, a per-contest **editor**, or a `contest.manage` holder
can transition status (`transitionContestStatus` takes a `canManage` boolean and
re-checks editor server-side).

---

## Stage engine

A contest's timeline is either its explicit `stages` array or, when empty, the
**synthesized classic flow**. The standard flow is the zero-config default, so a
contest with no `stages` renders identically to a pre-stage contest.

```
normalizeStages(c):  c.stages?.length ? c.stages : synthesizeStages(c)

synthesizeStages(c) = [ Submissions(submission) , Judging(review) , Results(results) ]

currentStage(c):  currentStageId resolves → that stage
                  else derived from status:
                     draft|cancelled        → null
                     completed              → results (or last)
                     judging                → review
                     upcoming|active|paused → submission (or first)
```

Stage **kinds** drive display and map onto the coarse `status` when the owner
advances stages:

| kind | Meaning | Maps to status |
| --- | --- | --- |
| `submission` | Collect entries/artifacts (proposal vs prototype round) | `active` |
| `review` | A judging round (carries its own `criteria` + `advanceCount`) | `judging` |
| `interim` | A working/sprint period | `active` |
| `results` | Results published | `completed` |
| `event` | A showcase/venue milestone (carries `location`/`url`) | `completed` |
| `custom` | Arbitrary named milestone | — |

This lets a contest have multiple submission/judging **rounds** that all gate
identically (via `status`) but display as distinct named stages. The
`submission`-stage extras (`submissionTemplate`, `submissionMode`) drive the
[entry submission paths](#entry-submission-paths).

---

## Entry submission paths

A `submission`-kind stage has a `submissionMode`:

- **`attach`** (default) — the entrant attaches a **pre-existing published** content
  item they own. Classic path.
- **`proposal`** (Phase 4, gated by `features.contestProposals`) — the entrant fills
  a form; the server creates a **DRAFT placeholder project** linked as the entry and
  routes them into the editor to develop it for later rounds.

### Attach path

```
entrant ── picks published project ──▶ POST /contests/:slug/entries { contentId }
   └─ submitContestEntry: status==active? owns content? content published?
      type eligible? under per-user cap? ──▶ tx { insert entry; entryCount += 1 }
```

### Proposal path (form-first)

```
entrant fills the stage form (ContestProposalForm)
        │  POST /contests/:slug/proposal { stageId, fields }   [requireFeature contestProposals]
        ▼
submitContestProposal(db, {contestId, stageId, fields, userId, ip}):
   1. contest active?  stage current + kind=submission + submissionMode=proposal?
   2. validateSubmissionFields(template, fields) → { artifact, pii, agreements }
   3. per-user cap check (BEFORE creating anything)
   4. createContent(draft placeholder project)          ── own write
   5. tx {                                                  ┐
        insert contest_entry (links the DRAFT — published   │ atomic
          gate relaxed for proposal mode); stageSubmissions │  unit
          = [{stageId, artifact}]                           │
        contests.entryCount += 1                            │
        recordPrivateAndAgreements(pii, agreements)         │
      }                                                     ┘
   6. on tx failure → deleteContent(placeholder)  (no orphan draft)
   ▼
returns { entryId, projectSlug }  ──▶ client routes to the project editor
```

The published-only gate that `submitContestEntry` enforces is **relaxed only** for
proposal-mode stages (a draft placeholder is a valid entry there). The
`stageSubmissions` artifact records only the **non-PII, non-agreement** fields.

---

## Submission forms & field types

`submissionTemplate[]` field types (extended in Phase 4). `validateSubmissionFields`
(pure, `validation.ts`) validates the domain of each AND **partitions** values into
three buckets so PII and consent never reach the public artifact:

| type | Control | Validation | Bucket |
| --- | --- | --- | --- |
| `text` / `textarea` | input / textarea | non-blank if required, ≤4000 chars | artifact |
| `url` | url input | `https?://` only + structural parse | artifact |
| `email` | email input | RFC-lite email regex | artifact (or PII if `pii`) |
| `number` | number input | finite number | artifact (or PII if `pii`) |
| `select` | dropdown | value ∈ `options` | artifact (or PII if `pii`) |
| `checkbox` | checkbox | required ⇒ must be checked; stored `'true'`/`'false'` | artifact (or PII if `pii`) |
| `date` | date input | `YYYY-MM-DD` + parseable | artifact (or PII if `pii`) |
| `agreement` | terms box + accept checkbox | required/`mustAccept` ⇒ must accept | **agreement** (never artifact) |
| `address` | structured subform (line1/line2/city/region/postal/country) | JSON object | **PII** (auto, JSON-encoded) |

- `pii: true` (auto for `address`) routes a field's value to
  `contest_entry_private_fields`, never the public `stageSubmissions`.
- `agreement` fields are **consent, not data**: each accepted agreement becomes an
  immutable row in `contest_agreement_acceptances` (terms hash + snapshot + ip).
- **Organizer UI**: `ContestStagesEditor` offers the scalar types whenever
  `features.contestStageSubmissions` is on; `agreement` + `address` + the per-field
  PII toggle are gated behind `features.contestPii`; the `submissionMode` selector
  behind `features.contestProposals`.
- **Entrant UI**: one reusable `ContestSubmissionField` renders every type (used by
  both the per-stage artifact form and the proposal form). Client helpers
  (`utils/contestSubmission.ts` — `blockingFields`, `buildSubmissionPayload`,
  `parse/serializeAddress`) gate + serialize identically on both surfaces; the
  server stays the authoritative validator.

---

## PII & agreements

**PII is a permission, not a column you hope nobody selects.** Personal data lives
in a separate table, never serialized through the normal entries endpoints, gated
by a dedicated permission.

```
                         ┌──────────────────────────────────────────────┐
 submit form values ───▶ │ validateSubmissionFields → partition           │
                         │   artifact   → contest_entries.stageSubmissions │ (public-ish, gated)
                         │   pii        → contest_entry_private_fields      │ (private)
                         │   agreements → contest_agreement_acceptances     │ (audit)
                         └──────────────────────────────────────────────┘

 READ PII:  GET /contests/:slug/entries/:entryId/private
            allow IF  requester is the entrant (own PII)
                  OR  hasPermission('contest.pii')   (seeded admin via *, + staff)
            else 403.  The normal entries endpoints NEVER include PII.
```

- `contest.pii` is seeded to `staff` (migration 0030) and held by `admin` via `*`.
  The contest owner/editor does **not** get entrant PII unless they are also
  admin/staff (operator decision; widen later via RBAC).
- Agreement acceptances are append-only and snapshot the exact terms text + a
  sha-256 hash (`hashTerms`) so the wording the entrant agreed to survives later
  template edits. Exportable for legal/audit.
- `features.contestPii` only controls whether PII field types are **offered** in the
  builder; **access** is always gated by `contest.pii` regardless of the flag.

---

## Judging & advancement

### Per-round scoring

`judgeContestEntry` (`judging.ts`) — transactional (`FOR UPDATE`), conflict-of-
interest check, accepted-non-guest gate, per-`roundId` score isolation, per-stage
`criteria` rubric (falls back to contest-level `judgingCriteria`).

- With **no criteria**: judges submit one holistic 1–100 score.
- With **criteria**: judges score each criterion (0..weight, or 0..100 if no weight);
  the overall 0–100 is the normalized weighted sum `sum(score)/sum(max)*100`; the
  breakdown is stored in `judgeScores`. Writes are row-locked so concurrent judges
  never clobber each other. Per-entry aggregate = mean of accepted judges' scores.

### Advancement (the Top-N cull)

```
advanceContestStage(db, contestId, canManage, { reviewStageId, mode, topN | advancedEntryIds }):
   mode=topN   → rank the surviving cohort by round score, advance the top N,
                 eliminate the rest (deterministic tiebreak)
   mode=manual → advance the explicit entry ids, eliminate the rest of the cohort
   ▼
   writes contest_entries.stageState[{stageId, status, score, rank}] (snapshot),
   moves currentStageId to the next stage, idempotent per stage.
```

`isEliminated(entry)` is the cohort gate: a culled entry can no longer submit
later-stage artifacts or be scored in later rounds. `calculateContestRanks()` ranks
only **scored, non-eliminated** entries (`RANK()` window; ties share a rank;
unscored stay unranked).

---

## Score & visibility

`judgingVisibility` controls who sees aggregate scores before results:

| Setting | Public sees aggregate score… | Per-judge scores + feedback |
| --- | --- | --- |
| `public` | during judging and after | privileged only |
| `judges-only` (default) | only after `completed` | privileged only |
| `private` | never (ranks may still show) | privileged only |

"Privileged" = contest owner, instance admin, or a panel judge. Decision is the pure
helper `shouldRevealScores(visibility, status, privileged)` (`read.ts`); per-judge
detail is always privileged-only. Per-round snapshot scores in `stageState` honour
`revealScores` too (the cohort outcome itself stays public).

---

## Visibility & access control

`visibility` is **orthogonal to `status`** — it controls *who can see* the contest
and can change at any time.

| `visibility` | Listed? | Who can view |
| --- | --- | --- |
| `public` (default) | yes | everyone |
| `unlisted` | no | anyone with the direct link |
| `private` | no | owner, admins, collaborators (reviewers + editors), panel judges, roles in `visibleToRoles` |

- **Collaborators** (`contest_stakeholders`) are per-contest, no system-wide access:
  `reviewer` (view-only) and `editor` (full edit of *that* contest — fields,
  transition, advance — but cannot delete, manage judges, or add collaborators, so
  no escalation; recognized by `isContestEditor`).
- `canViewContest(db, contest, user)` gates every read endpoint; a blocked viewer
  gets **404** (not 403) so a private contest's existence isn't leaked.
- **Who can edit/manage:** `canManage = ownerOrPermission(..., 'contest.manage') ||
  isContestEditor(...)`; `updateContest`/`transitionContestStatus`/
  `advanceContestStage` take a `canManage` boolean and re-check the editor. Delete +
  judge/collaborator management stay owner / `contest.manage`. The detail payload
  exposes a per-request `viewerCanManage` hint (server still enforces).

---

## The editor

One mode-aware, **client-only** orchestrator `ContestEditor.vue` backs BOTH
`pages/contests/create.vue` and `[slug]/edit.vue` as 1-line thin shells (create =
blank model, edit = hydrated). Form model = the tested composable
`useContestEditor.ts` (refs · slugify · ISO dates · dirty · hydrate · buildPayload ·
mode-aware POST/PUT save incl. `{silent}` autosave + `onRenamed`).

```
ContestEditor (ClientOnly)
├─ sticky topbar      back · title · status · dirty/required · View · Save · autosave indicator
├─ ContestMediaStrip  banner (4:1) + cover placeholders (themed ImageUpload)
├─ ContestBodyTabs    Overview · Rules · Prizes (block body, each its own *Blocks jsonb)
│   └─ Write / Preview / Code switch (Preview = live BlockContentRenderer; Code = tuple JSON)
│   └─ extra tabs: Stages (ContestStagesEditor) · Judging (ContestCriteriaEditor)
└─ settings rail      Details · Schedule (CpubDateTimeField) · Entries · Prizes cards ·
                      Visibility · People (ContestJudgeManager / ContestStakeholderManager)
```

- Body fields are **BlockTuple[]** (`descriptionBlocks`/`rulesBlocks`/`prizesBlocks`);
  legacy `description`/`rules`/`prizesDescription` text + `*Format` toggle stay for
  back-compat, converted to blocks on first block-edit.
- **Dates** use `CpubDateTimeField` (local-correct via `utils/datetime`, themed native
  popup, `min`/`max` coupling). The whole editor is `<ClientOnly>` and date fields are
  `onMounted`-gated to avoid prod UTC-vs-local hydration mismatches.
- **Autosave** for draft contests via `useEditorAutosave` (silent save + rename-in-place
  + hydrate guard); published/upcoming keep save-on-action.
- **Stages editor** offers the Phase 4 field-type builder (see
  [Submission forms](#submission-forms--field-types)).

---

## The public contest page

`pages/contests/[slug]/index.vue`. Slim hero (`ContestHero` = ≤220px banner + one
compact bar) + `coverImageUrl` as a lead image atop Overview. Tabs **Overview ·
Rules · Prizes · Entries · Participants · Judges** are deep-linkable via `?tab=`
(SSR-aware, reload-stable). All local dates render through one `formatLocalDate`
(`utils/datetime`), `onMounted`-gated.

The **Entries** tab is submission-mode aware:

- proposal-mode current stage + signed in + no entry yet → `ContestProposalForm`
- proposal-mode + anonymous → log-in prompt
- attach mode (no proposal stage) → the classic "Submit Entry" CTA
- entrant with a live entry + current submission stage → `ContestStageSubmission`
  (edit the artifact)

---

## API surface

`layers/base/server/api/contests/`. Routes are thin: `requireFeature` → `parseParams`
→ `getContestBySlug`/`canViewContest` → `parseBody` → call the server fn.

| Method + path | Purpose | Auth |
| --- | --- | --- |
| `GET /contests` | List (public; own drafts when signed in; all for admin) | optional |
| `POST /contests` | Create | authed + `contestCreation` policy |
| `GET /contests/:slug` | Detail (+ `viewerCanManage`) | `canViewContest` |
| `PUT /contests/:slug` | Update | owner / editor / `contest.manage` |
| `DELETE /contests/:slug` | Delete | owner / `contest.manage` |
| `POST /contests/:slug/transition` | Status transition | owner / editor / `contest.manage` |
| `POST /contests/:slug/advance` | Advancement cut (Top-N / manual) | owner / editor / `contest.manage` |
| `GET /contests/:slug/entries` | List entries (PII never included) | `canViewContest` |
| `POST /contests/:slug/entries` | Attach a published project | authed entrant |
| `DELETE /contests/:slug/entries/:entryId` | Withdraw | entrant / owner |
| `GET /contests/:slug/entries/:entryId` | Entry detail (artifacts gated) | `canViewContest` |
| `PUT /contests/:slug/entries/:entryId/submission` | Submit/update a per-stage artifact | entrant (owns entry) |
| **`POST /contests/:slug/proposal`** | **Form-first proposal entry** (Phase 4) | authed + `features.contestProposals` |
| **`GET /contests/:slug/entries/:entryId/private`** | **Entrant PII + agreements** (Phase 4) | `contest.pii` OR own entry |
| `GET/POST/DELETE /contests/:slug/judges*` | Judge panel management | owner / `contest.manage` |
| `POST /contests/:slug/judges/accept` | Accept a judge invite | invitee |
| `GET/POST/DELETE /contests/:slug/stakeholders*` | Collaborator management | owner / `contest.manage` |
| `GET /contests/:slug/user-search` | Contest-scoped user search (public fields) | owner / `contest.manage` |
| `POST/DELETE /contests/:slug/entries/:entryId/vote` | Community vote | authed (not own entry) |

---

## Feature flags

| Flag | Default | Gates |
| --- | --- | --- |
| `features.contests` | OFF (reference: ON) | The whole contest surface. |
| `features.contestStageSubmissions` | ON | Per-stage submission templates + artifact form. Inert until a template exists. |
| `features.contestProposals` | OFF | Proposal `submissionMode` + the proposal form + `POST /proposal`. |
| `features.contestPii` | OFF | Offering PII field types (agreement/address/`pii` toggle) in the builder. Access to stored PII is always gated by `contest.pii`. |

All declared end-to-end: `config/types.ts` + `config/schema.ts`,
`nuxt.config.ts` `runtimeConfig.public.features` (env-propagation),
`useFeatures.ts` (interface + DEFAULT_FLAGS + accessor), `/admin/features` metadata.

---

## RBAC permissions

Catalog: `packages/schema/src/permissions.ts` (single-dot `<segment>.<segment>`).

| Permission | Held by | Grants |
| --- | --- | --- |
| `contest.create` | staff, admin (`*`) | Create contests (with `contestCreation` policy). |
| `contest.manage` | staff, admin (`*`) | Manage any contest (edit/transition/advance/delete/judges). |
| `contest.pii` | staff, admin (`*`) | Read entrant PII via the gated private endpoint. Seeded to staff in migration 0030. |

Per-contest `editor`/`reviewer` (`contest_stakeholders`) are orthogonal, scoped
grants — not global permissions.

---

## Notifications

Status transitions notify participants (in-app, + email when `emailNotifications`):

- **active / judging / cancelled** — entrants get a status note; judges get a
  judging/cancelled note.
- **completed** — entrants whose rank earns a place-prize (or top-3 when no
  place-prizes) get a "You won" alert naming placement + prize; others get "Results
  Posted". Judges notified separately. Fired after `calculateContestRanks`.
- Judge **invite** → invitee; judge **accept** → owner.

---

## Federation scope

Contests are **instance-local**. They never serialize through `@commonpub/protocol`
and have no ActivityPub type. PII + agreements are likewise never federated. The
public v1 API (`isPublicContest`) only ever exposes `public` contests.

---

## Testing strategy

- **Pure (unit):** `validation.ts` (field-type domain + partition), `stages.ts`,
  client `utils/contestStages.ts` + `utils/contestSubmission.ts`, the enum-derived
  validators (drift guard).
- **Server (real-PG/PGlite harness):** `submitContestProposal` (tx atomicity, draft
  placeholder, entry link, PII isolation, agreement capture, gates, per-user cap),
  the B1/B2 tx fixes, per-round judging, advancement cohort gate, RBAC seed parity.
- **Components (@testing-library/vue + axe):** `ContestStagesEditor` (Phase 4 builder,
  flag-gating), `ContestSubmissionField` (every type + axe), `ContestStageSubmission`,
  body tabs, criteria editor, `CpubDateTimeField`.
- **Invariant under test:** the normal entries endpoint never includes PII — proven
  both in the server integration suite and verified live.

---

## Key files

- Schema: `packages/schema/src/contest.ts`, `validators/contest.ts`, `permissions.ts`.
- Server: `packages/server/src/contest/` (see [module map](#server-module-map)) +
  `rbac/seed.ts`, `content/content.ts`, voting in `voting/voting.ts`.
- API: `layers/base/server/api/contests/**`.
- UI: `layers/base/pages/contests/**` + `layers/base/components/contest/**`
  (`ContestEditor`, `ContestBodyTabs`, `ContestStagesEditor`, `ContestCriteriaEditor`,
  `ContestSubmissionField`, `ContestProposalForm`, `ContestStageSubmission`,
  `ContestHero`, `ContestSidebar`, `ContestJudgeManager`, `ContestStakeholderManager`).
- Utils: `layers/base/utils/{contestStages,contestSubmission,contestTransitions,contestBody,datetime}.ts`.
- Homepage/layout section: `components/homepage/ContestsSection.vue`,
  `sections/builtin/contests.ts`.
