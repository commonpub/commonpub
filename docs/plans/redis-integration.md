# Redis Integration Plan

**Status**: deferred (not started). Written session 128; pick up in a later
session when horizontal scaling matters.

## Why

Two single-process assumptions currently bake scaling debt into the codebase:

1. **Rate-limit store is an in-process `Map`.** `packages/infra/src/security.ts`
   holds IP-level counts in memory. Every Nitro restart resets all counters.
   Run two Nitro instances behind a load balancer and an attacker who splits
   requests across them effectively gets 2× the rate limit. The Public Read
   API added its own in-process `apiKeyRateLimit` Map in session 127 with the
   same problem.
2. **SSE fanout is single-instance.** `/api/realtime/stream` (notification +
   message counts) polls the DB in whatever Nitro process the client is
   connected to. A notification created on instance A never wakes the
   stream on instance B — B's consumer sees it only on the next DB poll
   tick. Event-driven delivery across instances needs a shared bus.

Redis is already provisioned in `docker-compose.yml` and the production
`deploy/docker-compose.prod.yml`. No code imports it. Adding it removes
both scaling walls.

## Scope

### In scope

- Rate-limit store abstraction: `RateLimitStore` interface with `MemoryStore`
  (current) and `RedisStore` implementations. Feature-toggle with
  `NUXT_REDIS_URL` env var: present → RedisStore, absent → MemoryStore.
- API-key rate limiter uses the same abstraction.
- SSE pub/sub: when a notification / message / counter update is written,
  `publish` to a Redis channel keyed by userId. Each Nitro process subscribes
  once at boot and fans events out to its local SSE connections.
- A single `@commonpub/infra` export `createRedisClient({ url })` that returns
  an `ioredis` instance. All callers share it via DI.
- Graceful degradation when Redis connection drops: rate-limit falls back to
  memory (worse but not broken), SSE falls back to polling.

### Out of scope (for the initial wiring session)

- Caching layer (data caching for API responses / session lookups). Separate
  initiative, bigger design surface, save for after scaling proof of need.
- Session store migration (Better Auth sessions currently in Postgres). Works
  fine there until multi-instance web tier lands.
- Queue/job system (currently `setInterval` on `activities` table with
  advisory locks). Fine at current scale; BullMQ later if needed.

## Files to change

### Add

- `packages/infra/src/redis/index.ts` — `createRedisClient`, exported singleton
  getter.
- `packages/infra/src/redis/rateLimitStore.ts` — `RedisRateLimitStore` using
  atomic `INCR` + `EXPIRE NX`.
- `packages/infra/src/realtime/pubsub.ts` — thin publish/subscribe wrapper
  with JSON message payloads.
- `packages/infra/src/__tests__/redis.test.ts` — testcontainers-redis or
  skip-if-no-redis integration tests.

### Modify

- `packages/infra/src/security.ts` — `RateLimitStore` interface; factory that
  picks Memory or Redis based on presence of `createRedisClient`. Current
  `rateLimitIp()` keeps the same signature.
- `packages/server/src/publicApi/middleware.ts` — swap inline `Map` for the
  injected store.
- `layers/base/server/api/realtime/stream.ts` — subscribe once per process
  in an h3 plugin; fan events to local SSE writers.
- Hooks where counts change (notifications.create, messages.create,
  whatever emits SSE updates) — add `publish(channel, payload)` call.

### Config

- `NUXT_REDIS_URL` env var. Consumed by `commonpub.config.ts` → `features.redis`
  or direct config field. Falls back to `redis://redis:6379` inside Docker
  Compose networks, otherwise unset.
- `docker-compose.prod.yml` already starts a Redis container with password;
  docker-compose.yml local dev needs a matching connection string in `.env`.

## Migration path

1. Ship `RateLimitStore` interface + `MemoryStore` wrapper (no behavior
   change yet). Verify tests pass.
2. Ship `RedisStore` + env-based factory. Default unset → no behavior change.
3. Flip `NUXT_REDIS_URL` on commonpub.io in a staging window, monitor.
4. Flip on deveco.io.
5. Wire SSE pub/sub. Ship behind `features.realtime.redis` flag if desired.
6. Promote to default once both instances are stable.

## Risks

- **Connection pool exhaustion.** Many tiny reads can blow ioredis's
  default pool. Use a single shared client per process; no per-request
  clients.
- **Key name collisions.** Namespace keys: `cpub:ratelimit:ip:<ip>:<bucket>`,
  `cpub:ratelimit:apikey:<keyId>:<bucket>`, `cpub:sse:notif:<userId>`.
- **Memory growth.** SSE pub/sub doesn't persist, so that's fine. Rate-limit
  keys must have `EXPIRE` on write.
- **Restart races.** On pod restart, in-flight SSE subscriptions need to
  re-establish. Client already has reconnect logic for SSE; server just
  has to not hang on drop.
- **Broken delivery.** If Redis goes down mid-request, rate-limit should
  fail open (allow) rather than fail closed (reject). Logging + a metric
  for the fallback rate is essential.

## Testing

- Unit tests for `RateLimitStore` (both memory + Redis) on bucket rollover,
  reset semantics, concurrent increment correctness.
- Integration test: two Nitro processes sharing one Redis; exhaust limit
  from process A, verify process B also rejects. Without Redis, verify B
  still allows (documents the hole being closed).
- SSE fanout: two subscribers across two processes; publish once; both
  receive.

## Package versioning

- `@commonpub/infra` minor bump (new exports)
- `@commonpub/server` minor bump (if any server module depends on the new
  abstraction; likely publicApi middleware moves)
- No schema change → no `@commonpub/schema` bump needed

## Estimated effort

~2–3 days for a careful ship:
- Day 1: interface + MemoryStore refactor (no-op behavior change), tests
- Day 2: RedisStore + integration tests
- Day 3: SSE pub/sub wiring, staging flip, monitoring

## Not part of this plan

- Fedify migration. Rejected in session 126 scaling doc.
- Postgres LISTEN/NOTIFY as an alternative to Redis for SSE. Viable for
  single-DB scale but Redis composes better with the rate-limit use case
  and we already have it deployed.
- Kafka / NATS. Overkill for the current traffic.

## References

- Current in-process stores: `packages/infra/src/security.ts` (IP limiter),
  `packages/server/src/publicApi/middleware.ts` (API-key limiter).
- Current SSE endpoint: `layers/base/server/api/realtime/stream.ts`.
- Session 127 scaling notes: `docs/sessions/127-ultrathink-audit-public-api.md`.
- Session 126 scaling doc: `codebase-analysis/12-scaling-and-infrastructure.md`.
