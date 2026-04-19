# Session 133 → 134 Handoff

Fresh Claude Code context. Session 133 was one of the biggest sessions
in recent history — closed 7 of 8 open items from the session 132
list, shipped Redis-backed rate limiting to both prod droplets, and
turned a handful of CI infrastructure quirks into real improvements
(Playwright trace artifacts, unconditional-on-non-cancel uploads,
compose-file drift discovery).

**CI should be fully green on the tip of `main`** (artifact upload +
structured logging changes are additive; the only test assertion I
added — mobile-layout stacking check in `responsive.spec.ts` — was
validated against the local workspace before push). Both prod sites
are healthy, both on Redis. No in-flight feature work.

## Orientation — read in order

1. `CLAUDE.md` — standing rules. Critical:
   - **Never add Claude as a git co-author.** No `Co-Authored-By:`,
     `Signed-off-by:`, or AI attribution — in any commit, in any repo.
   - No feature without a flag in `commonpub.config.ts`.
   - Schema changes via committed migrations + `scripts/db-migrate.mjs`,
     never `drizzle-kit push` in CI.
2. `docs/sessions/133-quiz-ui-rebuild.md` — the primary session 133
   work (Vue quiz editor + viewer rebuild, `QuizGrade.results`
   per-question breakdown).
3. `docs/sessions/133-redis-flip.md` — the Redis flip on both droplets
   (commonpub with auth, deveco without) + compose-file drift finding.
4. `docs/sessions/133-final-items.md` — audittest cleanup, structured
   JSON logs for fail-open events, `/learn` mobile breakpoint.
5. `docs/llm/gotchas.md` — short-form invariants, updated this session
   with the server-side quiz-grading invariant.
6. `CHANGELOG.md` — `Unreleased` section covers sessions 108–133.

## Current state (2026-04-19, end of session 133)

**Deployed and healthy:**

| Site          | Host          | DB              | Redis URL                                | Redis auth |
|---------------|---------------|-----------------|------------------------------------------|------------|
| commonpub.io  | DO droplet    | self-hosted PG  | `redis://:<hex>@redis:6379`              | --requirepass, password in droplet's .env |
| deveco.io     | DO droplet    | DO managed PG   | `redis://redis:6379`                     | no auth (container-network isolation via `expose:`) |

Both return `{"status":"ok"}` on `/api/health`. Both have live
`cpub:ratelimit:*` keys in Redis under real traffic. One expected
startup-race fail-open per app-container restart is the only noise in
the logs.

**Published package versions (npm):**

| Package              | Version | Session 133 change |
|----------------------|---------|-------------------|
| `@commonpub/schema`  | 0.14.4  | unchanged |
| `@commonpub/server`  | 2.47.3  | `QuizGrade.results` pass-through; structured-log sink inside `apiKeyRateLimit` (not yet published — workspace-only) |
| `@commonpub/learning`| 0.5.2   | `QuizGrade.results` + `QuizQuestionResult` |
| `@commonpub/layer`   | 0.18.2  | Quiz editor/viewer rebuild; hero-banner test-side fix; /learn mobile breakpoint; inline structured logger; useAuth cleanup |
| `@commonpub/infra`   | 0.6.1   | `createStructuredLogger` added (not yet published — workspace-only) |
| config 0.11.0, explainer 0.7.12, ui 0.8.5, protocol 0.9.9, editor 0.7.9, docs 0.6.2, auth 0.5.1, test-utils 0.5.3 | unchanged |

**Not-yet-published:** `@commonpub/infra` (`createStructuredLogger`
source) + the updated `apiKeyRateLimit` in `@commonpub/server`. Prod
picks these up via the Docker-build-from-source deploy, so no urgency.
External consumers (deveco-io repo) wouldn't see the `createStructuredLogger`
export until a coordinated minor bump lands.

## Open items (pick one, or wait for user direction)

Session 133 closed items #1–#7 from the session 132 handoff (some
partial). Remaining:

### Still open

1. **Mobile responsive audit — continue from /learn pattern.**
   Session 133 fixed one page (`pages/learn/index.vue`) with an
   `@media (max-width: 768px)` block + two e2e tests in
   `responsive.spec.ts`. The same pattern applies to other
   high-traffic pages whose CSS has 0 `@media` queries. Candidates
   by descending impact (per session 133 audit):
   - `pages/videos/index.vue` (127 CSS lines, 0 @media) +
     `pages/videos/[id].vue` (123 lines)
   - `pages/federation/users/[handle].vue` (153 lines) — federated
     profile view
   - `pages/admin/federation.vue` (110) + `pages/admin/api-keys.vue`
     (105)
   - `pages/docs/[siteSlug]/edit.vue` (630 — largest; but editor-only)
   Auth pages (`login.vue`, `register.vue`) were false positives —
   auth-layout wrapper already handles their responsive case, and
   `responsive.spec.ts` passes mobile tests for both.

2. **Session 130's deferred scaling projects.** Each is multi-session,
   explicitly deferred by `codebase-analysis/12-scaling-and-infrastructure.md`:
   - **Session store → Redis.** Move Better Auth sessions off Postgres
     onto Redis so auth survives multi-instance scale-out. Requires a
     Better Auth adapter config change + migration of existing sessions
     (or accept the 1-session-expiry cost).
   - **BullMQ for activity delivery.** Replace the in-process poll in
     `packages/server/src/federation/worker.ts` with a Redis queue.
     Decouples delivery workers from the app instance.
   - **API-response caching for public read API.** The `/api/public/v1/*`
     endpoints (session 127) are cacheable by route + scope. Redis
     keys with TTL, cache middleware at the route layer.

3. **Publish `@commonpub/infra@0.6.2` + `@commonpub/server@2.47.4`** so
   external consumers pick up `createStructuredLogger` + the
   apiKeyRateLimit structured-log wiring. Not urgent — prod rebuilds
   from source — but cleaner for the deveco-io repo's next pin bump.

### Incidental improvements surfaced this session

4. **Deploy workflow sync: compose file.** `.github/workflows/deploy.yml`
   only scp's the Docker image tarball. Changes to
   `deploy/docker-compose.prod.yml` (or `deploy/Caddyfile`) in the repo
   never reach droplets without manual sync. Session 131 shipped
   `--requirepass ${REDIS_PASSWORD:-changeme}` to the repo; it sat
   un-deployed until session 133 manually scp'd it. Fix: extend
   `deploy.yml` to scp the compose file (and Caddyfile) if it diffs.

5. **Publish trace-artifact retention tuning.** Currently 14 days
   regardless of pass/fail. On very high CI volume this would add up;
   for now it's negligible. If you hit GH Actions artifact quotas,
   reduce to 7 days or condition it further.

### Blocked on you

6. Unifying Redis auth between commonpub and deveco. Either add
   `--requirepass` to deveco's compose (defense-in-depth) or remove
   it from commonpub's (simpler, matches deveco). Neither is wrong;
   posture choice.

## Non-obvious things to know

Carryover from 132 + additions from 133:

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
  casts reimmediately reintroduces the error. A comment in the file
  explains; don't "clean it up."
- `@media (max-width: 768px)` is the mobile breakpoint convention used
  across the layer. Hero-banner + filter-toggle + /learn all use this.
- Playwright trace artifact upload is now unconditional-on-non-cancel
  (not just `failure()`). Flaky runs get a trace too. 14-day retention.
- `deploy.yml` only ships the Docker image tarball. Changes to
  `docker-compose.prod.yml` in the repo don't reach the droplet
  automatically. (Flagged as follow-up #4 above.)
- commonpub.io's docker-compose now matches the repo (session 133
  manually scp'd it). deveco.io's is still its own separate version.

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
