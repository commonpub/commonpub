# Session 131 → 132 Handoff

Fresh Claude Code context. Session 131 shipped DB-level integrity
constraints (eventAttendees UNIQUE + federatedContent.mirrorId FK), wired
CI to run the Redis integration tests against a real sidecar, cleared
every pre-existing e2e flake, and added a rate-limited fail-open logger
for when someone eventually flips `NUXT_REDIS_URL`. Also finally bolded
the docs FTS search matches.

## Orientation — read in order

1. `CLAUDE.md` — standing rules. In particular:
   - **Never add Claude as a git co-author.** No `Co-Authored-By:`,
     `Signed-off-by:`, or AI attribution — in any commit, in any repo.
     Ever.
   - No feature without a flag in `commonpub.config.ts`.
   - Schema changes via committed migrations + `scripts/db-migrate.mjs`.
2. `docs/sessions/131-constraints-ci-flakes-observability.md` — what
   shipped this session with acceptance checks.
3. `docs/sessions/130-redis-integration.md` + `130-handoff-prompt.md` —
   the Redis integration plan and the flip-on runbook (still deferred).
4. `docs/plans/redis-integration.md` — Redis scope doc (still valid).
5. `docs/llm/gotchas.md` + `codebase-analysis/09-gotchas-and-invariants.md`
   — updated with the now-enforced constraints.
6. `codebase-analysis/12-scaling-and-infrastructure.md` — scaling runbook.

## Current state

**Deployed, stable, byte-identical-unless-flipped:**
- commonpub.io — droplet + self-hosted Postgres, Docker + Caddy. Redis
  container running but `NUXT_REDIS_URL` UNSET on app. Migration state
  has 0000/0001/0002 applied.
- deveco.io — droplet + managed Postgres (DO), Docker + Caddy. Same
  state (Redis container running, URL unset, 0002 applied).

**CI green on latest main:** check, rust, e2e all pass — including the
Redis integration suite against a redis:7-alpine sidecar (4 tests,
~2 s).

**Published versions (as of 2026-04-18):**
- `@commonpub/schema` **0.14.4** — migration 0002 (eventAttendees unique
  + federatedContent.mirrorId FK + orphan cleanup).
- `@commonpub/server` **2.47.2** — rsvpEvent race-safety, onRedisError
  default wiring, SSE + publishSseEvent + subscribeSseEvents from 130.
- `@commonpub/infra` **0.6.1** — Redis client + factory +
  RedisRateLimitStore + RedisRealtimePubSub +
  `createRedisFailOpenLogger`. `MemoryRateLimitStore` still the default.
- `@commonpub/layer` **0.18.1** — SSE stream subscription, docs search
  snippet highlighting, e2e flake fixes.
- Unchanged: config 0.11.0, learning 0.5.1, explainer 0.7.12, ui 0.8.5,
  protocol 0.9.9, editor 0.7.9, docs 0.6.2, auth 0.5.1, test-utils 0.5.3.

## What's still open

### High-signal, small effort

1. **Flip `NUXT_REDIS_URL` on commonpub.io, then deveco.io.**
   Exact runbook at `codebase-analysis/12-scaling-and-infrastructure.md`
   "How to turn Redis ON". Verify in logs with the new
   `[ratelimit:ip]` / `[ratelimit:apikey]` scope prefixes. **User
   direction has been: "wire it, don't flip it" — don't flip without
   asking.**
2. **Wire the `onRedisError` logger's sink to something more durable.**
   Current sink is `console.warn` → Docker logs → journald on the
   droplets. Fine for now; swap to a counter / structured logger
   (Prometheus, Sentry, etc.) once there's an observability surface.
3. **Docs FTS — snippet rendering on the federated side**: the
   highlighting util only ships via `@commonpub/layer`. If we ever
   expose federated docs search, the same pattern applies.

### Medium

4. **Vue quiz UI rebuild.** Server-side is correct since session 129;
   the learn-lesson client still sends the old `correctIndex` shape.
   Zero quiz lessons in prod so no urgency, but it's a regression the
   first time someone creates one.
5. **`audittest` user cleanup** — self-flagged session 127 incident.
   Admin's call per that handoff. Remains in `users` on commonpub.io.
6. **Mobile responsive audit** — ~70 components without @media
   breakpoints. Big project; do piecewise.

### Low / pre-existing

7. **`useAuth.ts` TS2589 deep-instantiation** — pre-existing, not
   blocking.
8. **`federatedContent.mirrorId` FK is new; no code changes to
   `deleteMirror` needed** because ON DELETE SET NULL handles it, but
   audit any app-level mirror-deletion paths to confirm they don't
   still do a manual cascade that now conflicts.
9. **Session store → Redis, BullMQ for activity delivery,
   API-response caching** — all deferred by plan.

## Non-obvious things to know going in

- `RateLimitStore.check()` is async. `checkRateLimit()` is async. The
  class alias `new RateLimitStore()` still works and constructs a
  `MemoryRateLimitStore` — third-party callers won't break.
- Turbo 2.x strips env vars unless declared on the task. When adding a
  new test that reads `process.env.X`, add `X` to `turbo.json`'s `test`
  task `env` array too.
- The Redis pub/sub subscriber MUST keep `enableOfflineQueue: true`
  (the factory does this). The publisher runs fast-fail because it's
  on the request hot path.
- `rsvpEvent` relies on `ON CONFLICT DO NOTHING` on
  `event_attendees_event_user_unique` — don't drop that constraint
  without also changing the code path.

## Standing rules (reminder)

- **Never add Claude as co-author** — no `Co-Authored-By:`,
  `Signed-off-by:`, or AI attribution anywhere.
- **Conventional commits** — `feat(infra):`, `fix(auth):`, etc.
- **Atomic commits.** One logical change per commit.
- **Schema changes** via committed migrations + `scripts/db-migrate.mjs`,
  never `drizzle-kit push` in CI.
- **`pnpm publish`**, never `npm publish`. After local `pnpm build` of
  a package, rsync dist into the pnpm store entries used by consumers
  so typecheck sees the new exports.

## Quick reference

- Check migrations applied:
  ```
  ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "SELECT * FROM drizzle.__drizzle_migrations"'
  ```
- Inspect rate-limit keys (when Redis is flipped on):
  ```
  docker exec commonpub-redis-1 redis-cli -a "$REDIS_PASSWORD" --scan --pattern 'cpub:ratelimit:*'
  ```
- Fail-open log lines will appear as:
  `[ratelimit:ip] Redis fail-open: exec failed (ECONNREFUSED). Falling back to in-memory...`
- CI status for the current commit: `gh -R commonpub/commonpub run list --branch main --limit 3`.
- Recent sessions (`docs/sessions/`) are the authoritative log.
