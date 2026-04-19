# LLM Gotchas — CommonPub

Non-obvious pitfalls. Read before making changes that touch these areas.

Full version: [`codebase-analysis/09-gotchas-and-invariants.md`](../../codebase-analysis/09-gotchas-and-invariants.md).
This file is the short version.

## Build & publish

- **pnpm, not npm.** `npm publish` ships workspace:* literals that break installs.
- **Verify `dist/` exports before publishing.** `pnpm build` can silently drop exports — look inside `dist/index.d.ts` and confirm the public API you expect.
- **`pnpm update` touches lockfile too.** Commit both.
- **After local `pnpm build` of a package, consumer typecheck may see stale types.** Fix: `pnpm install --prefer-offline` in the consumer repo.

## Database

- **Schema changes go through committed migrations, not `drizzle-kit push`.** After editing `packages/schema/src/*.ts`, run `pnpm --filter=@commonpub/schema db:generate` locally (needs a TTY), commit the resulting `packages/schema/migrations/000N_*.sql` + `meta/` updates alongside the TS changes. CI deploy runs `scripts/db-migrate.mjs` which calls `drizzle-orm/node-postgres/migrator.migrate()` directly and records state in `drizzle.__drizzle_migrations`. No prompts in CI, no manual SQL.
- **Do not use `drizzle-kit push` in CI.** It blocks on interactive prompts (populated-table constraint changes, varchar→enum conversions, rename detection) and silently drops all queued DDL when it throws. The session-128 docs outage was caused by this — the push had been failing for weeks. `db-push.mjs` remains only for dev-time convenience against a local DB.
- **Do not call `drizzle-kit migrate` directly in CI either** — its `renderWithTask` spinner exits non-zero on success and swallows error output. `scripts/db-migrate.mjs` uses the underlying drizzle-orm function which is reliable.
- **Schema changes in packages/schema require bumping `@commonpub/schema`.** Consumers pin it. The `migrations/` folder ships in the npm package (declared in `files`), so deveco and other consumers get the SQL too.

## Nuxt / Nitro

- **`server/utils/config.ts` is the Nitro-side config resolver, not a proxy re-export.** It merges build-time `commonpub.config.ts` with env-var overrides (`FEATURE_*`) and DB overrides from `instanceSettings.features.overrides` (cached 60s). Server handlers import from `~/server/utils/config`, not directly from the config file. See `apps/reference/server/utils/config.ts` for the canonical implementation.
- **New imports into API routes can 404 in prod.** Nitro externalizes node_modules; if an import wasn't reachable before, Nitro may not bundle it. Add to `nitro.externals.inline` if needed.
- **`useLazyFetch` inside Suspense** instead of `useFetch` to avoid render races (session 124 fix).
- **`error.vue` must re-apply data-theme** via `useHead` — error pages render outside the layout tree on SSR.

## Federation

- **Don't enable `federation: true` without a peer to federate with.** The delivery worker polls forever.
- **`cpub:type`, `cpub:metadata`, `cpub:blocks`, `cpub:postType` are wire format.** `cpubType`/`cpubBlocks`/`cpubMetadata` are the local DB column names; the AP JSON fields use the colon-namespaced form. Changing the wire names breaks interop between CommonPub instances on different versions. Version the mapper if you must change.
- **AP Actor SSO = Model B only** (OAuth2 + WebFinger). Shared auth DB (Model C) is operator opt-in and strongly discouraged.
- **Signed backfill required for protected outboxes** (session 119). If backfill returns 401, verify your instance keypair is registered.

## Content & schema

- **`article` is legacy.** Use `blog`, `project`, or `explainer`. Schema still has `article` in `contentTypeEnum` but it normalizes to `blog` (session 116 merge).
- **`eventAttendees` has UNIQUE (eventId, userId)** as of migration 0002 (session 130 follow-up). `rsvpEvent` uses `ON CONFLICT DO NOTHING` to handle double-click races — no longer a 500 on race; the second attempt falls through to the "already registered" path.
- **`federatedContent.mirrorId` has an FK** to `instance_mirrors.id` with `ON DELETE SET NULL` as of migration 0002. Orphans that predated the FK (3 rows on commonpub.io) are nulled by the migration.
- **Always verify `/api/events` status whitelist** (session 125 security fix). Only `published`, `active`, `upcoming`, `past`, `featured`, `mine` are honored.
- **Quiz lessons are graded server-side** (session 129). `GET /api/learn/:slug/:lessonSlug` runs `redactQuizAnswers` for non-authors: `correctOptionId` + `explanation` are stripped from each question. The viewer CANNOT grade locally — it must POST answers to `/complete` and render `quiz.results` from the response (added session 133). Canonical shape: `{type:'quiz', passingScore, questions:[{id, options:[{id,text}], correctOptionId, explanation?}]}`. If you see someone reinstate a client-side `correctIndex` or local score computation, they've silently broken grading for every learner.

## UI / theming

- **No hardcoded colors or fonts.** Always `var(--*)`. Session 096 did a 698-replacement sweep to enforce this.
- **Federated content uses local components.** Don't create parallel federation-only component trees. Session 122 found several that had drifted.

## Git

- **Never add Claude as co-author.** No `Co-Authored-By`, `Signed-off-by`, AI attribution — in any commit, in any CommonPub repo.

## Testing

- **3 integration tests skipped for PGlite incompat** (advisory locks, certain extension types). Don't "fix" by rewriting — running against real Postgres passes them.
- **Stryker full-repo takes 30+ minutes.** Use per-package targets.

## Deployment

- **commonpub.io and deveco.io auto-deploy on push to main.** Deploy runs `scripts/db-migrate.mjs` (session 128 migration switch) which applies any new `.sql` migrations committed in `packages/schema/migrations/`. Deploy fails hard on migration errors rather than continuing past silent failures.
- **deveco.io uses DO managed Postgres.** `NUXT_DATABASE_URL` is from the managed DB connection string, not Docker.

## Session awareness

- **Session logs are the source of truth for recent changes.** When reference docs contradict session logs, trust the log.
- **CHANGELOG** has an Unreleased section covering sessions 108–125. Previous tagged release: v0.2.0 (2026-03-23).
- **Handoff prompts** in `docs/sessions/NNN-handoff-prompt.md` are context-reset notes. Load the most recent if continuing work.

## Build-time prerender

- **Never `prerender: true` on data-fetching routes.** Docker build has no DB; the prerenderer saves 500 HTML as the static output and ships it. Use `swr: 60` or `isr: true` (runtime + cache) instead. See `codebase-analysis/09-gotchas-and-invariants.md`.

## Security

- **Public API serializers are ALLOW-lists.** Every `/api/public/v1/*` response is built by an explicit `to*` helper in `packages/server/src/publicApi/serializers.ts` that names each field — never spread (`{ ...row }`) user/content/hub rows into responses. If a new private column lands in the DB, the serializer excludes it by default. Tests in `publicApi.test.ts` assert known-private names (email, passwordHash, role, ...) never appear in any response body.
- **Every `v-html` in `@commonpub/explainer` must wrap with `sanitizeHtml()`** from `packages/explainer/vue/utils/sanitize.ts` at the render site. `clickable-cards/Viewer.vue` and `toggle/Viewer.vue` missed this (session 127 fix) — stored XSS vector for any registered user, also reachable via federation. Don't rely on ingest-side sanitization alone; audit rule is `grep -rn 'v-html=' packages/explainer/` and require `sanitizeHtml(` in the same file.

## Nitro server/routes vs server/middleware

- **`server/routes/foo/[x].ts` returning `undefined` sends HTTP 204 — it does NOT fall through to a Nuxt page at the same path.** If you need "AP response for AP Accept, render the Nuxt page for browsers" at the same URL, it MUST live in `server/middleware/` not `server/routes/`. Only middleware lets undefined fall through. This bit `/hubs/:slug` and `/hubs/:slug/posts/:postId` (session 127) — every hub detail page returned 204 with an empty body on refresh. `server/middleware/content-ap.ts` has the canonical docstring spelling out this rule. Before adding a new AP endpoint at a URL that has a Nuxt page, check that it's middleware, not a route.

## useState key collisions

- **`useState(key, initializer)` only runs the initializer ONCE per request.** If two call sites use the same key with different initializers, whichever runs first wins — the other's initializer is silently ignored. Was the root cause of the session 126 SSR-500 bug on `/docs`, `/learn`, `/videos`, `/explainer`: `feature-gate.global.ts` initialized `useState('feature-flags', () => null)` before the layout's `useFeatures()` got to init with real defaults. Pattern: export ONE `getInitialFlags()` from `composables/useFeatures.ts` and use it in every `useState('feature-flags', ...)` call site.
