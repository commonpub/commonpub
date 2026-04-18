# Session 129 → 130 Handoff — Redis integration (C from the session-129 plan)

Fresh Claude Code context. Your job this session is to wire Redis into
CommonPub to kill two single-process assumptions that block horizontal
scaling. Plan was written at the end of session 129; executing it now.

## Orientation — read these first

1. `CLAUDE.md` — project rules. **Read the Standing Rules block.** In
   particular:
   - **Never add Claude as a git co-author.** No `Co-Authored-By:`,
     no `Signed-off-by:`, no AI attribution lines, in any commit, in any
     repo. Ever.
   - No feature without a flag in `commonpub.config.ts`.
   - The schema is the work — schema changes before UI.
   - Tests first where feasible.
2. `docs/plans/redis-integration.md` — **your working spec.** Read it top
   to bottom. It has scope, file-by-file changes, migration path, risk
   list, and testing plan.
3. `docs/llm/gotchas.md` — session-128+129 gotchas, including the
   committed-migrations workflow.
4. `docs/sessions/129-quiz-security-docs-fts.md` — what we just shipped.

## Current state (end of session 129)

**Published, deployed, stable on both instances:**
- commonpub.io — droplet + self-hosted Postgres, Docker + Caddy
- deveco.io — droplet + managed Postgres (DO), Docker + Caddy
- Both auto-deploy on push to main; `scripts/db-migrate.mjs` applies
  committed migrations via `drizzle-orm/node-postgres/migrator.migrate()`
- Migration state on both DBs: `0000_session128_baseline` + `0001_docs_content_unstringify`

**Published versions:**
- `@commonpub/schema` **0.14.3** (migration 0001 unwraps docs_pages.content)
- `@commonpub/server` **2.46.1** (quiz grading + docs FTS + content serialization fix)
- `@commonpub/config` **0.11.0** (publicApi flag default false)
- `@commonpub/layer` **0.17.0** (unchanged since session 127)
- `@commonpub/learning` **0.5.1** (gradeQuiz, redactQuizAnswers,
  completeLessonSchema)
- `@commonpub/explainer` 0.7.12, `@commonpub/ui` 0.8.5, `@commonpub/protocol` 0.9.9,
  `@commonpub/editor` 0.7.9, `@commonpub/docs` 0.6.2, `@commonpub/auth` 0.5.1,
  `@commonpub/infra` 0.5.1, `@commonpub/test-utils` 0.5.3

**CI status:** 912 server tests + 97 learning tests green. Reference app
typecheck green. Pre-existing e2e flakes in auth/navigation/smoke unchanged.

## The task this session: Redis integration

The plan doc (`docs/plans/redis-integration.md`) is the authoritative
spec. Summary of the core work:

### Why

Two single-process assumptions limit horizontal scaling:

1. **Rate-limit store is an in-process `Map`.** `packages/infra/src/security.ts`
   (`RateLimitStore`) and `packages/server/src/publicApi/middleware.ts`
   (`apiKeyRateLimit`) both keep counts in memory. Two Nitro instances
   behind a load balancer = attacker splits requests and doubles the
   effective limit.
2. **SSE fanout is single-instance.** `layers/base/server/api/realtime/stream.ts`
   polls the DB in whatever Nitro process the client is connected to.
   A notification written by instance A never wakes a stream on B until
   B's next DB poll tick.

Redis is already provisioned in `docker-compose.yml` + `deploy/docker-compose.prod.yml`.
Nothing imports it yet.

### Scope (what to build)

Per the plan, in rough order:

1. **`packages/infra/src/redis/index.ts`** — `createRedisClient({ url })`
   returning an `ioredis` instance. Singleton per process. Graceful
   connection-failure handling.
2. **`packages/infra/src/redis/rateLimitStore.ts`** — `RedisRateLimitStore`
   using atomic `INCR` + `EXPIRE NX`. Implements the same `RateLimitStore`
   interface the memory version already does.
3. **Refactor `packages/infra/src/security.ts`** — introduce
   `RateLimitStore` interface (if not already); keep a `MemoryStore` as
   the default. Factory picks memory vs Redis based on `NUXT_REDIS_URL`.
4. **Refactor `packages/server/src/publicApi/middleware.ts`** — swap the
   inline `Map` for the shared store.
5. **`packages/infra/src/realtime/pubsub.ts`** — thin publish/subscribe
   wrapper with JSON payloads. Shared subscribe per Nitro process.
6. **Modify `layers/base/server/api/realtime/stream.ts`** — subscribe
   once per process; fan pub-sub events to local SSE writers.
7. **Emit publish** wherever SSE-relevant writes happen (new notifications,
   new messages, count updates). Identify sites by grep for existing SSE
   touchpoints.
8. **Config + env** — `NUXT_REDIS_URL` env var consumed by the factory.
   Falls back to memory/polling if unset. Add to `commonpub.config.ts`
   surface only if we decide to expose via config rather than env alone
   (plan says env-first).

### What NOT to do

- **Do not** migrate Better Auth sessions to Redis this session. Works
  fine in Postgres.
- **Do not** wire a caching layer for API responses.
- **Do not** replace the activity-delivery setInterval+advisory-lock
  with BullMQ. That's a separate initiative.
- **Do not** promote `NUXT_REDIS_URL` to default ON. Ship the code with
  memory as default; flip the env var on staging first.

### Testing strategy

- Unit tests for each store implementation (`MemoryStore`, `RedisStore`)
  covering rollover, reset, concurrent increment correctness.
- Integration test that spins up two "Nitro-like" clients against one
  Redis: exhaust the limit from client A, verify client B also rejects.
  Mirror with memory to document what's being fixed.
- SSE pub/sub: two subscribers, one publisher, both receive.
- Use testcontainers-style spin-up or skip if Redis unavailable (same
  convention as existing `pglite` skip patterns).

### Ship order

1. Interface refactor + MemoryStore wrapper (no-op behavior change). Tests green.
2. `ioredis` client + `RedisStore` + integration tests.
3. Factory that picks based on env. Defaults: unset → memory (no change).
4. SSE pub/sub wiring, still defaulting off.
5. `pnpm publish` `@commonpub/infra` + `@commonpub/server` minor bumps.
6. Push. Deploys go green because default is still memory.
7. Flip `NUXT_REDIS_URL` in `/opt/commonpub/.env` on commonpub.io,
   monitor, then deveco.io.

### Risk list (from plan)

- **Connection pool exhaustion.** Use a single shared client per process.
- **Key name collisions.** Namespace: `cpub:ratelimit:ip:<ip>:<bucket>`,
  `cpub:ratelimit:apikey:<keyId>:<bucket>`, `cpub:sse:notif:<userId>`.
- **Memory growth.** Always `EXPIRE` on rate-limit write. SSE pub/sub
  doesn't persist so no growth there.
- **Restart races.** Clients already reconnect SSE; server just needs
  to not hang on drop.
- **Broken delivery.** If Redis goes down mid-request, rate-limit
  should **fail open** (allow) rather than fail closed (reject). Log
  + metric on the fallback rate.

### Acceptance criteria

- With `NUXT_REDIS_URL` UNSET: behavior identical to today (all tests
  still green).
- With `NUXT_REDIS_URL` SET: rate limits enforced across multiple
  Nitro processes sharing a Redis; SSE events published from one process
  reach subscribers on another.
- Redis down mid-request: rate-limit fails open; SSE falls back gracefully.
- No ephemeral-state assumptions leak into tests (no flaky cross-test
  state via Redis — tests either use memory or a fresh Redis per suite).

## Standing rules (the important ones)

- **Never add Claude as co-author** — `docs/llm/conventions.md`,
  `CLAUDE.md` §15. Commit messages are the human's own; no
  `Co-Authored-By:`, `Signed-off-by:`, AI attribution lines. Not in
  commonpub, not in deveco, not anywhere.
- **Conventional commits** — `feat(infra):`, `feat(server):`,
  `test(infra):`, `chore(deps):`.
- **Atomic commits** — one logical change per commit. Land the interface
  refactor, the implementation, and the wiring as separate commits.
- **Schema changes go through `pnpm --filter=@commonpub/schema db:generate`**
  and get committed as `packages/schema/migrations/000N_*.sql` +
  journal/snapshot updates. No schema changes expected this session.

## Open threads NOT in scope for this session

1. **Vue quiz UI rebuild** (session-129 finding). Zero quiz lessons in
   prod, so no urgency.
2. **Docs FTS snippet highlighting in UI** — `ts_headline` returns
   `<b>...</b>` wrapping; the UI currently renders plain text. UX nice-to-have.
3. **Pre-existing e2e flakes** (auth.spec, navigation.spec hero-banner,
   smoke.spec contests) — not ours, not blocking.
4. **Public API phase 3 extras** (webhook subs, OAuth2 client-credentials
   writes, Personal Access Tokens, auto-OpenAPI-from-Zod) — separate initiatives.
5. **`audittest` user cleanup** (session-127 incident) — admin's call.
6. **federatedContent.mirrorId FK** + **eventAttendees unique constraint**
   — known data gaps, neither user-facing.
7. **`useAuth.ts` TS2589** deep-instantiation — pre-existing, not a blocker.

## Quick reference

- Deploy workflow: push to main → GH Actions → droplet → `docker compose up -d`
  → `node scripts/db-migrate.mjs`. Fails hard on migrate errors.
- Check migrations applied: `docker exec commonpub-postgres-1 psql -U commonpub
  -d commonpub -c "SELECT * FROM drizzle.__drizzle_migrations"`
- commonpub pg shell: `ssh root@commonpub.io 'docker exec -it commonpub-postgres-1 psql -U commonpub -d commonpub'`
- deveco pg shell: `ssh root@deveco.io 'docker run --rm -it --network host postgres:16-alpine
  psql "$(docker exec deveco-app-1 env | awk -F= "/NUXT_DATABASE_URL/{print \$2}")"'`
- Backups at `/root/db-backups/` on both droplets if a prod write needs
  rolling back.

Start by reading `docs/plans/redis-integration.md`. Then scaffold the
interface + memory store refactor as the first commit before introducing
any new dependencies.
