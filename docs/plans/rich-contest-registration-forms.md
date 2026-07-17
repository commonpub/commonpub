# Plan — Rich, operator-definable contest registration forms + form-editor UX overhaul

**Status:** proposed + AUDIT-CORRECTED (plan only — awaiting go-ahead before implementation).
**⚠ READ §0 (Audit corrections) FIRST** — an adversarial audit (2026-07-17) verified the direction is
sound but found 2 blockers + 10 majors that change specifics and sequencing. §0 supersedes the affected
parts of §4–§13 below; the original sections remain for context.
**Author context:** session 242. Reference target: the Resilient America Preparedness Challenge
registration form (https://resilientamericapreparedness.lovable.app/).
**Operator decisions captured:** (1) architecture = *operator chooses per contest* (support both a
light registration + separate entry, AND a single combined intake form); (2) add ALL new field types
(sections, repeatable group, file upload, signature, radio, phone); (3) plan first, implement after review.

---

## 0. Audit corrections (2026-07-17) — MUST READ; supersedes affected parts below

An adversarial audit verified the plan's direction (lift the entry field-template subsystem onto
registration) and confirmed the session's shipped code is clean, but found the following. Treat these as
authoritative over the corresponding original sections.

### Blockers (the plan was WRONG — fix the design before building)

- **B1 — Combined-mode entry creation (fixes §8).** `contest_entries.content_id` is **NOT NULL** FK to
  `content_items` (`schema/contest.ts:273`). A raw project *URL* cannot populate an entry. Combined mode
  MUST reuse `submitContestProposal`'s mechanism: create a **draft placeholder content** row
  (`createContent`, `submissions.ts:267`) → obtain `contentId` → link the entry. Also `submitContestProposal`
  requires `contest.status==='active'` **and** a submission stage in **proposal mode** as the current stage
  (`submissions.ts:228,240-242`) — but registration is also open in **`upcoming`** (`REGISTERABLE_STATUSES`,
  `registrations.ts:24`). So §8 must define combined-mode behavior when the contest is `upcoming` (defer
  entry creation until active, or block combined registration pre-launch) and which stage the auto-entry
  attaches to. Specify the entry title/type source explicitly (a URL alone is insufficient).

- **B2 — "Private" files/signatures are a FALSE guarantee today (fixes §5/§7).** The only upload path is
  **public-read**: `storage.ts:192` sets `ACL:'public-read'` and returns a public URL; `files/upload.post.ts`
  always returns/stores `publicUrl`; valid purposes are a closed set `['cover','content','avatar','banner',
  'attachment']` (`upload.post.ts:35`) with size capped **per purpose** (attachment=100MB), not per field.
  Routing file/signature through this endpoint puts signed legal docs + signature PNGs at a **shareable
  public URL** — a GDPR/privacy breach for exactly the fields marked confidential. **Prerequisite before any
  file/signature field ships:** add a private storage path (non-public ACL / signed URLs) + an
  auth+`contest.pii`-gated file-serving route + a `contest`/`private` upload purpose. Until that exists,
  do NOT offer file/signature fields.

### Data-model corrections (fix §4)

- **Endpoint wire schema drops rich fields (major).** `register.post.ts:29` parses with
  `contestRegisterSchema`, whose `fields` = the **closed** `contestRegistrationFieldsSchema`
  (`z.object({building,experience,team})`, `validators/contest.ts:402`). Zod `z.object` **strips unknown
  keys**, so every operator-defined answer vanishes at the endpoint before any server logic. **Fix:** swap
  `contestRegisterSchema.fields` to an **open bounded record** (mirror `stageSubmissionSchema`:
  `z.record(z.string().max(64), z.string().max(4000))`, ≤50 keys); the closed schema becomes a preset shape
  only, not the wire contract. Do domain validation server-side against `registrationTemplate`.
- **Widening `fields` $type breaks typecheck at 5 sites (major).** The at-rest jsonb is safe (all
  string-valued), but changing `$type<ContestRegistrationFields>()` → `$type<Record<string,string>>()`
  breaks these explicit annotations that P1 must update in lockstep: `server/src/contest/types.ts:269`,
  `registrations.ts:52,156,218`, `layers/.../register.get.ts:18`, re-export `server/src/index.ts:74`. (The
  reference-app `nuxt typecheck` — not vitest — is the gate that catches these; see build-pipeline findings.)
- **Consent-audit table generalization is bigger than §4.5 says (major).** `contest_agreement_acceptances`
  has BOTH `entry_id NOT NULL` **and `stage_id NOT NULL`** (`contest.ts:388-412`), and the writer
  `recordPrivateAndAgreements` (`submissions.ts:25`) takes required `entryId`+`stageId` and upserts private
  fields on `entryId`. To support registration: make `entry_id` **and `stage_id`** nullable, add
  `registration_id`, add a CHECK that exactly one of entry_id/registration_id is set, **re-signature**
  `recordPrivateAndAgreements` to `{entryId?|registrationId?, stageId?}`, and upsert against the correct
  private table per scope. Also add `entry_id`/`registration_id` (or a `scope`) to the GDPR export
  projection (`profile/export.ts:298`) so registration acceptances are distinguishable (minor).

### Server corrections (fix §6)

- **Atomicity (major).** `registerForContest` is currently NOT transactional (insert-onConflictDoNothing,
  then a separate select+update reconcile; `registrations.ts:137-166`). §6's three coupled writes
  (registration + private fields + agreements) MUST be wrapped in one `db.transaction` (as
  `submitStageArtifact`/`submitContestProposal` already do) so consent can't diverge from the record.
- **Idempotent-register duplicates consent (major).** `registerForContest` is idempotent and re-invoked for
  info edits; `contest_agreement_acceptances` is append-only with no dedup. Re-registering would pile up
  duplicate acceptance rows. **Fix:** `UNIQUE(registration_id, field_key, terms_hash)` + `onConflictDoNothing`
  (record only on first accept / when terms change).
- **File-ownership check is NOT pure-validator work (major).** `validateSubmissionFields` is deliberately
  pure/no-DB (`validation.ts:5`) — verified. File "resolve to an uploaded object owned by the user" +
  per-field accept/maxSizeKb needs DB + storage, so it belongs in a **DB-backed post-validation step** (like
  `recordPrivateAndAgreements`), NOT the pure partition step. No code queries `files` by key for
  `uploaderId` today — this is net-new, not reuse.
- **`validateTemplateFields(...,{pii})` invents an arg (nit).** The current function has no `{pii}` toggle
  (PII is intrinsic via `isPiiField`) and is already pure+uncoupled — verified. Registration can call
  `validateSubmissionFields` directly; the "extraction" is really a rename + new-type handling.
- **`radio` needs its own options-refine (minor).** The `select-needs-options` refine
  (`validators/contest.ts:167`) fires only for `select`; a `radio` with zero options passes save-time
  validation then rejects every entrant answer. Add `radio` to that refine + the validator's select branch.

### Field-type sequencing corrections (fix §5/§7)

- **DEFER `group` (repeatable) to its own late phase — it's a model rewrite, not a switch-case (major).**
  The whole stack is `Record<string,string>` (renderer `defineModel<string>` `ContestSubmissionField.vue:17`;
  driver `ContestProposalForm.vue:24,70`; client helpers `utils/contestSubmission.ts:48,60,81`; server
  `validateSubmissionFields(template, values: Record<string,string>)`). A group value is an array-of-records
  — incompatible with all of these. It also breaks: the 4000-char per-value cap (a team list packed into one
  JSON string), the flat unknown-key guard (`byKey.has(key)`), the `field_key` regex `^[a-z0-9_]+$` +
  `varchar(40)` for group-child agreement keys (`team[0].consent` is illegal), and needs a `z.lazy` schema
  with a **depth cap (recommend 1 — groups can't nest)**. Design an explicit nested value model
  (`Record<string, string | GroupRow[]>`) threaded through renderer + both drivers + helpers + validator +
  export before attempting it. Ship simpler types first.
- **`file`/`signature` gated on the B2 private-storage prerequisite.** `address` (JSON-encoded into one
  string, `validation.ts:118`) proves JSON-in-a-string-value is fine for file/signature *refs* — but the
  bytes need private storage (B2) + DB-backed ownership validation.
- **Signature draw-pad is net-new UI (minor).** `ImageCropperModal.vue` is a *cropper* (emits a cropped
  Blob), not a freehand draw-pad and does not upload — weak reuse. Build the draw-pad + its "type your name"
  a11y fallback as new UI; only reuse the cropper if signature = uploaded image.

### UI/editor corrections (fix §9)

- **Anonymous intake is a HARD CONSTRAINT, not an open sub-decision (major).** Registration
  (`register.post.ts:22`) AND upload (`upload.post.ts:24`) both `requireAuth`; anonymous visitors see only
  "Log in to register" (`ContestSignup.vue:188`). The reference form is a public no-account form. So combined
  mode / reference parity is **authenticated-participants only** unless an anonymous-intake path (captcha +
  email-verify + deferred account) is built as a **separate net-new line item**. Recommend: scope to
  authenticated; drop the "pre-account" idea. Resolve §15.
- **DnD is heavier than stated; make keyboard up/down the PRIMARY reorder (minor).** Prior art
  (`admin/layouts/[id].vue:698-707`) shows `@vue-dnd-kit/core` ships **no a11y announcer** (they built
  `useLayoutAnnouncer`) and gate DnD to ≥640px. Up/down buttons are lighter + a11y-by-default; treat pointer
  DnD as optional polish that reuses the announcer pattern, and budget the announcer.
- **Exhaustive type maps force updates (nit).** New union members require new keys in
  `utils/contestStages.ts:242` `TEMPLATE_FIELD_TYPE_LABEL` (`Record<type,string>`) and any other exhaustive
  Record over the type union — compiler-caught but add to the touch list.

### Revised phase order (supersedes §13)

- **P0 — private-storage prerequisite** (infra private ACL/signed-URL path + gated file-serving route +
  `contest` upload purpose). Gate for file/signature fields.
- **P1 — schema + types + migration 0043** (registrationTemplate + registrationMode columns; widen `fields`
  + update the 5 annotation sites; `contest_registration_private_fields`; consent-table generalization incl.
  `stage_id` nullable + CHECK + dedup UNIQUE; add `section`/`radio`/`tel` types + `radio` refine; **NOT
  `group`/`file`/`signature` yet**).
- **P2 — server** (open wire schema on `contestRegisterSchema.fields`; registration through
  `validateSubmissionFields`; transactional write of record+private+agreements; DB-backed file post-validation
  once P0 lands).
- **P3 — renderer + registration form** (`section`/`radio`/`tel`; `ContestRegistrationForm`; live preview).
- **P4 — editor UX** (extract shared `FormTemplateEditor`; cards; **up/down reorder primary**, DnD optional;
  sections; grouped type picker; touch `TEMPLATE_FIELD_TYPE_LABEL`).
- **P5 — combined mode** (auth-only; reuse placeholder-content; define upcoming/active + stage; maxEntries
  race decision) **+ admin registrants list/export + presets/"comprehensive intake" template.**
- **P6 (later) — `file`/`signature` fields** (after P0) and **`group`** (dedicated nested-model phase).

Each phase: fix → full package suite → **`apps/reference` `nuxt typecheck`** (the layer gate) →
adversarial audit → roll the exact-pin chain. No `group`/`file`/`signature` claims of "private" or
"repeatable" ship until their prerequisites (P0 / nested-model) are done.

---

## 1. Goal

Let a contest organizer **build a rich registration form from the UI** — arbitrary typed fields, grouped
into sections, with required flags, help text, choices, consents, personal-data handling, a repeatable
team block, file uploads and a signature — and have every answer **map properly to storage** (public vs
private/PII vs consent audit). And make the **form editor itself easy and pleasant to read and edit**.

## 2. The key finding (why this is mostly reuse, not greenfield)

CommonPub already has a complete operator-definable rich-field subsystem — it's just wired to **entry
submissions**, not registration. Registration is stuck on a fixed 3-field set.

| Concern | Entry / submission side (EXISTS, rich) | Registration side (fixed) |
|---|---|---|
| Field definition type | `ContestSubmissionTemplateField` (`packages/schema/src/contest.ts:102`) — 10 types, required, help, options, pii, agreement terms | `ContestRegistrationFields` (`contest.ts:447`) — hardcoded `{building?, experience?, team?}` |
| Field-def validator | `submissionTemplateFieldSchema` (`validators/contest.ts:144`) | `contestRegistrationFieldsSchema` (closed 3-key) |
| Where defs live | `contests.stages[].submissionTemplate` (jsonb) | *nowhere* — no `registrationTemplate` |
| Answers storage | public `contest_entries.stageSubmissions`; PII `contest_entry_private_fields`; consent `contest_agreement_acceptances` | single undifferentiated `contest_registrations.fields` jsonb, no PII split, no consent audit |
| Validate + partition | `validateSubmissionFields` (`server/src/contest/validation.ts:40`) — domain checks + PII/agreement partition | none (flat zod only) |
| Entrant renderer | `ContestSubmissionField.vue` (all 10 types incl. address/agreement) | bespoke hardcoded inputs in `ContestSignup.vue` |
| Operator builder | `ContestStageTemplateEditor.vue` (presets, whole-form templates, per-field editor, markdown intro) | *none* — operator has zero control |
| Presets / templates | `utils/contestSubmissionTemplates.ts` (incl. `us-entity`, address/shipping) | none |

**Strategy:** lift the entry field-template subsystem onto registration, extend the shared field-type
system for the new types, and overhaul the (shared) builder's UX. ~80% is reuse.

## 3. Architecture — "operator chooses per contest"

Add a per-contest **registration mode** plus an operator-defined **registration template**:

- `contests.registrationTemplate: FormField[]` — the operator's registration fields (new jsonb column).
- `contests.registrationMode: 'light' | 'combined'` (default `'light'`).
  - **light** — registration is a lightweight "I'm participating" record with optional rich fields
    (track, country, org, shipping, team, consents…). Project **entry** stays a separate step and keeps
    its existing per-stage submission templates. This is today's split, made rich.
  - **combined** — a single intake form at registration captures everything, including a **project link
    field** that creates/links a `contest_entries` row, so the participant registers *and* enters in one
    submit. Closest to the reference form's monolith. (See §8 for the register→entry mapping.)

Both modes render from the same `registrationTemplate` via the same renderer and validator; the mode only
changes what happens *after* a valid submit (write a registration row, or write registration **and** an
entry).

## 4. Data model + migration (schema is the work)

New/changed in `packages/schema/src/contest.ts` + one Drizzle migration (`packages/schema/migrations/`,
applied via `scripts/db-migrate.mjs`):

1. **`contests.registration_template jsonb`** `$type<FormField[]>()` default `[]` — operator field defs.
2. **`contests.registration_mode text`** default `'light'` (`'light'|'combined'`).
3. **Widen `contest_registrations.fields`** from `$type<ContestRegistrationFields>()` to
   `$type<Record<string,string>>()` (open key→value, matching `stageSubmissions`). **Back-compat:** the
   existing `{building,experience,team}` rows are already `Record<string,string>`-shaped at rest, so no
   data rewrite is needed; we re-express the 3 legacy fields as three default template fields (see §11) so
   old answers still render with labels.
4. **New table `contest_registration_private_fields`** — mirror of `contest_entry_private_fields`
   (`{id, contestId, userId, registrationId UNIQUE, fields jsonb Record<string,string>}`) for PII answers
   at registration.
5. **Generalize consent audit for registration.** `contest_agreement_acceptances` is `entry_id`-scoped
   today. Options (pick at impl): (a) make `entry_id` nullable + add nullable `registration_id` + a
   `scope` check-ish discriminator; or (b) a parallel `contest_registration_agreement_acceptances` table.
   **Recommend (a)** — one audit table, `entry_id` **or** `registration_id` set, guarded by a migration
   that backfills nothing (additive) and a CHECK that exactly one FK is present. Orphan-safe.
6. **Extend the field-definition type** (shared by entry + registration) — rename the exported concept to a
   neutral `FormField` (keep `ContestSubmissionTemplateField` as an alias for back-compat) and add types:
   `section | group | file | signature | radio | tel` (see §5). New optional props: `children?: FormField[]`
   (group), `min?/max?` (group count), `accept?: string` + `maxSizeKb?` (file), `layout?: 'radio'` sugar.

Migration is **additive** (new columns default-empty, new table, nullable FK) → low risk, forward-only,
no destructive change. Latest migration today is `0042`; this becomes `0043`.

## 5. Field-type extensions (shared entry + registration)

Extend `FormField['type']` + `submissionTemplateFieldSchema` (`.refine`s) + the renderer + validator:

| Type | Value shape (string-encoded wire, like today) | Validation | Storage class |
|---|---|---|---|
| **section** | none (display-only: title + optional description) | n/a (skipped in validate/partition) | not stored |
| **radio** | same as `select` (one option value) | membership in `options` | public (unless `pii`) |
| **tel** | string | phone regex (lenient E.164-ish), optional | public (unless `pii`) |
| **file** | storage key/ref (JSON: `{key,name,size,mime}`) | mime in `accept`, size ≤ `maxSizeKb`, must resolve to an uploaded object owned by the user | **private** (always) |
| **signature** | data-URL PNG or uploaded image ref | non-empty; size cap | **private** (always) + optional consent-style timestamp/IP |
| **group** (repeatable) | JSON array of `Record<string,string>` (each = child fields) | recurse `children`; enforce `min`/`max` count; per-child domain checks | per-child PII class (a group can contain public + private children) |

- **radio/tel** are cheap (radio = display variant of select; tel = text + regex).
- **file/signature** reuse the existing upload path: `layers/base/server/api/files/upload.post.ts` +
  `composables/useFileUpload.ts` + infra `validateUpload` / `MAX_UPLOAD_SIZES` / `generateStorageKey`
  (`packages/infra/src/storage.ts`). `ImageCropperModal.vue` is a reuse candidate for signature preview.
  Both land in the private store (never the public jsonb).
- **group** is the biggest new piece: the renderer repeats a mini-form of `children`; the
  validate+partition step recurses, and a group with any PII child routes that child's values to the
  private store keyed as `groupKey[i].childKey`.

## 6. Server — validate + partition (shared)

- **Extract** `validateSubmissionFields` (`server/src/contest/validation.ts`) into a reusable
  `validateTemplateFields(template, values, { pii })` that both entry and registration call. Add handling
  for the new types (skip `section`; recurse `group`; treat `file`/`signature` as always-private refs;
  `radio` like `select`; `tel` regex).
- **Registration path** (`server/src/contest/registrations.ts` `registerForContest`): route the submitted
  answers through `validateTemplateFields(contest.registrationTemplate, …)`, then persist:
  - public answers → `contest_registrations.fields`
  - PII answers → `contest_registration_private_fields`
  - agreement accepts → `contest_agreement_acceptances` (registration-scoped, §4.5) with the existing
    sha-256 `termsHash` + `termsSnapshot` + IP audit.
- **Combined mode** additionally creates/links a `contest_entries` row from the project field (§8).
- Reuse the entry side's protections: unknown-key rejection, per-type domain checks, required/must-accept
  enforcement, value length caps, CSV formula-injection neutralization on export.

## 7. UI — entrant renderer

- Reuse `ContestSubmissionField.vue`; extend its `switch(field.type)` for `section` (renders an `<h*>` +
  description, no input), `radio` (fieldset of radios), `tel` (`type="tel"`), `file` (upload button +
  filename chip, wired to `useFileUpload`), `signature` (a small draw-pad canvas → PNG; a11y fallback:
  "type your name" alternative), and `group` (repeatable sub-form with "+ Add {label}" / remove, honoring
  `min`/`max`).
- Drive the registration form from `contests.registrationTemplate`. Replace the hardcoded inputs in
  `ContestSignup.vue` with a template-driven `ContestRegistrationForm.vue` (keeps the two-tier
  register/reminders card, dirty-tracking Save, prefill from `GET /register`). Legacy 3-field contests get
  the default template (§11) so nothing regresses.

## 8. Combined mode — mapping one form to registration + entry

In `combined` mode the registration template may include a **project field** (`type:'url'` flagged
`role:'project'`, or a dedicated `projectLink` field). On submit:
1. validate + partition as usual → write the registration row + private/consent rows;
2. create (or find) the participant's `contest_entries` row, setting its project link / title from the
   flagged field; entry stays the canonical "submission" object so judging/stages still work.
3. Entry-level submission templates can be empty in combined mode (everything was captured up front), or
   used for later stages.
**Open sub-decision (flag in impl):** whether combined mode auto-creates the entry as `draft` vs
`submitted`, and how it interacts with `maxEntriesPerUser`. Recommend `draft` + the existing entry-flow.

## 9. UI — the form-editor UX overhaul (explicit ask)

Today's builder (`ContestStageTemplateEditor.vue`, 374 lines) is functional but a **dense flex-row per
field**, **no reordering**, **no sections**, **no whole-form preview**. Redesign into a shared, pleasant
builder used by BOTH registration and entry:

- **Extract `FormTemplateEditor.vue`** (shared) from `ContestStageTemplateEditor`; the stage editor and a
  new registration editor both mount it. One editor to maintain.
- **Field cards, not rows.** Each field = a collapsible **card**: collapsed shows `label` + a **type
  badge** + a **Required** chip + drag handle + expand/delete; expanded shows the full editor (type
  picker, help, options/terms/pii, etc.). Turns a wall of inputs into a scannable list.
- **Reordering** via `@vue-dnd-kit/core` (already a dep, used by the layout editor) with a keyboard
  fallback (up/down buttons) for a11y. Reorder emits the reordered array (pure helper).
- **Sections** as first-class: an "Add section" affordance inserts a `section` field; cards render grouped
  under their preceding section header with subtle nesting — matches the reference's structure.
- **Grouped, described type picker.** Replace the bare `<select>` with a categorized picker (Basic /
  Choice / Consent & legal / Personal data / Advanced) showing icon + one-line description per type
  (reuse `TEMPLATE_FIELD_TYPE_LABEL` + the preset icons). PII/agreement/file/signature gated by
  `contestPii` as today.
- **Live WYSIWYG preview.** A toggle/side panel renders the whole template through the entrant renderer
  (`ContestSubmissionField`) exactly as participants see it — the operator sees the real form while
  editing. (The intro-block already has a preview; extend to the whole form.)
- **Presets + whole-form templates** (reuse `contestSubmissionTemplates.ts`) + ship a new
  **"Comprehensive challenge intake"** template that reproduces the reference form (see §14) so an
  operator gets it in one click.
- **Ergonomics kept:** auto-derived + uniquified field keys (`fieldKeyFromLabel`), destructive-replace
  confirm, outside-click/Escape menu close, WCAG-AA tokens, inline validation hints ("a choice field needs
  at least one option").

## 10. Admin — registrant list + export (close the existing gap)

`listContestRegistrants` is written but **routed nowhere**, and CSV export covers entries only. Wire:
- `GET /api/contests/[slug]/registrants` (organizer-gated) → registrant list incl. label-mapped answers,
  PII gated by the `contest.pii` permission (reads `contest_registration_private_fields`).
- An admin registrants view/table in the contest admin UI.
- Extend `buildContestExport` (or add a registrants CSV) to include registration answers keyed by template
  label, PII columns gated, formula-injection-neutralized.

## 11. Back-compat & migration

- Existing contests: `registrationTemplate` defaults `[]`, `registrationMode` defaults `'light'`.
- The legacy `{building,experience,team}` fields are re-expressed as a **default registration template**
  (a `textarea` "What are you building", a `radio`/`select` "Experience", a `radio`/`select` "Team") so
  existing signup UX and stored answers render unchanged. Ship this as a named preset and (optionally) a
  one-time backfill that sets `registrationTemplate` for contests that had the old form. Non-destructive.
- Feature-flag the new form behind `contestSignup` (already on) + `contestPii` (for private/consent types);
  consider a `contestRegistrationForm` flag (default off) to dark-launch the builder.

## 12. Testing

- **Unit:** `validateTemplateFields` for every new type + group recursion + partition correctness
  (public/private/consent) + unknown-key rejection; pure editor array-ops (reorder/section/group).
- **Component:** renderer per new type (section/radio/tel/file/signature/group) incl. a11y (axe); the
  builder (add/reorder/section/preview) with jsdom (polyfill PointerEvent per repo memory).
- **Integration (test Postgres):** register with a rich template → assert public vs
  `contest_registration_private_fields` vs agreement rows; combined mode → assert entry created; registrant
  list/export mapping + PII gate.
- **Visual/E2E:** the reference "comprehensive intake" template rendered + submitted at true mobile width
  (Playwright `newContext({viewport})`), per repo memory on v-html/overflow + verify-before-ship.

## 13. Phased rollout (each phase: fix → full suite + reference-app typecheck → adversarial audit → roll)

- **P1 — schema + types + migration** (schema pkg; `FormField` + new types + columns + private table +
  agreement generalization; migration 0043). No behavior change yet.
- **P2 — server validate+partition + registration wiring** (server pkg; shared `validateTemplateFields`,
  registration route through it, private/consent persistence). Behind a flag.
- **P3 — renderer new types** (layer; `ContestSubmissionField` extensions + `ContestRegistrationForm`).
- **P4 — editor UX overhaul** (layer; extract `FormTemplateEditor`, cards + DnD + sections + live preview
  + grouped type picker; used by both registration + entry).
- **P5 — combined mode + admin registrants list/export + the "comprehensive intake" template.**

Roll landmines still apply: layer pins deps exact → republish chain; run `apps/reference` `nuxt typecheck`
before any layer roll (build-pipeline gap, see `docs/reviews/build-pipeline-findings-2026-07-17.md`);
`git push --no-verify` after validating; migration via `scripts/db-migrate.mjs` (drizzle-kit push needs a
TTY).

## 14. Reference-form → CommonPub field mapping (proof the design covers it)

| Reference section / field | CommonPub field type | Notes |
|---|---|---|
| Challenge Track (Developer/Startup) | `radio` (or `select`) | required |
| Full name, Email | `text`, `email` | email default-PII; name may prefill from account |
| Country of residence + "confirm US" | `select` + `checkbox` (or `agreement`) | the confirm is a consent checkbox |
| Organization name / role / website | `text` ×3 | optional |
| Registered US Entity (docs) | `file` + `agreement` (`us-entity` preset exists) | private |
| Project Page URL | `url` (flagged `project` in combined mode) | required |
| Team members (+ Add member) | `group` (repeatable, children: name/role/email) | new type |
| Dev-kit shipping address | `address` (exists) | always PII |
| Recipient / Phone | `text` / `tel` | phone new; PII |
| Compliance / eligibility / IP / liability / governing-law clusters | multiple `agreement` fields (with `terms` + `mustAccept`), grouped under `section`s | consent audit rows |
| Required vs optional communications | `checkbox` ×N (required flag) | consent |
| Publicity consent, AI & judging ack | `checkbox` / `agreement` | consent |
| Print name / Date / Signature | `text` / `date` / `signature` | signature new, private |

Every reference field maps to an existing or planned type — no field is unrepresentable.

## 15. Open decisions for the operator (surface before/into implementation)

1. **Combined-mode entry state:** auto-create the linked entry as `draft` (recommended) or `submitted`?
   And how should it count against `maxEntriesPerUser`?
2. **Signature storage:** inline PNG data-URL vs uploaded image object (recommended: uploaded, private
   store). Any legal requirement to snapshot IP/timestamp like agreements?
3. **File field limits:** allowed mime types + max size per field (defaults from `MAX_UPLOAD_SIZES`), and
   whether files are virus/type-scanned.
4. **Consent audit table:** generalize `contest_agreement_acceptances` (recommended) vs a separate
   registration table — a schema-shape call.
5. **Ship the exact reference form** as a named "Comprehensive challenge intake" template? (recommended —
   one-click parity with your reference.)
6. **Editor DnD:** confirm `@vue-dnd-kit/core` for reordering (already a dep) vs simple up/down buttons
   only (lighter, fully a11y by default).

---

### Appendix — key files to touch (grounded)

- Schema: `packages/schema/src/contest.ts`, `packages/schema/src/validators/contest.ts`,
  `packages/schema/migrations/0043_*.sql`
- Server: `packages/server/src/contest/{validation,registrations,submissions,export,types}.ts`
- Layer API: `layers/base/server/api/contests/[slug]/{register.post,register.get,registrants.get,export.get}.ts`,
  `layers/base/server/api/files/upload.post.ts`
- UI renderer: `layers/base/components/contest/ContestSubmissionField.vue`, new `ContestRegistrationForm.vue`
- UI editor: extract `layers/base/components/contest/FormTemplateEditor.vue` from
  `ContestStageTemplateEditor.vue`; wire into `ContestEditor.vue` (new "Registration form" panel) + the
  stages editor
- Utils: `layers/base/utils/{contestSubmissionTemplates,contestStages,contestSubmission}.ts`,
  `composables/useFileUpload.ts`, `components/ImageCropperModal.vue`
- Infra (reuse): `packages/infra/src/storage.ts`
