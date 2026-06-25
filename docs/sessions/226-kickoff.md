# Session 226 — kickoff prompt

Paste the block below as the opening message to a fresh agent.

---

You're picking up the CommonPub monorepo (/Users/obsidian/Projects/ossuary-projects/commonpub; pnpm +
Turborepo, Nuxt reference app + @commonpub/*, plus consumer sites ../deveco-io and ../heatsynclabs-io).
START HERE: read `docs/sessions/225-handoff.md` (what just shipped + remaining work) and `docs/STATUS.md`
(release/deploy runbook + version table), then your auto-memory index.

Everything is SHIPPED + live as of 2026-06-25: `schema 0.49.0 · server 2.93.0 · config 0.23.0 · editor 0.9.0
· layer 0.86.6`, create-commonpub 0.5.18 (crates.io), migrations through **0034**. All 3 instances
(commonpub.io local layer; deveco.io + heatsynclabs.io pin `^0.86.6`) rolled + health 200; working trees
clean. Session 225 shipped the contest entry-flow fixes (hero "Submit Entry" → proposal form; the attach
option is now available in proposal mode; proposal-withdraw archives its draft placeholder via the new
`contest_entries.placeholder` marker + migration 0034) plus Task C contest-field tests. A deep adversarial
audit of every contest entry/submission flow found NO P0/P1 regressions; the items below are the leftovers.

Note: `contestProposals` is `true` in the reference app's `commonpub.config.ts` (so the proposal form is
live on commonpub.io) but DEFAULTS to `false` — a "proposal" stage degrades to attach-mode when off.

Task A — contest P2 fixes (server; no schema/migration). All PRE-EXISTING, surfaced by session 225's audit:
- **Vote-race 500** (`packages/server/src/voting/voting.ts` `voteOnContestEntry`): the duplicate-vote guard
  is a non-transactional check-then-insert; two concurrent votes hit the unique constraint and throw an
  unhandled 500 instead of a clean 400. Swap to `onConflictDoNothing().returning()` → "Already voted". Clean
  fix, no decision needed; add a test.
- **Public draft proposal entries** (`packages/server/src/contest/entries.ts` `listContestEntries`): the
  `innerJoin` on content has NO status filter, so proposal DRAFT placeholders are listed publicly and the
  entry-detail "View the project" link 404s for non-owners. DECISION: filter `contentItems.status =
  'published'` for non-privileged callers, OR add a "proposal in progress" state + suppress the dead link.
- **PII operator footgun** (`packages/server/src/contest/validation.ts` `isPiiField`): an `email` field
  without `pii:true` lands entrant emails in the PUBLIC artifact. DECISION: default `email` to PII (as
  `address` already is) or warn in the builder. (Check it doesn't break contests relying on email-in-artifact.)

Task B — contest UX polish (layer-only; pending since 224-handoff; verify visually before shipping):
- Subheading clamp (`ContestHero.vue` `.cpub-hero-tagline` ~L267: `-webkit-line-clamp:5`/`max-height`).
- Tab-band a11y (`pages/contests/[slug]/index.vue`): guard `onTabKey`/`focusTab` when the active tab is
  removed from `tabs`; `scrollIntoView` the active tab after arrow-nav at the 640px breakpoint.
- Submit dialog: `aria-labelledby` → the `<h2>` id instead of plain `aria-label` (~L296).
- `ContestBannerAdjust`: `.cpub-ba-mode:focus-visible` outline + zero-rect `getBoundingClientRect()` drag guard.

Bundle A + B into ONE release: **server 2.94.0 + layer 0.86.7** (no schema bump — no migration). Release
chain: bump `packages/server/package.json` + `layers/base/package.json` → `pnpm typecheck` (28/28) + suites
green → `pnpm --filter @commonpub/server publish --no-git-checks --access public` (poll `npm view`) →
`pnpm run publish:layer` → PR + squash-merge to main (commonpub.io deploys on push to main, hard-fail
db-migrate + smoke) → deveco/heatsync: bump `@commonpub/{server,layer}` pins + update BOTH lockfiles
(`pnpm install --lockfile-only` for the tracked pnpm-lock.yaml + `npm install --package-lock-only`; heatsync's
package-lock.json is tracked, deveco's is gitignored) → push main → **curl-verify `/api/health` on all 3
(deveco/heatsync health checks are WARN-ONLY — `gh run` success ≠ healthy)**.

Task C — `create-commonpub` pin bump: pins are STALE (^0.48/^2.92 vs published 0.49.0/2.93.0). Bump
`tools/create-commonpub/template.rs` pins + `tests/cli.rs` asserts + `Cargo.toml`, `cargo test`, then
`cargo publish --locked` (crates.io). Separate from the instance deploys; only affects newly-scaffolded apps.

Backlog (E, build when prioritized): agreement-terms block editing; bulk PII review UI; judge-invite-resend
trigger; stage-advance discoverability; wire a `pnpm pack` test-leak check into `publish:layer`; heatsync
Dependabot `@types/hast`. Deferred a11y: `--accent` as small link/nav TEXT (~2.8:1; brand decision,
`--accent-text` exists) and `--green-border`-as-TEXT cases. P3s: maxEntries TOCTOU; eliminated entries still
votable (by-design?); proposal-form SSR flash before lazy entries load.

Standing rules: test-driven; verify UI visually (run the app + screenshot/Playwright) before shipping;
theme/token edits in `packages/ui/theme/` (NOT the gitignored `layers/base/theme/`) and a CSS sweep must also
hit `packages/ui/theme/*.css` + `layouts/` + the deveco/heatsync forks; `var(--*)` only, no hardcoded colors;
no em dashes in user-facing copy; NO AI attribution in commits/PRs. Local run: docker postgres `:5433`, nuxt
dev with `NUXT_DATABASE_URL`+`NUXT_PORT=3001`(`:3000`=doot-games)+`NUXT_AUTH_SECRET`, apply pending migrations
to the local DB first.
