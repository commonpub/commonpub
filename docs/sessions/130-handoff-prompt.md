# Session 130 → 131 Handoff — Redis is wired, now flip it

Fresh Claude Code context. Session 130 shipped the Redis-backed scaling
path (rate-limit + SSE pub/sub) behind `NUXT_REDIS_URL`. Code is live on
`main`, both instances are deployed with the env var **unset** (so
behavior is byte-identical to pre-130). The remaining work is to turn it
on, verify, and handle a few follow-ups.

## Orientation — read these first

1. `CLAUDE.md` — standing rules. In particular:
   - **Never add Claude as a git co-author.** No `Co-Authored-By:`,
     `Signed-off-by:`, or AI attribution — in any commit, in any repo.
     Ever. Enforced by reviewers.
   - No feature without a flag in `commonpub.config.ts` (Redis is gated
     on an env var, which is fine for infra — features stay config-gated).
   - Schema changes via committed migrations + `scripts/db-migrate.mjs`.
2. `docs/sessions/130-redis-integration.md` — what shipped, with
   acceptance criteria and deploy checklist.
3. `docs/plans/redis-integration.md` — the working spec that drove 130.
4. `docs/llm/gotchas.md` — session-128+ gotchas, including the
   committed-migrations workflow.

## Current state (end of session 130)

**Published, deployed, stable (Redis opt-in, default off):**
- commonpub.io — droplet + self-hosted Postgres, Docker + Caddy, Redis
  container ALREADY running (`deploy/docker-compose.prod.yml`), just not
  wired.
- deveco.io — droplet + managed Postgres (DO), Docker + Caddy, Redis
  container ALREADY running, just not wired.

**Published versions:**
- `@commonpub/infra` **0.6.0** — NEW: `RateLimitStore` interface,
  `MemoryRateLimitStore`, `RedisRateLimitStore`, `createRateLimitStore`,
  `MemoryRealtimePubSub`, `RedisRealtimePubSub`, `createRealtimePubSub`,
  `createRedisClient`. `checkRateLimit` is now async.
- `@commonpub/server` **2.47.0** — `publishSseEvent`,
  `subscribeSseEvents`, `createRateLimitStore` re-export. `createNotification`
  and `sendMessage` fire-and-forget publish; `apiKeyRateLimit.check` is
  async.
- `@commonpub/layer` **0.18.0** — Nitro middleware awaits the new async
  limiter; SSE stream subscribes to pub/sub + 30 s poll safety net.
- Unchanged: schema 0.14.3, config 0.11.0, learning 0.5.1, explainer
  0.7.12, ui 0.8.5, protocol 0.9.9, editor 0.7.9, docs 0.6.2, auth 0.5.1,
  test-utils 0.5.3.

**Tests:** 257 infra + 912 server + 75 reference green. Redis integration
test file (`packages/infra/src/__tests__/redis.integration.test.ts`)
skipped locally; opt in via `REDIS_URL_TEST` env var.

## The task this session

### Step 1 — Flip `NUXT_REDIS_URL` on commonpub.io

The Redis container already runs on both droplets with a password from
`REDIS_PASSWORD` in the droplet's `.env`. To enable cross-process rate
limits + SSE fanout:

```bash
ssh root@commonpub.io
cd /opt/commonpub
# .env already has REDIS_PASSWORD. Source it so the URL expands correctly.
set -a; source .env; set +a
# Append NUXT_REDIS_URL if not present.
grep -q '^NUXT_REDIS_URL=' .env || \
  echo "NUXT_REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379" >> .env
docker compose up -d --force-recreate app
docker compose logs -f app | head -100
```

Verify after a minute:
- App responds. No `[realtime]` or fail-open spam in logs.
- `docker exec commonpub-redis-1 redis-cli -a "$REDIS_PASSWORD" --scan --pattern 'cpub:ratelimit:*' | head -5` should return rate-limit keys once real traffic flows.
- Hit `/auth/login` 6× fast from a browser. 6th request should 429.
- Open a hub post in two browser sessions of the same user (or a second
  logged-in user messaging them). Post a comment in one; notification
  badge in the other should update within ~1 s (was up-to-10s).

### Step 2 — Roll to deveco.io

Same procedure after ~24 h clean on commonpub.io:

```bash
ssh root@deveco.io
cd /opt/deveco
set -a; source .env; set +a
grep -q '^NUXT_REDIS_URL=' .env || \
  echo "NUXT_REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379" >> .env
docker compose up -d --force-recreate app
```

Note: deveco-io consumer repo is still pinned to the PRE-130 layer
version. Bump `@commonpub/layer` in `deveco-io/package.json` to
`^0.18.0`, `pnpm install`, commit, push — that triggers the deveco
auto-deploy. THEN flip the env var.

### Step 3 — Rollback plan

If either instance misbehaves with Redis on:

```bash
ssh root@<host>
cd /opt/<instance>
sed -i.bak '/^NUXT_REDIS_URL=/d' .env
docker compose up -d --force-recreate app
```

The memory path is the same code that ran in session 129 — known good.

## Rollback is safe because…

- `createRateLimitStore({ redisUrl: undefined })` returns a plain
  `MemoryRateLimitStore`, identical shape to the pre-0.6.0 class.
- `createRealtimePubSub({ redisUrl: undefined })` returns an in-process
  EventEmitter wrapper; same-process publishes still reach local SSE
  subscribers, so per-process delivery is unchanged.
- SSE stream still polls (at 30 s — slightly slower than the pre-130 10 s
  poll, but events arrive via in-process pub/sub immediately anyway, so
  the user-facing latency is unchanged).

## Fail-open behavior to be aware of

`RedisRateLimitStore.check()` catches every error path and returns
`{ allowed: true, remaining: limit - 1 }` when Redis is unreachable. The
`onRedisError` hook fires with `{ operation, key }` — currently wired to
no-op. Wire it to structured logging or a counter if you add observability.

ioredis client is configured fast-fail (`enableOfflineQueue: false`,
`commandTimeout: 500`, `maxRetriesPerRequest: 1`) so a Redis outage adds
at most ~500 ms of latency before falling open, not the multi-second
pile-up the default config would cause.

## Open threads from session 130

1. **No metric sink for `onRedisError`** — stores accept the hook but the
   app doesn't wire one. Add once there's a structured logging or
   Prometheus surface.
2. **Redis integration test needs CI sidecar.** The test file works
   locally against a real Redis (`REDIS_URL_TEST=redis://localhost:6379
   pnpm -F @commonpub/infra test`) but CI doesn't start one. Follow-up:
   add a `redis:7-alpine` service to GitHub Actions.
3. **Better Auth session store** — still Postgres. Works fine at
   current scale; moving to Redis is a separate initiative.
4. **BullMQ for activity delivery** — deferred per the plan. Current
   `setInterval` + advisory locks in `activities` table is fine.
5. **API-response caching** — bigger design surface, deferred.

## Open threads older than 130 (still relevant)

1. **Vue quiz UI rebuild** (session 129). Zero quiz lessons in prod;
   not urgent.
2. **Docs FTS snippet highlighting in UI** (session 129).
3. **Pre-existing e2e flakes** (auth.spec, hero-banner, smoke.spec) —
   not ours.
4. **`audittest` user cleanup** (session 127 incident).
5. **federatedContent.mirrorId FK** + **eventAttendees unique
   constraint** — known data gaps, neither user-facing.
6. **`useAuth.ts` TS2589** — pre-existing.

## Standing rules (the important ones)

- **Never add Claude as co-author.** No `Co-Authored-By:`,
  `Signed-off-by:`, or AI attribution, in any commit, in any CommonPub
  repo.
- **Conventional commits** — `feat(infra):`, `fix(auth):`, `chore:`.
- **Atomic commits.** One logical change each.
- **Schema changes** via committed migrations + `scripts/db-migrate.mjs`.

## Quick reference

- Deploy: push to `main` → GH Actions → droplet → `docker compose up -d`
  → `scripts/db-migrate.mjs`.
- Check rate-limit keys in Redis:
  `docker exec commonpub-redis-1 redis-cli -a "$REDIS_PASSWORD" --scan --pattern 'cpub:ratelimit:*'`
- Check pub/sub channels:
  `docker exec commonpub-redis-1 redis-cli -a "$REDIS_PASSWORD" pubsub channels 'cpub:sse:*'`
- Postgres shells:
  - commonpub.io: `ssh root@commonpub.io 'docker exec -it commonpub-postgres-1 psql -U commonpub -d commonpub'`
  - deveco.io: `ssh root@deveco.io 'docker run --rm -it --network host postgres:16-alpine psql "$(docker exec deveco-app-1 env | awk -F= "/NUXT_DATABASE_URL/{print \$2}")"'`
- Backups at `/root/db-backups/` on both droplets.
