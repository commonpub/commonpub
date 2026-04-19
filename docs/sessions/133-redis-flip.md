# Session 133 — Redis flip on prod (addendum)

Date: 2026-04-19

Late-session addition: flipped `NUXT_REDIS_URL` on both prod droplets.
Closes open-item #1 from the long-standing post-130 punch list. The
infrastructure was "wired, not flipped" since session 130; now it's
flipped.

## Starting state (before flip)

- **commonpub.io**: Redis container running, but with NO `--requirepass`
  — droplet's `docker-compose.prod.yml` was one-line older than the
  repo version (missing the `--requirepass ${REDIS_PASSWORD:-changeme}`
  from the command line). `REDIS_PASSWORD` was NOT in `.env`.
  `NUXT_REDIS_URL` was NOT in `.env`. A stale `REDIS_URL=` (no `NUXT_`
  prefix) was present as a dead var.
- **deveco.io**: Redis container running, no `--requirepass` (never was
  in deveco's compose). `NUXT_REDIS_URL=redis://redis:6379` was ALREADY
  set — MEMORY.md claim that it was unset was outdated. App has been
  connecting to Redis all along (once the startup-race settled).
- **Both sites**: only `cpub:*` keys visible on deveco before the flip
  started (~4 keys). Commonpub had 0 until my config change.

## What shipped

### commonpub.io

1. **Synced droplet compose to repo version** via `scp
   deploy/docker-compose.prod.yml root@commonpub.io:/opt/commonpub/`.
   Single-line diff (the `--requirepass` flag). Deploy workflow
   `appleboy/ssh-action` only copies the image tarball, not the
   compose file, so the droplet had drifted.
2. **Generated a hex password** (`openssl rand -hex 24` — 48 chars,
   URL-safe, no special chars that'd break URL parsing).
3. **Added to `.env`**: `REDIS_PASSWORD=<hex>` and
   `NUXT_REDIS_URL=redis://:<hex>@redis:6379` (literal password —
   Docker Compose `env_file` does NOT interpolate `${VAR}` references,
   so the substitution happens once at the shell level, not at runtime).
4. **Removed stale `REDIS_URL=`** from `.env`.
5. **Recreated redis container** to pick up `--requirepass` with the
   new password. Auth verified: `PONG` with password, `NOAUTH` without.
6. **Recreated app container** to pick up `NUXT_REDIS_URL`.

### deveco.io

Investigated, found already correctly wired:
- `NUXT_REDIS_URL=redis://redis:6379` (no password; Redis has no auth).
- 4 `cpub:ratelimit:*` keys already present from organic traffic.
- Zero fail-open logs in last 10 minutes.
- NO ACTION NEEDED. MEMORY.md was just outdated.

## Verification

**commonpub.io:**
```
$ curl -s "https://commonpub.io/api/content?limit=1" # x5
200 200 200 200 200
$ redis-cli ... --scan --pattern "cpub:ratelimit:*" | wc -l
8
$ grep -c "Redis fail-open" app-logs (last 10m)
1   # expected startup-race during app container recreate
```

**deveco.io:**
```
$ curl -s "https://deveco.io/api/content?limit=1" # x5
200 200 200 200 200
$ redis-cli --scan --pattern "cpub:ratelimit:*" | wc -l
6
$ grep -c "Redis fail-open" app-logs (last 10m)
0
```

Client IP `68.3.214.53` (my outgoing IP) appears in `cpub:ratelimit:ip:*`
keys on both sites — end-to-end wiring confirmed from external client
through Caddy through app container through ioredis into Redis.

## Asymmetry: commonpub has auth, deveco doesn't

Deveco's `docker-compose.yml` never had `--requirepass` on the Redis
command. The repo's `deploy/docker-compose.prod.yml` (which commonpub
uses) does. Deveco has its own separate compose file (different repo /
deploy flow — deveco-io has its own branded Dockerfile and deploy).

Both are defensible:
- **commonpub-style (with auth)**: defense-in-depth if the Docker network
  is ever compromised or if Redis is accidentally port-mapped to the host.
- **deveco-style (no auth, network-only)**: simpler; relies on `expose:
  6379` keeping Redis container-internal.

For this session I did NOT unify them — deveco was working, changing its
Redis auth posture would be scope creep beyond "flip Redis URL." Log
this as a follow-up: either add `--requirepass` to deveco's compose
(drift from upstream), or remove it from commonpub's compose (lowest
common denominator). Lean toward adding it to deveco to match the
commonpub-side security posture; it's trivially done on the droplet.

## Compose file drift: broader concern

The droplet's compose file diverged from the repo's because the deploy
workflow only ships the image tarball. Any change to
`deploy/docker-compose.prod.yml` in the repo is effectively a no-op for
running instances unless someone manually syncs it. Session 131 shipped
`--requirepass` in the repo but it never landed on the droplet. Session
133 caught this only because I SSH'd to debug the flip.

**Recommended follow-up**: extend `deploy.yml` to scp the compose file
too, conditional on detecting drift. Out of scope for this addendum.

## Rollback

If Redis needs to be disabled on either droplet:

```
ssh root@<host>
cd /opt/{commonpub,deveco}
# Comment out or empty NUXT_REDIS_URL in .env
sed -i 's|^NUXT_REDIS_URL=|#NUXT_REDIS_URL=|' .env
docker compose -f docker-compose.prod.yml up -d --force-recreate app
```

App restarts using the in-process MemoryRateLimitStore fallback. Byte-
identical behavior to pre-130 code path. Data loss: only the Redis-
backed rate-limit counters (transient, reset every window anyway).
