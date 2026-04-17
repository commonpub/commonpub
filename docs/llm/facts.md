# LLM Facts — CommonPub Architecture

Condensed, high-signal. Load this before touching code.

## Repo identity

- Name: CommonPub — open ActivityPub federation protocol and package suite for self-hosted maker communities.
- License: AGPL-3.0-or-later.
- Language: TypeScript strict. Vue 3 Composition API. Zod. Drizzle. Nuxt 3.
- Repo root: `/Users/obsidian/Projects/ossuary-projects/commonpub/`.

## Topology

```
apps/{reference, shell}  →  layers/base (@commonpub/layer)  →  packages/* (12 npm packages)
tools/create-commonpub   Rust CLI
tools/worker             delivery monitoring utilities
deploy/                  Docker, Caddyfile, DO app-spec
docs/                    human docs, ADRs, session logs
codebase-analysis/       raw inventory (generated — trust over older docs)
```

12 packages on npm as `@commonpub/*`:
schema, server, config, protocol, auth, ui, editor, explainer, learning, docs, infra, test-utils.

## Latest published versions (session 128, 2026-04-17)

- schema 0.14.2, server 2.45.1, config 0.11.0, layer 0.17.0
- ui 0.8.5, protocol 0.9.9, editor 0.7.9, explainer 0.7.12
- learning 0.5.0, docs 0.6.2, auth 0.5.1, infra 0.5.1, test-utils 0.5.3

## Database

- PostgreSQL 16 + Drizzle.
- **79 tables, 41 enums.** Full list: `codebase-analysis/02-schema-inventory.md`.
- Domains: auth, content, social, messaging, hubs, products, learning, docs, videos, contests, events, voting, federation, admin, files.
- Soft delete on: users, contentItems, hubs, federatedContent, federatedHubPosts.
- Denormalized counters pervasive (voteScore, entryCount, attendeeCount, memberCount, likeCount, etc.).
- `contentTypeEnum`: project, article, blog, explainer. **`article` is legacy — use `blog`** (session 116).

## Recent major additions (sessions 108–128)

- **108** URL restructure → `/u/{username}/{type}/{slug}` canonical
- **116** Article↔Blog merge
- **117** Contest system
- **118** Password reset, admin reports, video social, nav badges
- **119** Security hardening, HTML sanitizer, signed federation backfill
- **121** OAuth federation bugs fixed
- **122** Deep audit, hub resources/products, v1.0 completion
- **123** Destination phases 0+1+4+2 (editorial, runtime flags, homepage)
- **124** Destination phases 3+5+6+7 — **nav system, events, voting, contest judges**
- **125** Events UI polish, contest voting UI, error.vue SSR theme fix
- **126** Doc overhaul + scaling plan + typecheck fixes
- **127** Public Read API v1 (admin-managed bearer tokens, 13 read scopes, OpenAPI 3.1) + 8 bug fixes including critical drafts-leak + stored-XSS
- **128** **Docs unblock** + switched schema deploys from `drizzle-kit push` to committed migrations via `scripts/db-migrate.mjs` + fixed silent drift on both prod DBs

## Layer structure

`layers/base/` — the distribution unit.
- 85 pages (Nuxt file-based)
- 106 components
- 20 composables
- 257 API routes in `server/api/`
- AP routes in `server/routes/` (inbox, outbox, .well-known)
- 6 server plugins, 7 request middlewares
- 5 themes registered in `packages/ui/src/theme.ts` `BUILT_IN_THEMES` (base, dark, generics, agora, agora-dark)

## Server package structure

`packages/server/src/` modules:
admin, auth (identity), content, contest (+judges), docs, events, federation (10 files), homepage, hub (5 files), import, learning, messaging, navigation, notification, product, profile, search, social, video, voting.

Plus file-level utilities: email, hooks, image, oauthCodes, query, security, storage, theme, utils.

## Feature flags (15)

Default ON: content, social, hubs, docs, video, learning, explainers, editorial.
Default OFF: contests, events, federation, federateHubs, seamlessFederation, admin, emailNotifications.

Details: `codebase-analysis/08-feature-flags-inventory.md`.

## Thin-app pattern

A deployed instance is ~4 files extending the layer:
- `nuxt.config.ts` — `extends: ['@commonpub/layer']`
- `commonpub.config.ts` — feature flags + instance config
- `server/utils/config.ts` — Nitro-side config resolver: merges `commonpub.config.ts` defaults with `FEATURE_*` env vars and DB overrides from `instanceSettings.features.overrides` (cached 60s). Server handlers import from here.
- `components/SiteLogo.vue` — branded logo

Real example: `deveco.io` (~25 branded/config files extending the layer).

## Federation (ActivityPub)

- Pure-TS ActivityPub in `@commonpub/protocol` (no Fedify or external AP framework). `jose` for HTTP signatures.
- Better Auth + AP Actor SSO (Model B) for cross-instance login.
- Content federates with `cpub:type` extension — full fidelity CommonPub-to-CommonPub, falls back to AP Article for Mastodon/Lemmy.
- Hub federation: Group actors (FEP-1b12), session 083+, `federateHubs` flag.
- Instance mirroring: pull or push, per-domain, with filterContentTypes and backfillCursor.
- Circuit breaker per `instanceHealth` domain.
- HTTP Signatures with RSA 2048 via jose.

## Deployment

Two production instances (both auto-deploy from main on push):
- **commonpub.io** — DO, Docker+Caddy, self-hosted Postgres
- **deveco.io** — DO, Docker+Caddy, managed DO Postgres, thin consumer of layer

Deploy runs `scripts/db-migrate.mjs` (session 128+) which applies committed migrations from `packages/schema/migrations/` via `drizzle-orm/node-postgres/migrator.migrate()`. State tracked in `drizzle.__drizzle_migrations`. No prompts, no manual SQL. (Before session 128: deploys used `drizzle-kit push`, which blocked on TTY prompts for populated-table constraint changes and silently dropped DDL.)

## Where to read more

- Full inventory: `codebase-analysis/` (every table, route, component)
- Session logs: `docs/sessions/NNN-*.md` — newest is highest NNN, load most recent ones first for context
- ADRs: `docs/adr/` — architecture decisions
- Human guides: `docs/guides/users.md` + `docs/guides/developers.md`
