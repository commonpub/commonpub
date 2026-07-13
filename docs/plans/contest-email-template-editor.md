# Per-Contest Email-Template Editor — Plan (session 232)

Status: **BUILT + VERIFIED** (session 232; NOT rolled). Branch: **`contest-registration-reminders`**
(stacked on the registration/reminder work — same two templates; commit `faa5bb3f`). One branch, no merge
to main required first. All phases P1-P6 implemented TDD-first; P7 verified: schema/config/infra/server/
reference typecheck clean, server 1682 + layer 1483 tests pass (real-Postgres enqueue asserted), editor
component-tested (v-model + preview + axe). Flag `contestEmailEditor` ships OFF. Live browser run is the
remaining pre-roll gate (memory `feedback_verify_ui_visually_before_ship`).

## 1. Goal

Contest organizers need an in-editor UI to customize, **per contest**, the copy of the two contest
participation emails introduced in session 231:

- **Registration confirmation** — `emailTemplates.contestRegistrationConfirmation` (`packages/infra/src/email/templates.ts:99`)
- **Deadline reminder** — `emailTemplates.contestDeadlineReminder` (`packages/infra/src/email/templates.ts:133`)

Today both bodies are hardcoded, instance-global copy in `templates.ts`. A Qualcomm partner (via Jinger
Zeng) wants their own wording without a code change. Deliver a per-contest **override with fallback**:
an organizer edits subject + intro; a contest with no override sends the built-in default unchanged.

## 2. Definition of done (the feature, not this planning doc)

Organizer opens a contest → Emails editor → edits confirmation + reminder subject/intro with live
preview → saves → a real registration/reminder send uses the custom copy; a contest with no override
still sends the built-in default. Verified with a local app run + a real enqueue (assert the enqueued
outbox message subject/html), not only green units.

## 3. Current state (grounded, file:line)

- **Templates** — `packages/infra/src/email/templates.ts`. `contestRegistrationConfirmation(siteName,
  username, contest{title,url,deadline?}, unsubscribeUrl?, branding?)` at :99; `contestDeadlineReminder(
  siteName, username, contest{title,url,deadline,timeRemaining}, unsubscribeUrl?, branding?)` at :133.
  Both build HTML through the render kernel and carry the unsubscribe link (participation mail).
- **Render kernel** — `packages/infra/src/email/render.ts`. `escapeHtml` (:13), `wrapTemplate` (:29;
  emits the unsubscribe link at :36-38 and footer), `button` (:67), `brandAccent` (:23). These are the
  ONLY places that emit raw HTML (module-private to the email dir). The unsubscribe link + footer are
  produced inside `wrapTemplate`; the CTA is `button()`. Both are system-owned chrome.
- **Override-with-fallback precedent** — `packages/server/src/comms/branding.ts`: `getEmailBranding(db)`
  reads an instance setting, re-validates with the **write-side** `emailBrandingSchema`, returns `{}` on
  unset/invalid so each template field falls back to its default. This is the exact shape to mirror.
- **Safe organizer-copy precedent** — `packages/schema/src/validators/comms.ts:36` `broadcastInputSchema`
  (plain-text `bodyText`, `http(s)`-only CTA url via `.refine`, `.strict()`); `packages/server/src/comms/
  broadcast.ts:173-178` splits plain text into `escapeHtml`-ed `<p>` paragraphs + a system CTA. **No
  organizer HTML anywhere.** This is the load-bearing security model.
- **Live-preview editor precedent** — `layers/base/pages/admin/email-templates.vue`: flat `reactive`
  form; empty field = built-in default (`buildPayload` only adds trimmed-truthy fields); 400ms-debounced
  `POST /api/admin/email-preview`; preview rendered in a **sandboxed `<iframe :srcdoc>` (`sandbox=""`)**,
  never `v-html`; save via PUT, load via GET, preview via POST, all sharing `buildPayload()`.
- **Preview route precedent** — `layers/base/server/api/admin/email-preview.post.ts`: `requireFeature('admin')`
  + `requirePermission(event,'email.manage')`; body parsed with the same `emailBrandingSchema`; renders a
  fixed sample through a real template fn; returns `{ html, subject }`.
- **Send integration points** — `packages/server/src/contest/registrations.ts:82` (confirmation enqueue;
  already loads `getEmailBranding`) and `packages/server/src/contest/reminders.ts:140` (reminder enqueue;
  already loads branding). Both already `select` the contest row, so `emailCopy` can join that select.
- **Contest editor shell** — `layers/base/components/contest/ContestEditor.vue`. Body tabs are a
  `BodyTab` union + `activeTab` ref (:88-89), rendered by child `ContestBodyCanvas.vue` (:480-487); the
  Stages tab is a **form (not block) body tab** via named slot `#stages` (:544-561) with the palette
  hidden by `v-show="activeTab !== 'stages'"` (:474) — the precedent for a form body tab. Right-rail
  `EditorSection` accordions (`@commonpub/editor/vue`) driven by `openSections` + `toggleSection`
  (:269-275); People/Danger are gated `mode === 'edit'`. Save is a **single whole-contest payload**
  via `useContestEditor` (`buildPayload` L319-370 → POST `/api/contests` or PUT `/api/contests/:slug`);
  drafts autosave (3s debounce), published save on a button.
- **Save route + update fn** — `layers/base/server/api/contests/[slug]/index.put.ts` parses
  `updateContestSchema`, computes `canManage = ownerOrPermission(...,'contest.manage') || isContestEditor(db,
  contest.id, user.id)`, calls `updateContest(db, slug, user.id, input, canManage)`. `updateContest`
  (`packages/server/src/contest/contest.ts:113-183`) re-checks auth (:127-128) then field-guards
  (`if (data.X !== undefined) updates.X = data.X`).
- **Editor gate** — `packages/server/src/contest/stakeholders.ts:157` `isContestEditor(db, contestId,
  userId): Promise<boolean>` (returns `row.role === 'editor'`). Folded into `canManage`.
- **Email context** — `packages/server/src/contest/types.ts:249` `ContestEmailContext { siteUrl, siteName,
  secret }`. Consumed by `reminders.ts` + `registrations.ts`.
- **Schema** — `contests` = `pgTable('contests', ...)` at `packages/schema/src/contest.ts:147-245`;
  `jsonb` already imported (:1); typed jsonb precedent `stages: jsonb('stages').$type<ContestStage[]>()`
  (:192). `createContestSchema` L200-251 / `updateContestSchema` L256-295 in
  `packages/schema/src/validators/contest.ts` (hand-maintained parallel objects). Latest migration is
  `0040_sleepy_madelyne_pryor.sql`; **next is `0041`** via `pnpm --filter @commonpub/schema db:generate`.

### Verified live flag state (`curl /api/features`, 2026-07-12)

| Instance | `contests` | `emailNotifications` | `contestReminders` |
|---|---|---|---|
| commonpub.io | true | **false** | (absent in probe) |
| deveco.io | true | **true** (console sink, no transport) | (absent in probe) |
| heatsync.club | (no JSON returned) | — | — |

So `contests` is ON on the two reachable instances; only deveco actually enables email (console sink).
`contestEmailEditor` (this feature's new flag) does not exist yet.

## 4. Design decisions (each open question resolved)

### 4.1 Storage → additive `email_copy jsonb` column on `contests` (NOT a new table)

Per-contest data belongs on the contest row (branding is instance-global → instance setting; copy is
per-contest → contest column). Only two small templates, so a column beats a table. Additive, nullable,
no `.notNull()`, matching `prizes`/`judgingCriteria`.

- Schema: `emailCopy: jsonb('email_copy').$type<ContestEmailCopy>(),` added to `contest.ts` near :240.
- `ContestEmailCopy` interface (in `contest.ts`, beside the other jsonb `$type` interfaces):
  ```ts
  export interface ContestEmailCopy {
    confirmation?: { subject?: string; intro?: string };
    reminder?: { subject?: string; intro?: string };
  }
  ```
- Migration `0041` generated (never hand-written): `ALTER TABLE "contests" ADD COLUMN "email_copy" jsonb;`.

### 4.2 Editable surface → per template: subject + intro (plain text, tokenized). Everything else system-owned.

- Editable: **subject** and **intro body** (plain text) for each of the two templates.
- System-owned chrome the organizer CANNOT touch: the **unsubscribe link** (legal/deliverability —
  produced by `wrapTemplate`), the **CTA button** (`button()`), the confirmation **deadline line**, the
  reminder **"Submissions close on {deadline}" line**, the branded shell/footer.
- One reminder template is shared across all four milestones; `{timeRemaining}` differentiates them (do
  not offer per-milestone copy — matches the single `contestDeadlineReminder` fn).

When an override intro is present it **replaces the default greeting + lead paragraph(s)**; the system
deadline line + CTA + unsubscribe are always appended after it. When a subject override is present it
**replaces the whole subject** (the organizer owns it; we do NOT append `-- {siteName}` — predictability
over the deliverability nicety). Empty string or absent = built-in default (mirrors branding).

**Critical invariant:** the token interpolation helper runs ONLY on the override branch (when `copy?.subject`
/`copy?.intro` is present). The default copy path must never pass through `.replace(/\{(\w+)\}/g,…)` — the
built-in strings could legitimately contain braces, and re-running the tokenizer over them would corrupt
output. P2 tests assert the `copy === undefined` path is byte-identical to today (the tokenizer is not on it).

### 4.3 Tokens → fixed, documented, per-template allow-list; HTML-escaped values; unknown tokens left literal

- Confirmation tokens: `{contestTitle}`, `{deadline}`, `{username}`, `{contestUrl}`.
- Reminder tokens: `{contestTitle}`, `{deadline}`, `{username}`, `{timeRemaining}`, `{contestUrl}`.
- Interpolation (module-private helper in the email dir, beside `escapeHtml`):
  - **HTML intro**: split into paragraphs like broadcast (`.split(/\r?\n\r?\n|\r?\n/)` → trim → filter →
    `<p>…</p>`), `escapeHtml` each paragraph, THEN
    `.replace(/\{(\w+)\}/g, (m,k) => k in tokens ? escapeHtml(tokens[k]) : m)`. `escapeHtml` never
    touches `{`/`}`, so placeholders survive escaping; `String.replace(fn)` does not re-scan inserted
    text, so a token value containing another `{token}` is NOT re-expanded (no double interpolation).
  - **Subject** and **text/plaintext body**: raw interpolation
    `.replace(/\{(\w+)\}/g, (m,k) => k in tokens ? tokens[k] : m)` (plain-text headers/bodies, no HTML).
  - Unknown tokens (`{foo}`) are left **literal** and documented; the live preview surfaces them so the
    organizer catches typos. No stripping (reversible, honest).
- Token VALUES (`contestTitle`, `username`) are user-controlled, so escaping them in the HTML path is
  load-bearing, not decorative. Test with a `<script>`-bearing title.

### 4.4 templates.ts integration → optional `copy?` param, default path unchanged

Grow each template fn with a trailing optional `copy?: { subject?: string; intro?: string }`:

```ts
contestRegistrationConfirmation(siteName, username, contest, unsubscribeUrl?, branding?, copy?)
contestDeadlineReminder(siteName, username, contest, unsubscribeUrl?, branding?, copy?)
```

When `copy?.subject` is present → tokenized override subject, else current default. When `copy?.intro`
is present → tokenized escaped paragraphs in place of the default greeting/lead, else current default.
The system deadline line + `button(...)` + `wrapTemplate` unsubscribe are unconditional. **When `copy`
is undefined the output is byte-identical to today** (existing template tests stay green — assert this).

### 4.5 Server override loading → mirror `getEmailBranding`

New `packages/server/src/contest/emailCopy.ts`:

```ts
export function parseContestEmailCopy(raw: unknown): ContestEmailCopy   // safeParse → {} on failure
export async function getContestEmailCopy(db: DB, contestId: string): Promise<ContestEmailCopy>
```

`parseContestEmailCopy` re-validates with the write-side `contestEmailCopySchema` (defense in depth,
exactly like `getEmailBranding`). In `registrations.ts` / `reminders.ts` the contest row is already
selected, so add `emailCopy: contests.emailCopy` to those selects and `parseContestEmailCopy(row.emailCopy)`
inline (no extra round-trip); `getContestEmailCopy` exists for callers that lack the row (e.g. preview).

**Flag gate on application:** in `registrations.ts` and `reminders.ts`, only apply the parsed copy when
`config.features.contestEmailEditor` is on; otherwise pass `undefined` → built-in default. This makes the
flag a true kill-switch (turning it off reverts every send to defaults even if a stored value exists).

### 4.6 Feature flag → NEW flag `contestEmailEditor` (default false) — overriding the kickoff's "no new flag"

The kickoff recommended reusing existing flags. **I am overriding that**, because CLAUDE.md Standing Rule
#2 ("No feature without a flag in `commonpub.config.ts`") is an explicit override of default behavior, and
this is a discrete feature (UI panel + storage + interpolation + routes). A dedicated flag also gives
operators independent control (emails on, but per-contest copy customization locked) and a clean
kill-switch. Precedent: `contestReminders` got its own flag in the same workstream.

- Add to `packages/config/src/schema.ts` near :43: `contestEmailEditor: z.boolean().default(false),`
- Add to `packages/config/src/types.ts` near :44: `contestEmailEditor: boolean;`
- Gates: the Emails tab visibility, the preview route, the test-send route, and copy **application** on
  the send path (4.5). Writing an `emailCopy` value while the flag is off is harmless (stored, never used),
  so the PUT need not be flag-gated — but the UI that produces it is.

### 4.7 UI home → dedicated "Emails" body tab (primary); right-rail section+dialog (documented alternative)

The live email preview needs ~600px width (the branding editor uses a 2-pane 1fr/1fr grid). The right-rail
settings accordion is ~320px — too narrow for side-by-side preview. The Stages tab proves a **form-style
body tab** is a supported pattern (named slot + palette hidden). So the primary choice is a dedicated
body tab with the proven 2-pane layout.

**Primary — "Emails" body tab (chosen):**
```
[ Overview | Rules | Prizes | Stages | Emails ]
+------------------------------------+---------------------------+
| Template: (o) Confirmation         |  LIVE PREVIEW             |
|           ( ) Deadline reminder    |  +---------------------+  |
|                                    |  | (sandboxed iframe)  |  |
| Subject  [___________________]     |  |  branded email      |  |
|  empty = built-in default          |  |  with sample tokens |  |
| Intro                              |  |                     |  |
| [ textarea, plain text          ]  |  +---------------------+  |
| [ blank lines = new paragraph   ]  |  [ Send test to me ]      |
| Tokens: {contestTitle} {deadline}  |                           |
|   {username} {contestUrl}          |                           |
+------------------------------------+---------------------------+
```

**Alternative — right-rail "Communications" `EditorSection` + preview dialog:** compact accordion with the
two forms; a "Preview" button opens a modal sandboxed-iframe. Lower integration surface (self-contained in
`ContestEditor.vue`, no `ContestBodyCanvas.vue` edit) but worse UX (preview not side-by-side). Documented
as the fallback if the body-tab integration proves heavier than estimated during the build.

Chosen: **body tab**, gated `mode === 'edit'` (needs a persisted contest for per-contest preview + save;
mirrors People/Danger gating). The build must edit `ContestBodyCanvas.vue` to add the tab button + panel
and extend the palette-hide condition (Stages precedent).

- UX rules (mirror `email-templates.vue`): flat `reactive` form, 400ms-debounced `POST /api/contests/
  :slug/email-preview`, empty field = default, sandboxed `<iframe :srcdoc>` (never `v-html`), whole-copy
  object flows through `buildPayload` → the existing contest PUT (no new save endpoint).
- a11y (Rule #12 / #3): `var(--*)` only, labeled inputs, keyboard-navigable radio for template select,
  token list as real text (not color-only), no em dashes in sample copy.

### 4.8 Preview + test-send

- **Preview**: new `layers/base/server/api/contests/[slug]/email-preview.post.ts`, mirroring the admin
  route. `requireFeature('contests')` + `requireFeature('contestEmailEditor')` + `requireAuth` + editor
  gate (`ownerOrPermission(...,'contest.manage') || isContestEditor(db, contest.id, user.id)`). Body:
  `{ template: 'confirmation' | 'reminder', copy: { subject?, intro? } }` validated by a per-template
  slice of `contestEmailCopySchema`. Renders the chosen template with **sample token values** derived from
  the real contest (title/slug/deadline) + placeholder username + the instance branding; returns
  `{ html, subject }`. Client shows it in a sandboxed iframe.
- **Test-send (optional, Phase 6b)**: `layers/base/server/api/contests/[slug]/email-test.post.ts` enqueues
  ONE message through the outbox to the requesting editor's own **verified** address, using the POSTed
  (unsaved) copy. Same gates; self-only (never an arbitrary recipient). Nice-to-have; ship core first.

## 5. Security requirements (checklist — all must hold)

1. Organizers supply **plain text only** (subject + intro) + a fixed token allow-list. **No raw HTML**,
   ever. All rendering goes through `escapeHtml` + the render kernel.
2. Token **values** are HTML-escaped in the HTML path (title/username are user-controlled).
3. System chrome is never removable: unsubscribe link, CTA button, deadline line, branded shell/footer.
4. Write-validation with `contestEmailCopySchema.strict()`; **re-validation on read** (`parseContestEmailCopy`).
5. Length caps: subject `max(200)`, intro `max(2000)` — bounds email size.
6. Preview + test-send routes re-validate the POSTed copy with the same schema and gate on `isContestEditor`
   (organizer-only, not merely authed).
7. `email_copy` must **not** leak in public/unauthenticated contest responses — it is organizer-only. The
   public serializer is **`toContestDetail` in `packages/server/src/contest/read.ts:104`**, which explicitly
   field-picks (SAFE — a new column will not leak; verified). Note `getContestBySlug` (`read.ts` ~:177) does
   `db.select()` = the whole row, so the guarantee rests entirely on `toContestDetail`'s explicit picking;
   the leak test (P5) targets `read.ts:104` and asserts no code path returns a raw `getContestBySlug` row.
8. No double token interpolation (value containing `{token}` not re-expanded) — proven by the single-pass
   `String.replace(fn)` and asserted in a test.
9. Test-send is self-only, verified-address-only, routed through the durable outbox (no direct send).

## 6. TDD test plan (Rule #11 — tests first, exercise the real output path)

Memory `feedback_integration_test_full_output_path`: assert the REAL enqueued outbox message, not a
same-algorithm re-derivation.

1. **Schema** (`packages/schema/src/__tests__/`): `contestEmailCopySchema` — accepts nested
   confirmation/reminder subject+intro; `.strict()` rejects unknown keys; trims; enforces max caps;
   all-optional; empty object valid.
2. **Token interpolation** (`packages/infra/src/email/__tests__/`): value escaping (`<script>` title →
   escaped in HTML); raw subject interpolation; unknown token left literal; no double interpolation;
   paragraph split+escape; **system chrome present when override applied** (unsubscribe href, CTA button,
   deadline line all still in the HTML); **defaults byte-unchanged when `copy` undefined**.
3. **Server** (`packages/server/src/**/__tests__/`): `parseContestEmailCopy` ({} on invalid / object on
   valid); `getContestEmailCopy` reads the column; `updateContest` persists `emailCopy` under editor auth;
   registration confirmation — override + flag ON uses custom subject/intro (assert enqueued message),
   flag OFF uses default, no override uses default; reminder sweep — same three cases.
4. **Routes** (`layers/base/server/api/__tests__/`): preview route — 403 for non-editor, renders sample
   HTML, re-validates body, flag-gated; PUT round-trips `emailCopy`; **public GET does not leak
   `emailCopy`**; test-send (if built) self-only + gated.
5. **Component** (`layers/base/components/__tests__/`): the Emails tab — renders both template forms,
   shows the token help, empty=default, debounced preview call fires, a11y via axe (labels, keyboard,
   no color-only state).

## 7. Build phases (ultracode workflow — TDD each phase, adversarial verify)

All on `contest-registration-reminders`. Each phase writes tests first, then implementation, then
verifies (typecheck + the phase's suite). Publish/roll only when explicitly asked.

- **P1 Schema**: `ContestEmailCopy` type + `contestEmailCopySchema` + `email_copy` column + field in
  create/update schemas + `db:generate` migration `0041`. Tests: schema validators.
- **P2 Infra**: token-interpolation helper + `copy?` param on the two templates. Tests: interpolation +
  defaults-unchanged.
- **P3 Server**: `emailCopy.ts` (parse/get) + `updateContest` guard + `registrations.ts`/`reminders.ts`
  application (flag-gated) + `emailCopy` in create insert. Tests: parse/get + both send paths x3 cases.
- **P4 Config**: `contestEmailEditor` flag (schema + types). Tests: config default OFF.
- **P5 Routes**: per-contest `email-preview.post.ts` (+ optional `email-test.post.ts`); confirm PUT/GET
  carry/withhold `emailCopy`. Tests: preview gate + render, PUT round-trip, GET no-leak.
- **P6 UI**: "Emails" body tab. `ContestBodyCanvas.vue` edits (multi-point, NOT just a button): add to the
  `BodyTab` union (:18) + the parent duplicate (`ContestEditor.vue:88`); add the `TABS` entry (:33-38); make
  `isBlockTab` (:40) exclude `'emails'` so the Write/Preview/Code toolbar (:94) does not render over the
  form; add a `v-else-if="activeTab === 'emails'"` panel branch with an `#emails` slot (:111-125); handle
  the palette-hide (`ContestEditor.vue:474`) + body-hint (:563) cases. Parent supplies the `#emails` form
  slot (Stages precedent, `ContestEditor.vue:544-561`) + wires `emailCopy` into `useContestEditor.ts`
  `buildPayload`/`hydrate`. 2-pane sandboxed-iframe preview, token help, debounce, a11y. Tests: component.
- **P7 Verify** (change medium — memory `feedback_verify_ui_visually_before_ship`): local app (docker
  :5433 + drizzle push + nuxt dev), flag ON, edit copy → register a test user → assert the **enqueued
  outbox row** carries the custom subject/html; a no-override contest sends the default; screenshot the
  editor + a rendered preview; run FULL `pnpm test` + typecheck before declaring done.

## 8. Roll plan (only when asked — do not roll by default)

Publish chain if/when rolling (touches schema + infra templates + server + layer): **schema → infra →
server → layer** (`pnpm publish:layer`), apply migration `0041` via `db-migrate.mjs`/`db:push` (memory
`feedback_use_deploy_migrations_not_ssh`), CLI re-pin, fork `package.json` 0.x caret hand-edits +
lockfiles (deveco npm gitignored / heatsync pnpm tracked). Flag ships **OFF**. Run full `pnpm test`
before publishing (memory `project_session_229_referral_links`). No AI attribution on any commit (Rule #15).

## 9. Risks / self-audit

- **`ContestBodyCanvas.vue` is unread** — the body-tab UI requires editing it (tab button + panel + palette
  gate). If that integration is heavier than the Stages precedent implies, fall back to the right-rail
  section + preview dialog (4.7 alternative) — same server/schema/infra work, only the UI host changes.
- **`emailCopy` leak** — the public serializer `toContestDetail` (`read.ts:104`) field-picks (verified
  safe); `types.ts:63-103` is only the interface. Explicit no-leak test in P5 targets `read.ts:104` and
  guards that no path returns a raw `getContestBySlug` (`read.ts` ~:177, `db.select()` = whole row).
- **Milestone token in the shared reminder** — `{timeRemaining}` is the only per-milestone value; ensure
  the preview picks a representative sample (e.g. "24 hours") so organizers understand it varies.
- **Empty-string vs absent** — treat empty-after-trim as "use default" (mirror branding `buildPayload`),
  so clearing a field reverts to the built-in copy rather than sending an empty subject/body.
- **Create-mode preview** has no slug; the Emails tab is edit-only, sidestepping this.

## 10. Open questions (none blocking — defaults chosen)

All kickoff design questions are resolved above with defaults. The only judgement call that reverses a
kickoff default is the **new feature flag** (4.6), justified by Rule #2. Test-send is scoped optional.
