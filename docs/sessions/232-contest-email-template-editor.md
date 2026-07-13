# Session 232 — Per-contest email-template editor (explore → plan → build)

Date: 2026-07-12. Branch **`contest-registration-reminders`** (stacked on session 231's registration +
reminders work, commit `faa5bb3f`; NOT pushed / rolled). Plan: `docs/plans/contest-email-template-editor.md`.

## What was asked

Contest organizers need an in-editor UI to customize, per contest, the copy of the two participation
emails (registration confirmation + deadline reminder) that were hardcoded, instance-global, in
`templates.ts`. A Qualcomm partner wants their own wording without a code change. Explore + plan first,
then build (ultracode).

## What shipped (all TDD, tests-first)

Override-with-fallback, mirroring `getEmailBranding`; organizers get subject + plain-text intro + a fixed
token allow-list only (never HTML); all other chrome stays system-owned.

- **P1 schema** — `ContestEmailCopy` interface + `email_copy jsonb` column on `contests`
  (`packages/schema/src/contest.ts`); `contestEmailCopySchema`/`contestEmailPreviewSchema` + `emailCopy`
  on create/update contest schemas (`validators/contest.ts`); **migration `0041_rapid_catseye.sql`**
  (additive `ALTER TABLE ... ADD COLUMN email_copy jsonb`, generated via `db:generate`).
- **P2 infra** — `interpolateTokens` + `escapedParagraphsWithTokens` in the email render kernel
  (`render.ts`); optional `copy?` param on `contestRegistrationConfirmation` / `contestDeadlineReminder`.
  Tokenizer runs ONLY on the override branch, so defaults are byte-unchanged; token values are
  HTML-escaped in the HTML body, raw in the subject; unknown tokens left literal; no double interpolation.
- **P3 server** — `contest/emailCopy.ts` (`parseContestEmailCopy` re-validates on read; `getContestEmailCopy`);
  `updateContest`/`createContest` carry `emailCopy`; `registrations.ts` + `reminders.ts` apply the override
  ONLY when `contestEmailEditor` is on (flag is a true kill-switch). Public DTO `toContestDetail`
  (`read.ts:104`) field-picks, so `email_copy` never leaks (tested).
- **P4 config** — new flag **`contestEmailEditor`** (default OFF), registered in config schema/types +
  mockConfig + nuxt.config + useFeatures + admin features.vue. (Overrode the kickoff's "no new flag" per
  CLAUDE.md Rule #2 — no feature without a flag; also gives operators an independent kill-switch.)
- **P5 routes** — `POST /api/contests/:slug/email-preview` (live preview, sample tokens) + `GET
  /api/contests/:slug/email-copy` (organizer-only load, since the public DTO omits it). Both gated on
  `contests` + `contestEmailEditor` + owner/`contest.manage`/`isContestEditor`. Save rides the existing
  contest PUT.
- **P6 UI** — new **"Emails" body tab** (edit-only, feature-gated) in the contest editor: two-pane
  `ContestEmailEditor.vue` (form + 400ms-debounced sandboxed-iframe preview, token help, empty=default),
  wired through `ContestBodyCanvas.vue` (new `showEmails` prop + `#emails` slot + `isBlockTab` fix) and
  `useContestEditor.ts` (`emailCopy` form + `emailCopyLoaded` guard so a save that never opened the tab
  can't clobber stored copy + `setEmailCopy`).

## Verified

Typecheck clean: schema, config, infra, server, **reference (vue-tsc strict)**. Tests: schema 516, config
29, infra 167, **server 1682** (incl. new real-Postgres enqueue tests asserting the actual outbox message
subject/html for both send paths x flag-on/off/no-override + the no-leak DTO test), **layer 1483** (route
contract + component test incl. v-model, preview, per-template tokens, axe). No regressions.

## Key decisions / landmines

- **New flag over kickoff's "no new flag"** — Rule #2 is a hard standing override; a dedicated flag is the
  certain, reversible call and a real kill-switch (flag off ⇒ every send reverts to default copy even if a
  stored override exists, because application is gated, not just the UI).
- **Public DTO never carries `email_copy`** — the editor loads it via a dedicated organizer-gated GET, not
  by augmenting `ContestDetail`; keeps the leak surface at zero. `getContestBySlug` selects the whole row,
  so the guarantee rests entirely on `toContestDetail`'s explicit field-pick (tested).
- **`emailCopyLoaded` guard** — the whole-contest save omits `emailCopy` until the tab has fetched it, so
  editing other fields (or an autosave) can't overwrite stored copy with an empty override.
- **Body-tab is multi-point** — the audit caught that `ContestBodyCanvas.vue:40` `isBlockTab` drives the
  Write/Preview/Code toolbar; an Emails form tab had to exclude itself there too, plus a `v-else-if` panel
  branch + palette/hint gating, not just a button.
- **Cross-package barrels** — a new server export must be added to BOTH `contest/index.ts` AND the
  top-level `server/index.ts` named re-export block; a new flag touches 5+ files. Rebuild upstream dist
  (schema/config/infra/server) before the consumer typechecks.

## Deep audit (post-build) — 3 independent reviewers + live browser verify

Commit `3398feae` was audited by three parallel reviewers (correctness/security, cruft/conventions/a11y,
regression/roll-readiness). **No P0/P1.** Confirmed: token values HTML-escaped (no injection), no double
interpolation, `__proto__`/`constructor` token names left literal via the `hasOwnProperty` guard, byte-
identical default template output, all three routes gated (`contests` + `contestEmailEditor` + owner/
`contest.manage`/`isContestEditor`), `email_copy` never in the public DTO, true kill-switch on the send
paths, `emailCopyLoaded` prevents clobbering, additive lock-safe migration, flag registered at all sites.

Audit polish applied (commit `a96197d3`, no behavior change):
- a11y: the Emails template selector was a broken `radiogroup` (role=radio, no arrow-key/roving-tabindex)
  → `role="group"` + `aria-pressed` toggle buttons (matches the body-mode switcher).
- **Fixed a latent `vue-tsc` error in the component test** (TS7053 on the emitted-event index) that
  esbuild/vitest didn't flag but the strict reference typecheck (CI) does — it would have failed CI.
- Dropped 3 unused type exports (`ContestEmailCopyInput` dup of the interface, `ContestEmailTemplateKey`,
  `ContestEmailPreviewInput`).

Informational (no action): subject header-injection is non-exploitable (nodemailer/Resend sanitize; the
default subject already interpolates `contest.title` raw — pre-existing); the *write* path isn't flag-
gated, only *apply* is (intended kill-switch-on-apply — flipping the flag ON later activates any stored
copy); `background:#fff` on the preview iframe is a matched exception (mirrors the branding editor).

Re-verified after polish: schema/server/reference typecheck clean; layer 1483 pass; component test green.

## Not done / next

- **Live browser run** (docker :5433 + `db:push` for `email_copy` + nuxt dev + enable `contestEmailEditor`
  + create a contest → Emails tab → edit → save → real send) — the pre-roll visual gate (memory
  `feedback_verify_ui_visually_before_ship`). Recommended before rolling.
- **Optional test-send** ("send test to me") — scoped out to keep the core tight; a small follow-up.
- **Roll** — only when asked. Chain: schema → infra → server → layer (`pnpm publish:layer`), apply mig
  `0041` via `db-migrate.mjs`, CLI re-pin, fork pins + lockfiles. Flag OFF. No AI attribution (Rule #15).
