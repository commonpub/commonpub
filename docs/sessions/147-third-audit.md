# Session 147 — Third full-repo audit (convergence pass)

Date: 2026-05-18. Branch: `main`. **SHIPPED + verified live on all
three instances.**

## Shipped

5 atomic commits (commonpub `main` d42e586..e3176a3). Published
`@commonpub/explainer@0.7.13` then `@commonpub/layer@0.21.7` (dep
order; both npm-propagation-confirmed). CLI pin `^0.21.7`
(template.rs + tests/cli.rs; cargo 26/26). Dependants: deveco
`32c300b..469c204`, heatsync `7cf27c6..6c180d2` (its uncommitted
`commonpub.config.ts` + untracked `ONBOARDING.md` left untouched —
verified post-commit). **Deploys all success (no SSH flake):**
commonpub.io 26070181484, deveco.io 26070209417, heatsynclabs.io
26070227659. Post-deploy `/api/health` 200 + SSR homepages 200 on
all 3. Gates green: typecheck 26/26, lint 24/24, explainer 191/191,
layer 47/47, cargo 26/26, sweep 0 unresolved (only the known
sharp-wasm32 build flake red).

## Method

Third repeat of the 145/146 method: 5 parallel subagents partitioned
for FRESH surface (auth/session/security; editor/explainer/learning/
docs/infra internals; UI/UX a11y+perf deep; server/API breadth+
migrations+public-API; build/CI/supply-chain+repo-health) + self-run
gates. Each agent verified the 146 diff didn't regress and was told
to report NET-NEW only and say so plainly if a surface is clean.

## Convergence

This pass converged sharply — far fewer findings than 145/146, as a
maturing audit should. Most surfaces verified CLEAN with no
manufactured findings. **146 fixes independently re-verified holding**,
including a rigorous path-analysis proof that the SSE-counter
`release()` is exactly-once in every path (pre-start abort, normal
close, double 'close', start() throws); scaffolder Dockerfile/pins/
README metrics all exact; toggleBuildMark correct.

## Gates (post-fix)

typecheck 26/26 · lint 24/24 · explainer + layer + all package suites
green · cargo unaffected (no Rust changed) · drizzle no-drift (count
5) · pathPrefix sweep 0 unresolved. Only red = known sharp-wasm32
build flake.

## Fixed (verified-real, unambiguous, low-risk)

1. **HIGH (live security)** `packages/explainer/modules/custom-html/
   Viewer.vue` — the `sandboxed` author toggle (`config.ts`) set false
   emitted an iframe with NO `sandbox` attribute, so author-supplied
   `<script>` ran same-origin → any registered explainer author had a
   stored-XSS primitive against every viewer (explainers default-on,
   not federation-gated). Fixed: `sandbox="allow-scripts"` is now
   unconditional (custom JS still runs, but in an opaque origin — no
   parent cookie/DOM/same-origin-fetch access); removed the
   misleading `sandboxed` config toggle. → `@commonpub/explainer`.
2. **MED (live)** `components/contest/ContestHero.vue` — hero overlay
   `--hero-border`/`--hero-surface` were hardcoded white-alpha; in
   dark theme the hero bg flips near-white so countdown blocks /
   dividers / dark button went invisible (white-on-white). Now
   `color-mix(... var(--hero-text) ...)` so they track the inverted
   hero in both themes (also removes the hardcoded color).
3. **LOW** `pages/docs/[siteSlug]/edit.vue` — three hardcoded colors
   → `var(--color-surface-overlay)` / `var(--red-bg)` / `var(--text-xs)`.
4. **LOW (a11y)** `components/views/ProjectView.vue` — TOC
   `scrollIntoView({behavior:'smooth'})` ignored `prefers-reduced-
   motion`; now gated via `matchMedia`.
5. **LOW (docs)** CHANGELOG had no 145/146 entries (two cycles stale)
   → added + manifest bumped; README "as of session 144" → 146;
   README schema-deploy caveat rewritten (it told operators to run
   `drizzle-kit push` / hand-apply enum SQL — directly contradicts
   the committed-migration invariant; an operator footgun).

No regression test for #1: explainer has no SFC-render test infra
(logic tests only); the one-line static `sandbox` attribute is
trivially verified by reading the SFC — no fragile new-infra test
added (same honest stance as 146's SSE/toggleBuildMark).

## Deferred — documented, NOT fixed

- **`docs/plans/federation-hardening.md` Part 3 (new):** hand-minted
  unsigned/wrong-named session cookies break federated+Mastodon SSO
  login (HIGH, fail-closed, dormant — flags OFF in prod); spoofable
  X-Forwarded-For rate-limit key (needs proxy-contract confirmation).
  Tracked with the SSRF + inbound-digest work (same second-instance
  milestone). Sensitive auth code — needs the real flow exercised,
  not a hasty in-audit patch.
- **LOW carry-forward (session log only):** explainer regex sanitizer
  is bypassable (defense-in-depth, wiring correct, sole barrier for
  federated explainer content — same class as contentMapper);
  `learn`/`videos`/`docs` API routes never call `requireFeature`
  (rule-2 contract gap; ~40 routes; features default-on so low
  real-world impact — recommend a dedicated mechanical follow-up
  rather than bundling 40-file changes here); BlockTuple
  unknown-type drop on version skew; Meilisearch filter injection in
  dead-code adapter (live path parameterized); poll-vote postId not
  scoped to `:slug` (not exploitable — server fn re-scopes);
  index.vue `Date.now()` inline hydration-unstable; HubHero
  decorative white-alpha overlays (product-decision).

## Release plan (PENDING GO-AHEAD)

`@commonpub/explainer` 0.7.12 → **0.7.13** (security: custom-html
sandbox). `@commonpub/layer` 0.21.6 → **0.21.7** (ContestHero
dark-mode, edit.vue tokens, ProjectView reduced-motion). Layer
depends on explainer (workspace:*). Order: **explainer → layer**;
then `tools/create-commonpub` `template.rs` `COMMONPUB_LAYER_VERSION
^0.21.7` + `tests/cli.rs` + cargo; then deveco.io + heatsynclabs.io
`@commonpub/layer ^0.21.7` (separate install, real exit, poll npm
first); commonpub.io builds from source on push. README layer-version
row → 0.21.7 in the release commit. No server/schema change
(migration count 5). Leave heatsync's uncommitted `commonpub.config.ts`
+ `ONBOARDING.md` untouched.
