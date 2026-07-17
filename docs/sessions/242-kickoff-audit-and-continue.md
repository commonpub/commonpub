# Session 242 — Kickoff: audit the live state, then continue the backlog

_Paste the block below into a fresh `ultracode` session. It is self-contained; it assumes no memory
of session 241 beyond what's on disk (this file, `241-handoff.md`, `docs/reviews/full-review-2026-07-17.md`,
`docs/reference/codebase-analysis.md`, and auto-loaded MEMORY.md)._

---

ultracode — This is an AUDIT-AND-CONTINUE session on CommonPub. Two phases: (1) adversarially audit the
LIVE state to confirm the session-241 hardening holds with no regression, then (2) continue clearing the
review backlog. Roll fixes only after the gate + an audit pass. Production is LIVE on 3 instances
(commonpub.io, deveco.io, heatsynclabs.io) — treat every roll as a real, hard-to-reverse event.

## Discipline (non-negotiable)
- MAKE NO ASSUMPTIONS. `241-handoff.md`, this file, MEMORY.md, and the review docs are LEADS, not truth —
  they lag reality. Before trusting any of them, RE-VERIFY empirically: `npm view @commonpub/<pkg> version`,
  `curl https://<instance>/api/features` (flag count/state), `curl https://<instance>/api/health`, latest
  migration in `packages/schema/migrations/`, and `git status` in commonpub + both forks (../deveco-io,
  ../heatsynclabs-io).
- READ-ONLY recon by default. You may implement + roll a fix ONLY after: (a) the full package test suite +
  `tsc --noEmit` are green, AND (b) an adversarial audit workflow over the change comes back clean (or its
  findings are fixed). NEVER skip the audit — in session 241 it caught a real regression in 3 of 5 batches
  (a §2b cap that was a prod no-op, a P1 backfill bypass, and a reminder poison-pill) that green unit tests
  missed. A fix can pass its unit test yet be wrong in prod if the WIRING is untested — always exercise the
  real call path end-to-end, not just the leaf function.
- Adversarially verify every finding before recording or fixing it: an independent skeptic that defaults to
  "not a bug" and reads the actual code. Record only what survives, with a concrete failure scenario.
- Never AI-attribute commits/PRs. Follow CLAUDE.md standing rules. Log the session in `docs/sessions/`.

## Verified baseline (2026-07-17, session 241 — RE-VERIFY before relying on it)
- LIVE on all 3 (health ok, 37 flags, migration 0042): server **2.116.0** / layer **0.106.5** /
  editor **0.13.0** / protocol **0.15.0** / auth **0.11.0** / schema 0.59 / config 0.33 / ui 0.13.2 /
  infra 0.17 / docs 0.6.3 / explainer 0.8 / learning 0.5.2 / theme-studio 0.6.1 / test-utils 0.5.13.
  CLI create-commonpub 0.5.29. All repos clean + pushed.
- Monorepo: pnpm + Turborepo; `packages/*` + `apps/reference` + `layers/base` (the Nuxt layer, where the
  product lives) + `tools/create-commonpub` (Rust CLI). Consumer forks: `../deveco-io`, `../heatsynclabs-io`.

## Phase 1 — Audit the LIVE session-241 hardening (confirm no regression)
Fan out read-only adversarial reviewers over the changes that shipped in session 241 (they are LIVE now).
Try to BREAK each; a confirmed regression on live code is priority-0 — fix + roll immediately. Focus:
- The federation untrusted-input boundary: `packages/server/src/federation/inboxHandlers.ts` (onCreate
  object.id↔actor host binding ~line 599; onAnnounce note.attributedTo↔note-origin binding ~1428), the
  outbox-crawl actor-host binding in `backfill.ts` + `hubMirroring.ts`, and the `mirrorMaxItems` cap now
  wired via `config.federation` into the 3 inbox routes. Verify none of these can be bypassed or broke a
  legit flow (two-instance publish, cross-instance Group relay, paginated authorized-fetch).
- Auth/SSO: `exchangeCodeForToken`/`exchangeCodeAndVerify` actor-host binding; `roleGuard` fail-closed.
- Protocol: HTTP-signature `(request-target)` now covers `url.search` (sign + verify must stay byte-identical);
  digest verification case-insensitive.
- The contest mobile-overflow CSS (`.cpub-md-html`/`.cpub-block-text`/`.cpub-prose`, `CustomHtmlSection`,
  `BlockMarkdownView`) — no leak onto structured tables/articles.
Also look for SIBLING code paths with the same class of bug that session 241 did NOT touch.

## Phase 2 — Continue the backlog (package-grouped, each audited before roll)
Details + file:line in `docs/reviews/full-review-2026-07-17.md`. Remaining (all P3 unless noted):
- **#11** Undo(Like) decrements like counters without verifying a prior matching Like existed
  (`inboxHandlers.ts` ~388) — needs the like-tracking model (find where onLike records the inbound Like).
- **#22** `createComment` doesn't validate `parentId` belongs to the same target (`social/social.ts` ~350).
- **#24** the markdown parser emits a `table` block the core registry never registers
  (`editor/src/blocks/registry.ts`) — add a `tableContentSchema` + register it + a MarkdownBlock preview case.
- **#19/#20** schema self-FK / conversations-participants FK (`schema/src/federation.ts`, `social.ts`) —
  NEEDS A MIGRATION. Higher risk: generate the migration, guard against pre-existing orphan rows, apply via
  `scripts/db-migrate.mjs` (never hand-edit prod DB), and roll schema + the chain carefully.
- **Build-pipeline gap:** `layers/base` has NO `typecheck`/`lint`/`build` script and `packages/infra` has no
  `lint`. Add them — but adding `lint` to ~94k never-linted layer LOC will surface a real cleanup; scope it
  (don't wire a failing lint into CI in one shot).
- **PII/GDPR pass** — under-reviewed by the session-241 review; a dedicated read of contest-PII/consent/export
  paths is worthwhile.

## OPEN PRODUCT DECISION — do NOT decide this yourself; surface it to the operator
- **§2b(ii)** federated-content storage policy: *subscribed-only* (store only content from actors/domains the
  instance follows or mirrors — closes the open-storage flood, but stops open discovery and breaks ~4 tests'
  current contract) vs *open* (current behavior + the now-working per-mirror cap + a future retention job).
  It changes observable federation behavior; it's a product choice, not a bug. Ask; don't assume.

## The proven working loop (use it for every fix batch)
fix → full package suite (`vitest run --root packages/<pkg>`) + `tsc --noEmit -p packages/<pkg>/tsconfig.json`
→ **adversarial audit workflow** (per-fix skeptics, default-refute; read the real code) → apply confirmed
findings → roll the exact-pin chain → background deploy-wait + `/api/health` on all 3.

## Roll landmines (reconfirmed session 241)
- The layer pins its `@commonpub/*` deps at EXACT versions at publish (`workspace:*` → e.g. `2.116.0`), so a
  fix in protocol/auth/editor/server requires republishing UP the chain (leaf → server → layer) for it to
  reach prod. Publish leaves first, then server, then layer.
- Forks pin only `@commonpub/layer` (caret) and deploy via Docker `RUN npm install` (fresh caret resolve).
  A layer PATCH is in-range, BUT the npm-install Docker layer is cache-keyed on package.json — a bare
  `workflow_dispatch` reuses the stale install. ALWAYS `pnpm update @commonpub/layer` in each fork (bumps
  package.json → busts the cache) and push to trigger the deploy.
- `git push` runs a ~2-min pre-push `pnpm typecheck` hook that times out the Bash tool → push `--no-verify`
  AFTER validating typecheck separately.
- `drizzle-kit push` needs a TTY (fails headless); the local dev DB is usually current enough to skip it.
- Local `nuxt dev` `networkidle` never settles → Playwright must use `domcontentloaded`; the browser MCP
  tool can't narrow the render viewport → use Playwright `newContext({viewport})` for true-mobile checks.

## Deliverables
- Keep `docs/reviews/full-review-2026-07-17.md` + `docs/sessions/241-handoff.md` current (mark items done,
  record rolls with versions).
- A session-242 log in `docs/sessions/`.
- Roll each confirmed fix (after its audit) or write it up with a proposed fix + risk if you judge it too
  risky to ship without the operator.

Start by reading `docs/sessions/241-handoff.md` + `docs/reference/codebase-analysis.md`, then re-verify the
baseline, then run Phase 1.
