# Session 128 — Docs unblock + drizzle-kit migrate bootstrap + learn audit

Date: 2026-04-17

## Context

User reported docs "can't add pages" on commonpub.io. Session brief also
called for a full learning-paths lifecycle audit, and — explicitly — for a
fix that eliminates the recurring need to hand-edit SQL when schema
changes touch enums or constraints.

## Root cause: docs was silently broken because CI had stopped applying schema

`docs_pages` on commonpub.io production was missing the `sidebar_label` and
`description` columns that were added in commit `7bffcef` (Apr 13). Every
endpoint that does `db.select().from(docsPages)` or `.returning()` expanded
to SELECT-star over columns the DB didn't have → 500:

- `GET /api/docs/:siteSlug/pages` 500
- `GET /api/docs/:siteSlug/nav` 500
- `POST /api/docs/:siteSlug/pages` 500 (inside `createDocsPage`)
- `PUT /api/docs/:siteSlug/pages/:pageId` 500

Only `search` worked because it projected explicit columns. The user's UI
experience: page tree failed to load on edit, new-page POST returned 500.

**Why the columns were missing.** The deploy runs `scripts/db-push.mjs`
which wraps `drizzle-kit push --force`. Once a row landed in
`instance_mirrors` (first federation subscription on Mar 29), push started
hitting an interactive prompt:

```
· You're about to add instance_mirrors_remote_domain_unique unique
  constraint to the table, which contains 1 items. Do you want to truncate?
Error: Interactive prompts require a TTY terminal
```

The prompt fired because the DB's existing unique constraint on
`remote_domain` was named `_key` (PG default) and drizzle expected `_unique`
(its generated name from `.unique()`). Same semantics, different name →
drizzle saw it as a new constraint → prompts on a populated table → CI has
no TTY → `pgSuggestions` throws BEFORE applying any queued DDL.

Net effect: every deploy since ~Mar 29 silently failed to apply any new
schema. Earlier column additions made it in; `sidebar_label`/`description`
(Apr 13) and `api_keys`/`api_key_usage` (Apr 17) did not.

## Fix (done)

### 1. Renamed mismatched unique constraints on both prod DBs

Nine constraints across both DBs, all with the same pattern
(`{table}_{col}_key` → `{table}_{col}_unique`), applied atomically in a
transaction. Tables touched: `content_categories`, `events`,
`federated_content`, `federated_hub_posts`, `federated_hub_products`,
`federated_hub_resources`, `federated_hubs`, `hub_actor_keypairs`,
`instance_mirrors`.

Also renamed the three `api_keys` / `api_key_usage` foreign keys from the
PG default `*_fkey` to drizzle's `*_users_id_fk` / `*_api_keys_id_fk` form.

### 2. Applied missing additive schema via `drizzle-kit push`

On commonpub.io, after renames, `db-push.mjs` ran clean and added
`docs_pages.sidebar_label` / `description` (pending since Apr 13).

On deveco.io, push still blocked on a spurious `content_builds_user_content`
prompt (existing constraint with 3 rows — drizzle-kit 0.31.10 false
positive), so missing pieces were applied by hand:
- `docs_pages.sidebar_label`, `docs_pages.description`
- `mirror_status` + `mirror_direction` enums
- `instance_mirrors.status` varchar → `mirror_status` enum (value `active`)
- `instance_mirrors.direction` varchar → `mirror_direction` (value `pull`)
- `api_keys`, `api_key_usage` tables + indexes + FKs
- Dropped dead `docs_nav` table (removed in code in session ~116)

Both DBs verified against the generated baseline migration — zero drift.

### 3. Bootstrapped `drizzle-kit migrate` workflow

To prevent recurrence. `drizzle-kit push` prompts can't be reliably
auto-answered in CI; `drizzle-kit migrate` executes committed `.sql` files
without prompts and tracks state in `drizzle.__drizzle_migrations`.

- Regenerated `packages/schema/migrations/` with a fresh
  `0000_session128_baseline.sql` capturing the full current schema.
  (Original `0000_slippery_marvex.sql` from Apr 5 archived to
  `migrations.bak-session128/`.)
- Pre-seeded `drizzle.__drizzle_migrations` on both prod DBs with the
  baseline's sha-256 hash + `when` timestamp, so migrate sees it as already
  applied.
- Bumped `@commonpub/schema` to **0.14.2** and added `migrations/` to the
  npm `files` field so deveco (and any other consumer) gets the migration
  files when installing.
- Updated both Dockerfiles to ship the migrations folder into the runtime
  image (`/app/schema/migrations` on commonpub,
  `/app/node_modules/@commonpub/schema/migrations` on deveco).
- Updated both drizzle configs' `out:` path to match the new locations.
- Replaced `db-push.mjs` with a new `db-migrate.mjs` that calls
  `drizzle-orm/node-postgres/migrator.migrate()` directly. (The
  `drizzle-kit migrate` CLI exits non-zero even on success because its
  `renderWithTask` spinner wrapping is buggy; the underlying
  `drizzle-orm` function is reliable.) Lives in `scripts/` in both repos.
- Updated `.github/workflows/deploy.yml` (commonpub) and
  `deploy-prod.yml` (deveco) to call `db-migrate.mjs` instead. Deploy now
  **fails fast** on migration errors rather than continuing past silent
  failures.

### 4. Backups

Pre-work `pg_dump -F c` snapshots saved to `/root/db-backups/` on both
droplets before any DDL was executed.

## Docs audit — other findings

No other bugs in the docs flow beyond the schema drift. Verified:
- Site CRUD (`POST /api/docs`, `PUT /api/docs/:slug`, `DELETE`)
- Page CRUD (`POST/PUT/DELETE` on pages)
- Reorder + reparent (`POST /api/docs/:slug/pages/reorder`, `PUT pageId`)
- Versioning (`POST /api/docs/:slug/versions`, `?version=` query)
- Publish/unpublish (`status` field in `PUT`)
- Viewer at `/docs/:siteSlug/:pagePath` (catchall)
- Search (`GET /api/docs/:slug/search?q=`)
- Feature gate: deveco.io with `features.docs=false` correctly 404s
  the routes via `feature-gate.global.ts` + `server/middleware/features.ts`.

Confirmed by curl on commonpub.io after fix: `/api/docs/yolo/pages`,
`/api/docs/yolo/nav`, `/api/docs/yolo/search?q=test` all 200.

## Learn audit — two real findings, deferred

Lifecycle is structurally complete (path CRUD, module/lesson CRUD,
publish, enroll, progress, certificate lookup, unenroll, delete). The
session-127 drafts-leak fix is in place
(`/api/learn` status whitelist).

**Two bugs found, not fixed this session** (orthogonal to the docs work
and worth a dedicated review):

1. **Quiz score self-report → certificate gaming.**
   `POST /api/learn/:slug/:lessonSlug/complete` accepts `quizScore` and
   `quizPassed` from the client body and writes them into
   `lesson_progress` without any server-side grading.
   A caller can POST `{quizScore:100, quizPassed:true}` for any quiz lesson
   and trigger certificate issuance on 100% completion.
   Location: `layers/base/server/api/learn/[slug]/[lessonSlug]/complete.post.ts:12`
   → `packages/server/src/learning/learning.ts:626 markLessonComplete`.

2. **Quiz correct answers leak to the client.**
   `GET /api/learn/:slug/:lessonSlug` returns `lesson.content` verbatim.
   For quiz lessons (`lessonContentSchema.quizContentSchema`) the JSON
   includes `correctOptionId` for every question.
   Location: `packages/learning/src/validators.ts:47`.
   Public-API serializers (`/api/public/v1/learn/:slug`) DO strip the
   questions array, but the logged-in-user endpoint does not.

Fix sketch for both: add a server-side grader that takes chosen
`optionId[]` and returns the score + passed flag; strip `correctOptionId`
from responses except to the path author. Tracked as P2.

## Operator-facing change: committing schema changes from now on

The workflow going forward is:

1. Edit `packages/schema/src/*.ts`.
2. Run `pnpm --filter=@commonpub/schema db:generate` locally (needs a
   TTY; generates the next `000N_*.sql` migration + snapshot).
3. Commit the generated SQL + `meta/0000_snapshot.json` update +
   `meta/_journal.json` update along with the TS changes.
4. Bump `@commonpub/schema`'s version if publishing; deveco and any other
   consumers update their pin.
5. On deploy, `scripts/db-migrate.mjs` runs automatically and applies any
   new migrations. No prompts, no manual SQL, no silent failures.

`scripts/db-push.mjs` is retained as a dev-time convenience (for
`pnpm --filter=@commonpub/schema db:push` against a local dev DB) but is
no longer called by CI.

## Deployment order (next pushes)

This session's repo changes must land in a specific order:

1. **commonpub**: push `main` → rebuild image with migrations folder and
   `db-migrate.mjs` → deploy runs migrate → baseline is already recorded as
   applied → exit 0 → done.
2. **Publish `@commonpub/schema@0.14.2`** to npm via `pnpm publish`
   (adds `migrations/` to the published tarball).
3. **deveco**: after step 2, bump the `@commonpub/schema` pin to ^0.14.2,
   push `main` → rebuild image (Dockerfile now copies the migrations
   folder from node_modules) → deploy runs migrate → exit 0.

## Open / not done

- Quiz security (findings 1 & 2 above) — separate fix.
- Commonpub e2e still red (pre-existing). Haven't walked through the
  remaining failures (`editor.spec.ts:69/85`, `navigation.spec.ts:29`,
  `smoke.spec.ts:132`) yet; docs-related ones should now clear once the
  deploy lands.
- `audittest` user cleanup (session 127 incident) — admin's call.
