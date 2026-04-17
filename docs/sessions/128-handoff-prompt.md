# Session 128 → 129 Handoff

Context-reset prompt for a fresh Claude Code instance continuing work on
CommonPub.

## Repo orientation — read these first

1. `CLAUDE.md` — project rules (auto-loaded). **Standing rules are hard constraints.**
2. `docs/llm/facts.md` — condensed architecture (always load)
3. `docs/llm/conventions.md` — code style, naming
4. `docs/llm/gotchas.md` — non-obvious pitfalls (updated session 128 with the
   migrate-based schema workflow that replaced `drizzle-kit push`)
5. `docs/llm/task-recipes.md` — step-by-step flows (also session-128 updated)

Deep reference: `codebase-analysis/` (13 files). `docs/public-api.md` for
the Public Read API added in session 127. `docs/sessions/128-docs-and-learn-audit.md`
for the full session-128 log including the deep-audit follow-up.

## Current state (2026-04-17)

**Deployed and stable on both instances:**
- commonpub.io — Droplet + self-hosted Postgres, Docker + Caddy
- deveco.io — Droplet + managed Postgres (DO), Docker + Caddy
- Both auto-deploy on push to main; **`scripts/db-migrate.mjs` applies committed
  migrations** (no more `drizzle-kit push` — see session 128)

**Published versions:**
- `@commonpub/schema` **0.14.2** (adds `migrations/` to npm tarball)
- `@commonpub/server` **2.45.1** (publicApi module + phase-2 serializers + usage)
- `@commonpub/config` **0.11.0** (`publicApi` feature flag, default false)
- `@commonpub/layer` **0.17.0** (public API middleware + endpoints + admin UI)
- `@commonpub/explainer` **0.7.12** (XSS fixes — session 127)
- `@commonpub/ui` 0.8.5, `protocol` 0.9.9, `editor` 0.7.9, `learning` 0.5.0,
  `docs` 0.6.2, `auth` 0.5.1, `infra` 0.5.1, `test-utils` 0.5.3

**Schema state:**
- 79 tables, 41 enums, 112 FKs, 54 unique constraints
- Baseline migration: `packages/schema/migrations/0000_session128_baseline.sql`
- Both prod DBs seeded with `drizzle.__drizzle_migrations` marking baseline as applied
- Fresh installs apply it cleanly on first deploy (verified end-to-end)

**CI status:** server 893 unit + integration + 39 publicApi tests passing;
typecheck green; Rust create-commonpub green. **commonpub e2e has 3 pre-existing
flakes** unrelated to recent work (see Open threads).

## What session 128 shipped

### Docs "can't add pages" — root cause + fix

`docs_pages` on commonpub.io was missing `sidebar_label` and `description`
columns. Every endpoint that used `db.select().from(docsPages)` or
`.returning()` 500'd. The underlying reason: CI deploys had been silently
dropping schema changes for weeks.

### Silent schema drift — why

`drizzle-kit push` in CI blocked on a prompt: an `instance_mirrors` unique
constraint name mismatch (PG default `_key` vs drizzle's `_unique`) on a
populated table. `pgSuggestions` throws when `isTTY` is false, aborting the
entire push before applying any DDL. This had been happening since the
first federation row landed on Mar 29.

### Systemic fix — migrate workflow

- Retired `drizzle-kit push` in CI. Generated a fresh baseline migration
  `0000_session128_baseline.sql` that captures the full current schema.
- Both prod DBs pre-seeded with the baseline as applied so the first
  post-switch deploy was a verified no-op.
- `scripts/db-migrate.mjs` now calls `drizzle-orm/node-postgres/migrator.migrate()`
  directly. **Note:** not `drizzle-kit migrate` — its `renderWithTask` CLI
  spinner exits non-zero on success and swallows errors.
- `@commonpub/schema@0.14.2` publishes `migrations/` in the npm tarball so
  deveco (any downstream consumer) receives SQL migration files.
- Both Dockerfiles copy migrations into the runtime. Both GH Actions
  deploy workflows now fail hard on migration errors.

### Deveco drift cleanup (from deep audit)

Deveco had accumulated more drift than commonpub because it was bootstrapped
separately. Fixed in the audit pass:
- 40 FK constraints renamed from PG default `_fkey` → drizzle's `_fk`
- 3 missing enum values added (`comment_target_type.video`,
  `contest_status.cancelled`, `like_target_type.video`)
- 10 missing performance indexes created
- `hub_followers_fed.status` converted varchar → `follow_relationship_status`
- Dropped extra `content_items_slug_unique`, `idx_fedhubposts_object_uri`
- Post-fix: both DBs byte-for-byte equivalent in columns/enums/indexes/FK semantics

### Docs sweep

Every non-archive, non-session doc that referenced `drizzle-kit push` or
"apply SQL manually" was rewritten for the new flow. Covered: 14 files
across `docs/`, `codebase-analysis/`, root README, CHANGELOG, deveco README.

### Backups

Both DBs snapshotted to `/root/db-backups/{commonpub,deveco}-20260417-*.dump`
on the respective droplets before any DDL.

## Open threads, in rough priority

### 1. Quiz security (discovered in session-128 learn audit; deferred)

Two real bugs, both P2:

- **Quiz score self-report → certificate gaming.**
  `POST /api/learn/:slug/:lessonSlug/complete` accepts `quizScore` and
  `quizPassed` from the client body and writes them into `lesson_progress`
  without server-side grading. Users can POST `{quizScore:100, quizPassed:true}`
  for any quiz lesson. Location:
  `layers/base/server/api/learn/[slug]/[lessonSlug]/complete.post.ts:12`
  → `packages/server/src/learning/learning.ts:626 markLessonComplete`.
- **Quiz correct answers leak to client.**
  `GET /api/learn/:slug/:lessonSlug` returns lesson content verbatim. For
  quiz lessons, the JSON includes `correctOptionId`. Location:
  `packages/learning/src/validators.ts:47`. The public-API serializers DO
  strip quiz questions, but the logged-in-user endpoint doesn't.

**Fix sketch** (~1 day): server-side grader in `markLessonComplete` that
takes chosen `optionId[]`, scores against `correctOptionId`, returns the
result; strip `correctOptionId` from `GET lesson` response for non-authors.

### 2. Docs FTS search indexes raw JSON as text

`searchDocsPages` in `packages/server/src/docs/docs.ts:531` builds
`to_tsvector(lang, title || ' ' || content)`. Since `content` is jsonb, PG
coerces it to its JSON text form — so the search tokenizes `"paragraph"`,
`"html"`, brackets, quotes, etc. Search still works for the real text
content (because the HTML fragments contain the words), but snippets look
ugly (`[["paragraph",{"html":""}]]` in the UI). Fix: extract block text
before building the tsvector. ~1 hour.

### 3. Commonpub e2e still red (pre-existing, not from session 128)

Three failing tests in the CI workflow (deploy succeeds independently):
- `auth.spec.ts:98` — Register form fields accept input
- `navigation.spec.ts:29` — Homepage hero banner dismiss button
- `smoke.spec.ts:132` — Console errors on /contests page

Session-127 had two docs-related failures (editor.spec.ts:69/85) and a
navigation flake. The docs ones **cleared after session 128's fix**. These
three remain.

### 4. Public API phase 3 (deferred, tracked)

- Redis-backed rate limit (in-process Map today; multi-instance blocks on it)
- Write scopes via OAuth2 client-credentials
- Webhook subscriptions (reverse of the API)
- `read:federation` scope is reserved in the enum but unwired
- Auto-generate OpenAPI from Zod schemas (hand-written today; drift risk)
- Per-user Personal Access Tokens

### 5. Known data/infra limitations

- `federatedContent.mirrorId` has no DB-level FK (enforced in app code only)
- `eventAttendees` lacks `unique(eventId, userId)` — duplicate RSVP possible under race
- 3 integration tests skipped for PGlite incompat (advisory locks + extension types)
- Rate-limit store ephemeral in-process (security.ts IP limiter + apiKeyRateLimit)
- Redis container provisioned in docker-compose but unused by code
- Pre-existing `useAuth.ts` TS2589 deep-instantiation error in shell
- ~70 layer components without `@media` breakpoints (mobile sweep pending)

### 6. Residual admin cleanup from session 127

- Test account `audittest` (id `a2dde266-2019-49b9-9a66-b6cba74cd13d`) on
  commonpub.io still needs admin deletion. Low urgency.

## Standing rules (don't violate)

From `CLAUDE.md`:

- The schema IS the work — schema changes come before UI
- No feature without a flag in `commonpub.config.ts`
- No hardcoded colors or fonts — always `var(--*)`
- AP actor SSO = Model B only; shared auth DB = Model C, operator opt-in
- No federation before two instances with real content (we now have both)
- Never add Claude as co-author in git commits — no `Co-Authored-By`,
  `Signed-off-by`, or any AI attribution, in ANY commit, in ANY repo

## Schema change recipe (new as of session 128)

1. Edit `packages/schema/src/*.ts`.
2. `pnpm --filter=@commonpub/schema db:generate` locally (requires a TTY).
3. **Commit** the generated `migrations/000N_*.sql` + `meta/_journal.json` +
   `meta/000N_snapshot.json` in the same commit as the TS change.
4. Bump `@commonpub/schema` version. If downstream consumers pin it, publish
   via `pnpm publish` and bump the consumer's pin.
5. Push to main. CI runs `scripts/db-migrate.mjs` which applies pending
   migrations via `drizzle-orm/node-postgres/migrator.migrate()` and records
   state in `drizzle.__drizzle_migrations`. No TTY prompts, no manual SQL,
   fails hard on errors.

`drizzle-kit push` is **legacy** — retained for local dev iteration only,
never called by CI. `scripts/db-push.mjs` lives but isn't invoked.

## Quick deployment facts

- Push to `main` on either repo = auto-deploy
- Deploy runs `node scripts/db-migrate.mjs` (session 128+)
- Migration folder:
  - commonpub: `/app/schema/migrations/` (Dockerfile COPY from `packages/schema/migrations`)
  - deveco: `/app/node_modules/@commonpub/schema/migrations/` (from the published npm tarball)
- Both images have the migrations baked in; verify with
  `docker exec <container> ls /app/schema/migrations/` (commonpub) or
  `/app/node_modules/@commonpub/schema/migrations/` (deveco)
- Feature flags default off where listed in the schema; existing
  `commonpub.config.ts` files don't need updating for new flags
  (`defineCommonPubConfig` takes `Partial<features>`)

## Next session kick-off suggestions

Most user value per unit of work, roughly in order:

**Pick A — Quiz security fixes** (~1 day, ship in one session)
Quiz score self-report + answer leak. Compact, self-contained, closes a
real cheating vector before anyone builds a learning path that matters.
Write server-side grader in `markLessonComplete`, update
`POST /complete` to take `optionId[]`, strip `correctOptionId` from `GET
lesson` responses for non-authors. Tests included. Published as
`@commonpub/server` minor bump.

**Pick B — Docs FTS snippet fix** (~1 hour, ship anytime)
Extract block text from BlockTuple[] before tokenizing. Search UX-only;
no schema changes. Could be a warm-up for something bigger.

**Pick C — Redis integration for rate limit + SSE** (~2-3 days, medium lift)
Already provisioned, currently unused. Wiring it enables:
- Multi-instance rate limit (currently an in-process Map — attacker can
  split requests across Nitro processes and 2× the limit)
- Cross-instance SSE fanout (currently single-instance)
Both are session-127 "phase 3" groundwork that'd reduce scaling debt.
Introduces a real external dep on Redis — worth weighing.

**Pick D — Public API phase 3 slice** (~larger; pick 1 of 4)
Webhook subscriptions OR OAuth2 client-credentials writes OR Personal
Access Tokens OR auto-generated OpenAPI from Zod. Each is its own
initiative; probably better once quiz + FTS are done.

My recommendation: **A then B this session, C next.** A closes a real
security gap before learning paths get real data. B is a free UX win.
C earns its complexity once we have something to scale.
