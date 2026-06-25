# Session 227 — kickoff prompt

Paste the block below as the opening message to a fresh agent.

---

You're picking up the CommonPub monorepo (/Users/obsidian/Projects/ossuary-projects/commonpub; pnpm +
Turborepo, Nuxt reference app + @commonpub/*, plus consumer sites ../deveco-io and ../heatsynclabs-io).
START HERE: read `docs/sessions/226-contest-p2-and-ux-polish.md` (what just shipped) and `docs/STATUS.md`
(release/deploy runbook + version table), then your auto-memory index.

Everything is SHIPPED + live as of 2026-06-25: `schema 0.49.0 · server 2.94.0 · config 0.23.0 · editor 0.9.0
· layer 0.86.7`, create-commonpub 0.5.19 (crates.io), migrations through **0034**. All 3 instances
(commonpub.io local layer; deveco.io + heatsynclabs.io pin `^0.86.7`/`^2.94.0`) rolled + health 200; working
trees clean. Session 226 shipped the three Task A contest P2 fixes (race-safe votes via `onConflictDoNothing`;
draft proposal placeholders hidden from the public entries list with a viewer-own exemption; `email` fields
default to PII with a `pii:false` opt-out) plus the Task B contest UX polish (subheading 5-line clamp, tab-band
`focusTab` guard + `scrollIntoView`, submit-dialog `aria-labelledby`, ContestBannerAdjust `:focus-visible` +
zero-rect drag guard), all in **server 2.94.0 + layer 0.86.7** (no schema/migration). Task C bumped the CLI.

Note: `contestProposals` is `true` in the reference app's `commonpub.config.ts` but DEFAULTS to `false` — a
"proposal" stage degrades to attach-mode when off.

There is no committed plan with remaining required work. Pick from the backlog below when prioritized, or take
new direction from the user.

Backlog (build when prioritized):
- **Entry-detail status gate (residual from 226's A2):** `getContestEntry` / the entry-detail route still
  have NO content-status filter, so a non-owner who knows a draft entryId could open `/contests/:slug/entries/
  :id` directly (the list fix only removed the normal navigation path). Small follow-up: gate the detail route
  (404 a draft placeholder for non-owner/non-privileged) and/or suppress the dead "View the project" link.
- Agreement-terms block editing; bulk PII review UI; judge-invite-resend trigger; stage-advance discoverability;
  wire a `pnpm pack` test-leak check into `publish:layer`; heatsync Dependabot `@types/hast`.
- Deferred a11y: `--accent` as small link/nav TEXT (~2.8:1; brand decision, `--accent-text` exists) and
  `--green-border`-as-TEXT cases.
- P3s: maxEntries TOCTOU (count outside tx); eliminated entries still votable (by-design?); proposal-form SSR
  flash before lazy entries load.

Standing rules: test-driven; verify UI visually (run the app + screenshot/Playwright) before shipping;
theme/token edits in `packages/ui/theme/` (NOT the gitignored `layers/base/theme/`) and a CSS sweep must also
hit `packages/ui/theme/*.css` + `layouts/` + the deveco/heatsync forks; `var(--*)` only, no hardcoded colors;
no em dashes in user-facing copy; NO AI attribution in commits/PRs. Local run: docker postgres `:5433`
(user `commonpub` / password `commonpub_dev` / db `commonpub`), nuxt dev with `NUXT_DATABASE_URL` +
`NUXT_PORT=3001` (`:3000`=doot-games) + `NUXT_AUTH_SECRET`, apply pending migrations to the local DB first.

Release chain (when shipping a server/layer change): bump `packages/server/package.json` +
`layers/base/package.json` → `pnpm typecheck` (28/28) + suites green → `pnpm --filter @commonpub/server publish
--no-git-checks --access public` (poll `npm view`) → `pnpm run publish:layer` → PR + squash-merge to main
(commonpub.io deploys on push) → deveco/heatsync: bump `@commonpub/{server,layer}` pins + update BOTH lockfiles
(`pnpm install --lockfile-only` for the tracked pnpm-lock.yaml + `npm install --package-lock-only`; heatsync's
package-lock.json is tracked, deveco's is gitignored) → push main → **curl-verify `/api/health` on all 3**
(deveco/heatsync health checks are WARN-ONLY — `gh run` success != healthy). A push to main CANCELS an
in-progress commonpub.io deploy (concurrency) — don't push the CLI/docs bump to main while the app deploy runs;
branch + PR + merge after it settles.
