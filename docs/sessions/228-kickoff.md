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
except a few pending areas. **The prioritized master backlog is `docs/ROADMAP.md` — read it and
pick from there, or take new direction from the user.** Headline tiers:
- **Tier 0:** enable email on an instance (operator + Resend secret — unlocks the inert email
  subsystem); small protective hardening (paginate the digest build; `pnpm pack` leak check in
  `publish:layer`).
- **Tier 1 (big, need the user's go-ahead + scoping):** the **layout engine** (editor 3e/3f +
  rollout Phases 4-10; a commonpub.io-only canary; includes the homepage 3-path consolidation) and
  **instance-self-update** (entirely un-built, "awaiting maintainer approval").
- **Tier 2 (ready):** federated-follow-from-profile UI (backend ready); extract the ~1512-line
  `inboxHandlers.onCreate` monolith behind new inbound-Create integration tests.
- **Tier 3:** operator actions + small polish + deferred-by-design (see ROADMAP).

Do NOT start a Tier 1 item without the user's direction (they're large/strategic). Tier 0.2 +
Tier 2 are safe to pick up directly.

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
