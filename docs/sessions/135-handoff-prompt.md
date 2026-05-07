# Session 135 → 136 Handoff

Fresh Claude Code context. Session 135 ran a meticulous nine-round
audit of the codebase, filed the findings at
`docs/sessions/135-audit.md`, then implemented all CERTAIN
findings worth shipping this week as five discrete change sets PLUS
follow-up tests, mobile-responsive work, and gotchas-doc updates
in one working tree (`docs/sessions/135-audit-fixes.md`). All gates
green; commits and publish are NOT yet done — the next session owns
review, commit, lockfile push, and npm publish.

## Orientation — read in order

1. `CLAUDE.md` — standing rules. Critical:
   - **Never add Claude as a git co-author.** No `Co-Authored-By:`,
     no `Signed-off-by:`, no AI attribution — in any commit, in any
     repo. (User re-emphasized this in session 135.)
   - No feature without a flag in `commonpub.config.ts`.
   - Schema changes via committed migrations + `scripts/db-migrate.mjs`,
     never `drizzle-kit push` in CI.
2. `docs/sessions/135-audit.md` — the audit findings ledger
   (30 CERTAIN, 3 LIKELY, 0 UNCERTAIN, 10 WITHDRAWN). Anchor for
   any "is X a known issue" question.
3. `docs/sessions/135-audit-fixes.md` — what landed in the
   working tree. Read before reviewing the diff.
4. `docs/sessions/134-handoff-prompt.md` and earlier — only if
   you need pre-135 context.
5. `CHANGELOG.md` — `Unreleased` section already has the session 135
   entry; review for accuracy and ride along with the chore-bumps PR.

## Current state (2026-05-05, end of session 135)

**Deployed and healthy** (no prod changes this session — code only):

| Site          | Host          | DB              | Redis    |
|---------------|---------------|-----------------|----------|
| commonpub.io  | DO droplet    | self-hosted PG  | with auth, password in droplet `.env` |
| deveco.io     | DO droplet    | DO managed PG   | no auth, container-network isolation |

**Working tree state:** dirty. **44 files modified, 6 new, 2 deleted** (52 total changes).

The diff broadly groups into three rounds of work:

**Round A — original audit-fix PRs (PR 1–5 in this handoff):**
- `.gitignore` — `design-system-v2/`
- `apps/reference/package.json`, `apps/shell/package.json`,
  `layers/base/package.json` — workspace pinning + version bumps
- `codebase-analysis/README.md` — stale banner
- `deploy/Caddyfile` — 128MB body cap on catch-all
- `deploy/migrations/*` — DELETED (orphan)
- `layers/base/components/{ContentPicker,ImportUrlModal,RemoteFollowDialog}.vue`
  — wired `useFocusTrap`
- `layers/base/composables/useFocusTrap.ts` — NEW
- `layers/base/layouts/default.vue` — skip-to-content link
- `layers/base/nuxt.config.ts` — `htmlAttrs.lang` + Font Awesome SRI
- `layers/base/server/api/content/[id]/view.post.ts` — `.unref()`
- `layers/base/server/api/image-proxy.get.ts` — refactor onto `safeFetchBinary`
- `layers/base/server/api/realtime/stream.get.ts` — per-user 10-conn cap
- `packages/infra/{package.json, src/image.ts, src/storage.ts, src/__tests__/storage.test.ts}`
  — sharp `limitInputPixels`, S3 fail-fast + test
- `packages/schema/{package.json, src/social.ts, migrations/0003_*, migrations/meta/_journal.json, migrations/meta/0003_snapshot.json}`
  — UNIQUE index on notifications + migration (NEW SQL + snapshot)
- `packages/server/package.json` — 2.47.4 → 2.48.0
- `packages/server/src/{content/content.ts, federation/delivery.ts, federation/inboxHandlers.ts, federation/messaging.ts, import/ssrf.ts, index.ts, notification/notification.ts, search/contentSearch.ts}`
  — content of the 5 PRs (see `135-audit-fixes.md`)

**Round B — additional work after the initial handoff was written:**
- `packages/server/src/__tests__/import-ssrf.test.ts` — added 7 tests for `safeFetchBinary`
- `packages/server/src/__tests__/notification.integration.test.ts` — added 4 dedup tests
- `packages/schema/src/social.ts` — switched declaration from
  `unique('name').on(...)` (table-level constraint) to `uniqueIndex(...)`
  because drizzle-kit's `pushSchema` silently drops table-level
  constraints (the integration tests caught this)
- `packages/schema/migrations/0003_notifications_dedup.sql` — regenerated
  to match (CREATE UNIQUE INDEX instead of ALTER TABLE … ADD CONSTRAINT)
- `packages/server/src/notification/notification.ts` — strengthened the
  unique-violation catch to handle Drizzle's wrapped error (`err.code`,
  `err.cause?.code`, regex on `err.message`)
- `packages/{auth,docs,explainer,learning,protocol,server}/package.json`
  — switched their `@commonpub/schema` (and `@commonpub/explainer` in
  learning) deps from `^x.y.z` to `workspace:*`. **Reason:** the npm-published
  schema 0.14.4 was being preferred over the workspace's 0.15.0,
  hiding the new dedup index from PGlite tests. Same pattern reasoning
  as the apps/* in Round A.

**Round C — mobile a11y, more modal a11y, doc updates:**
- `layers/base/components/PublishErrorsModal.vue` — wired `useFocusTrap`
  (the fourth modal; it was missed in Round A's pass)
- `layers/base/pages/admin/federation.vue` — `@media (max-width: 768px)`:
  stats grid 4-col → 2-col, tabs scroll, form column-stacks, activity
  rows shrink
- `layers/base/pages/admin/api-keys.vue` — `@media`: table becomes
  horizontally scrollable, usage drawer 1-col, action buttons stack
- `layers/base/pages/federation/users/[handle].vue` — `@media`: header
  column-stacks, follow + DM buttons full-width, stats wrap
- `docs/llm/gotchas.md` — added "Session 135 — audit-fix invariants"
  section (8 invariants, including the `pushSchema` constraint quirk
  caught in Round B)
- `CHANGELOG.md` — Unreleased section extended with the full session
  135 entry

**New files (??):** `docs/sessions/135-audit.md`,
`docs/sessions/135-audit-fixes.md`, `docs/sessions/135-handoff-prompt.md`
(this file), `layers/base/composables/useFocusTrap.ts`,
`packages/schema/migrations/0003_notifications_dedup.sql`,
`packages/schema/migrations/meta/0003_snapshot.json`.

**Pending package versions (not yet published):**

| Package              | Current workspace | Last published | Bump kind |
|----------------------|-------------------|----------------|-----------|
| `@commonpub/server`  | 2.48.0            | 2.47.4         | minor — new exports |
| `@commonpub/schema`  | 0.15.0            | 0.14.4         | minor — new migration |
| `@commonpub/infra`   | 0.6.3             | 0.6.2          | patch — added arg |
| `@commonpub/layer`   | 0.19.0            | 0.18.3         | minor — new composable + behavior |
| config 0.11.0, explainer 0.7.12, ui 0.8.5, protocol 0.9.9, editor 0.7.9, docs 0.6.2, auth 0.5.1, learning 0.5.2, test-utils 0.5.3 | unchanged |

## Open items (do these in order)

### 1. Review and commit the working tree

Each PR-shaped change set should commit atomically. Suggested
breakdown (matches `135-audit-fixes.md` + the Round B/C additions):

1. `feat(server,infra,layer): SSRF + body-cap + sharp DoS hardening` —
   ssrf.ts, image-proxy.get.ts, image.ts, server/index.ts. **HIGH
   security wins (close 2 HIGH + 1 MED finding).**
2. `feat(server): federation delivery hardening — SSRF guard +
   structured logging` — inboxHandlers.ts, delivery.ts.
3. `feat(schema,server,layer): notification dedup + SSE per-user
   connection cap` — schema/social.ts (uniqueIndex form), migration,
   notification.ts (try/catch with wrapped-error handling), stream.get.ts.
4. `feat(layer): useFocusTrap composable for modal a11y` — composable
   + 4 modal Vue files (Content/ImportUrl/RemoteFollow/PublishErrors).
5. `feat(layer): mobile responsive for admin/federation pages` —
   `@media` blocks for `pages/admin/federation.vue`,
   `pages/admin/api-keys.vue`, `pages/federation/users/[handle].vue`.
   (Closes session 134's open #1 work.)
6. `test(server): coverage for safeFetchBinary + notification dedup` —
   7 new ssrf tests (redirect re-validation, streaming size cap,
   contentType, redirect-chain limit) + 4 new dedup integration tests
   (collapse, mark-read-then-refire, system notifs don't dedup,
   different actors don't collide).
7. `chore: LOW-severity hygiene cleanup` — .gitignore,
   deploy/migrations delete, default.vue (skip-link),
   nuxt.config.ts (lang+SRI), view.post.ts (.unref), storage.ts
   (+ test), contentSearch.ts, content.ts, federation/messaging.ts,
   codebase-analysis/README.md, Caddyfile.
8. `chore(deps): workspace pinning + version bumps` — bump server
   2.48.0, schema 0.15.0, infra 0.6.3, layer 0.19.0. Switch all
   workspace consumers (apps/{reference,shell}, layers/base, and
   sub-packages auth/docs/explainer/learning/protocol/server) to
   `workspace:*` for in-monorepo deps. Lockfile churn included.
9. `docs(sessions,llm): 135 audit + audit-fixes + handoff +
   gotchas` — three new `docs/sessions/135-*` files, gotchas.md
   "Session 135 — audit-fix invariants" section, CHANGELOG.md
   Unreleased entry.

After commits, `pnpm install --frozen-lockfile` should be a no-op.

**Do NOT add Claude as co-author** to any of these commits.

### 2. Publish the four bumped packages to npm

In dependency order:

```
pnpm --filter @commonpub/schema publish --access public --no-git-checks
pnpm --filter @commonpub/infra  publish --access public --no-git-checks
pnpm --filter @commonpub/server publish --access public --no-git-checks
pnpm --filter @commonpub/layer  publish --access public --no-git-checks
```

Verify each landed:
```
npm view @commonpub/schema version    # should show 0.15.0
npm view @commonpub/server version    # 2.48.0
npm view @commonpub/infra version     # 0.6.3
npm view @commonpub/layer version     # 0.19.0
```

### 3. Apply the schema migration on prod

Both droplets need `0003_notifications_dedup.sql` applied. Per the
existing deploy flow, the next push to `main` triggers
`scripts/db-migrate.mjs` inside the running container which picks up
the new migration from `/app/schema/migrations/`.

The migration has TWO statements (separated by
`--> statement-breakpoint`):

1. **DELETE duplicate rows** in `notifications` for any
   `(user_id, type, actor_id, link)` tuple where both `actor_id` and
   `link` are non-null. Keeps the newest row per tuple (tie-break on
   `id`). **Critical for prod safety:** without this, the `CREATE
   UNIQUE INDEX` below would fail on any database that accumulated
   like→unlike→like notification spam pre-migration. If commonpub.io
   or deveco.io has any user with even one repeat-like history,
   the deploy aborts mid-migration without this DELETE.
2. **CREATE UNIQUE INDEX** `uq_notif_user_type_actor_link`.

To inspect duplicate counts BEFORE deploy (peace of mind):

```
ssh root@commonpub.io \
  'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c \
   "SELECT count(*) FROM (SELECT user_id, type, actor_id, link, count(*) AS c FROM notifications WHERE actor_id IS NOT NULL AND link IS NOT NULL GROUP BY 1,2,3,4 HAVING count(*) > 1) dup"'
```

If the result is 0, the DELETE is a no-op and the migration
matches what drizzle-kit would have generated. If the result is > 0,
the DELETE runs first and deletes that many minus one row per tuple.

Verify post-deploy:

```
ssh root@commonpub.io \
  'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "SELECT * FROM drizzle.__drizzle_migrations"'
```

Expect to see four rows after deploy. The index is
`uq_notif_user_type_actor_link`; verify with `\d+ notifications`.

### 4. Sync compose changes to droplets (manual scp — known gap)

The Caddyfile and `docker-compose.prod.yml` aren't auto-synced by
`.github/workflows/deploy.yml` (session 134 open item #3). After
PR 6/7 merge, scp the Caddyfile to commonpub.io:

```
scp deploy/Caddyfile root@commonpub.io:/opt/commonpub/
ssh root@commonpub.io \
  'cd /opt/commonpub && docker compose -f docker-compose.prod.yml restart caddy'
```

deveco.io has its own separate Caddyfile (per session 133 notes); if
deveco wants the same body-size cap, mirror the change there.

### 5. (Optional, deferred) Redis healthcheck auth

The audit's #9 finding — `deploy/docker-compose.prod.yml` Redis
healthcheck doesn't authenticate. **Not fixed this session.** When
ready, change the line:

```yaml
    healthcheck:
-     test: ['CMD', 'redis-cli', 'ping']
+     test: ['CMD-SHELL', 'redis-cli -a "$$REDIS_PASSWORD" ping | grep -q PONG']
```

Then scp the compose file to commonpub.io (deveco doesn't use
`--requirepass` so its healthcheck is fine as-is).

## Non-obvious things to know

Carryover from sessions 130–134, plus what 135 added:

- `RateLimitStore.check()` is async; `checkRateLimit()` is async.
- Turbo 2.x strips env vars unless declared on the task (see
  `turbo.json`'s `test` env array — `DATABASE_URL`,
  `NUXT_DATABASE_URL`, `REDIS_URL_TEST`, `CI` already there).
- Redis pub/sub subscriber MUST keep `enableOfflineQueue: true`;
  publisher is fast-fail.
- `rsvpEvent` uses `ON CONFLICT DO NOTHING` on
  `event_attendees_event_user_unique`.
- `federated_content.mirror_id` FK is `ON DELETE SET NULL`.
- `QuizGrade` has a `results` field. `.toMatchObject(...)` over
  `.toEqual(...)` for quiz assertions.
- The learn-lesson viewer relies on server `results` for per-question
  correctness — the GET-lesson response REDACTS `correctOptionId` +
  `explanation` for non-authors.
- `layers/base/composables/useAuth.ts` contains two `$fetch` casts
  that silence TS2589. Verified upstream in session 133.
- `@media (max-width: 768px)` is the mobile breakpoint convention.
- `@commonpub/infra` exports `createStructuredLogger` since session 133.
- **Session 135 additions:**
  - `@commonpub/server` exports `safeFetch`, `safeFetchBinary`,
    `isPrivateUrl`, `SafeFetchOptions` from
    `packages/server/src/import/ssrf.ts`. Use these for any new
    server-side fetch of remote content.
  - **Notification dedup is implemented as try-INSERT, on 23505 do
    UPDATE.** NOT `ON CONFLICT DO UPDATE` — PGlite (the test DB)
    rejects partial-index inference even with literal full UNIQUE
    constraints. The try/catch path works on both PGlite and real
    Postgres. If you change `createNotification`, keep the
    try/catch shape — don't "clean it up" to ON CONFLICT.
  - **Notifications now have a UNIQUE constraint** on
    `(user_id, type, actor_id, link)`. Postgres NULL-distinct
    semantics mean system notifications (no actor + no link) stay
    non-deduplicated. If a future caller wants an "always
    independent" notification with both actor and link, that's not
    currently possible at the schema level — would need a new
    `dedup_key` column or a different approach.
  - **SSE has a per-user cap of 10 connections.** Module-level Map
    in `realtime/stream.get.ts`. Multi-instance scale-out: each
    Nitro process has its own Map, so effective cap is `10 × N`.
  - **Modal a11y is via the `useFocusTrap` composable**, not
    `<Dialog>` from `@commonpub/ui`. The composable adds focus
    trap, Esc, scroll lock, and focus restore to any
    `role="dialog"` div. Wire from `<script setup>` with a ref to
    the dialog element + an `isOpen` getter + a close callback.
- **Workspace pinning convention.** `apps/reference`,
  `apps/shell`, and `layers/base` now use `workspace:*` for all
  `@commonpub/*` deps. Don't reintroduce `^x.y.z` pinning — it
  causes pnpm to prefer the previously-published npm version when
  the workspace bumps a minor. `pnpm publish` replaces `workspace:*`
  with the actual version at publish time, so external npm
  consumers see real ranges.

## Deploy safety — failure modes for migration 0003

Migration 0003 is the only schema change shipping this session, and
it has the highest deploy risk because it runs DELETE on prod data
before creating the new index. Failure modes and mitigations:

**Failure mode A: many duplicates exist, DELETE takes too long.**
The DELETE is `DELETE FROM notifications a USING notifications b WHERE …`
which is a self-join. On notifications with N rows and many dupes,
this is O(N²) without a supporting index on `(user_id, type, actor_id, link)`.
For typical CommonPub notification volumes (single-digit thousands)
this completes in subsecond time. If commonpub.io's notifications
table has accumulated to >100k, expect 1-10s; >1M and we're in
multi-minute territory.

Mitigation: pre-deploy duplicate-count query in §3 above. If it
returns a high number, consider applying the migration in a
maintenance window. Typical CommonPub instances should be safe.

**Failure mode B: race during migration creates new duplicates.**
The migration runs in a single drizzle-managed transaction
(BEGIN ... COMMIT around DELETE + CREATE INDEX). DELETE acquires
ROW EXCLUSIVE; CREATE INDEX upgrades to ACCESS EXCLUSIVE. Concurrent
INSERT (also ROW EXCLUSIVE) is COMPATIBLE with DELETE, so a new
duplicate could squeeze in between DELETE-finish and CREATE
INDEX-acquire. CREATE INDEX would then fail with `could not create
unique index`.

Mitigation: the deploy script restarts the app container before
running the migration (per `.github/workflows/deploy.yml`), and the
new container's first 5s sleep gives the connection pool time to
warm. App-level traffic during the migration window is brief. If a
race does occur, **the migration is idempotent and safe to re-run** —
the second pass finds the new duplicate, deletes it, and the index
creates successfully. drizzle's migrator only marks a migration
applied AFTER the transaction commits, so a failed run leaves
`__drizzle_migrations` unchanged and the next run retries.

**Failure mode C: migration applied but app is broken.**
If app code is buggy (e.g., the try/INSERT-then-UPDATE-on-23505
catch path doesn't trigger correctly on real Postgres), users would
see 500s on social-action notifications. The index itself is
harmless to have in place.

Mitigation:
- The dedup integration test in `notification.integration.test.ts`
  exercises the catch-path against PGlite. The error-code matching
  (`err.code` || `err.cause?.code` || regex on message) handles both
  PGlite and node-postgres error wrappings, verified.
- If a runtime issue surfaces, the cheapest rollback is **roll
  forward** with a hotfix — drop the index in a 0004 migration:
  ```sql
  DROP INDEX IF EXISTS uq_notif_user_type_actor_link;
  ```
  Then revert `createNotification` to its pre-session-135 INSERT-only
  shape and ship. Don't try to roll back 0003 in-place — that
  creates a hash mismatch in `__drizzle_migrations` and confuses
  future migrations.

**Failure mode D: deveco-io picks up new packages incompatibly.**
deveco-io pins `@commonpub/layer@^0.18.1` per session 134's
handoff; `^0.18.1` does NOT match the new 0.19.0. So deveco-io
won't auto-upgrade until someone bumps its pin. Same for schema
(deveco-io uses npm packages, not workspace). This is BY DESIGN —
session 134 documents that deveco-io upgrades are explicit.

Mitigation: when deveco-io is ready to upgrade, bump its
`@commonpub/layer` pin to `^0.19.0` and `@commonpub/schema` to
`^0.15.0` simultaneously, run `pnpm install` in deveco-io, commit
the lockfile, deploy. Deveco's deploy will then run the same
migration 0003 against deveco's database.

## Pre-deploy operator script (commonpub.io)

Run BEFORE pushing to main:

```bash
# 1) Confirm CI is green on the branch you're about to merge
gh -R commonpub/commonpub run list --branch <branch> --limit 1

# 2) Inspect potential duplicate count on prod (read-only)
ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "
  SELECT
    count(*) AS dup_tuples,
    sum(c) AS rows_to_delete
  FROM (
    SELECT user_id, type, actor_id, link, count(*) - 1 AS c
    FROM notifications
    WHERE actor_id IS NOT NULL AND link IS NOT NULL
    GROUP BY 1,2,3,4
    HAVING count(*) > 1
  ) dup"'

# 3) Confirm migration count is currently 3
ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "
  SELECT count(*) FROM drizzle.__drizzle_migrations"'
```

If step (2) returns >10000 rows-to-delete, run during a low-traffic
window. Otherwise proceed.

## Post-deploy verification (commonpub.io)

Run AFTER the deploy workflow completes:

```bash
# 1) Migration count should be 4
ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "
  SELECT count(*) FROM drizzle.__drizzle_migrations"'

# 2) The new index exists
ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "
  SELECT indexname FROM pg_indexes WHERE tablename = '\''notifications'\''"'

# 3) No duplicates remain
ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "
  SELECT count(*) FROM (
    SELECT 1 FROM notifications
    WHERE actor_id IS NOT NULL AND link IS NOT NULL
    GROUP BY user_id, type, actor_id, link
    HAVING count(*) > 1
  ) leftover_dups"'
# Expected: 0

# 4) Health check
curl -fsS https://commonpub.io/api/health
# Expected: {"status":"ok"}

# 5) SSE rate-limit cap (smoke test — optional)
# Open the network tab in the dashboard, hard-refresh repeatedly;
# the 11th /api/realtime/stream connection should 429
```

If step (3) returns >0, something is very wrong — file an incident.

## Semver finding worth flagging for next-bump session

I edited `auth/docs/explainer/learning/protocol`'s `package.json`
to switch their `@commonpub/schema` dep from `^0.14.3` to
`workspace:*` (for workspace-internal cohesion — pnpm was preferring
the previously-published 0.14.4 over the workspace's 0.15.0,
which masked the dedup index in tests). These five packages are NOT
being republished this session — their npm-registry artifacts still
carry the old `^0.14.3` pin.

**Implication for deveco-io after publishes complete:**

When `@commonpub/schema@0.15.0` and `@commonpub/server@2.48.0` ship
to npm, deveco-io's resolver may end up with two schema versions:

- `auth@0.5.1` (transitive via `@commonpub/layer`) → pulls schema `^0.14.3` → 0.14.4
- `server@2.48.0` (transitive via `@commonpub/layer`) → pulls schema `^0.15.0` → 0.15.0

These are non-overlapping ranges, so pnpm/npm installs both copies
in different `node_modules` paths.

**Runtime impact analysis:**

| Package | Schema usage | Risk if duplicated |
|---|---|---|
| auth | `import * as schema` (runtime values, Better Auth's drizzleAdapter) | Both copies hit the same physical DB table; Drizzle table identity differs but SQL queries succeed. Practical impact: works, but slight install-size cost. |
| docs | declares dep, never imports | Pure manifest cruft. Cleanup: remove the dep on next bump. |
| explainer | declares dep, never imports | Same. |
| learning | imports Zod schemas only | No Drizzle table identity issue. |
| protocol | declares dep, never imports | Same. |

**Net: deveco-io will function correctly after the publishes**, but
it will install schema twice. To clean this up, the next session
that bumps any of these five packages should:

1. For docs/explainer/protocol: remove the unused `@commonpub/schema`
   dep entirely from `package.json`.
2. For auth/learning: keep the dep, with `workspace:*`. At publish
   time, pnpm replaces with `^0.15.x` (current schema), which
   matches the rest of the deveco tree. No more duplicate.
3. Bump the package versions and republish. Now deveco's tree is
   single-schema.

This is documented but NOT urgent. Skip for the immediate deploy.

## Standing rules

- **Never add Claude as co-author** — no `Co-Authored-By:`,
  `Signed-off-by:`, no AI attribution anywhere, ever. (User
  re-emphasized this in session 135.)
- **Conventional commits** — `feat(infra):`, `fix(auth):`,
  `chore(deps):`, `docs(sessions):`, etc.
- **Atomic commits.** One logical change per commit.
- **`pnpm publish`**, never `npm publish`.
- **Schema changes via committed migrations** — never
  `drizzle-kit push` in CI.
- **After any `package.json` version change, run
  `pnpm install --frozen-lockfile` locally** before pushing.

## Quick reference

- Migration state:
  `ssh root@commonpub.io 'docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "SELECT * FROM drizzle.__drizzle_migrations"'`
- Redis keys on commonpub (password required):
  `ssh root@commonpub.io 'cd /opt/commonpub && PW=$(grep ^REDIS_PASSWORD= .env | cut -d= -f2) && docker exec commonpub-redis-1 redis-cli -a "$PW" --scan --pattern "cpub:*"'`
- Redis keys on deveco (no auth):
  `ssh root@deveco.io 'docker exec deveco-redis-1 redis-cli --scan --pattern "cpub:*"'`
- CI runs for the current branch:
  `gh -R commonpub/commonpub run list --branch main --limit 3`
- Publish a single package:
  `pnpm --filter @commonpub/<pkg> publish --access public --no-git-checks`
- Verify published version:
  `npm view @commonpub/<pkg> version`
- Notifications dedup-key check (post-deploy):
  `psql -c "SELECT user_id, type, actor_id, link, count(*) FROM notifications GROUP BY 1,2,3,4 HAVING count(*) > 1"` —
  expect 0 rows except for system-notif duplicates with both NULLs.
- Session logs at `docs/sessions/` are the authoritative
  recent-changes record. When `codebase-analysis/` or `docs/llm/`
  contradicts a session log, trust the log.
