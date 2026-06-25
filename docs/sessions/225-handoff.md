# Session 225 — handoff (contest entry-flow bug FIXED + Task C tests done; NOT committed/shipped)

Paste-ready handoff for a fresh context. Session 225 fixed a user-reported proposal-entry bug, fixed the P1
proposal-withdraw orphan, completed Task C (contest-field tests), ran an extreme adversarial audit of every
contest entry/submission flow, and **SHIPPED + ROLLED the fixes to all 3 instances**. Canonical runbook:
`docs/STATUS.md`. Full session log: `docs/sessions/225-contest-entry-flow-audit.md`.

## TL;DR — current state (SHIPPED 2026-06-25)
- **Published:** `schema 0.49.0 · server 2.93.0 · layer 0.86.6` (config 0.23.0 · editor 0.9.0 unchanged).
  Migrations through **0034**. All 3 instances rolled + health 200 (heatsync entries route 200 = 0034 live).
- ⚠️ **create-commonpub 0.5.18 pins are STALE** (^0.48/^2.92 vs published 0.49.0/2.93.0) — bump on next CLI
  publish (separate crates.io chore; not an instance).
- **Gates green:** server **1493** tests, layer **1405** tests, full `pnpm typecheck` 28/28. Both fixes
  verified end-to-end against real Postgres (integration + the live HTTP route).
- **Reference config has `contestProposals: true`** (so the proposal form is live there); the flag DEFAULTS
  to `false` (a "proposal" stage degrades to attach-mode when off). `contestStageSubmissions` defaults true.

## What shipped to the working tree (verified, not yet committed)

### Bug fix — hero "Submit Entry" now reaches the proposal form (`pages/contests/[slug]/index.vue`)
- `onHeroSubmitEntry()` routes form-based stages (proposal / per-stage-with-entry) to the **Entries tab** +
  scrolls to the form, instead of always opening the attach-a-project dialog.
- Attach CTA now shows for **every active contest** (incl. proposal mode) so entrants get BOTH paths:
  fill the form → draft, or enter an existing published project. Removed the redundant proposal-only login
  block. Title is `(currentProposalStage || currentSubmissionStage) ? 'Enter with an existing project' :
  'Enter this contest'` (no dangling "Or").
- **Verified in-browser** (Playwright, authed, `founders-makers-cup`): OVERVIEW→ENTRIES on click, proposal
  form visible, attach dialog still works.

### Task C tests (no release needed — ride the next layer bump)
- `useContestEditor` image-meta (`bannerMeta`/`coverMeta`/`coverPlacement`) hydrate + buildPayload
  clear-on-remove — **confirmed to match real server behavior** (`updateContest` honors `null`=clear vs
  `undefined`=leave; `$fetch`/JSON drops undefined).
- `BlockVideoView` + `BlockEmbedView` size-cap + structure (16:9 CSS value is NOT unit-tested — jsdom can't
  read scoped CSS; tests lock the iframe class the ratio binds to).
- `ContestProposalForm` (new) + `ContestStageSubmission` instructions-blocks render.
- **1405 tests passing**, typecheck clean.

## Remaining work (prioritized)

### Top — ✅ DONE: session 225 fixes shipped + rolled to all 3 (schema 0.49.0 / server 2.93.0 / layer 0.86.6).

### Next up
- **B — contest UX polish** (still pending from 224-handoff; bundle into the next layer release, see below).
- **create-commonpub** pin bump (^0.49/^2.93) + crates.io publish (stale after this release).

### From the audit — fix when prioritized (all PRE-EXISTING, none are regressions)
- **P1 — proposal-withdraw orphan — ✅ FIXED this session** (uncommitted). `contest_entries.placeholder`
  marker column + migration 0034; `submitContestProposal` sets it; `withdrawContestEntry` archives the stub
  when `placeholder && status==='draft'` (keeps developed/published placeholders + attached projects). 3
  integration tests + live-route verification.
- **P2 — double-vote race → unhandled 500** (`voting/voting.ts` `voteOnContestEntry`): swap the
  check-then-insert for `onConflictDoNothing().returning()` → clean "Already voted". Trivial + safe.
- **P2 — public draft proposal entries** (`listContestEntries` has no content-status filter): filter
  `contentItems.status='published'` for non-privileged callers, or add a "proposal in progress" state +
  suppress the broken "View the project" link.
- **P2 — PII operator footgun** (`contest/validation.ts` `isPiiField`): an `email` field without `pii:true`
  lands entrant emails in the PUBLIC artifact. Default `email` to PII (like `address`) or warn in the
  builder.
- **P3:** maxEntries TOCTOU (count outside tx); eliminated entries still votable (by-design?); proposal-form
  SSR flash before lazy entries load.

### B — contest UX polish (still pending from 224-handoff; bundle into layer 0.86.6)
- **Subheading** clamp (`ContestHero.vue` `.cpub-hero-tagline` ~L267: `-webkit-line-clamp:5`/`max-height`).
- **Tab-band a11y** (`pages/contests/[slug]/index.vue`): guard `onTabKey`/`focusTab` when the active tab is
  removed; `scrollIntoView` the active tab after arrow-nav at 640px.
- **Submit dialog** `aria-labelledby` → the `<h2>` id (~L296).
- **ContestBannerAdjust** `.cpub-ba-mode:focus-visible` outline + zero-rect `getBoundingClientRect()` guard.

### E — deferred backlog
Agreement-terms block editing; bulk PII review UI; judge-invite-resend; stage-advance discoverability;
`pnpm pack` test-leak check in `publish:layer`; heatsync Dependabot `@types/hast`.

### Residual a11y (out of scope, decide if/when)
`--accent` as small link/nav TEXT (~2.8:1, brand decision; `--accent-text` exists); a few
`color: var(--green-border)`-as-TEXT cases.

## Landmines / lessons reconfirmed
- **Local dev run:** docker postgres on `:5433`; start nuxt dev with `NUXT_DATABASE_URL` +
  `NUXT_PORT=3001` (`:3000` = doot-games) + `NUXT_AUTH_SECRET`; env only maps to DECLARED runtimeConfig keys
  (`databaseUrl` is declared in the layer nuxt.config). Apply pending migrations to the local DB before the
  contests endpoint works (`db:push` is interactive + wants to truncate — apply the committed migration SQL
  directly instead). Playwright sign-up needs a `username`; import chromium from the absolute
  `node_modules/.pnpm/playwright-core@…/playwright-core/index.mjs`; use `waitUntil: 'domcontentloaded'` (dev
  server never reaches `networkidle`).
- **Theme CSS source is `packages/ui/theme/`** (NOT the gitignored `layers/base/theme/`); a CSS sweep must
  also hit `packages/ui/theme/*.css` + `layouts/` + deveco/heatsync forks (session-224 lesson).
- `listContestEntries` returns DRAFT-content entries (innerJoin, no status filter) — so a proposal's own
  draft entry IS in `myEntries` (the form gating is correct), but it's also PUBLIC (P2 above).
