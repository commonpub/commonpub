# Research: Polish & Launch (Phase 12)

## 1. Meilisearch SDK Patterns

### Official JS Client (`meilisearch` npm package)

- `new MeiliSearch({ host, apiKey })` — client init
- `client.index('name')` — get/create index reference
- `index.addDocuments(docs, { primaryKey })` — upserts by PK
- `index.search(query, { filter, limit, attributesToHighlight })` — search with filtering
- `index.deleteDocuments(ids)` — bulk delete by primary key
- Filterable attributes must be declared: `index.updateFilterableAttributes(['siteId', 'versionId'])`
- Searchable attributes configurable: `index.updateSearchableAttributes(['title', 'headings', 'content'])`
- Highlighting: `_formatted` field on results when `attributesToHighlight` is set

### Index Strategy

- One index per site: `docs_{siteId}` — isolates data, allows per-site settings
- Document primary key: `pageId` (natural unique ID)
- Filter by `versionId` at query time (not separate indexes per version)
- Ranking rules: default (words, typo, proximity, attribute, sort, exactness) sufficient for docs

### Adapter Pattern

- Interface with `index()`, `search()`, `delete()` methods
- Factory function checks `MEILI_URL` env var to select implementation
- Postgres adapter wraps existing `to_tsvector`/`to_tsquery` logic
- Meilisearch adapter wraps `meilisearch` npm client
- Both return same `SearchResult` type

## 2. CSP & Security Header Best Practices

### Content-Security-Policy

- `default-src 'self'` — baseline
- `script-src 'self' 'unsafe-inline'` — SvelteKit needs inline for hydration
- `style-src 'self' 'unsafe-inline'` — CSS custom properties + inline styles
- `img-src 'self' data: https:` — allow external images + data URIs
- `font-src 'self'` — self-hosted fonts only
- `connect-src 'self'` — API calls to same origin
- `frame-ancestors 'none'` — prevent embedding (replaces X-Frame-Options)
- Report-only mode for initial deployment: `Content-Security-Policy-Report-Only`

### Other Security Headers

- `X-Content-Type-Options: nosniff` — prevent MIME sniffing
- `X-Frame-Options: DENY` — legacy browser fallback for frame-ancestors
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — HSTS (prod only)
- `Referrer-Policy: strict-origin-when-cross-origin` — minimal referrer leak
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — disable unused APIs

### SvelteKit Integration

- `handle` hook in `hooks.server.ts` — set headers on every response
- Use `sequence()` to compose with existing auth/theme hooks
- Avoid CSP on dev mode (hot reload needs eval)
- Static assets get longer cache headers

## 3. Rate Limiting

### Sliding Window Algorithm

- Key: `ratelimit:{ip}:{route}` — per-IP, per-route-group
- Window: 60 seconds, configurable per route
- Limits: auth routes (10/min), API routes (60/min), general (120/min)
- In-memory Map for dev, Redis INCR + EXPIRE for prod
- Return `429 Too Many Requests` with `Retry-After` header

### Implementation

- Hook checks path prefix to determine rate limit tier
- Skip rate limiting for static assets (/\_app/, /favicon)
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers

## 4. adapter-static for Landing Pages

### SvelteKit adapter-static

- `@sveltejs/adapter-static` — prerender all pages at build time
- Config: `adapter({ pages: 'build', assets: 'build', fallback: undefined })`
- All routes must be prerenderable (no server-side logic)
- `export const prerender = true` in root layout
- Output: flat HTML files + static assets

### Landing Page Patterns

- Hero section with tagline + CTA buttons
- Feature cards with icons/descriptions
- Code snippet for quick start (syntax highlighted)
- Footer with links, copyright, social
- Responsive: mobile-first, CSS Grid/Flexbox
- Share theme CSS via `@commonpub/ui/theme/*.css` imports

## 5. Lighthouse Performance Budgets

### Targets (WCAG 2.1 AA + Performance)

- Performance: ≥ 90
- Accessibility: ≥ 95
- Best Practices: ≥ 90
- SEO: ≥ 95

### Optimization Strategies

- Cache static assets with long max-age (1 year for hashed assets)
- `Cache-Control: public, max-age=31536000, immutable` for `/_app/` assets
- Lazy load heavy components (CodeMirror, TipTap) via dynamic imports
- Preconnect to external origins if used
- Image optimization: width/height attributes, loading="lazy"

### Lighthouse CI

- `@lhci/cli` package for CI integration
- Config in `lighthouserc.js` with budget assertions
- Run against built app in CI (separate job)
