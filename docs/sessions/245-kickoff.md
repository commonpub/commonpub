# Session 245 — kickoff

Two jobs, in order: **(A) roll the `postroll-hardening` batch to prod**, then **(B) upgrade the
Registration-tab editor UX** so it's a real side-by-side editor + live preview, not a preview-dominated
stack. Utmost care; adversarially verify; NEVER add AI attribution to any commit/PR (CLAUDE.md rule #15).
Re-verify state empirically before trusting docs — `npm view`, `curl /api/features`, read the code.

---

## A. Roll `postroll-hardening` (the delete-safety hardening batch)

**What it is:** 9 commits past `main` fixing what the post-roll deep audits found on the LIVE rich-registration
feature (P1–P6 shipped session 244 to commonpub.io + deveco). Contents:
- GDPR account-deletion purge of **private** file bytes only (`layers/base/server/utils/purgeUserFiles.ts` +
  the 2 delete routes). Public files deliberately left — their bytes serve at a DIRECT bucket URL that may be
  embedded in other content; purging would 404 live embeds. Private `/raw` is dead once the row cascades, so
  purging private bytes is safe.
- Orphaned-private-file **sweep** (`sweepOrphanedContestFiles` in `packages/server/src/contest/submissions.ts`
  + `layers/base/server/plugins/contest-file-sweep.ts`, hourly, **30-day grace**). Atomic single-statement
  `DELETE … WHERE id IN (SELECT … unreferenced-by-owner + age … LIMIT) RETURNING`, `lower(e.value)` case match,
  bytes purged only for rows actually deleted. **Triple-re-verified** it cannot destroy a legitimately-referenced
  file (invariant: `recordPrivateAndAgreements` is the sole private-fields writer, `validateFileFields` gates file
  ownership, so a legit reference's `user_id` is always the file's uploader).
- `canonicalUuid()` lowercasing of file refs on write (`validation.ts`) + case-normalized `validateFileFields`.
- Advisory-lock TOCTOU fix in all 3 entry-creation txns (`submitContestProposal`, `maybeCreateCombinedEntry`,
  `submitContestEntry`) — `pg_advisory_xact_lock` on (contest,user) + under-lock cap re-check.
- `deploy/docker-compose.prod.yml` dedicated `uploads_private_data` volume + `PRIVATE_UPLOAD_DIR`.

**State:** full suite **33/33**, reference typecheck clean, live prod bucket confidentiality verified (403 on both
instances). Final audit: 3 confirmed, ALL harmless nits (see "Open follow-ups").

**Roll steps (SIMPLE — server + layer only, NO migration, NO schema/config/infra change):**
1. Verify branch is green: `pnpm test`, `pnpm --filter @commonpub/reference... typecheck` via `apps/reference`.
2. Bump: `packages/server` 2.118.0 → **2.119.0**, `layers/base` 0.110.0 → **0.111.0**. (schema 0.61 / config 0.35 /
   infra 0.19 / test-utils 0.5.14 UNCHANGED — do not bump/republish.)
3. Build: `pnpm build`. Publish in order: `pnpm --filter @commonpub/server publish --no-git-checks --access public`
   then `pnpm publish:layer`. (workspace:* → exact pins automatically; layer 0.111 will pin server 2.119 + schema
   0.61 + config 0.35.) Verify with `npm view @commonpub/{server,layer} version` (mind [[feedback_npm_propagation_lag]]).
4. Commit the bumps, ff-merge `postroll-hardening` → `main`, `git push --no-verify origin main` (the pre-push
   typecheck hook times out Bash — [[project_session_240_stage_aware_deadlines]] LANDMINE — use `--no-verify`).
   commonpub.io deploys on push.
5. **deveco** (`../deveco-io`): bump the DIRECT pins `@commonpub/server` `^2.113`→**`^2.119`** + `@commonpub/layer`
   `^0.110`→**`^0.111`** (0.x caret won't cross a minor — hand-edit; [[feedback_caret_semver_0x_minor_bump]]).
   schema `^0.61` / config `^0.35` pins STAY (no schema change; a stale schema pin is harmless here since there's
   NO migration — [[feedback_fork_direct_schema_pin_gates_migration]] only bites when a migration ships). Regen
   `pnpm-lock.yaml` (`pnpm install --lockfile-only`); package-lock is gitignored (Docker regen). Commit + push.
6. **heatsync** (`../heatsynclabs-io`): STILL not rolled to the rich-registration versions (it's back at schema
   ^0.60 / layer ^0.109 — session 244 deferred it per operator). Decide with the operator whether session 245
   brings heatsync up to schema 0.61 + config 0.35 + server 2.119 + layer 0.111 (that WOULD need its schema pin
   bumped so `db-migrate` applies migrations 0044+0045; regen BOTH lockfiles — package-lock is tracked on heatsync)
   OR leaves it. Default: leave heatsync unless the operator says otherwise.
7. Verify: once deploys go green (`gh run list --workflow="Deploy Production"`), `curl /api/health` +
   `/api/features` on commonpub.io + deveco. No flag change expected (contestPrivateFiles already ON).
   Don't long-poll — check once, move on ([[feedback_no_long_deploy_poll_loops]]).

CI is red on `@commonpub/docs#test` — **pre-existing, env-specific, green locally (131/131)**, unrelated; deploy
runs independently of CI. Not a blocker.

---

## B. Registration-tab editor UX — a real editor alongside the preview

**The complaint:** the contest editor's **Registration tab** reads as "just a preview," not a proper editor.

**Current state (read these first):**
- `layers/base/components/contest/ContestEditor.vue` — the `#registration` template (~line 582) renders: a
  Registration-mode toggle (light/combined), then `.cpub-ce-reg-cols` = a CSS grid holding **`FormTemplateEditor`**
  (the field builder) + a **`ContestRegistrationForm … preview`** (read-only rendered form), then
  `ContestRegistrantsPanel` (edit mode). CSS: `.cpub-ce-reg-cols { grid-template-columns: 1fr }` and only at
  `@media (min-width: 900px)` becomes `3fr 2fr`.
- **Why it feels preview-only:** the contest editor is 3-column (220px block palette | center body | **340px settings
  rail**). The palette is hidden on the registration tab, but the 340px settings rail stays, so the center body is
  often < 900px → the grid **collapses to one column** (editor stacked ABOVE preview). Scrolling down shows the
  preview + registrants; the editor is off-screen above. Even at ≥900px the two panes are cramped and the preview
  isn't sticky.
- `FormTemplateEditor.vue` is a list of **field-config cards** (label input, type `<select>`, required checkbox,
  reorder ▲▼, delete, per-type extras). Functional but utilitarian — not a "designed" editor feel.

**CRITICAL constraint:** `FormTemplateEditor` is **SHARED** — also used by the **Stages tab** per-stage submission
templates (`layers/base/components/contest/ContestStageCard.vue:162`). Any change to it must NOT break the stages
usage. Prefer changing the Registration-tab LAYOUT (in `ContestEditor.vue`) + optional additive props over rewriting
`FormTemplateEditor` internals; if you polish the cards, verify BOTH tabs.

**Goal — think it through, then propose before building:** make the Registration tab a genuine two-pane builder:
- A robust **side-by-side** editor (left, scrollable) + **live preview** (right, ideally sticky) that does NOT
  collapse to preview-dominated. Likely needs the registration tab to reclaim width — e.g. this tab spans the full
  center (it already hides the palette) and either de-emphasizes / collapses the settings rail for this tab, or
  moves the mode toggle + form builder into a dedicated wide two-pane layout with its own breakpoint tuned to the
  actual available width (not a naive 900px).
- Make the editor feel like an editor: clearer field cards, a prominent "add field" affordance (the field-type
  presets already exist — `availableFieldPresets`/`fieldPresets`), and — the high-value UX win — **link editor ↔
  preview** (click a field in the preview → focus/scroll its editor card, and vice-versa). See
  [[feedback_visual_editor_ux_patterns]] + the P4 form-editor overhaul (session ~160) for the established patterns.
- Keep it headless/theme-driven: `var(--*)` only, `cpub-` prefix, sharp corners / 2px borders, JetBrains Mono
  labels, WCAG 2.1 AA, keep the existing aria-live reorder + keyboard nav.

**Verify (standing rule — [[feedback_verify_ui_visually_before_ship]] + [[feedback_local_browser_acceptance_before_deploy]]):**
run the reference app locally (docker :5433 + drizzle push + nuxt dev; recipe in [[reference_local_run_and_visual_verify]]),
open a contest's `/contests/<slug>/edit` → Registration tab, and screenshot the new layout at desktop AND true 390px
mobile before shipping. contestPrivateFiles/contestPii are ON on the reference (`apps/reference/commonpub.config.ts`).

---

## Open follow-ups (non-blocking; from the final audit + earlier)
- **[nit] sweep unindexed scan:** `sweepOrphanedContestFiles` scans `files WHERE purpose='contest' AND
  visibility='private'` with no supporting index (only uploader/content/hub indexes exist). Hourly + `LIMIT 200`, so
  cheap now, but a partial index `ON files(created_at) WHERE purpose='contest' AND visibility='private'` (a migration)
  would future-proof it. Bundle with any next migration.
- **[minor] advisory-lock keyspace:** the 3 entry-creation locks use single-arg `pg_advisory_xact_lock(hashtext(
  'contest-entry:'||contest||':'||user))` → one 2³² space; a hash collision only causes two unrelated (contest,user)
  pairs to briefly serialize (harmless, no incorrectness). Trivial hardening: two-arg `pg_advisory_xact_lock(
  hashtext(contestId), hashtext(userId))` → 2⁶⁴ space.
- **[nit] purge sequential deletes:** `deleteUserPrivateFileBytes` awaits `deletePrivate` one key at a time inline
  on the delete request. N is tiny (private contest files per user), but `Promise.all` (bounded) would speed a
  heavy account. Low priority.
- **[minor, pre-existing] `contests.entryCount` inflates on cascade delete** — denormalized counter, no cascade-side
  decrement (account/content deletion cascades `contest_entries` but runs no app code). Public display + metrics read
  it. Fix needs a DB trigger on `contest_entries` AFTER DELETE, or a periodic recompute. Not data loss.
- **combined auto-entry cleanup on unregister** — `unregisterForContest` doesn't remove the combined-mode
  auto-created draft entry (+ its entryCount). Nit.
- **heatsync** version parity (see roll step 6).

Detail on everything: `docs/sessions/244-p6-audit-and-browser-verification.md`.
