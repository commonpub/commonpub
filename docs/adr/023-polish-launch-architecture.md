# ADR 023: Polish & Launch Architecture

## Status

Accepted

## Context

Phase 12 delivers polish and hardening for v1 launch. We need Meilisearch integration for docs search, a static landing page, security hardening, and launch documentation.

## Decisions

### 1. Meilisearch Search Adapter

**Decision**: `SearchAdapter` interface in `@commonpub/docs` with factory-selected implementation.

- `SearchAdapter` interface: `index()`, `search()`, `delete()` methods
- `PostgresAdapter`: wraps existing `to_tsvector`/`to_tsquery` logic extracted from reference app
- `MeilisearchAdapter`: uses `meilisearch` npm client, one index per site (`docs_{siteId}`)
- `createSearchAdapter(config)`: factory selects by `MEILI_URL` presence
- Postgres FTS remains default fallback — Meilisearch is transparent upgrade

**Rationale**: Adapter pattern allows zero-config Postgres search for simple deployments while supporting Meilisearch for scale. No feature flag needed — selection is automatic based on environment.

### 2. Landing Page

**Decision**: `apps/landing/` with `@sveltejs/adapter-static`, sharing `@commonpub/ui` theme CSS.

- Separate SvelteKit app with static adapter (fully prerendered)
- 3 routes: `/`, `/features`, `/getting-started`
- 5 components: Hero, FeatureCard, CodeBlock, Footer, Nav
- Imports `@commonpub/ui/theme/base.css` for consistent theming
- No feature flags needed — separate app, not a feature toggle

**Rationale**: Static site is simpler to deploy (CDN, GitHub Pages), has better performance than SSR, and keeps the landing page decoupled from the reference app.

### 3. Security Hardening

**Decision**: CSP headers + rate limiting in SvelteKit hooks, dependency audit in CI.

- **Security headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy via `securityHook` in `sequence()`
- **Rate limiting**: sliding window, in-memory for dev, Redis for prod, per-route tiers (auth: 10/min, API: 60/min, general: 120/min)
- **Dependency audit**: `pnpm audit --audit-level=high` added to CI

**Rationale**: Security headers are table-stakes for production. Rate limiting prevents abuse of auth and API endpoints. Dependency audit catches known vulnerabilities before deploy.

### 4. No New Feature Flags

**Decision**: Phase 12 adds no new feature flags.

- Landing page is a separate app (no flag)
- Meilisearch is transparent adapter upgrade (no flag)
- Security headers are unconditional (no flag)
- Rate limiting is unconditional (no flag)

**Rationale**: These are infrastructure concerns, not user-facing features. Feature flags are for features that operators may want to disable.

## Consequences

- `@commonpub/docs` gains `meilisearch` dependency (optional peer dep pattern)
- `apps/landing/` added to workspace and turbo pipeline
- `hooks.server.ts` gains two new hooks in the sequence chain
- CI pipeline expands with audit step and matrix testing
