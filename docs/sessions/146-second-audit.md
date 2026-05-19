# Session 146 — Second full-repo audit (deeper pass)

Date: 2026-05-18. Branch: `main`. **Fixes applied + verified locally;
NOT yet committed/published/deployed (paused for go-ahead).**

## Method

Repeat of the 145 maximum-depth method, deeper: 5 parallel research
subagents (packages+145-diff / UI deeper / server+fed deeper / SSRF
remediation design / CLI+CI+docs+145-verification) + self-run gates.
Every finding re-verified against source.

## Session-145 fixes — independently re-verified HOLDING

- ShareToHubModal focus-trap **works** (Vue mount/watch ordering: the
  `onMounted`→`visible=true` false→true transition fires the
  no-`immediate` watcher; trap/Esc/scroll-lock activate). Residual
  LOW: focus is not restored to the trigger on close because `v-if`
  unmounts the modal and `useFocusTrap`'s `onUnmounted` omits restore
  — true for all 5 `useFocusTrap` consumers.
- `article`→`blog` **fully consistent repo-wide** — no residual
  `article` emitter (createContent/updateContent/contentMapper/
  inboxHandlers/useMirrorContent all normalize; the `IN ('blog',
  'article')` reads are deliberate legacy-row tolerance).
- CI server-cmd/admin-promote hardening **correct, no residual gap**
  (appleboy `envs:` forwards via runner env, never templated into
  script; psql `:'u'` binding sound; regex runs pre-psql).
- CLI pins correct (`^0.21.5` etc.); deploy.yml stale-arg gone.
- Layer vitest suite confirmed running in the gate: 47/47.

## Gates (post-fix, all green)

typecheck 26/26 · lint 24/24 · cargo ✓ · drizzle no-drift (count 5,
no schema change) · pathPrefix sweep 0 unresolved · layer 47/47 ·
server 964/3skip · all packages green. Only red = known darwin
sharp-wasm32 build flake.

## Fixed (verified-real, unambiguous, low-risk)

1. **HIGH (live)** `realtime/stream.get.ts` — SSE connection counter
   incremented in handler body, decremented only via `cleanup`
   registered inside the lazily-invoked `ReadableStream.start()`. A
   pre-stream-pull client abort permanently leaked the slot →
   eventual permanent 429 lockout per Nitro process (gotchas wrongly
   said "briefly"). Added a handler-scope idempotent `release()` on
   `req.'close'`; `cleanup()` now calls it.
2. **MED a11y** `editors/MarkdownImportDialog.vue` — full-screen
   modal with zero a11y (pass 1 only swept ShareToHubModal). Wired
   `useFocusTrap` + role=dialog/aria-modal/aria-labelledby (mirrors
   ImportUrlModal's proven `props.show` pattern).
3. **MED/LOW** `RemoteFollowDialog.vue` — `var(--shadow)` is
   undefined in every theme → dialog rendered with NO shadow; →
   `var(--shadow-md)`. Hardcoded `rgba(0,0,0,.5)` backdrop →
   `var(--color-surface-overlay,…)`. `CookieConsent.vue` blurred
   hardcoded shadow → offset token (design-system rule).
4. **MED** `packages/server/.../content.ts` `toggleBuildMark` —
   check-then-insert; concurrent double-click → `content_builds_
   user_content` UNIQUE uncaught **500**. Added `.onConflictDoNothing()`
   + no-double-count path (documented `rsvpEvent` pattern).
5. **MED/LOW docs** `README.md:77` "15"→"16(+5)";
   `docs/federation.md:864,873` dropped deprecated `"article"` from
   two config examples (145's own doc pass missed these).
6. **LOW** `vitest.workspace.ts` — added `layers/*` so a bare
   `vitest` also runs the layer suite (145 wired via turbo only).

No regression tests added for #1/#4: PGlite harness does not enforce
table-level `unique()` (documented) so #4's race is unreproducible
there; #1 needs heavy lazy-stream/h3 mocking for low marginal value.
Flagged honestly rather than adding theater tests.

## Deferred — needs decision/design (NOT fixed)

- **Federation hardening** (SSRF cluster + inbound digest/signature
  defects) — full implementation-ready design in
  `docs/plans/federation-hardening.md`. Dormant (federation OFF in
  prod) but on the critical path before any 2nd instance. Inbound
  digest verifies re-serialized JSON vs raw-byte Digest → all signed
  inbound 401 (interop break). 4 product decisions listed in the plan.
- **Scaffolder one-click deploy likely broken** [HIGH,
  needs-confirmation] — generated Dockerfile `COPY …pnpm-lock.yaml` +
  `--frozen-lockfile` but scaffolder never emits a lockfile; `cli.rs`
  asserts the broken contract. Needs a deploy-contract decision.
- Lower (carried): `delivery.ts:134` dead-letters transient resolve
  failures; `contest.ts:428-441` judge lost-update race;
  `index.vue`/`feed.vue` fetch-error renders as empty-state; avatar
  dropdown `role=menu` w/o arrow-keys/Esc; `contentMapper.ts:150`
  regex sanitizer (outbound, low today); `requireAuth` no ban
  enforcement; `deploy.yml` no-rollback after `--force-recreate`;
  floating action tags; `Dockerfile:29` unpinned runtime npm install;
  `useFocusTrap` no focus-restore for v-if-unmounted modals.

## Release plan (PENDING GO-AHEAD)

`@commonpub/server` 2.53.0 → **2.53.1** (patch: toggleBuildMark race;
no API/schema change). `@commonpub/layer` 0.21.5 → **0.21.6** (patch:
SSE leak, MarkdownImportDialog a11y, theming tokens). Layer depends on
server. Order: **server → layer**; then `tools/create-commonpub`
template.rs (`COMMONPUB_SERVER_VERSION ^2.53.1`,
`COMMONPUB_LAYER_VERSION ^0.21.6`) + tests/cli.rs + cargo; then
deveco.io + heatsynclabs.io `@commonpub/layer ^0.21.6` (separate
install, real exit code, poll npm first); commonpub.io builds from
source on push. README:214 layer-version row to be set to 0.21.6 in
the release commit. No schema change (migration count 5). Leave
heatsync's uncommitted `commonpub.config.ts` + `ONBOARDING.md`
untouched.
