# Session 001: Foundation + Phase 1 Core

**Date**: 2026-03-09

## What Was Done

### Phase 0: Foundation (Complete)

- Moved HTML mockups to `docs/mockups/`
- Created monorepo structure with all directories
- Root configuration: `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `tsconfig.json`, `vitest.workspace.ts`, `playwright.config.ts`, `.prettierrc`, `.nvmrc`, `.npmrc`, `.gitignore`
- 10 package scaffolds: schema, protocol, auth, ui, config, docs, editor, explainer, learning, test-utils
- Apps: `apps/reference/` (SvelteKit + adapter-node), `tools/worker/`
- Infrastructure: `deploy/docker-compose.yml` (Postgres 16 + Redis 7 + Meilisearch 1.12)
- `.env.example` with all environment variables
- `.github/workflows/ci.yml` — CI pipeline
- Documentation: `CLAUDE.md`, `docs/plan.md`, `docs/contributing.md`, `docs/coding-standards.md`
- 8 ADRs (001–008): SvelteKit, Drizzle+Postgres, Better Auth, Fedify, TipTap, CSS tokens, feature flags, Turborepo

### Phase 1: Schema + Config + Tokens (In Progress)

#### @commonpub/config (Complete)

- `defineCommonPubConfig()` factory with Zod validation
- Feature flags: communities, docs, video, contests, learning, explainers, federation
- Auth config: emailPassword, magicLink, passkeys, OAuth, sharedAuthDb, trustedInstances
- Instance config: domain, name, description, contentTypes, maxUploadSize
- Warnings: sharedAuthDb Model C, federation without trusted instances, learning without explainers
- **17 tests passing**

#### @commonpub/schema (Complete)

- Drizzle tables ported from hack-build (25 tables) + deveco-io patterns:
  - **Auth**: users, sessions, accounts, organizations, members, federatedAccounts, oauthClients
  - **Content**: contentItems (unified), contentForks, tags, contentTags
  - **Social**: likes, follows, comments, bookmarks, notifications, reports
  - **Community**: communities, communityMembers, communityPosts, communityPostReplies, communityBans, communityInvites, communityShares
  - **Learning**: learningPaths, learningModules, learningLessons, enrollments, lessonProgress, certificates
  - **Docs**: docsSites, docsVersions, docsPages, docsNav
  - **Video**: videos, videoCategories
  - **Contest**: contests, contestEntries
  - **Files**: files
- All enums defined in `enums.ts`
- All Drizzle relations defined
- Zod validators for all create/update operations
- **34 tests passing**

#### CSS Token Surface (Complete)

- `packages/ui/theme/base.css` — complete token contract (colors, typography, spacing, shadows, borders, radii, transitions, z-index, layout, focus ring)
- `packages/ui/theme/deepwood.css` — CommonPub brand (forest greens, lime #b8f542, Raleway/DM Sans/DM Mono)
- `packages/ui/theme/hackbuild.css` — punk zine (paper #f5f0e6, ink #1a1a1a, accent #ff3366, hard-edge shadows, Permanent Marker)
- `packages/ui/theme/deveco.css` — clean tech (white, teal/pink, Poppins/Nunito, rounded corners)

### Verification

- `pnpm install` ✅
- `pnpm build` ✅ (24/24 tasks)
- `pnpm test` ✅ (24/24 tasks, 51 tests passing)

## Key Design Decisions

- **Unified content table**: `content_items` with `type` enum instead of separate tables per content type (project, article, guide, blog, explainer). Simpler queries, consistent social/tagging.
- **Normalized learning paths**: Separate `learning_modules` and `learning_lessons` tables instead of hack-build's nested JSON array. Better for progress tracking queries.
- **UUID primary keys**: Following deveco-io pattern (uuid with defaultRandom) instead of hack-build's Convex IDs.
- **Timestamps with timezone**: All timestamps use `withTimezone: true` per deveco-io pattern.

## Open Questions

- ESLint shared config location
- Husky + lint-staged timing
- Content items: should explainer sections live in `content` JSON or in `sections` JSON column?

## Next Steps

1. Phase 2: `@commonpub/auth` — Better Auth wrapper with createAuth() factory
2. Phase 2: `@commonpub/protocol` — Fedify integration, WebFinger, NodeInfo
3. Research: Fedify SvelteKit integration, Better Auth org plugin, AP Actor SSO
