# Session 225 — kickoff prompt

Paste the block below as the opening message to a fresh agent.

---

You're picking up the CommonPub monorepo (/Users/obsidian/Projects/ossuary-projects/commonpub; pnpm +
Turborepo, Nuxt reference app + @commonpub/*, plus consumer sites ../deveco-io and ../heatsynclabs-io).
START HERE: read `docs/sessions/224-handoff.md` (current state + prioritized remaining work) and
`docs/STATUS.md` (release/deploy runbook), then your auto-memory index.

Everything is SHIPPED + live as of 2026-06-24: schema 0.48.0 · editor 0.9.0 · server 2.92.0 · config
0.23.0 · layer 0.86.5, create-commonpub 0.5.18, migrations through 0033. All 3 instances healthy on
`^0.86.5`; working trees clean. Session 224 shipped the theme-wide WCAG-AA contrast pass (`--*-text`
tokens) across the layer, bundled theme CSS, and the deveco/heatsync homepage forks.

Top task (C) — test coverage for the new contest fields (no publish needed; rides the next layer
release). None of session 220-222's fields have a dedicated test: `useContestEditor`
`bannerMeta`/`coverMeta`/`coverPlacement` hydrate + buildPayload (clear-on-remove); public render of
`instructionsBlocks` above the form (`ContestProposalForm`/`ContestStageSubmission`); video/embed `size`
cap + the `aspect-ratio` 16:9 (`BlockVideoView`/`BlockEmbedView`); the `.cpub-ctabs` tab band
(roles/aria/roving focus) + a contest-page axe pass; block-intro markdown round-trip
(`ContestStageTemplateEditor`). Tests-first per the standing rules; run `pnpm --filter @commonpub/layer
test` to verify.

Then task (B) — contest UX P2/P3 polish, bundled into one layer release (0.86.6) + roll all 3:
subheading clamp (`ContestHero.vue` `.cpub-hero-tagline` ~L267, add `-webkit-line-clamp:5`/`max-height`);
tab-band a11y guards in `pages/contests/[slug]/index.vue` (guard `onTabKey`/`focusTab` when the active
tab is removed; `scrollIntoView` active tab after arrow-nav at 640px); submit dialog `aria-labelledby` →
the `<h2>` id (~L296); `ContestBannerAdjust` `.cpub-ba-mode:focus-visible` outline + zero-rect
`getBoundingClientRect()` drag guard. Verify visually (run the app + screenshot) before shipping.

Release chain for B: bump `layers/base/package.json` → `pnpm run publish:layer` → deveco/heatsync pins
`^0.86.6` + both lockfiles → push + curl-verify health on all 3. Honor the standing rules: theme/token
edits in `packages/ui/theme/` (NOT the gitignored `layers/base/theme/`), verify UI visually before
shipping, no AI attribution in commits, `var(--*)` only, no em dashes in user-facing copy. A CSS sweep
must also cover `packages/ui/theme/*.css` + `layouts/` + the consumer forks (session-224 lesson).

E is backlog (terms block-editing, bulk PII UI, judge-invite-resend trigger, stage-advance
discoverability, `pnpm pack` test-leak check in `publish:layer`, heatsync Dependabot `@types/hast`).
Residual a11y deliberately deferred: `--accent` as link text (brand decision; `--accent-text` exists if
chosen) and `--green-border`-as-text cases.
