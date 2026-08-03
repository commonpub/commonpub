# Session 249 — Production-Readiness Sweep (contest launch 2026-08-03)

Hardening + verify pass before a real contest goes live on **deveco.io** with real traffic
(public registration via a rich 41-field form: file upload + signature + address + 7 required
agreements; entry submission; judging; CSV export of entrant PII). NOT the P2 register/entry
unification.

## Method

Ran an `ultracode` fan-out **Workflow** (`contest-launch-readiness-sweep`): 8 parallel finders
across the ranked dimensions (scale/pagination/indexes, rate-limit coverage, concurrency/
atomicity, upload+private-files, PII authz/export, CSP/XSS/legacy-URLs, ops/health/errors,
lifecycle correctness) → each finding **adversarially verified refute-by-default**. 25 agents,
17 findings → **1 confirmed launch blocker, 16 refuted**. Every confirmed/decision item was then
re-verified by hand against source (the verifiers over-refuted a couple of cheap real fixes, and
contradicted each other on the Caddyfile — resolved empirically).

## Confirmed blocker (fixed)

**Upload OOM DoS.** `layers/base/server/api/files/upload.post.ts:18` calls
`readMultipartFormData(event)` which buffers the **entire** request body into memory before the
100MB size check (`validateUpload`, `packages/infra/src/storage.ts:422`). No app-level
Content-Length pre-check, no Nitro body cap. **deveco's `deploy/Caddyfile` catch-all had NO
`request_body` cap** (only the three `/inbox` blocks were capped at 1MB) — so `/api/files/upload`
flowed through the uncapped catch-all. commonpub.io's Caddyfile already caps the catch-all at
128MB (line 58); deveco did not. An authenticated user (accounts are cheap with `emailUnverified`
ON) streaming a multi-GB body OOM-kills the app container → contest outage.

Fixes (defense in depth):
1. **`deveco-io/deploy/Caddyfile`** — added `request_body { max_size 128MB }` to the catch-all
   (verbatim parity with commonpub.io; `caddy validate` clean). Edge cap aborts oversized bodies
   before Node buffers them. **Deployed to deveco (config-only, operator-approved).**
2. **`upload.post.ts`** — Content-Length fast-path: reject `> 128MB` with 413 **before**
   `readMultipartFormData`. Defense-in-depth for within-limit concurrent uploads, chunked/no-
   Content-Length bodies, and self-hosters without a tuned proxy. (Layer roll — pending.)

## Cheap hardening also fixed (operator chose "blocker + cheap hardening")

- **`advanceContestStage` lost-update** (`packages/server/src/contest/judging.ts`): read the
  cohort OUTSIDE the txn then wrote recomputed `stageState`/`currentStageId` inside — two
  organizers advancing concurrently (or a judge scoring mid-advance) could clobber each other.
  Now reads the entry rows INSIDE the txn with `FOR UPDATE`, mirroring the sibling
  `judgeContestEntry` lock. (Server roll.)
- **`safeHref` belt** on the two contest URL-field sinks (`judge.vue:308`,
  `entries/[entryId].vue:151`) — write-validation already blocks non-http(s) under url-typed
  fields, but the project's own `safeUrl.ts` policy requires the render guard on every
  user-sourced `:href`. (Layer roll.)
- **`/api/health` readiness probe** (`health.get.ts`) — was `{status,timestamp}` only; now runs
  `SELECT 1` and returns 503 when Postgres is unreachable, so an LB/monitor can pull a broken
  instance from rotation. Never throws. (Layer roll.)

## Known item — DOCUMENTED, left as-is (operator decision)

**Entry submission auto-registers a `tier='full'` participant with no agreement acceptance.**
`entries.post.ts` gates on content ownership/status/eligibility + contest `active`, then
`submitContestEntry` (`entries.ts:308`) upserts a registration `tier='full'` via
`onConflictDoUpdate` — with NO check that the user registered or accepted the required
agreements. So the **API** permits becoming a counted participant without accepting the 7
required agreements. Left as-is for launch (operator confirmed the UI flow requires
register-then-enter; touching the entry↔registration relationship is P2 unification territory,
too invasive the night before). **If entry-without-registration ever becomes UI-reachable, add a
consent precondition to `entries.post.ts`.**

## Refuted (verified NOT launch blockers)

- Per-contest list COUNT-per-request + single-column-only indexes — bounded to ONE contest's
  rows (hundreds–low-thousands day one); a few ms via the `contest_id` index. Not a launch-scale
  problem. (Global-feed pagination scalability remains a real but separate post-launch item —
  `project_pagination_scalability`.)
- Registration write path — already transactional + idempotent (`onConflictDoNothing`),
  double-submit safe.
- Private-file serving (`files/[id]/raw.get.ts`) — correct per-contest scoping, uniform 404 (no
  oracle), streamed.
- Auth rate limiting — Better Auth's own limiter is enabled by default in production.
- Contest-route rate-limit bucket coarseness (all `/api/contests/*` share one 60/min per-user
  bucket) — acceptable; registration/entry require auth.
- CSV export / entries / registrants unbounded loads — bounded at launch-day volume.
- `>50`-field / ingestion caps — creation-side cap (50) is authoritative.
- Empty-object satisfies a required address/file field — data-quality nit, no crash/leak. LOW.

## Deferred (documented, NOT for tonight)

- **Nonce-based CSP.** `middleware/security.ts:92` overrides `script-src` to `'self'
  'unsafe-inline'` (confirmed live on deveco) — the root enabler of the stored-XSS class. A nonce
  CSP is the biggest single hardening but HIGH regression risk the night before (Nuxt inlines
  hydration scripts); the real defense is the write-time validators + `safeHref` render guards,
  which are comprehensive. Revisit post-launch.
- Legacy-row URL scrub migration (0046) — needs a deveco DB check for pre-guard bad rows first;
  renders are already `safeHref`-guarded.
- Global-feed composite indexes / cursor pagination (post-launch scale work).

## Verification (all local, green)

- server: **1776/1776** tests, typecheck clean.
- layer: `safeUrl` + `register-routes` tests pass; `apps/reference` `nuxi typecheck` clean.
- E2E (Playwright, port 3001): normal upload → 200 (guard doesn't break it); **oversized
  Content-Length → 413** (guard works); health probe reports `checks.database:ok`; rich 41-field
  register form renders (37 inputs) at desktop + **390px with no horizontal overflow**; contest
  detail loads. Screenshots in scratchpad.

## Roll status — ROLLED TO ALL 3

- **deveco Caddyfile (blocker):** DEPLOYED to deveco first, independently (operator-approved).
- **App hardening — server 2.122→2.123 + layer 0.117→0.118, NO migration, NO schema/config/infra
  change — ROLLED to all 3** (operator approved "deploy on all instances"):
  - Published `@commonpub/server@2.123.0` + `@commonpub/layer@0.118.0` to npm (propagated).
  - ff-merged `main` → **commonpub.io** deploy (uses the local layer).
  - Bumped **deveco** + **heatsync** pins (`@commonpub/server ^2.123.0`, `@commonpub/layer
    ^0.118.0`; layer hand-edited — 0.x caret locks the minor) + regen BOTH lockfiles
    (`npm install --package-lock-only` + `pnpm install --lockfile-only`) → pushed → deploys.
  - **Full-lifecycle contest E2E: 44/44** on a deveco-matching config (all email flags ON) —
    rich registration (file+signature+address+2 agreements) → consent+PII → confirmation-email
    enqueue → entry → judging → **advance topN (the changed path): correct 2-advanced/1-eliminated
    results + idempotent** → completed/ranks → CSV export (PII+consent+no-store, non-org 403) →
    private-file per-contest scoping (owner/organizer 200, other 404) → upload 413 → health probe.
    Visually confirmed via screenshots (results podium, judge view, registrants, 390px form).

Current LIVE (all 3): schema 0.63 / config 0.35 / infra 0.19 / **server 2.123** / **layer 0.118**,
migration 0045.

## Open / next

- Fix the long-red `e2e` CI (stale `/auth/register` submit assertion) — deferred this session
  (operator chose the middle scope, not the ops-extras option).
- Backup + rollback runbook — deferred (same).
- Deferred hardening (documented above): nonce CSP; legacy-URL scrub migration 0046; global-feed
  composite indexes; entry-consent guard (if entry-without-registration becomes UI-reachable).
