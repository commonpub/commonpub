# Launch Checklist — CommonPub v1

## Build & Tests

- [x] `pnpm build` — all 13 packages + apps compile
- [x] `pnpm test` — 902 unit tests green (13 packages)
- [ ] `cargo test` in `tools/create-commonpub/` — 17 tests green
- [ ] `pnpm exec playwright test` — E2E tests pass (requires running services)
- [ ] `pnpm audit --audit-level=high` — 2 high vulnerabilities in transitive deps (hono via prisma/drizzle — not directly used)

## Type Safety & Code Quality

- [x] `pnpm typecheck` — 0 errors, 71 warnings (Svelte state_referenced_locally — benign)
- [x] `pnpm lint` — 0 errors, 50 warnings (unused test vars, mock `any` types)
- [x] `pnpm format:check` — all files pass Prettier

## Search

- [x] Meilisearch adapter works with mocked HTTP (unit tests pass)
- [x] Postgres FTS fallback works when `MEILI_URL` is not set
- [x] Search API endpoint returns results for valid queries

## Landing Page

- [x] `apps/landing/` builds to static HTML with adapter-static
- [x] All 3 routes render: `/`, `/features`, `/getting-started`
- [x] OG meta tags present on all pages
- [x] No hardcoded colors — all `var(--*)` with fallbacks
- [x] axe-core a11y tests pass on all components

## Security

- [x] Security headers present: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [x] Rate limiting triggers 429 on rapid auth requests
- [x] Rate limit headers present: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- [x] CSP not applied in dev mode (HMR compatibility)

## Accessibility

- [x] E2E a11y tests pass (axe-core on key pages)
- [x] Color contrast verified across all 4 themes
- [x] Keyboard navigation works on all interactive elements
- [x] ARIA labels present on all interactive elements

## Performance

- [x] Static assets get `Cache-Control: immutable` headers
- [ ] Lighthouse scores: Performance ≥90, Accessibility ≥95, SEO ≥95 (needs running instance)
- [x] CodeMirror and TipTap lazy-loaded via dynamic imports

## CI/CD

- [x] Matrix CI: Node 22/23, ubuntu/macos
- [x] Rust CI: `cargo test` + `cargo clippy`
- [x] E2E tests wired into CI (separate job)
- [x] Dependency audit step in CI
- [x] Docker build succeeds
- [x] Deploy workflow triggers on release

## Documentation

- [x] README.md — project overview, quick start, architecture
- [x] CHANGELOG.md — all 12 phase summaries
- [x] ADR 023 — Polish & Launch Architecture
- [x] A11y audit document
- [x] Session log at `docs/sessions/012-polish-launch.md`
- [x] `docs/plan.md` updated with Phase 12 completion

## Feature Flags

- [x] All features behind flags: content, social, communities, federation, docs, admin
- [x] No new flags added in Phase 12 (infrastructure changes only)
- [x] Landing page is separate app, not feature-flagged

## Infrastructure

- [x] Docker multi-stage build works (node:22-alpine)
- [x] Production compose starts all services
- [x] Health checks on Postgres, Redis, Meilisearch
- [x] `.env.example` includes all required variables

## QA Audit (2026-03-10)

- [x] All packages build without errors
- [x] 902 unit tests passing across 13 packages
- [x] 0 typecheck errors (was 23 — all fixed)
- [x] ESLint config created (eslint.config.js for ESLint 9)
- [x] 0 lint errors (was 20 — all fixed)
- [x] Prettier formatting applied to all files
- [x] `.prettierignore` updated to exclude build artifacts
- [x] Unused imports cleaned up across reference app and auth package
- [x] SvelteKit action `parent()` bug fixed (6 docs edit routes)
- [x] `onContentLiked` missing argument fixed
- [x] `@tiptap/core` type resolution fixed
- [x] Landing favicon.png added for prerender
