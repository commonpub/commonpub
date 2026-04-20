# Session 134 → 135 Handoff

Fresh Claude Code context. Session 134 extended the session 133 mobile
audit to the next two highest-impact pages (`/videos` index + detail),
and closed the session-133 carryover by publishing
`@commonpub/infra@0.6.2`, `@commonpub/server@2.47.4`, and
`@commonpub/layer@0.18.3` to npm. All three bumps are additive-only.

CI is green on `main`. Both prod sites (commonpub.io + deveco.io) are
healthy on Redis. No in-flight feature work.

## Orientation — read in order

1. `CLAUDE.md` — standing rules. Critical:
   - **Never add Claude as a git co-author.** No `Co-Authored-By:`,
     `Signed-off-by:`, or AI attribution — in any commit, in any repo.
   - No feature without a flag in `commonpub.config.ts`.
   - Schema changes via committed migrations + `scripts/db-migrate.mjs`,
     never `drizzle-kit push` in CI.
2. `docs/sessions/134-mobile-videos.md` — the session 134 work (two
   `@media` blocks for /videos, two new responsive.spec.ts tests,
   layer + infra + server bumps).
3. `docs/sessions/133-quiz-ui-rebuild.md`, `133-redis-flip.md`,
   `133-final-items.md` — the session 133 trilogy (quiz UI + Redis on
   prod + observability). Only re-read these if your task is
   quiz/Redis/observability-adjacent.
4. `docs/llm/gotchas.md` — short-form invariants.
5. `CHANGELOG.md` — `Unreleased` section covers sessions 108–134.

## Current state (2026-04-19, end of session 134)

**Deployed and healthy:**

| Site          | Host          | DB              | Redis URL                                | Redis auth |
|---------------|---------------|-----------------|------------------------------------------|------------|
| commonpub.io  | DO droplet    | self-hosted PG  | `redis://:<hex>@redis:6379`              | --requirepass, password in droplet's .env |
| deveco.io     | DO droplet    | DO managed PG   | `redis://redis:6379`                     | no auth (container-network isolation via `expose:`) |

Both return `{"status":"ok"}` on `/api/health`. Both have live
`cpub:ratelimit:*` keys in Redis under real traffic. One expected
startup-race fail-open per app-container restart is the only noise.

**Published package versions (npm) — session 134 closed the infra/server
carryover:**

| Package              | Version | Session 134 change |
|----------------------|---------|-------------------|
| `@commonpub/schema`  | 0.14.4  | unchanged |
| `@commonpub/server`  | 2.47.4  | **published** — ships the session-133 `apiKeyRateLimit` structured-sink wiring |
| `@commonpub/learning`| 0.5.2   | unchanged |
| `@commonpub/layer`   | 0.18.3  | **published** — /videos mobile CSS + two new e2e tests; `useAuth` cleanup from 133 |
| `@commonpub/infra`   | 0.6.2   | **published** — ships `createStructuredLogger` from session 133 |
| config 0.11.0, explainer 0.7.12, ui 0.8.5, protocol 0.9.9, editor 0.7.9, docs 0.6.2, auth 0.5.1, test-utils 0.5.3 | unchanged |

Reference (`apps/reference/package.json`) pins via `workspace:*` / caret
so it picks up workspace versions automatically. `deveco-io` pins
`@commonpub/layer@^0.18.1` — next `pnpm install` in that repo pulls
0.18.3 and the mobile CSS ships to deveco.io on next deploy.

## Open items (pick one, or wait for user direction)

### Still open

1. **Mobile responsive audit — continue from /learn + /videos pattern.**
   Two pages fixed so far (`pages/learn/index.vue` session 133,
   `pages/videos/{index,[id]}.vue` session 134). Remaining
   high-impact candidates per the 133/134 audits:
   - `pages/federation/users/[handle].vue` (153 CSS lines, 0 @media)
     — federated profile view
   - `pages/admin/federation.vue` (110) + `pages/admin/api-keys.vue`
     (105) — admin-only but used during setup
   - `pages/docs/[siteSlug]/edit.vue` (630 — largest; editor-only)

2. **Session 130's deferred scaling projects.** Each is multi-session,
   explicitly deferred by `codebase-analysis/12-scaling-and-infrastructure.md`:
   - **Session store → Redis.** Move Better Auth sessions off Postgres
     onto Redis so auth survives multi-instance scale-out. Requires a
     Better Auth adapter config change + migration of existing sessions.
   - **BullMQ for activity delivery.** Replace the in-process poll in
     `packages/server/src/federation/worker.ts` with a Redis queue.
     Decouples delivery workers from the app instance.
   - **API-response caching for public read API.** The
     `/api/public/v1/*` endpoints (session 127) are cacheable by
     route + scope. Redis keys with TTL, cache middleware at the
     route layer.

### Incidental improvements surfaced session 131–134

3. **Deploy workflow sync: compose file.** `.github/workflows/deploy.yml`
   only scp's the Docker image tarball. Changes to
   `deploy/docker-compose.prod.yml` (or `deploy/Caddyfile`) in the repo
   never reach droplets without manual sync. Session 131 shipped
   `--requirepass ${REDIS_PASSWORD:-changeme}` to the repo; it sat
   un-deployed until session 133 manually scp'd it. Fix: extend
   `deploy.yml` to scp the compose file (and Caddyfile) if it diffs.

4. **Playwright trace-artifact retention tuning.** Currently 14 days
   regardless of pass/fail. Reduce to 7 days if GH Actions artifact
   quotas become a concern. Not urgent.

### Blocked on you

5. **Unifying Redis auth between commonpub and deveco.** Either add
   `--requirepass` to deveco's compose (defense-in-depth) or remove it
   from commonpub's (simpler, matches deveco). Neither is wrong; posture
   choice.

6. **Deveco-io pin bump.** `deveco-io/package.json` still pins
   `@commonpub/layer@^0.18.1`. Caret matches 0.18.3, so next install
   pulls it; but the lockfile won't update until someone runs
   `pnpm install` in that repo and commits the updated
   `pnpm-lock.yaml`. Trivial PR if you want it explicit.

## Non-obvious things to know

Carryover from 132/133 + additions from 134:

- `RateLimitStore.check()` is async; `checkRateLimit()` is async.
- Turbo 2.x strips env vars unless declared on the task (see
  `turbo.json`'s `test` env array — `DATABASE_URL`, `NUXT_DATABASE_URL`,
  `REDIS_URL_TEST`, `CI` already there).
- Redis pub/sub subscriber MUST keep `enableOfflineQueue: true`;
  publisher is fast-fail.
- `rsvpEvent` uses `ON CONFLICT DO NOTHING` on
  `event_attendees_event_user_unique`.
- `federated_content.mirror_id` FK is `ON DELETE SET NULL`.
- `QuizGrade` has a `results` field (per-question breakdown). If you
  `.toEqual(...)` on the result, use `.toMatchObject(...)` instead or
  include `results` in the expected object.
- The learn-lesson viewer relies on server `results` for per-question
  correctness — the GET-lesson response REDACTS `correctOptionId` +
  `explanation` for non-authors. A well-meaning "let's grade locally"
  refactor would silently score every learner 0%.
- `layers/base/composables/useAuth.ts` contains two `$fetch` casts
  that silence TS2589. Verified upstream in session 133 — removing the
  casts immediately reintroduces the error.
- `@media (max-width: 768px)` is the mobile breakpoint convention
  across the layer. /learn + /videos + hero-banner + filter-toggle all
  use this.
- Playwright trace artifact upload is unconditional-on-non-cancel.
  14-day retention.
- `deploy.yml` only ships the Docker image tarball. Changes to
  `docker-compose.prod.yml` in the repo don't reach the droplet
  automatically.
- commonpub.io's docker-compose now matches the repo (session 133
  manually scp'd it). deveco.io's is still its own separate version.
- `@commonpub/infra` exports `createStructuredLogger({ component, level?, write? })`
  (session 133 addition, published in session 134). Emits one JSON
  line per event to stdout. Used for Redis fail-open observability.
  The layer's `security.ts` inlines an identical 20-line helper
  rather than importing — keep shapes in sync; a comment in the file
  points at the infra helper.
- Server-side quiz grading is the single source of truth for
  correctness. The GET lesson response redacts `correctOptionId` +
  `explanation` for non-authors. Do not refactor to client-side
  grading.
- Session 134 could not run Playwright locally because port 3000 was
  occupied by an unrelated project; CI ran the new /videos tests
  end-to-end and was green.

## Standing rules

- **Never add Claude as co-author** — no `Co-Authored-By:`,
  `Signed-off-by:`, or AI attribution anywhere, ever.
- **Conventional commits** — `feat(infra):`, `fix(auth):`,
  `chore(deps):`, `docs(sessions):`, etc.
- **Atomic commits.** One logical change per commit.
- **`pnpm publish`**, never `npm publish`.
- **Schema changes via committed migrations** — never `drizzle-kit push`
  in CI.
- **After any `package.json` version change, run
  `pnpm install --frozen-lockfile` locally** before pushing.
  Otherwise CI fails on lockfile drift (session 133 learned this
  twice — the fix is trivial, but the CI cycle burns 12 min).

## Quick reference

- Migration state:
  `ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "SELECT * FROM drizzle.__drizzle_migrations"'`
- Redis keys on commonpub (password required):
  `ssh root@commonpub.io 'cd /opt/commonpub && PW=$(grep ^REDIS_PASSWORD= .env | cut -d= -f2) && docker exec commonpub-redis-1 redis-cli -a "$PW" --scan --pattern "cpub:*"'`
- Redis keys on deveco (no auth):
  `ssh root@deveco.io 'docker exec deveco-redis-1 redis-cli --scan --pattern "cpub:*"'`
- CI runs for the current branch:
  `gh -R commonpub/commonpub run list --branch main --limit 3`
- Download a failed-run's Playwright artifact:
  `gh -R commonpub/commonpub run download <run-id> -n playwright-report -D /tmp/pw && pnpm exec playwright show-trace /tmp/pw/test-results/*/trace.zip`
- Publish a single package:
  `pnpm --filter @commonpub/<pkg> publish --access public --no-git-checks`
- Verify published version:
  `npm view @commonpub/<pkg> version`
- Redis flip rollback (if ever needed):
  ```
  ssh root@<host>
  cd /opt/{commonpub,deveco}
  sed -i 's|^NUXT_REDIS_URL=|#NUXT_REDIS_URL=|' .env
  docker compose -f docker-compose.prod.yml up -d --force-recreate app
  ```
- Session logs at `docs/sessions/` are the authoritative recent-changes
  record. When `codebase-analysis/` or `docs/llm/` contradicts a session
  log, trust the log.
