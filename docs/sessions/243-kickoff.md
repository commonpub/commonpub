# Session 243 — Kickoff prompt

Paste the block below into a fresh context session.

---

ultracode — This session's PRIORITY is implementing the **rich contest registration forms** plan with
**utmost care**, then continuing the backlog. Production is LIVE on 3 instances (commonpub.io, deveco.io,
heatsynclabs.io) — treat every roll as a real, hard-to-reverse event.

**START HERE (make no assumptions — the docs LAG reality, RE-VERIFY):**
1. Read `docs/sessions/242-handoff.md` (full state), then
   `docs/plans/rich-contest-registration-forms.md` — **read its §0 (Audit corrections) FIRST**; §0
   supersedes §4–§13 and has the revised phase order (P0→P6). An adversarial audit already found 2 blockers
   + 10 majors in the original plan; §0 fixes them. Do NOT implement the pre-§0 prose where it conflicts.
2. Re-verify the baseline empirically: `npm view @commonpub/<pkg> version` for server/layer/protocol/
   editor/ui/infra; `curl https://<instance>/api/health` + `/api/features` on all 3; latest migration in
   `packages/schema/migrations/`; `git status` in commonpub + both forks (`../deveco-io`,
   `../heatsynclabs-io`). Verified-as-of-handoff (RE-VERIFY): server **2.117.1** / layer **0.107.2** /
   protocol **0.15.1** / editor **0.14.0** / ui **0.13.3** / infra 0.17.0 / schema 0.59 / config 0.33 /
   auth 0.11 / docs 0.6.3; migration **0042**; 37 flags; all healthy; all trees clean; commonpub HEAD
   `6fb5232a`. **0 AI attribution** in commits — keep it that way (CLAUDE.md rule #15 overrides the default
   Co-Authored-By trailer; NEVER add AI attribution, any repo).

**The task — rich, operator-definable contest registration forms + a nicer form editor.**
Reference target: the Resilient America Preparedness Challenge form
(https://resilientamericapreparedness.lovable.app/) — a richly-sectioned intake (track, name/email,
country, org, project URL, repeatable team, shipping address, many legal-consent clusters, signature).
Operator decisions already made: **operator-chooses-per-contest** (light registration + separate entry
vs a single combined intake form); **add all new field types** (section headers, repeatable team group,
file upload, signature, radio, phone) on top of the existing 10; the operator builds it all from an
**easy, readable, editable** UI. The key architectural finding: CommonPub ALREADY has the full
operator-definable rich-field system — it's wired to entry submissions, not registration — so this is
mostly *lift + extend*, not greenfield (`ContestSubmissionTemplateField`, `ContestSubmissionField.vue`,
`validateSubmissionFields`, `ContestStageTemplateEditor.vue`, PII/agreement partition, presets).

**Implement in the plan's §0 revised phases, one at a time, each behind a feature flag:**
- **P0** — private-storage prerequisite (non-public ACL/signed-URL path + auth+`contest.pii`-gated
  file-serving route + a `contest` upload purpose). REQUIRED before any file/signature field — today's
  only upload path is public-read (a false-privacy blocker).
- **P1** — schema + types + migration 0043 (`registrationTemplate` + `registrationMode` columns; widen
  `contest_registrations.fields` + update the 5 enumerated typecheck sites; `contest_registration_private_fields`;
  generalize `contest_agreement_acceptances` incl. `stage_id` nullable + one-of CHECK + dedup UNIQUE; add
  `section`/`radio`/`tel` types + a `radio` options-refine). NOT group/file/signature yet.
- **P2** — server (swap `contestRegisterSchema.fields` to an open bounded record so rich answers aren't
  stripped; route registration through `validateSubmissionFields`; write record+private+agreements in ONE
  `db.transaction`; DB-backed file post-validation after P0).
- **P3** — renderer + `ContestRegistrationForm` (section/radio/tel; live preview).
- **P4** — editor UX (extract a shared `FormTemplateEditor` from `ContestStageTemplateEditor`; collapsible
  field cards; **keyboard up/down reorder as PRIMARY**, `@vue-dnd-kit` pointer-DnD optional + reuse the
  `useLayoutAnnouncer` a11y pattern; sections; grouped type picker; extend `TEMPLATE_FIELD_TYPE_LABEL`).
- **P5** — combined mode (auth-only; reuse `submitContestProposal`'s placeholder-content → contentId → entry;
  define `upcoming` vs `active`+proposal-stage behavior; maxEntriesPerUser race decision) + admin registrants
  list/export + the "comprehensive intake" preset matching the reference form.
- **P6 (later)** — file/signature fields (after P0) and `group` (its own nested-model phase — a whole-stack
  `Record<string,string>`→`Record<string, string | GroupRow[]>` change; do NOT bundle it as a switch-case add).

**Discipline (non-negotiable, per the proven loop):**
- Re-verify before trusting any doc/memory (`curl /api/features` before any flag claim, etc.).
- TDD where practical; follow CLAUDE.md (feature flags, `var(--*)` only, `cpub-` prefix, a11y AA, explicit
  return types, no `any`).
- Per phase: implement → **full package suite + `cd apps/reference && pnpm typecheck`** (the layer gate — the
  layer has no local typecheck; a layer type error otherwise ships via esbuild; macOS has NO `timeout` binary
  — run typecheck directly or it false-negatives) → **adversarial audit workflow** over the change (skeptics
  default-refute, read real code; it caught real regressions in 4 of ~6 batches this arc) → apply findings →
  roll the exact-pin chain → background deploy-wait + `/api/health`.
- Adversarially verify every finding against actual code. Log the session in `docs/sessions/`.

**Roll landmines (reconfirmed):** layer pins deps EXACT at publish → republish leaf→server→layer; forks
deploy via Docker `npm install` cache-keyed on package.json → bump each fork's `@commonpub/layer` caret pin
(hand-edit; `^0.x` won't cross a minor) AND sync its tracked lockfile (deveco `pnpm-lock` — its CI
frozen-installs for `nuxt typecheck`; heatsync `package-lock` — COPYed by its Dockerfile); verify NESTED dep
resolution not just top-level; `git push --no-verify` (pre-push typecheck times out Bash); migration via
`scripts/db-migrate.mjs` (drizzle-kit push needs a TTY); `nuxt dev` networkidle never settles (Playwright
`domcontentloaded`); browser MCP can't narrow viewport (Playwright `newContext({viewport})`); verify UI
visually at true mobile width before shipping.

**Operator decisions to surface (don't decide unilaterally):** the plan's §0/§15 open sub-decisions
(combined-mode entry status; signature storage format; file mime/size limits; ship the exact reference form
as a preset?); and the build-pipeline items in `docs/reviews/build-pipeline-findings-2026-07-17.md` — CI's
`check` job is RED at the Lint step (pre-existing `@eslint/js ^10.0.1` fallout, typecheck passes) and
`deploy.yml` doesn't gate on it: pick the eslint-10 strategy → green lint → `deploy.yml needs: check`.

**Backlog after the registration feature:** schema FK migration #19/#20 (`federated_hub_post_replies.parent_id`
self-FK + `conversations` sweep, latent P3, needs a migration); a real `TableBlock.vue` (the editor `table`
block validates/renders but isn't canvas-editable); §2b(ii) storage policy (operator); a dedicated PII/GDPR
pass. Referral autojoin is RESOLVED (no change — private-hub block is intended).

Start by reading the handoff + plan §0, re-verify the baseline, then begin P0 (or confirm P0 scope with the
operator, since it touches storage/privacy). Fan out ultracode workflows for understanding/design/audit at
each phase; implement with utmost care.
