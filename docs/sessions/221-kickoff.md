# Session 221 — kickoff / handoff (contest builder UX Phases 0/1/3 SHIPPED to all 3)

Paste-ready handoff for a fresh context. Session 220 shipped the first slice of the **contest builder UX**
initiative to all three instances. Everything below is LIVE. Canonical operator runbook: `docs/STATUS.md`.
Initiative plan: `docs/plans/contest-builder-ux.md`. Session log: `docs/sessions/220-contest-builder-ux.md`.

---

## TL;DR — current state (all SHIPPED + verified live 2026-06-24)

- **`main` HEAD `99d65225`** (feature merge `90467ebd` = PR #53). Working trees clean across all 3 repos.
- **Published `@commonpub/layer 0.84.0`** (the ONLY package that moved this session — the change set is
  layer-only + the reference app config). Everything else unchanged: `schema 0.46.0 · config 0.23.0 ·
  protocol 0.14.0 · infra 0.9.0 · test-utils 0.5.8 · editor 0.8.0 · explainer 0.8.0 · server 2.90.0`.
- **All 3 instances rolled + verified** (health + `/contests` = 200):
  - **commonpub.io** — local layer, deployed on merge to `main`. Contest builder flags **ON**
    (`/api/features` → `contestProposals: true, contestPii: true`).
  - **deveco.io** (`38d7f5a`) + **heatsynclabs.io** (`fb1d743`) — layer pin bumped `^0.83.2 → ^0.84.0`,
    lockfiles regen'd (deveco: pnpm-lock; heatsync: BOTH), deployed; deveco CI `nuxt typecheck` green.
    Their flags stay **OFF** (operator opt-in) — they get the Stages tab + template, but the template
    degrades to attach-mode and the agreement/address builder types aren't offered.
- **No migration this session** — schema is still at `0031` (layer-only change).

## What session 220 shipped (contest builder UX — Phases 0/1/3 of the plan)

The agreement/address/PII/configurable-form/judging machinery was ALREADY built (Phase 4/5, sessions
211-218) — it was just gated OFF, buried in the right rail, and never seeded into new contests. So this
was surfacing + templating + defaults, not a from-scratch build.

1. **Stages is now a 4th center tab** (`ContestBodyCanvas` `stages` form tab): the stage editor +
   advancement moved out of the cramped 340px rail into the full-width center; the block palette +
   Write/Preview/Code switch hide there.
2. **Standard new-contest template** (`layers/base/utils/contestTemplates.ts` `standardContestTemplate`):
   a Proposals → Judging → Results timeline + a starter proposal form (+ a rules `agreement` when PII is
   on) + a default rubric (Innovation 40 / Feasibility 30 / Impact 30) + Overview/Rules starter copy.
   Flag-adaptive. Seeded in create mode via the new `useContestEditor.applyTemplate()` (dirty-suppressed)
   + `reseedBodies()`.
3. **Reference flags ON** — `apps/reference/commonpub.config.ts` sets `contestProposals: true` +
   `contestPii: true`. `@commonpub/config` + layer `nuxt.config.ts` defaults stay OFF.
4. **De-monolith** (no behaviour change): `ContestStagesEditor` 422 → ~135 lines, split into
   `ContestStageCard.vue` + `ContestStageTemplateEditor.vue`; advancement → `ContestAdvancementPanel.vue`;
   array-level template helpers added to `utils/contestStages.ts` (stage-indexed wrappers delegate).

Gates: full suite **server 1490 + layer 1322** green, `pnpm build` + `nuxt typecheck` clean, adversarial
diff audit GO, create→save→edit Playwright round-trip verified. Also fixed kickoff follow-up #3 (the flaky
`ContestStageSubmission` isolation test — double-mount id collision → `cleanup()`).

---

## Deployment architecture (a fresh session MUST know this)
- **commonpub.io** runs the **local** `layers/base` (this repo) — merging to `main` deploys it; no npm
  publish needed for commonpub.io itself. It IS `apps/reference` (Dockerfile copies `apps/reference/.output`).
- **deveco.io** (`devEcoConsultingLLC/deveco-io`) + **heatsynclabs.io** (`heatsynclabs/heatsynclabs-io`)
  consume the **published** `@commonpub/*`, checked out at `../deveco-io`, `../heatsynclabs-io`. Both deploy
  via Docker `npm install` + `nuxt build` + hard-fail `db-migrate.mjs`. deveco ALSO runs a
  `pnpm --frozen-lockfile` + `nuxt typecheck` **CI** (a stale `pnpm-lock.yaml` or a layer type error fails
  it). heatsync tracks BOTH lockfiles (`pnpm-lock.yaml` + `package-lock.json`); deveco's npm lock is gitignored.
- Caret pins don't auto-cross 0.x minor (`^0.83.2` ✗→ 0.84.0) — hand-edit + regen lockfile(s).
- Release chain + exact commands: `docs/STATUS.md` → "Release an npm package" + "Deploy the 3 instances".
- **Instance feature config** is the app's `commonpub.config.ts` `features` block; it propagates to
  `/api/features` (verify ANY flag claim with `curl https://<instance>/api/features`, never from memory).

---

## Remaining work — the contest builder UX plan (`docs/plans/contest-builder-ux.md`)

Phases 0/1/3 done. The plan's decisions are already locked (banner zoom = non-destructive metadata; judge
photos = the Judges Showcase block; flags ON for reference only). Remaining, roughly by user-facing value:

- **P2 — submission-form builder upgrades.** (a) One-click **field presets** above the field list
  (Address / Agreement / Email / …, seeded via the existing `templateField*` helpers); (b) whole-form
  **templates** (Standard proposal / Hardware-shipping w/ address+agreement / Minimal) in a new
  `utils/contestSubmissionTemplates.ts`; (c) **block-editable instructions** per submission stage — add
  `instructionsBlocks?: BlockTuple[]` to `ContestStage` (lives in the `stages` jsonb → NO migration; add a
  Zod field to `contestStageSchema`), edited with a small `useBlockEditor` in `ContestStageTemplateEditor`,
  rendered above the fields in `ContestProposalForm` + `ContestStageSubmission` via `BlockContentRenderer`.
  All layer-side; no server change.
- **P4 — banner/cover zoom (non-destructive).** Add `bannerMeta`/`coverMeta jsonb` to `contests` →
  **migration 0032** (`drizzle-kit generate`). Shape `{ zoom, x, y }`. New `ContestBannerAdjust.vue` (zoom
  slider + drag) over the inline media in `ContestEditor`; `ContestHero.vue` reads the meta (null → current
  `cover`; zoom 0 → `contain`; zoom>0 → `cover` + scale + object-position). Schema + server passthrough +
  layer. This one needs a real release chain (schema bump + migration).
- **P5 — hero→tabs gap + missing-UI sweep.** The public contest page has a concrete **~52px** gap:
  `.cpub-hero-bar-inner` 20px bottom + `.cpub-contest-main` 32px top, in `pages/contests/[slug]/index.vue`.
  Reduce to ~16-20px. Also surface the existing CSV export (`GET /contests/:slug/export`) as a visible
  button, and sweep for any backend capability lacking a UI trigger.
- **P6 — Judges Showcase de-friction.** Polish `JudgesShowcaseBlock.vue` photo upload + add a one-click
  "Import panel judges" (seed rows from `contest_judges` name + account avatar). Layer-only.

### Standalone follow-ups (not blocking)
- **create-commonpub (crates.io) pins are STALE.** `tools/create-commonpub/src/template.rs`:
  `COMMONPUB_LAYER_VERSION = "^0.82.0"` → **`^0.84.0`**, `COMMONPUB_SCHEMA_VERSION = "^0.45.0"` →
  **`^0.46.0`**, `COMMONPUB_CONFIG_VERSION = "^0.22.1"` → **`^0.23.0`**, and the server pin → **`^2.90.0`**.
  Update `tests/cli.rs`, `cargo test`, `cargo publish --locked` (crate 0.5.16 → 0.5.17).
- **`seedBodyBlocks` latent bug** (`layers/base/utils/contestBody.ts`): the html-legacy / parse-failure
  fallback emits `['markdown', { content: text }]`, but the markdown block's attr key is **`source`** (both
  `MarkdownBlock` edit + `BlockMarkdownView`), so that fallback renders EMPTY. Change `content` → `source`
  (rarely hit; left untouched this session to avoid scope creep). The contest template already sidesteps it
  by seeding structured blocks via `markdownToBlockTuples`.
- Wire a `pnpm pack` test-leak check into `publish:layer` (long-standing, from session 219).

---

## Landmines reconfirmed this session
- **Markdown block attr key is `source`, not `content`** — seed body copy via `markdownToBlockTuples`
  (structured heading/paragraph blocks), never an ad-hoc `['markdown', { content }]` tuple.
- **`pnpm build` corrupts a running `nuxt dev` `.nuxt`** (`#internal/nuxt/paths` 500s) — don't run them
  concurrently; restart dev after a build. ([[reference_local_run_and_visual_verify]])
- Local visual verify needs `NUXT_DATABASE_URL` (not just `DATABASE_URL`); the persisted docker volume may
  be schema-stale (interactive `drizzle-kit push` truncation prompt) — use a fresh throwaway DB
  (`CREATE DATABASE commonpub_verify` + `drizzle-kit push --force`) to avoid touching dev data. Sign up via
  `POST /api/auth/sign-up/email` with `{ email, password, username, name }` (username is required).

## Local dev + visual verify (recipe)
- `docker compose up -d postgres` (`:5433`); fresh DB + `drizzle-kit push --force`; `NUXT_DATABASE_URL=… PORT=3010 pnpm --filter @commonpub/reference exec nuxt dev`; Playwright chromium (sign up via API → cookies persist in the context). Screenshot dirs + `scripts/shoot-*.mjs` are gitignored. See `reference_local_run_and_visual_verify`.
