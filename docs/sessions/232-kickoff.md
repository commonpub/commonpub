# Session 232 Kickoff — per-contest email-template editing UI (explore + plan)

## The ask

Contest organizers need a UI **in the contest editor** to edit the copy of the two contest emails
per-contest: the **registration confirmation** and the **deadline reminder**. Today that copy is
hardcoded, instance-global, in `packages/infra/src/email/templates.ts` — a Qualcomm partner wants to
supply their own wording, and right now that means a code change. Give them an editor with a
per-contest override that falls back to the built-in default when unset.

**This session is EXPLORE + PLAN first.** Read the rules and the prior handoff, study the four existing
patterns below, then write a plan to `docs/plans/contest-email-template-editor.md` (UI/UX + security +
storage + integration + test strategy). Only start building after the plan holds up to an audit.

## Read first
1. `CLAUDE.md` (standing rules — esp. #2 no feature without a flag, #3 `var(--*)` only, #11 TDD, #15
   NEVER add AI attribution to commits; also: no em dashes in user-facing copy).
2. `docs/sessions/231-handoff.md` — the bottom section documents the just-shipped contest registration +
   reminders + confirmation/reminder templates (branch `contest-registration-reminders`, commit
   `faa5bb3f`). **This session builds ON that branch** (or a branch off it), because it edits the same
   two templates it introduced. Do NOT re-plan registration/reminders — they're done.
3. This file.

Then `curl https://<instance>/api/features` before ANY flag/enabled claim (memory:
`feedback_verify_flag_state`, `project_email_flag_state_2026_07` — deveco has email ON, console sink;
commonpub/heatsync OFF). Bring the app up locally and verify visually before shipping (memory:
`feedback_verify_ui_visually_before_ship`, `reference_local_run_and_visual_verify`).

## Four existing patterns to mirror (do not reinvent)

1. **Live-preview editor UX** — `layers/base/pages/admin/email-templates.vue` (misnamed: it edits
   *branding*, not copy). Debounced (400ms) `POST /api/admin/email-preview` renders the email
   server-side with the UNSAVED values; "empty field = built-in default". Copy this UX shape for the
   per-contest editor (preview pane + debounce + empty-means-default).
2. **Safe organizer-supplied copy** — `layers/base/pages/admin/broadcast.vue` + `packages/server/src/
   comms/broadcast.ts` + `emailTemplates.broadcast` (templates.ts:165). Organizer supplies PLAIN TEXT;
   the server escapes it into paragraphs and appends a system-owned CTA button. **This is the security
   model** — organizers get plain text + a fixed token set, NEVER raw HTML (XSS + email-client
   breakage). Load-bearing.
3. **Per-scope override with default fallback** — `packages/server/src/comms/branding.ts`
   (`getEmailBranding` reads an instance setting, re-validates with the write-side Zod schema, returns
   `{}` → each template field falls back to its default). Mirror this for per-contest copy:
   `getContestEmailCopy(db, contestId)` → validated override or empty.
4. **Contest editor shell** — `layers/base/components/contest/ContestEditor.vue` (3-panel
   `cpub-ce-shell`; body tabs overview/rules/prizes/stages at ~L88; **right-rail collapsible sections**
   at ~L268 grouping Access/People/Danger). The new editor lands as a right-rail "Communications"
   section OR a dedicated body tab — decide with a mockup (see UI question below). Save route must gate
   on `isContestEditor` (`packages/server/src/contest/stakeholders.ts`).

## Design questions to resolve in the plan (with my recommended defaults)

- **Storage** → additive JSONB column on `contests` (e.g. `email_copy jsonb`), NOT a new table (only
  two small templates; matches branding-as-setting). Zod-validated on write. Migration via
  `pnpm --filter @commonpub/schema db:generate` (never hand-write SQL). Additive-only.
- **Editable surface** → per template: **subject** + **intro body (plain text, tokenized)**. Keep the
  deadline line, CTA button, and **unsubscribe link** as SYSTEM-owned chrome (do not let an organizer
  delete the unsubscribe link — deliverability/legal). One reminder template shared across the 4
  milestones; `{timeRemaining}` differentiates them.
- **Tokens** → a fixed, documented allow-list interpolated server-side with **HTML-escaped** values:
  `{contestTitle}`, `{deadline}`, `{username}`, `{timeRemaining}`, `{contestUrl}`. Show the organizer
  the available tokens inline; ignore unknown tokens. NO raw HTML.
- **Templates.ts integration** → grow `contestRegistrationConfirmation` / `contestDeadlineReminder`
  with an optional `copy?: { subject?; intro? }` param; when present, use the tokenized override; else
  the current default. `registrations.ts` + `reminders.ts` load the override via `getContestEmailCopy`
  and pass it through. Keep the existing tests green (defaults unchanged when no override).
- **Preview + test-send** → reuse the email-preview endpoint pattern (a per-contest variant, or
  generalize the existing one) so the organizer sees the rendered mail with sample token values; a
  "send test to me" that routes through the outbox to the editor's own verified address is a nice-to-have.
- **Feature flag** → decide whether this rides the existing `contestReminders`/`contests` flags or gets
  its own. Recommend: no new flag — editing copy is inert unless emails are enabled, so gate the UI
  section on `contests` and let the send-side flags do the rest. Confirm against rule #2.
- **UI home** → mock BOTH (right-rail "Communications" section vs. dedicated "Emails" body tab) and pick
  by whether the preview needs the width. a11y: `var(--*)` only, keyboard-navigable, labeled, no
  color-only state, no em dashes in the sample copy.

## Working method (matches this project's cadence)
- **ultrathink** the exploration/plan; **ultracode** (Workflow) the build if it fans out (audit → TDD
  implement → adversarial verify → synthesize). Scale to the task.
- **TDD** (rule #11): tests first — token interpolation (escaping + unknown-token handling), override
  fallback, `isContestEditor` gate, and a component test of the editor. Tests must exercise the real
  output path, not a cosmetic assertion (memory: `feedback_integration_test_full_output_path`).
- Save the plan to `docs/plans/contest-email-template-editor.md` and give the path (memory:
  `feedback_save_plans_as_files`).
- Roll only when asked. If/when rolling: schema → server → layer (branding/copy touches
  `@commonpub/schema` + `@commonpub/infra` templates + `@commonpub/server`), then layer. No AI
  attribution on any commit.

## Definition of done for the FEATURE (not this planning session)
Organizer opens a contest → Communications/Emails editor → edits confirmation + reminder subject/intro
with live preview → saves → a real registration/reminder send uses the custom copy, and a contest with
no override still sends the built-in default. Verified with a local app run + a real enqueue, not just
green units.
