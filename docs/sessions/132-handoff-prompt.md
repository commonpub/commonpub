# Session 132 → 133 Handoff

Fresh Claude Code context. Sessions 130+131+132 finished a big block of
scaling + hygiene work: Redis integration (opt-in), DB-level integrity
constraints, rate-limit + SSE pub/sub + CI Redis sidecar + fail-open
logger + docs FTS highlighting + 3 of 4 long-standing e2e flakes
repaired. Only one item was punted — the hero-banner dismiss e2e spec
is marked `test.fixme` after two failed repair attempts; no user
impact.

**CI is green on latest `main`. Both prod sites are healthy. No
in-flight work.** The next session can either pick a follow-up from
the list below, or take a fresh priority from the user.

## Orientation — read in order

1. `CLAUDE.md` — standing rules. Critical:
   - **Never add Claude as a git co-author.** No `Co-Authored-By:`,
     `Signed-off-by:`, or AI attribution — in any commit, in any repo.
   - No feature without a flag in `commonpub.config.ts`.
   - Schema changes via committed migrations + `scripts/db-migrate.mjs`,
     never `drizzle-kit push` in CI.
2. `docs/sessions/131-constraints-ci-flakes-observability.md` — the
   big session log for migration 0002 + Redis observability + e2e
   flake fixes.
3. `docs/sessions/132-hero-banner-punt.md` — the short follow-up that
   punted the hero-banner dismiss spec.
4. `docs/sessions/130-redis-integration.md` + the plan at
   `docs/plans/redis-integration.md` — Redis is wired opt-in; the flip
   runbook lives in `codebase-analysis/12-scaling-and-infrastructure.md`.
5. `docs/llm/gotchas.md` + `codebase-analysis/09-gotchas-and-invariants.md`
   — updated with the now-enforced DB constraints.

## Current state (2026-04-19)

**Deployed and healthy (`NUXT_REDIS_URL` unset; memory fallback path):**
- commonpub.io — self-hosted Postgres droplet. Migration 0000/0001/0002
  applied. Both new constraints live. 3 orphan `federated_content.mirror_id`
  rows cleaned by 0002.
- deveco.io — DO managed Postgres. Same migration state, 0 orphans.
- Both sites return 200 + `{"status":"ok"}` on `/api/health`.

**CI green on `main`:**
- `check (22)`: includes Redis integration tests against
  `redis:7-alpine` sidecar (4 tests, ~2s).
- `rust`: ✓
- `e2e`: ✓ (hero-banner spec is `test.fixme` — expected skip).

**Published package versions:**
- `@commonpub/schema` **0.14.4** — migration 0002 + updated types.
- `@commonpub/server` **2.47.2** — rsvpEvent race-safety, fail-open
  logger, SSE publish/subscribe helpers.
- `@commonpub/infra` **0.6.1** — Redis client + rate-limit store +
  pub/sub + `createRedisFailOpenLogger`.
- `@commonpub/layer` **0.18.1** — Redis-aware middleware, SSE stream
  subscription, docs FTS highlighting, e2e flake repairs.
- Unchanged: config 0.11.0, learning 0.5.1, explainer 0.7.12, ui 0.8.5,
  protocol 0.9.9, editor 0.7.9, docs 0.6.2, auth 0.5.1, test-utils 0.5.3.

## Open items (pick one, or wait for user direction)

### High-value, low-effort

1. **Flip `NUXT_REDIS_URL` in prod** — user direction has consistently
   been "wired, not flipped." Don't flip without asking. Runbook:
   `codebase-analysis/12-scaling-and-infrastructure.md` "How to turn
   Redis ON". After flip, watch `[ratelimit:ip]` / `[ratelimit:apikey]`
   log lines in Docker logs to confirm fail-open isn't firing.

2. **Hero-banner dismiss flake — properly debug.** Needs a Playwright
   trace from CI (configure `trace: 'retain-on-failure'` in
   `playwright.config.ts` so failures in CI upload the trace as an
   artifact). Then interactively step through to see what actually
   happens at click-time. Current theories ruled out: useState remount,
   Vue template auto-unwrap-on-write.

3. **Vue quiz UI rebuild** — session 129's server-side quiz grading is
   ready, but the learn-lesson page still sends the old
   `correctIndex` shape. Zero quiz lessons in prod, so no urgency, but
   it's a regression the first time someone creates one.

4. **Wire `onRedisError` logger sink to observability.** Today the sink
   is `console.warn` → Docker logs → journald. When a structured
   logger or metrics surface (Sentry, Prometheus) lands, swap the sink
   for something aggregable.

### Medium

5. **`audittest` user cleanup** — self-flagged session 127 incident.
   Admin's call per that handoff. Still in `users` on commonpub.io.
6. **Mobile responsive audit** — ~70 components without `@media`
   breakpoints. Big project; do piecewise.

### Low / pre-existing

7. **`useAuth.ts` TS2589 deep instantiation** — pre-existing, not
   blocking.
8. **Session store → Redis, BullMQ for activity delivery,
   API-response caching** — all deferred by the session 130 scope doc.

## Non-obvious things to know

- `RateLimitStore.check()` is async. `checkRateLimit()` is async. Back-
  compat alias `new RateLimitStore()` still works and constructs a
  `MemoryRateLimitStore`.
- Turbo 2.x strips env vars unless declared on the task. When adding a
  new test that reads `process.env.X`, add `X` to `turbo.json`'s `test`
  task `env` array too. DATABASE_URL / NUXT_DATABASE_URL /
  REDIS_URL_TEST / CI are already declared.
- Redis pub/sub subscriber MUST keep `enableOfflineQueue: true`
  (the factory does this via `duplicate({ enableOfflineQueue: true,
  maxRetriesPerRequest: null })`). Publisher runs fast-fail because
  it's on the request hot path.
- `rsvpEvent` relies on `ON CONFLICT DO NOTHING` on
  `event_attendees_event_user_unique`. Don't drop that constraint
  without also changing the code path.
- `federated_content.mirror_id` FK is `ON DELETE SET NULL`. Deleting a
  mirror config no longer requires manual null-cascade in app code.

## Standing rules

- **Never add Claude as co-author** — no `Co-Authored-By:`,
  `Signed-off-by:`, or AI attribution anywhere, ever.
- **Conventional commits** — `feat(infra):`, `fix(auth):`,
  `chore(deps):`.
- **Atomic commits.** One logical change per commit.
- **`pnpm publish`**, never `npm publish`. After local `pnpm build` of
  a package, rsync `dist/` into the pnpm store entries used by
  consumers so typecheck sees the new exports.

## Quick reference

- Migration state: `ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "SELECT * FROM drizzle.__drizzle_migrations"'`
- Redis keys (if flipped on): `docker exec commonpub-redis-1 redis-cli -a "$REDIS_PASSWORD" --scan --pattern 'cpub:ratelimit:*'`
- Fail-open log pattern: `[ratelimit:ip] Redis fail-open: exec failed (ECONNREFUSED). Falling back to in-memory behavior...`
- CI runs for current commit: `gh -R commonpub/commonpub run list --branch main --limit 3`.
- Deveco CI: `gh -R devEcoConsultingLLC/deveco-io run list --branch main --limit 3`.
- Session logs at `docs/sessions/` are the authoritative recent-changes record.
