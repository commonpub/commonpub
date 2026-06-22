# Contest Elevation — Architecture & Implementation Plan

> Created session 211 (2026-06-22). Branch: `contests` (forked from `monolith-splits`, pushed,
> NOT merged / published / deployed). Contests are **instance-local** (no ActivityPub surface),
> so this is contained to `@commonpub/schema` + `@commonpub/server` + `@commonpub/editor` +
> `@commonpub/config` + the `@commonpub/layer` UI. Ships to all instances via a schema migration
> + package releases.
>
> **Operator decisions (session 211):** (1) the new editor lives **in-layer**, reusing
> `@commonpub/editor` primitives (no new package); (2) per-tab deep links use a **`?tab=` query
> param** synced to the existing tablist; (3) the form-first proposal path is **operator-configurable
> per stage** via the existing per-stage template system, extended with new PII-aware field types;
> (4) **plan now, build in phases with checkpoints** — nothing deploys/publishes without an explicit
> go-ahead.

---

## 0. Verified current state (the audit, file:line)

A 6-agent source trace (schema, server, routes, display UI, editor UI, reusable patterns) established
ground truth. Headline: **the contest engine is mature and correct; the editor, layout, submission
breadth, and polish are the gaps.**

### What already exists and works (do NOT rebuild)
- **Stage engine** — `contests.stages` jsonb (6 kinds: `submission`/`review`/`interim`/`results`/
  `event`/`custom`), `currentStageId`, `synthesizeStages`/`normalizeStages`/`currentStage`
  (`server/src/contest/contest.ts:148-181`; layer mirror `layers/base/utils/contestStages.ts`).
- **Cohorts + advancement** — `contest_entries.stageState` jsonb; `advanceContestStage` (Top-N /
  manual cut, deterministic tiebreak, snapshot, idempotent per stage; `contest.ts:1342`).
- **Per-round judging** — `judgeContestEntry` (transactional `FOR UPDATE`, COI check, accepted-non-guest
  gate, per-`roundId` score isolation, per-stage `criteria` rubric; `contest.ts:819`);
  `calculateContestRanks` (RANK() window, eliminated/unscored nulled; `contest.ts:1155`).
- **Per-stage submission templates** — `stages[].submissionTemplate` (field types `text|textarea|url`)
  + `contest_entries.stageSubmissions` jsonb + `submitStageArtifact` (transactional upsert, cohort
  gate, template validation; `contest.ts:1240`) + `validateStageArtifactFields` (`contest.ts:1198`).
  Gated behind `features.contestStageSubmissions`.
- **Lifecycle** — `transitionContestStatus` bidirectional `VALID_TRANSITIONS` (draft/upcoming/active/
  paused/judging/completed/cancelled; `contest.ts:995`, layer mirror `utils/contestTransitions.ts`).
- **RBAC + per-contest editors** — `contest_stakeholders.role` (`reviewer`/`editor`), `isContestEditor`,
  `canManage` threaded through update/advance/transition (shipped session 201, live on all 3).
- **Per-field rich text** — `descriptionFormat`/`rulesFormat`/`prizesDescriptionFormat` enums +
  `sanitizeRichHtml` (script-free allowlist that preserves layout HTML + inline CSS;
  `composables/useSanitize.ts:175`).
- **API authz is solid** — every mutation `requireAuth` + owner/`contest.manage`/editor or in-fn
  ownership; reads gated by `canViewContest` (404, no existence leak); no NaN/non-uuid 500 class found.
- **Both image fields already exist** — `contests.bannerUrl` AND `contests.coverImageUrl`
  (`schema/src/contest.ts:114,117`).
- **Reusable infra** — block editor (`@commonpub/editor/vue` `useBlockEditor`/`BlockCanvas`/
  `EditorBlocks`, 20 block types, open `[string, Record]` extension arm + `provide(BLOCK_COMPONENTS_KEY)`
  override), `useEditorAutosave` (router-free autosave engine), AutoForm (`composables/autoFormSchema.ts`
  `buildAutoForm(zod)` + `AdminLayoutsAutoForm.vue`, supports text/textarea/number/select/toggle/array).

### What's broken / missing (this plan's scope)
| # | Area | Finding (file:line) |
|---|---|---|
| G1 | **Editor** | Monolithic native `<form>`, duplicated ~verbatim across `pages/contests/create.vue` (~470) + `[slug]/edit.vue` (~775). Zero use of the block editor. 3 plain `<textarea>` + `FormatToggle` for body/rules/prizes. |
| G2 | **Date/time** | All 8 inputs are raw native `datetime-local`; **no `color-scheme: light` on `:root`** (only `dark.css:85`) so the popup is unthemed; **UTC round-trip bug** (`new Date(iso).toISOString().slice(0,16)` feeds UTC into a local-time control — `ContestStagesEditor.vue:24-32`, `edit.vue:191-196`); no min/max coupling; **stage dates have no validation**; conversion duplicated per file (no shared util). |
| G3 | **Tabs** | `activeTab` is plain client state (`index.vue:66`); no URL sync, reload resets to Overview. |
| G4 | **Layout** | Hero is two stacked full-width bands (banner ≤360px + tall dark hero, `ContestHero.vue:125-263`). `coverImageUrl` collected + shown on listing cards but **never rendered on the detail page**. |
| G5 | **Overview blocks** | Overview/rules render `CpubMarkdown` (markdown OR `v-html`), not BlockTuple[]. **Judges not shown in Overview**; `ContestJudges` has **no bio/description field**. |
| G6 | **Dark-mode HTML** | `format:'html'` renders into `.cpub-md-html` which has **no CSS anywhere** — no `.cpub-prose`, no `var(--*)` baseline. Author-hardcoded colors break in dark mode. `sanitizeRichHtml` preserves inline `style` verbatim. |
| G7 | **Submission breadth** | Only path = attach a **pre-existing published** content item; **no placeholder-project creation**, no agreements/terms acceptance storage, no address/PII storage (confirmed absent in schema). |
| G8 | **Judge UX** | Global (not per-card) error/success banners far from the scored card; inconsistent scale (single 1–100 vs per-criterion min-0); placeholder-only feedback label; submit dialog mixes a `<NuxtLink>` inside a `role=radiogroup`. |
| G9 | **Export** | No CSV/Excel export route anywhere; entries GET caps at limit≤100. |
| B1 | **Bug (P1)** | `withdrawContestEntry` (`contest.ts:1146-1150`) — non-transactional delete + `entryCount` decrement. |
| B2 | **Bug (P1)** | `createContest` (`contest.ts:406-454`) — non-transactional contest insert + judges seed + stakeholders seed. |
| B3 | **Bug (P2)** | `judgeContestEntry` (`contest.ts:900-906`) — `criteriaScores` not validated against the configured rubric; weighted-sum trusts client-supplied `max`. |
| B4 | **Bug (P2)** | `addContestJudge` (`judges.ts:76-84`) — unsafe check-then-insert races the unique constraint → 500 (cf. `addContestStakeholder`'s `onConflictDoUpdate`). |
| B5 | **Bug (P2)** | `judge.post.ts` ignores its `:slug` (misleading contract; not an escalation). `ContestJudgeManager` searches admin-only `/api/admin/users` + hardcodes `:is-owner="true"` (`edit.vue:574`) → 403 for non-admin owners. |
| C1 | **Cleanup** | Dead columns `contests.judges` + `contests.content_format`; hand-typed enum-mirror validators (status/visibility/format) that can drift; emoji in notification copy (`🏆`/`✅`, `contest.ts:1075,1435`); `contestCreation` default divergence (route `'staff'` vs config `'admin'`); duplicated user-search + criteria editors + form CSS. |

---

## 1. Architecture principles

1. **Build on the engine, refactor the surface.** The schema/server engine stays; the editor, layout,
   submission breadth, and judging UX are reworked. New capability is **additive** (new columns/tables,
   new field types, new routes) so legacy contests render byte-identically.
2. **One editor, not two.** Collapse `create.vue` + `edit.vue` into a single `ContestEditor` component
   driven by a shared schema-derived form model. Create = empty model; edit = hydrated model.
3. **Reuse the block editor for prose; reuse AutoForm for config + submission forms.** No bespoke form
   frameworks. Contest body (overview/rules) becomes BlockTuple[]; structured config + per-stage
   submission forms go through `buildAutoForm`.
4. **Modular separation of concerns** (the elegant core the request asks for):
   - `@commonpub/schema` — tables, enums, Zod (single source; kill hand-typed enum drift).
   - `@commonpub/server/contest/*` — pure business logic, transactional, no HTTP.
   - `@commonpub/editor` — generic block primitives + the new contest-specific block **edit** components.
   - `layers/base/components/contest/` — contest **view** components + the in-layer `ContestEditor`
     and its sub-panels; `layers/base/server/api/contests/` — thin routes (validate → authz → call server).
5. **Flag everything new** (CLAUDE.md #2). Reuse `features.contests` for the editor/layout/tab work
   (it's the same surface). New flags: `features.contestProposals` (form-first path + placeholder
   project), `features.contestPii` (whether PII fields are *offered*; access is RBAC-gated regardless).
6. **PII is a permission, not a column you hope nobody selects.** Addresses/contacts live in a
   **separate table**, never serialized through the normal entries endpoint, gated by a new
   `contest.pii.read` permission (seeded admin + staff; widen later via RBAC — exactly the "enable for
   others later" the operator asked for).
7. **Dark-mode safety is non-negotiable** for any author HTML. Block content already strips `style`
   (safe); rich-HTML mode gets a theme baseline + color neutralization.
8. **TDD + mutation bar** (CLAUDE.md #11): every fix needs a test that goes RED on revert. Server →
   real-Postgres harness; components → @testing-library/vue + axe; pure logic → unit.

---

## 2. Phasing (checkpoint between each; all on `contests` branch)

### Phase 1 — Foundation & quick wins (low risk, de-risks everything)
**Goal:** shared primitives + bug fixes + the cheap high-value UX wins, before the big editor rewrite.

1. **Shared datetime field + util (fixes G2).**
   - `layers/base/utils/datetime.ts` — `toLocalInput(iso)` / `fromLocalInput(local)` using **local
     date components** (not `toISOString()`), killing the UTC shift. Replace the per-file `toLocal`/
     `toIso`/`toLocalDatetimeInput` copies. Unit-tested across zones (mock TZ).
   - `layers/base/components/CpubDateTimeField.vue` — themed wrapper over `datetime-local` with
     `label`/`aria`, `min`/`max` props, validation slot. Replace all 8 native inputs (create/edit/stages).
   - Add `color-scheme: light` to `:root` in `theme/base.css` (dark already in `dark.css:85`) so native
     pickers theme correctly in both modes. *Risk: global; visually QA both themes.*
   - Stage date validation: start ≤ end, within the contest window, non-overlap warnings — in
     `utils/contestStages.ts` (+ tests), surfaced inline.
2. **`?tab=` deep links (fixes G3).** Sync `activeTab` ⇄ `route.query.tab` in `index.vue` (validate
   against the visible `tabs`; default `overview`; `router.replace` on change, no scroll jump). SSR reads
   the query so a shared `/contests/x?tab=judges` lands correctly. Keep the existing roving-tabindex a11y.
3. **Dark-mode-safe inline HTML (fixes G6).** Two-part:
   - Add a `.cpub-md-html` baseline in a non-scoped layer stylesheet: `color: var(--text)`,
     `background: transparent`, links/tables/headings → `var(--*)`, and `color-scheme` inheritance.
   - Extend `sanitizeRichHtml` (`useSanitize.ts:175`, the per-declaration hook already exists) with a
     `neutralizeColors` mode that drops/remaps hardcoded `color`/`background-color`/`border-color` to
     `currentColor`/`transparent`/`var(--border)` (config: strict-neutralize vs allow). Default ON for
     contest fields. Tests: author light HTML stays readable in dark theme.
4. **Server bug fixes (B1–B5).**
   - Wrap `withdrawContestEntry` and `createContest` (insert + judge/stakeholder seed) in
     `db.transaction` (B1/B2). RED-on-revert concurrency/partial-failure tests.
   - `judgeContestEntry`: validate `criteriaScores` keys/maxes against the resolved rubric
     (`currentStage.criteria` ?? `judgingCriteria`); reject unknown criteria / mismatched `max` (B3).
   - `addContestJudge` → `onConflictDoUpdate` (B4).
   - `judge.post.ts`: load the contest by `:slug` + assert the entry belongs to it (B5a).
   - `ContestJudgeManager`: search via a non-admin-safe endpoint (a scoped `/api/contests/[slug]/
     user-search` or the existing member search) + pass real `canManage` instead of hardcoded
     `is-owner` (B5b).
5. **Cleanup (C1, the safe subset).** Remove emoji from notification copy; fix `contestCreation`
   default to `'admin'` in the route; derive the hand-typed status/visibility/format Zod from the
   pgEnums (kill drift). Defer the dead-column DROP to Phase 6's migration.

**Gates:** server suite + layer suite + `pnpm typecheck` green. **Checkpoint.**

### Phase 2 — Unified block-style contest editor (the headline)
**Goal:** one `ContestEditor` in the house block-editor style, with contest-specific blocks.

1. **`ContestEditor.vue`** (`layers/base/components/contest/editor/`) — the single source for create +
   edit. `create.vue` + `[slug]/edit.vue` become thin pages that mount it (create = blank model, edit =
   hydrated + lifecycle/danger/advance rails). Kills the create/edit duplication (G1).
2. **Body as BlockTuple[].** Replace the description/rules textareas with `BlockCanvas`/`useBlockEditor`
   (the ProjectEditor pattern). Persist as BlockTuple[] in `contests.descriptionBlocks` /
   `contests.rulesBlocks` (new jsonb columns; legacy `description`/`rules` text kept and converted on
   first edit, mirroring CLAUDE.md rule #4 for docs). `CpubMarkdown`/`ContestRules` viewers already
   render BlockTuple[] via `BlockContentRenderer`. The raw-HTML `FormatToggle` escape hatch is retained
   for back-compat but de-emphasized (block content is inherently dark-safe).
3. **Contest-specific blocks** (edit component in `@commonpub/editor/vue/components/blocks/`, view in
   `layers/base/components/blocks/`, registered in BOTH maps — `BlockCanvas.vue:43` + `BlockContentRenderer.vue:42`):
   - `judgesShowcase` — editorial avatar+name+description cards (G5). **Self-contained data** (carries its
     own `{avatar,name,bio,link}[]`), independent of the `contest_judges` table/Judges tab — so the
     organizer curates the showcase copy. Edit component models on `PartsListBlock.vue` (object-list CRUD).
   - `prizesShowcase`, `criteriaShowcase`, `stageTimeline`, `sponsors`, `cta` — optional contest blocks
     reusing existing view components (`ContestPrizes`/`ContestJudgingCriteria`/`ContestSidebar` timeline)
     as render targets where possible (don't reinvent — CLAUDE feedback `reuse_existing_components`).
   - Palette: a contest `blockTypes: BlockTypeGroup[]` descriptor (Basic / Contest / Media / Rich) passed
     to `EditorBlocks` + `BlockCanvas`; `BLOCK_DEFAULTS` entries for each.
4. **Structured config via AutoForm.** Schedule / visibility / entries / judging-config panels rendered
   from `buildAutoForm` over the existing Zod (one renderer, inline errors), replacing hand-rolled rows.
   Merge the two divergent criteria editors into one. Dedupe the user-search dropdown into one component.
5. **Autosave** via `useEditorAutosave` (draft contests autosave; published contests save-on-action).
6. **Stages editor polish.** Drag-and-drop reorder (reuse the layout-editor `@vue-dnd-kit` primitive —
   no new lib, CLAUDE feedback `phase_3_hybrid_libraries`) replacing up/down buttons; the new
   `CpubDateTimeField` for stage dates with validation.

**Gates + axe on new components. Checkpoint.**

### Phase 3 — Display / layout redesign (readability + cover image)
**Goal:** a contest page that reads well; cover image surfaced; judges in overview.

1. **Slim the hero (G4).** Collapse the two stacked bands into one cohesive header: banner as a
   constrained backdrop, title/meta/CTA/countdown overlaid or in a compact bar (not a second tall dark
   band). Token-driven heights; readable contrast in both themes.
2. **Surface `coverImageUrl` (G4).** Render the cover image in the overview/body (or beside the hero
   description) — the field exists and is unused on detail. Responsive, `object-fit`, alt text.
3. **Judges showcase in overview (G5).** The `judgesShowcase` block (Phase 2) gives the organizer an
   overview judges section with avatar+description, separate from the Judges tab. (If a contest has no
   showcase block, the Judges tab remains the canonical list.)
4. **Typography pass.** Ensure overview/rules/prizes use the `.cpub-prose` baseline; readable line
   length + line-height (CLAUDE: base 16px / 1.7); date display consistency (one formatter; decide
   date-only vs date+time per surface).

**Gates + axe. Checkpoint.**

### Phase 4 — Submission paths: forms, agreements, PII, placeholder projects (G7)
**Goal:** the operator-configurable, form-first proposal flow + safe PII + Excel-ready records.

1. **Extend the per-stage form builder (field types).** Add to `submissionTemplateFieldSchema`
   (`schema/src/validators/contest.ts:34`) + `validateStageArtifactFields` + `ContestStagesEditor`'s
   template builder + `ContestStageSubmission` renderer:
   - `email` (validated), `number`, `select` (options), `checkbox`, `date`,
   - `agreement` — `{ termsFormat: markdown|html, terms: string, mustAccept: true }`,
   - `address` — structured `{ line1, line2, city, region, postal, country }`,
   - per-field `pii?: boolean` flag (auto-true for `address`; selectable for others).
   Render via AutoForm where it fits; keep the existing template-field UX consistent.
2. **Agreement acceptance (versioned, auditable).** New table
   `contest_agreement_acceptances (id, contestId, entryId, userId, stageId, fieldKey, termsHash,
   termsSnapshot text, acceptedAt, ip)` — immutable record per acceptance, captured atomically with the
   submission. Exportable for legal/audit.
3. **PII storage + access control.** New table `contest_entry_private_fields (id, contestId, entryId,
   userId, fields jsonb, createdAt, updatedAt)` — **never** returned by the normal entries endpoints.
   New RBAC permission `contest.pii.read` (catalog + seed → `admin` via `*`, `staff`; migration seeds it
   like 0025 did for `contest.*`). New route `GET /api/contests/[slug]/entries/[entryId]/private`
   gated by `requirePermission('contest.pii.read')` **and** returns own-PII to the entrant. New flag
   `features.contestPii` controls whether PII fields are *offered* in the builder.
   *Open sub-decision (noted below): does the contest owner/editor get `contest.pii.read` by default, or
   strictly admin/staff?* Plan defaults to admin/staff + entrant-own per the operator's wording.
4. **Form-first proposal path + placeholder project.** New flag `features.contestProposals`. New server
   fn `submitContestProposal(db, contestId, stageId, fields, userId)` — in **one transaction**:
   validate the stage form (required + agreement accepted + PII present); create a **draft** placeholder
   content item (project) seeded from `title`/`abstract` (reuse `createContent`); link a `contest_entry`
   to it (relax `submitContestEntry`'s published-only gate for proposal-mode stages — a draft is allowed
   when the stage is proposal-mode); write the `stageSubmissions` artifact; record agreement acceptance;
   store PII separately; bump `entryCount`. Returns the entry + new project slug so the entrant is routed
   into the editor to develop it for later rounds. (Aligns with the Resilient-America "proposal →
   prototype" walkthrough already documented.)
5. **Submit UI.** A stage-aware submit surface on `index.vue` (entries tab): proposal-mode → render the
   form (AutoForm) inline; attach-existing-mode → the current radiogroup picker (fix the
   `<NuxtLink>`-in-radiogroup a11y issue from G8). Entrant edits their placeholder project via the normal
   editor; resubmits per-stage artifacts as rounds progress.

**Gates: server integration (tx atomicity, PII isolation, agreement capture, draft-placeholder
creation, cohort gate), component + axe. Checkpoint.**

### Phase 5 — Judging UX + Excel/CSV export + manual advance polish (G8, G9)
**Goal:** judging that's obviously usable + the offline-judging export the operator wants.

1. **Judge page UX (G8).** Per-card (not page-global) save status with `aria-live`; one scoring scale
   (decide 0–100 or 1–100 and apply to both single + per-criterion paths); accessible feedback label;
   per-criterion `fieldset`/`role=group`; disabled-state reasons inline.
2. **Submissions export (G9).** New route `GET /api/contests/[slug]/entries/export?format=csv`
   (and optionally `xlsx`) gated by `contest.manage` OR judge membership. **Pages through all entries**
   (not capped at 100). Columns: entry title, author, link to entry-detail + placeholder project, the
   current-round artifact summary, current score/rank, **plus one empty column per rubric criterion** for
   manual tallying. PII columns (email/address) included **only** when the requester holds
   `contest.pii.read`. v1 = CSV (zero-dep, opens in Excel); xlsx is an optional follow-up (needs a lib —
   flag if added). This is the "judges who prefer a spreadsheet" + "tally manually then advance" path,
   complementing the built-in `advanceContestStage`.
3. **Manual advance polish.** Surface the existing Top-N / manual cut clearly in the editor;
   confirm-with-summary; tie the export to the manual workflow (export → tally → manual advance).

**Gates + axe. Checkpoint.**

### Phase 6 — Cleanup, migration consolidation, docs, release
1. **Drop dead columns** (`contests.judges`, `contests.content_format`) in the migration (interactive
   drizzle generate; the schema already marks them `@deprecated`).
2. **Score/rank denormalization note.** Document the authoritative source (top-level `score`/`rank` vs
   `judge_scores` vs `stageState`) and assert sync in tests; refactor only if needed.
3. **Docs:** `docs/reference/guides/contests.md` (new editor, proposal flow, PII, export, dark-mode
   HTML), `codebase-analysis/` refresh, ADR addendum (proposal/PII model), session log, `docs/STATUS.md`.
4. **Release (per STATUS.md runbook, explicit go-ahead required):** bump changed packages in dependency
   order (schema → config → editor → server → … → layer via `pnpm run publish:layer`); commit migrations;
   deploy commonpub.io (push main), then deveco/heatsync with curl-verify; bump CLI pins + both lockfiles.

---

## 3. Schema changes (consolidated)

| Phase | Change |
|---|---|
| 2 | `contests.descriptionBlocks jsonb`, `contests.rulesBlocks jsonb` (BlockTuple[]; legacy text kept, converted on edit). New block schemas in `@commonpub/editor` (`judgesShowcase`, `prizesShowcase`, `criteriaShowcase`, `stageTimeline`, `sponsors`, `cta`). |
| 4 | `submissionTemplateFieldSchema` + new field types (`email`/`number`/`select`/`checkbox`/`date`/`agreement`/`address`) + `pii` flag. New tables `contest_agreement_acceptances`, `contest_entry_private_fields`. New permission `contest.pii.read` (catalog + seed). |
| 6 | DROP `contests.judges`, `contests.content_format`. Derive status/visibility/format Zod from pgEnums (kill drift). |

All additive until Phase 6's drops; one migration per phase that needs DDL, generated via
`drizzle-kit generate`, applied through the deploy `db-migrate` path (never `db:push`).

## 4. New / changed flags
- `features.contests` — reused for editor/layout/tab work (same surface).
- `features.contestProposals` (new, default OFF) — form-first proposal path + placeholder project.
- `features.contestPii` (new, default OFF) — whether PII field types are *offered* (access is always
  RBAC-gated by `contest.pii.read`).
- `features.contestStageSubmissions` (existing) — continues to gate the per-stage template surfaces.
- Declare each in `nuxt.config.ts runtimeConfig.public.features` (env-propagation landmine),
  `useFeatures`, `/admin/features`, config `types.ts`/`schema.ts`, and the CLI template pins.

## 5. Testing strategy
- **Server:** real-Postgres harness for `submitContestProposal` (tx atomicity, draft placeholder,
  agreement capture, PII isolation), the B1/B2 tx fixes (RED on revert), B3 rubric validation, B4 race.
- **Pure:** `datetime.ts` (TZ-mocked), `contestStages.ts` validation + field-type ops, sanitizer
  color-neutralization.
- **Components + axe:** `ContestEditor`, contest blocks (edit + view), `CpubDateTimeField`, submit forms,
  judge page, PII gating (anon/entrant/staff).
- **Route contract:** `?tab=` SSR, export gating + PII column gating, `contest.pii.read` enforcement.

## 6. Risks & mitigations
- **`color-scheme: light` on `:root` is global** → QA every native control in both themes before commit.
- **Body text→blocks migration** → keep legacy `description`/`rules` text columns; convert lazily on
  edit (CLAUDE rule #4 precedent); viewer supports both. No bulk data migration.
- **PII leak** → separate table + dedicated gated route + tests asserting the normal entries endpoint
  never includes private fields + federation-leak check (instance-local, but assert no AP serialization).
- **Placeholder draft visibility** → a draft project linked as an entry must respect existing draft
  visibility (owner/admin) until the entrant publishes; reuse `canViewContent`.
- **Scope** → strictly phased + checkpointed; each phase independently shippable and flag-gated.

## 7. Open sub-decisions (surface at the relevant phase)
1. **PII access for the contest owner/editor** — admin/staff-only (current plan) vs include owner (they
   ship the hardware). Default admin/staff + entrant-own; confirm before Phase 4 build.
2. **Excel format** — CSV-only v1 vs add an `xlsx` lib for true multi-sheet/scoring-formula export.
3. **Scoring scale** — standardize 0–100 vs 1–100 across single + per-criterion judging (Phase 5).
4. **Raw-HTML `FormatToggle`** — retain (hardened) vs deprecate now that body is block-based.

---

## Standing-rules checklist
TDD (tests first) · every new feature flagged · `var(--*)` only (no hardcoded color/font) · TS strict,
no `any` · **no em dashes in user-facing copy** · `cpub-` class prefix · WCAG 2.1 AA + axe on new
components · committed migrations only (never `db:push`) · session log after · **no AI co-author in git**.
