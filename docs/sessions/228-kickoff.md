# Session 228 — kickoff prompt

Paste the block below as the opening message to a fresh agent.

---

You're picking up the CommonPub monorepo (/Users/obsidian/Projects/ossuary-projects/commonpub;
pnpm + Turborepo, Nuxt reference app + @commonpub/*, plus consumer sites ../deveco-io and
../heatsynclabs-io). START HERE: read `docs/sessions/228-handoff.md` (full standing state) and
`docs/STATUS.md` (release/deploy runbook + version table), then your auto-memory index.

Everything is SHIPPED + live as of 2026-06-26: `schema 0.54.0 · config 0.26.0 · infra 0.13.0 ·
server 2.100.1 · layer 0.89.1`, create-commonpub 0.5.20 (crates.io, re-pinned to current),
migrations through **0037**. All 3 instances (commonpub.io local layer; deveco.io +
heatsynclabs.io pin the published versions) rolled + health 200; working trees clean. GDPR
Phase 2 gained server-side write-enforcement (`require-terms` middleware, flag-gated OFF).

Session 227 was long and completed two whole initiatives end to end:
- **Email & communications overhaul** (`docs/plans/email-comms-overhaul.md`, COMPLETE):
  durable `email_outbox` + throttled/retrying worker, RFC 8058 unsubscribe, per-instance email
  branding + admin editor, admin broadcast (all/by-role/specific), 3 outbox audit fixes, and a
  maintainability refactor (split the `infra/email.ts` monolith, DRY'd unsubscribe links,
  extracted `notification/emailPrefs.ts`).
- **GDPR consent** (`docs/plans/gdpr-consent-hardening.md`, COMPLETE): Phase 1 (terms-acceptance
  recording + signup checkbox + export completeness, migration 0035) and Phase 2 (re-acceptance
  gate + cookie-consent recording).

CRITICAL: **email is OFF in production on all 3** (`emailNotifications=false`, console adapter,
no Resend secret wired) — so the entire email subsystem is inert until an operator enables it.
The `adminBroadcast` and `requireTermsAcceptance` flags are also OFF by default. None of the
above changes prod behavior yet.

A session-228 audit of ALL 24 `docs/plans/` found everything COMPLETE or deferred-by-design
EXCEPT three areas of genuinely-pending engineering (full map in `docs/sessions/228-handoff.md`).
Pick from the backlog below when prioritized, or take new direction from the user.

Backlog (build when prioritized):
- **Layout engine (the largest dormant initiative)** — `docs/plans/layout-engine-rollout.md` +
  `phase-3-editor.md`. The visual editor is ~80% (Phase 3e-remainder + 3f pending); the ROLLOUT
  (Phases 4-10: adopt `LayoutSlot` beyond the homepage in ~7 routes, ~8 more section types, mobile
  editor, versioning/publish UI) is largely unshipped. The engine is a commonpub.io-only canary
  (`layoutEngine` OFF on deveco/heatsync). Big; scope a phase with the user before diving in.
- **instance-self-update.md** — entire feature un-built, "awaiting maintainer approval." A decision
  gate: confirm the user wants it before building (admin update page + backend + scaffolder workflow).
- **monolith-splits 3c/4a/4b** (`monolith-splits-remaining-backlog.md`): 3c federated-follow-from-
  profile UI (backend ready, needs a UI surface); 4a homepage 3-path consolidation (HIGH blank-page
  risk, needs a 2-phase deploy seeding default layouts); 4b extract `inboxHandlers.onCreate` (~1512
  lines, needs inbound-Create integration tests first). All risk-gated — confirm before starting.
- **Enable email on an instance** (operator decision): wire `NUXT_EMAIL_ADAPTER=resend` +
  `NUXT_RESEND_API_KEY`/`NUXT_RESEND_FROM` + `NUXT_PUBLIC_FEATURES_EMAIL_NOTIFICATIONS=true`,
  verify a sending domain in Resend, smoke a real send. Cost/scale model:
  `docs/reference/email-gdpr-scaling-analysis.md`.
- Email/GDPR follow-ups: bulk PII review UI; paginate the digest in-memory build at scale;
  `pnpm pack` test-leak check in `publish:layer`; broadcast specific-users picker polish; email
  open/click analytics.
- Older backlog: contest entry-detail residuals; deferred a11y (`--accent` as small nav TEXT);
  maxEntries TOCTOU; federation P3 mirror Offer→Accept live round-trip.

New-flag gotcha: a feature flag needs `config` schema/types + `layers/base/nuxt.config.ts`
`runtimeConfig.public.features` + `apps/reference/server/utils/config.ts` `ENV_FLAG_MAP` +
`packages/test-utils/src/mockConfig.ts` + the `health.test.ts` flags literal, or env-toggle
won't work / the server build fails. The `/admin/features` DB-toggle works for any flag.

Standing rules: test-driven; verify UI visually (run the app + screenshot/Playwright) before
shipping; theme/token edits in `packages/ui/theme/` (NOT the gitignored `layers/base/theme/`)
and a CSS sweep must also hit `packages/ui/theme/*.css` + `layouts/` + the deveco/heatsync
forks; `var(--*)` only, no hardcoded colors; no em dashes in user-facing copy; NO AI attribution
in commits/PRs. Local run: docker postgres `:5433` (user `commonpub` / pw `commonpub_dev` / db
`commonpub`), nuxt dev with `NUXT_DATABASE_URL` + `NUXT_PORT=3001` (`:3000`=doot-games) +
`NUXT_AUTH_SECRET`, apply pending migrations to the local DB first. To exercise email locally:
add `NUXT_PUBLIC_FEATURES_EMAIL_NOTIFICATIONS=true NUXT_EMAIL_ADAPTER=console` (the outbox worker
drains to the console + writes `email_outbox` rows you can query).

Release chain (when shipping a server/layer change): bump the changed `packages/*/package.json`
+ `layers/base/package.json` → `pnpm typecheck` (28/28) + suites green → publish in dep order
(`schema → config → infra → server → ui → theme-studio → layer`, poll `npm view` between) with
`pnpm --filter @commonpub/<pkg> publish --no-git-checks --access public`, layer via
`pnpm run publish:layer` → PR + squash-merge to main (commonpub.io deploys on push) →
deveco/heatsync: bump pins + update BOTH lockfiles (`pnpm install --lockfile-only` +
`npm install --package-lock-only`; heatsync's package-lock.json is tracked) → push main →
**curl-verify `/api/health` on all 3** (deveco/heatsync health checks are WARN-ONLY). A push to
main CANCELS an in-progress commonpub.io deploy (concurrency) — don't push a CLI/docs bump to
main while the app deploy runs.
