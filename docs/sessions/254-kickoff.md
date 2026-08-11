# Session 254 — kickoff: DEEP AUDIT (five rolls shipped in one session, now live on three instances)

Read this first. **Standing rules:** utmost care; adversarially verify (refute by default); **NEVER add
AI attribution to any commit/PR** (CLAUDE.md #15); **verify state empirically** (`npm view`,
`curl /api/features`, read the code) rather than trusting this document or memory; **verify behaviour,
not presence** — session 253 shipped analytics that loaded, initialised, logged every command and
measured nothing, past a green deploy. macOS has no `timeout`.

## The situation

Session 253 turned one operator report into three features and **five npm rolls in a single session**,
all now live on commonpub.io, deveco.io and heatsynclabs.io. It touched auth, CSP, cookie consent, the
privacy policy, every button in the app, and the contest page. A 38-agent audit ran *before* publishing
and returned 26 confirmed findings; two more real defects surfaced only *after* deploy.

The concern is not that the work was untested. It is that a large, security- and legally-sensitive
surface was designed, audited, fixed, published and deployed inside one session, and **the fixes to the
audit findings were never themselves audited**. This session is a deep audit of what is now live.

Start from `docs/sessions/253-handoff.md`. Read `docs/plans/contest-cta-metrics-and-analytics.md` for
why things are shaped the way they are, so you audit the design rather than rediscover it.

## Baseline (verify before trusting)

- LIVE all 3: layer **0.131.2** / server **2.129.0** / config **0.38.0** / auth **0.12.0** / infra
  **0.20.0** / ui **0.14.2** / test-utils **0.5.16** / schema 0.63.0. Migration **0045**, **42 flags**.
- `main` clean, no open PRs. Layer tests **1696**, e2e **136**, CI green.
- **deveco.io** is the only instance with analytics ON (`G-1BEXT06G60`) and the only one with a real
  mail transport. `features.emailVerification` is **OFF everywhere** but published and one toggle away.
- Four e2e failures reproduce locally and are environment, not code (a leftover custom theme in
  `instance_settings`, a dead seeded avatar host). Confirm that before chasing them.

## Suggested approach (ultracode — fan-out, then adversarially verify)

Run a Workflow: parallel finders across the dimensions below, then a verify pass that tries to **refute
every finding** (a finding survives only if you can state the inputs and confirm the code does that
today), then synthesize confirmed issues ranked by blast radius. Fix confirmed blockers, re-verify in a
real browser at true 390px, roll. Keep the operator in the loop between phases.

Two things the last audit proved worth doing: give verifiers **distinct lenses** rather than N identical
skeptics, and **check every new test for assertions that cannot fail** — that pass caught a documented,
ten-test, zero-caller function.

## Audit dimensions (ranked by blast radius)

### 1. PRIVACY, CONSENT AND LEGAL (highest — this is live and regulated)
- The consent gate is the load-bearing claim. Re-verify **empirically in a browser** against deveco.io:
  nothing before a choice, nothing after refusing including across navigation and a reload, and the
  cookies actually set are exactly the two `/cookies` discloses. Then try to break it: does an existing
  `cpub-consent=all` cookie from before this feature existed silently grant? What about a stale
  `cpub-consent` value, a second tab, a withdrawal mid-session, `prefers-reduced-data`?
- Is the privacy copy **accurate**? Read `plugins/analytics.client.ts` against what `/privacy` claims,
  line by line. Anything the page promises that the code does not do is the worst class of bug here.
- `anonymize_ip: true` is passed to `gtag('config')`. Confirm that is still meaningful in GA4 (it may be
  a no-op, in which case the privacy page's IP claim needs re-wording, not the code).
- Does consent need recording server-side for an audit trail? `POST /api/consent` exists and records
  `kind: 'cookies'` for logged-in users only. Anonymous consent is cookie-only. Is that defensible?
- Cross-check the GDPR export and deletion paths: does anything analytics-related need to appear there?

### 2. AUTH SURFACE (soft verification is one toggle from live)
- `POST /api/user/resend-verification`: re-audit end to end. Rate limit fails open on a Redis outage and
  is per-process without Redis. Can it be used to enumerate, to spam a victim, or to burn quota? Does
  `getAuthInstance()` risk a stale config, and can its import graph reach a client bundle?
- The `/api/auth/send-verification-email` 404: prove it cannot be bypassed (trailing slash, casing,
  double slash, query string, method).
- **`AuthUser` was widened with `email` + `emailVerified`.** Grep every place `requireAuth()`'s return is
  spread or serialized and confirm no route now leaks either into a response that did not carry them.
- Turning the flag ON is the next planned action. Walk that path as an adversary: what happens to an
  existing unverified population, to a Resend failure mid-signup, to a 1-hour token, to someone with no
  access to the address?

### 3. THE FIXES TO THE AUDIT FINDINGS (never themselves audited)
- 26 findings were fixed in one pass under time pressure. Re-read that diff (`git show bf17efc9`) as if
  it were new code. In particular: the `usePublishedHeight` extraction, the `resolveRegistrationAction`
  wiring at three call sites, the `hasPrimary` gate, and the `isEmailDeliverable` predicate.
- `.cpub-overlay-surface` and the `min-height: 44px` floor on `.cpub-btn` changed **every button in the
  app**. Sweep for dense surfaces that now look wrong: admin tables, editor chrome, toolbars, chips.
- The `--color-text-inverse` → `--color-on-accent` sweep touched 23 files by script. Verify each landed
  on a rule that genuinely has an accent fill, and that nothing on a dark surface got inverted.

### 4. TEST QUALITY, NOT COUNT
- ~100 tests were added. Find the ones that cannot fail, the tautologies, and the source-string
  contract tests that would still pass against wrong code. Be harsh; delete or strengthen.
- The e2e now depends on a shared `storageState`. What does that hide? Which specs would fail if the
  consent banner were broken, and is that acceptable?
- Is there coverage for the two post-deploy defects (CSP flag gate, gtag shim shape) that would have
  caught them *before* deploy? If not, add it — that is the highest-value test in the repo right now.

### 5. THE FLAG SYSTEM ITSELF
- Two mirrors of every flag, and setting one in the wrong place fails silently. That cost this session a
  production defect. Is the parity test enough, or should the mirrors be collapsed? Propose a design.
- 42 flags. Which are dead, which are permanently on, which have never been off in production? A flag
  that is never exercised in one of its states is a latent outage.

### 6. SCALE AND OPERATIONS (carried forward, still unaddressed)
- `project_pagination_scalability`: `COUNT(*)` on every list request, no composite indexes, on the hot
  contest paths.
- 185 `pnpm audit` advisories untriaged; 157 on heatsync (6 critical) per Dependabot. Triage for
  reachability rather than bumping blindly.

### 7. `create-commonpub` (~26 minors stale)
`cargo install create-commonpub` scaffolds an instance from around session 240 — without the
registration gate, the AA fix, verification, or analytics. Its regression test hardcodes the old
versions so it cannot catch drift. Fix the pins, make the test derive them, publish to **crates.io**.

## Roll mechanics (worked cleanly all of session 253)

Bump → `pnpm publish:check` → publish in dependency order (`schema → config → auth → server → ui →
theme-studio → layer`, layer only via `pnpm run publish:layer`) → hand-edit both fork pins (0.x carets
do not cross minors) → regenerate **four** lockfiles (both forks track `package-lock.json` *and*
`pnpm-lock.yaml`) → PR each repo → merge deploys. Fork deploys are **warn-only on health**, so always
curl `/api/health` plus a real route afterwards.

## Landmines (verified in session 253)

- The flag the app reads lives in `commonpub.config.ts`, not `nuxt.config.ts`.
- A green deploy, a 200 on the script, and a parsed config all pass while an integration does nothing.
- `browser.newContext()` does not inherit `playwright.config`'s `use` options.
- better-auth enforces its CSRF origin check only when the request carries a Cookie header.
- Adding a class name without grepping for it first collides (`cpub-cbar` / `CpubCriteriaBar`).
- A sticky element taller than the viewport cannot pin its top.
