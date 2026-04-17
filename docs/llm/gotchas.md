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

- **`drizzle-kit push` fails in CI when you introduce a new enum.** It prompts for confirmation and CI has no TTY. Apply the enum SQL manually via `psql` on each deployed DB BEFORE the push.
- **`drizzle-kit push` can silently skip some changes.** Always verify with `\d+ <table>` in psql.
- **Schema changes in packages/schema require bumping `@commonpub/schema`.** Consumers pin it.

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
- **`eventAttendees` has no unique constraint on (eventId, userId).** Duplicate RSVP is possible in a race. Server dedupe is the only defense.
- **`federatedContent.mirrorId` has no FK.** Enforced in app code only.
- **Always verify `/api/events` status whitelist** (session 125 security fix). Only `published`, `active`, `upcoming`, `past`, `featured`, `mine` are honored.

## UI / theming

- **No hardcoded colors or fonts.** Always `var(--*)`. Session 096 did a 698-replacement sweep to enforce this.
- **Federated content uses local components.** Don't create parallel federation-only component trees. Session 122 found several that had drifted.

## Git

- **Never add Claude as co-author.** No `Co-Authored-By`, `Signed-off-by`, AI attribution — in any commit, in any CommonPub repo.

## Testing

- **3 integration tests skipped for PGlite incompat** (advisory locks, certain extension types). Don't "fix" by rewriting — running against real Postgres passes them.
- **Stryker full-repo takes 30+ minutes.** Use per-package targets.

## Deployment

- **commonpub.io and deveco.io auto-deploy on push to main.** Deploy runs `drizzle-kit push`. If it fails (enum issue), the deploy fails and the app stays on the old code.
- **deveco.io uses DO managed Postgres.** `NUXT_DATABASE_URL` is from the managed DB connection string, not Docker.

## Session awareness

- **Session logs are the source of truth for recent changes.** When reference docs contradict session logs, trust the log.
- **CHANGELOG** has an Unreleased section covering sessions 108–125. Previous tagged release: v0.2.0 (2026-03-23).
- **Handoff prompts** in `docs/sessions/NNN-handoff-prompt.md` are context-reset notes. Load the most recent if continuing work.

## Build-time prerender

- **Never `prerender: true` on data-fetching routes.** Docker build has no DB; the prerenderer saves 500 HTML as the static output and ships it. Use `swr: 60` or `isr: true` (runtime + cache) instead. See `codebase-analysis/09-gotchas-and-invariants.md`.

## Security

- **Every `v-html` in `@commonpub/explainer` must wrap with `sanitizeHtml()`** from `packages/explainer/vue/utils/sanitize.ts` at the render site. `clickable-cards/Viewer.vue` and `toggle/Viewer.vue` missed this (session 127 fix) — stored XSS vector for any registered user, also reachable via federation. Don't rely on ingest-side sanitization alone; audit rule is `grep -rn 'v-html=' packages/explainer/` and require `sanitizeHtml(` in the same file.

## Nitro server/routes vs server/middleware

- **`server/routes/foo/[x].ts` returning `undefined` sends HTTP 204 — it does NOT fall through to a Nuxt page at the same path.** If you need "AP response for AP Accept, render the Nuxt page for browsers" at the same URL, it MUST live in `server/middleware/` not `server/routes/`. Only middleware lets undefined fall through. This bit `/hubs/:slug` and `/hubs/:slug/posts/:postId` (session 127) — every hub detail page returned 204 with an empty body on refresh. `server/middleware/content-ap.ts` has the canonical docstring spelling out this rule. Before adding a new AP endpoint at a URL that has a Nuxt page, check that it's middleware, not a route.

## useState key collisions

- **`useState(key, initializer)` only runs the initializer ONCE per request.** If two call sites use the same key with different initializers, whichever runs first wins — the other's initializer is silently ignored. Was the root cause of the session 126 SSR-500 bug on `/docs`, `/learn`, `/videos`, `/explainer`: `feature-gate.global.ts` initialized `useState('feature-flags', () => null)` before the layout's `useFeatures()` got to init with real defaults. Pattern: export ONE `getInitialFlags()` from `composables/useFeatures.ts` and use it in every `useState('feature-flags', ...)` call site.
