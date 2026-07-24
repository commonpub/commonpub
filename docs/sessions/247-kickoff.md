# Session 247 — kickoff: make the contest system fully work (end-to-end) + markdown import + fix the broken save + P1 security

Read this FIRST. **Standing rules:** utmost care; adversarially verify; **NEVER add AI attribution to any
commit/PR** (CLAUDE.md rule #15); **verify state empirically** (`npm view`, `curl /api/features`, read the
code — don't trust docs/memory blindly); **local browser acceptance before deploy** (run the app, drive the
real flow, screenshot desktop + true 390px, deploy only at 100%). Run the app on a **trusted port (3001, not
3100 / not 127.0.0.1)** or login CSRF-403s. macOS has no `timeout` binary.

## The mission

Make the **contest system fully work — every aspect** — and support **markdown import for registration
forms**, plus land the contest work we planned. Concretely, in priority order:

1. **P0 — reproduce + fix the reported "save button broken."** (See §1. I could NOT reproduce it; get the
   exact repro or test every save surface.)
2. **P0 — verify the WHOLE contest system end-to-end** (create → edit every tab → stages/submission forms →
   registration [light + combined] → markdown import → entry submission [attach + proposal] → judging →
   surfacing [registrants/entries/consent/export]) and fix whatever's broken. There is a large **uncommitted
   local changeset** (§2) that is unverified end-to-end.
3. **P1 — the markdown importer is solid + polished** (§3) — verify round-trips + the jinger example + UX.
4. **P1 — the 4 live security blockers** from the audit (§4) — these gate production.
5. **P2 — the planned contest unification work** (§5) — registration↔entry form unification, group/team
   field, surfacing fixes. Plans are written; build the confirmed slices.
6. **Then roll** the whole verified changeset (§6).

## State (verify before trusting)

- **Layer 0.113 is LIVE on all 3** (session 246 editor polish). Baseline (verified 2026-07-24):
  server 2.119 / schema 0.61 / config 0.35 / layer 0.113 / infra 0.19, **migration 0045**, **38 flags**.
- **Everything below layer 0.113 is UNCOMMITTED/local** (kept local to iterate; NOT shipped). `git status`
  shows it. All unit tests pass (421 layer + 15 parser + reference typecheck 0) but it is **not verified
  end-to-end in a browser** and **not rolled**.
- A demo contest exists locally: **`resilient-america-preparedness-challenge-2`** = the "jinger" reference
  form (41 fields, 13 sections) rebuilt via the markdown importer. Admin login: `s246admin` /
  `testpass1234` (email in `/tmp/s246-email.txt`; it's an admin).

## 1. The "save button broken" report (P0 — start here)

The operator reports a broken save button. **I could not reproduce it:**
- Contest EDITOR topbar save (`.cpub-ce-topbar-btn-primary` → `onSave` → PUT `/api/contests/[slug]`): works
  (PUT 200, button → "Saved") on the jinger contest.
- Register-PAGE participant save (`.cpub-regform-save` "Complete registration"): enables + works when the
  required field is filled (my first "disabled" reading was a test artifact — filled the wrong input).

**Do:** get the exact repro from the operator (which button, which contest, which tab/state, create vs edit),
OR systematically drive EVERY save surface: editor topbar Save (create + edit modes, each tab), the
`ContestRegistrationForm` Save/Register button in all three placements (sidebar modal, `/register` page,
full-participant "edit details"), the markdown **Import** button, the stage **submission** form
(`ContestStageSubmission`/`ContestProposalForm`), the email editor test-send, and the criteria/prizes rail.
Suspects given recent churn: the `ContestSignup.vue` rewrite (modal now closes only on `isFull` success — a
regression there would look like "save does nothing"), the `register.vue` page, `FormTemplateEditor` markdown
panel. Files: `layers/base/components/contest/ContestEditor.vue` (save at :259/:451; save logic in
`composables/useContestEditor.ts` — `save`/`canSubmit`/`buildPayload`), `ContestSignup.vue`,
`ContestRegistrationForm.vue`, `pages/contests/[slug]/register.vue`.

## 2. The uncommitted changeset to verify (contest system)

Modified: `ContestEditor.vue`, `ContestSignup.vue`, `ContestRegistrantsPanel.vue`, `ContestStageCard.vue`,
`ContestAdvancementPanel.vue`, `FormTemplateEditor.vue`, `utils/contestRegistration.ts`,
`packages/server/src/contest/{export,registrations,types}.ts`. New: `pages/contests/[slug]/register.vue`,
`utils/registrationMarkdown.ts` (+ tests), `utils/__tests__/contestRegistration.test.ts`.

What each adds — verify each works end-to-end in a browser:
- **Register UX** — rich forms (sections/address/file/signature/2+ agreements/>5 fields) open the dedicated
  `/contests/[slug]/register` page; short-but-required forms open a focus-trapped modal; the bare default is
  one-click. Heuristic: `isRichRegistrationForm`. **Confirm all three paths + that the modal preserves typed
  data on a server-400 (it closes only on confirmed success).**
- **Markdown import** — §3.
- **Consent surfacing** — `ContestRegistrantsPanel` shows a "Consents X/N" column + CSV `Consents` column
  (organizer-visible, not PII). Server-package change → needs a build + roll to actually ship.
- **CSS cleanup** — deleted 3 now-redundant `.cpub-form-input` scoped copies (global forms.css covers them).

## 3. Markdown import for registration forms (verify solid)

`layers/base/utils/registrationMarkdown.ts` — `registrationMarkdownToTemplate` / `templateToRegistrationMarkdown`.
DSL doc: `docs/reference/registration-markdown.md`. UI: the **"Markdown" button** in `FormTemplateEditor.vue`
(gated `enableMarkdown`, wired on the registration tab in `ContestEditor.vue`) opens a panel with a textarea +
Import (replace) + "Load current form" (export). 15 unit tests incl. adversarial round-trip cases (labels with
`:`/`*`/`()`, unicode, key-dedup hang, multi-MIME accept, tabs). **Verify:** paste
`docs/reference/examples/jinger-registration-form.md` → Import → rebuilds 41 fields; export→edit→import
round-trips; the Import button and error display are pleasant. Consider: should markdown import also be on the
**stage submission** editor (currently registration-only)?

## 4. The 4 P1 security blockers (production gate)

From `docs/reviews/production-readiness-audit-2026-07-23.md` (adversarially confirmed). Fix these before any
prod promotion — one shared http(s)-only URL helper covers two of them:
1. **Ban/suspend bypass** — no login path checks `users.status`; suspended users re-authenticate. Enforce
   `status==='active'` in `middleware/auth.ts` enrichUser + at login (`sign-in-username.post.ts` + Better Auth
   before-hook); make `updateUserStatus('deleted')` set `deletedAt` (`admin/admin.ts:363`).
2. **Stored XSS (root)** — `optionalUrl()` (`schema/validators/_shared.ts:4`) + bare `z.string().url()`
   (video.ts, hub.ts) accept `javascript:`/`data:` → XSS on rendered profile/hub `:href`. Add a scheme
   allowlist refine (http/https only).
3. **Stored XSS (hub resources)** — `HubResources.vue:121` `:href` no scheme guard; federated sync
   (`hubMirroring.ts:1548`) stores remote value unvalidated. Guard both + product URLs.
4. **Entrant-PII horizontal-privilege leak** — `contests/[slug]/entries/[entryId]/private.get.ts:33` checks
   instance-wide `contest.pii`, not per-contest. Add the per-contest `canManage` check the registrants routes
   use.

(These are broader than "contest system" but #4 is contest, and the operator asked for production readiness.
Batch-2 P2s in the report: non-atomic multi-writes, counter mis-targets, ingestion caps — fast-follow.)

## 5. The planned contest unification (P2 — plans written, build the confirmed slices)

- **`docs/plans/unify-registration-and-entry-forms.md`** — registration + stage-entry are two parallel intakes
  over ONE shared form engine; combined mode creates an **empty entry stub** and never flows the answers in.
  **Decision already made:** in combined mode the **entry is the single source of truth** — route combined
  "Register" through the proposal path so one form serves both, with a `submissionSource: 'own' | 'registration'`
  stage link. P1 (consent surfacing) is done; P2 (the flow rework, schema + server + UI) is the next build.
- **`docs/plans/team-registration-and-collaborative-content.md`** — the repeatable `group` field + real
  multi-person content ownership (`content_collaborators`). Held for review; keystone is Phase B (co-ownership
  authz), a security-sensitive change.
- **`docs/plans/registration-data-surfacing.md`** — address-as-columns, file/signature download links, a
  shipping-only export. P1 there (consent surfacing) shipped; A/B (address columns + downloads) are next.

## 6. Verify + roll

The changeset spans **layer + server** (server `contest/{registrations,export,types}.ts`), so a roll is NOT
layer-only: it's **schema? no. config? no. server yes + layer yes.** Sequence when verified 100%: build+publish
`@commonpub/server` (bump 2.119→2.120) then `@commonpub/layer` (0.113→0.114); ff-merge main → commonpub.io;
bump deveco + heatsync pins (`@commonpub/server` + `@commonpub/layer`, 0.x caret won't auto-cross — hand-edit)
+ reconcile BOTH lockfiles in each (`npm install --package-lock-only` + `pnpm install --lockfile-only`); push
with `git push --no-verify` (pre-push typecheck hook times out Bash). NO migration. Confirm published on npm
before bumping consumers.

## Landmines (recent, verified)

- **Login CSRF:** dev trustedOrigins = `siteUrl` + `localhost:3000–3005` only. Run on **3001**; `127.0.0.1`
  or `:3100` → "Invalid origin" 403 on `/api/auth/sign-in-username` (the browser login wrapper).
- **vue-tsc strict vs vitest:** vitest (esbuild) misses type errors that `apps/reference` `nuxi typecheck`
  (the gate) catches — always run the reference typecheck before claiming green. (It caught 2 latent errors
  this session that vitest passed.)
- **Theme CSS:** edit `packages/ui/theme/` (NOT gitignored `layers/base/theme/`); to SEE it locally run
  `node layers/base/scripts/bundle-theme.mjs` (dev reads the bundled copy).
- **Contest-dir auto-import:** a new `components/contest/Foo.vue` NOT starting with "Contest" needs an
  explicit import (bare tag renders empty).
- **Layer 0.x caret** won't cross a minor — hand-edit consumer pins. **Dual lockfiles** in both deveco AND
  heatsync (both now git-track package-lock + pnpm-lock).
- **`address`/`file`/`signature`/`agreement`/`group`** field types are PII/consent-gated (`contestPii` +
  `contestPrivateFiles`, both ON on the reference `apps/reference/commonpub.config.ts`). `group` (repeatable)
  is NOT implemented yet (a value-model change — see the teams plan).
