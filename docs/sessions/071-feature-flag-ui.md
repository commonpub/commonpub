# Session 071 — Feature-Flag-Aware UI + Production Readiness Sweep

**Date:** 2026-03-23
**Goal:** Make reference app UI respect feature flags; fix CLI scaffolder; production readiness sweep; repo cleanup for public release

---

## What Was Done

### CLI Scaffolder Rewrite (SvelteKit → Nuxt 3)
- Rewrote all Rust templates for Nuxt 3: nuxt.config.ts, package.json, app.vue, server utils, middleware, composables
- Added interactive feature selection (10 flags), auth methods, content types, contest permissions
- Added ResendEmailAdapter to @commonpub/infra + wired through server/CLI
- Added CLI flags for non-interactive mode: `--features`, `--content-types`, `--contest-creation`, `--no-docker`
- Feature-aware page generation + dynamic nav layout
- Published: @commonpub/infra@0.2.1, @commonpub/server@0.2.1, create-commonpub@0.2.0

### Feature Flag System (Phase 1)
- `server/utils/config.ts` now reads FEATURE_* env vars into defineCommonPubConfig()
- `nuxt.config.ts` exposes features, contentTypes, contestCreation in runtimeConfig.public
- New `useFeatures()` composable — typed reactive access to feature flags
- New `useContentTypes()` composable — parses enabled content types with metadata
- Flags propagate: .env → server config → Nuxt runtimeConfig → client composables

### Feature-Flag-Aware UI (Phase 2)
- `layouts/default.vue` — 12+ nav links gated (desktop, mobile, footer)
- `pages/index.vue` — tabs from useContentTypes(), sidebar sections gated
- `pages/create.vue` — content type cards filtered
- `layouts/admin.vue` — gated on admin flag + isAdmin role
- `pages/explore.vue`, `feed.vue`, `search.vue` — filters from config
- `pages/dashboard.vue` — learning tab gated
- `pages/u/[username]/index.vue` — profile tabs filtered
- `pages/about.vue`, `SearchSidebar.vue`, `ProjectView.vue` — links gated
- `pages/contests/index.vue` — Create Contest gated on contestCreation permission

### Bug Fixes
- Auth signup: send `username` field (not just `name`) in sign-up request body
- Component resolution: added `pathPrefix: false` to Nuxt components config
- Missing deps: @tiptap/pm, @opentelemetry/api added

---

### Production Readiness Sweep

#### Security + API Correctness
- Federation inbox guards: both inbox routes return 404 when `federation` flag is off
- HTTP Signature verification wired in both inbox routes using `verifyHttpSignature()` + `resolveActor()` from protocol package
- Conditional docs prerendering: `/docs/**` route rule skipped when `NUXT_PUBLIC_FEATURES_DOCS=false`
- CLI scaffolder Zod version fixed: `^3.24.0` → `^4.3.6` to match monorepo

#### Mobile Editor UX
- Touch-friendly cover image overlays: `@media (hover: none)` + `:focus-within` on ProjectEditor, ArticleEditor, BlogEditor
- Block library touch targets: padding increased from `6px 10px` → `10px 10px` for 44px WCAG minimum
- Floating toolbar viewport clamping: `Math.max`/`Math.min` prevents overflow on small screens
- Block wrapper controls: drag handle + control buttons always visible on touch devices
- Mobile slide-out sidebars: all 4 editors (Project, Article, Blog, Explainer) now have fixed sidebar slide-outs with toggle buttons + overlay instead of `display: none`

#### Type Safety
- Eliminated 26 production `as any` casts across 18 files (30 → 4 remaining, all non-production)
- ContentCard now typed with `Serialized<ContentListItem>` from `@commonpub/server`
- AuthorCard uses `ContentDetailAuthor`, AuthorRow uses `UserRef`
- All content list pages use typed `useFetch<PaginatedResponse<Serialized<ContentListItem>>>`
- Learning pages use typed `useLazyFetch<Serialized<LearningPathDetail>>`
- Server routes use proper input types (NotificationType, CreateContestInput)
- Exported `NotificationType` from `@commonpub/server`

#### Documentation Cleanup
- CLI README rewritten: all flags documented, Nuxt 3 generation, Phase 3 note
- Deployment docs: "Deploying a Scaffolded Site" section covering Docker, npm, S3, email
- ADR-014 fix: removed stale "guide" content type + "svelte:head" reference
- ADR-026 fix: updated design source of truth to `packages/ui/theme/`
- v1-limitations.md: federation roadmap links updated to federation-plan.md
- 5 skipped learning tests fixed: replaced `inArray` with `or(eq(...))` for PGlite compatibility, `deletePath` uses `.returning()` instead of `rowCount`

#### Repo Cleanup for Public Release
- **Deleted 10 research/ files** — all superseded by ADRs (010, 016, 017, 020, 021, 023)
- **Deleted ADR-001** (SvelteKit) — superseded by ADR-025 (Nuxt switch)
- **Deleted contributing.md** — redundant with CLAUDE.md
- **Archived sessions 034–046** to `docs/sessions/archived/` (pre-framework-switch era)
- **Consolidated 071-feature-flag-ui-plan.md** into main session log
- **Removed tracked uploads** — 18 demo images in `apps/reference/uploads/content/` (already gitignored)
- **Removed prime-mockups/** — 25 HTML design mockups (design system now in `packages/ui/theme/`)
- **Removed archive/** — 91 files of SvelteKit-era code and docs (preserved in git history)
- **Updated CLAUDE.md** — design source of truth → `packages/ui/theme/`, removed stale reference implementations section

---

## Architecture Audit Findings

### Reference App — Nuxt Best Practices ✓
- 61 pages, 142 API routes, 85 components, 11 composables — well-structured
- Auto-imports, runtimeConfig, file-based routing all used correctly
- No duplicated logic between server and client
- Composables focused and under 200 LOC each

### Package Abstractions — Assessed
| Package | Verdict |
|---------|---------|
| @commonpub/config | ✓ Essential — singleton feature flag system |
| @commonpub/schema | ✓ Essential — 53 Drizzle tables + Zod validators |
| @commonpub/protocol | ✓ Justified — federation complexity deserves isolation |
| @commonpub/server | ✓ Huge but necessary — 19K LOC, 221 imports from reference app |
| @commonpub/infra | ✓ Correctly focused — storage, email, security adapters |
| @commonpub/editor | ✓ Justified — 19 block types, used by 3 packages |
| @commonpub/learning | ✓ Justified — domain types + utilities |
| @commonpub/ui | ✓ Healthy — 22 headless components + 191 CSS tokens, fully themeable |
| @commonpub/test-utils | ✓ Lightweight, reduces test boilerplate |
| @commonpub/auth | ⚠️ Thin Better Auth wrapper — guards/SSO helpers valuable, core wrapper could be thinner |
| @commonpub/docs | ⚠️ Premature — only consumer is server, could fold into server/docs |
| @commonpub/explainer | ⚠️ Marginal — tightly coupled to learning, no independent reuse |

### UI / Theming System
- **191 CSS custom properties** covering surfaces, text, borders, accent, semantic colors, typography, spacing, shadows, z-index, layout
- **3 built-in themes**: light (base), dark, generics — switchable at runtime via `applyThemeToElement()`
- **100% headless components** — zero hardcoded colors, all `var(--*)`
- **Fully swappable**: create one CSS file with `:root` overrides, swap in nuxt.config.ts
- **80% shadcn-aligned** — same headless philosophy, different distribution model (npm vs copy-paste)
- CommonPub's approach is better for multi-instance federation (theme diversity + behavioral consistency)

---

## Key Decisions

1. **Features disabled via config flags, NOT file stripping** — all packages installed, all files on disk. Disabled = invisible in UI, not deleted. Users can re-enable later.
2. **ALL @commonpub/* packages must be in standalone sites** — even disabled features have files that Nuxt compiles. Missing packages cause build errors.
3. **CLI should copy reference app, not generate stubs** — Rust string templates produce broken, unstyled sites. Phase 3 (CLI rearchitecture) will embed the reference app.
4. **Design source of truth is packages/ui/theme/** — HTML mockups removed, CSS files are canonical.

---

## Open Items

- [ ] Phase 3: CLI rearchitecture (copy + patch approach)
- [ ] Email: works via ConsoleEmailAdapter (logs to server), no SMTP/Resend configured
- [ ] npm version of CLI (`create-commonpub` npm package)
- [ ] Consider folding @commonpub/docs into @commonpub/server
- [ ] Consider folding @commonpub/explainer into @commonpub/learning
- [ ] 4 minor hardcoded colors in forms.css/prose.css (code block bg, checkbox fill)

---

## Current State

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 25/25 pass |
| `pnpm build` | 14/14 pass |
| `pnpm test` | 29/29 suites, 0 skipped |
| `pnpm lint` | 0 errors, 15 warnings (pre-existing) |
| Production `as any` | 4 remaining (3 seed script, 1 Nitro limitation) |
| Feature flags | 10 flags wired end-to-end |
| UI flag-aware | 12+ files updated |
| Auth | Sign-up/sign-in working |
| Editor | Working (with @tiptap/pm fix) |
| Federation | Inbox routes gated + HTTP sig verified |
| Mobile editors | Touch targets, slide-out sidebars, viewport clamping |
| Repo cleanliness | No tracked binaries, secrets, or stale cruft |
